---
id: operations/esa-performance-optimization-20260831
type: implementation-plan
status: verified
last_inspected_at: 2026-09-01
last_verified_at: 2026-09-01
---

# ESA 接入后的访问与刷新性能优化计划

## 1. 目标与边界

本计划针对前厅、书房、博客以及全站刷新机制，按“先正确、再减少传输、最后降低源站压力”的顺序实施。

目标：

- 刷新后能看到应当更新的内容，不被旧 Service Worker 缓存遮蔽。
- 用户数据、认证响应、RSC、HTML 和 SSE 不进入浏览器公共缓存或 ESA 公共缓存。
- 重复访问尽量复用带 hash 的静态资源和安全的公开资源。
- 降低前厅、书房和博客的请求数、JSON 体积、图片传输量和源站数据库访问。
- 每个批次都能用自动化或可复现命令证明修改有效，并能单独回滚。

本计划不在生产环境做并发压测，不使用真实私人账号或内容作为测试数据。负载测试只在本地或测试环境执行；生产只做低频冒烟和响应头核验。

## 2. 2026-08-31 现状基线

### 2.1 ESA 与源站边界

公网抽样结果：

| 路径 | 当前缓存状态 | 单次样本 TTFB | 响应体 |
| --- | --- | ---: | ---: |
| `/` | `DYNAMIC`、`no-store` | 约 241 ms | 6,213 B |
| `/library` | `DYNAMIC`、`no-store` | 约 135 ms | 5,983 B |
| `/blog` | `DYNAMIC`、`no-store` | 约 144 ms | 3,000 B |
| `/api/site/profile` | `DYNAMIC`、`private, no-store` | 约 137–246 ms | 7,031 B |
| `/api/blog/featured` | `DYNAMIC`、`private, no-store` | 约 131–217 ms | 34,414 B |
| `/api/blog/posts-page?page=1&page_size=9` | `DYNAMIC`、`private, no-store` | 约 161–194 ms | 11,205 B |
| `/sw.js` | `DYNAMIC`、`no-store` | 约 215 ms | 2,816 B |
| `/icons/icon-192.png` | ESA `HIT`、30 天 immutable | 约 1–7 ms（热缓存） | 10,108 B |

这些数字来自单一网络位置的少量抽样，只作为实施前快照，不作为长期 SLO。正式比较必须使用同一机器、同一网络、相同次数并计算中位数和 p95。

### 2.2 已确认问题

1. `next-pwa` 正在使用默认运行时规则。生产 `sw.js` 包含 `apis`、`others`、`start-url` 和 `next-data` 缓存，并对除 `/api/auth/*` 外的同源 GET API 使用最长 24 小时的 `NetworkFirst`。
2. Service Worker 的 Cache Storage 不受 ESA `no-store` 规则自动约束；因此当前可能出现普通刷新仍读到旧 API/页面，或离线时读到旧用户数据。
3. Service Worker 会预缓存大量路由 chunk、CSS 和字体，首次访问会在后台下载用户尚未访问的页面资源。
4. 前厅、书房和博客主体均为客户端请求；前厅发起 2 个公共 GET，博客首页发起分类、分页和精选 3 个 GET。
5. `/api/blog/featured` 使用包含全文 `content` 的响应模型，但首页和博客列表只使用卡片字段，当前响应约 34 KB。
6. 公共 JSON 没有 `Content-Encoding`，动态文本压缩尚未启用。
7. 多处普通 `<img>` 未统一声明懒加载、异步解码和尺寸；书房与首页下方图片会过早请求。
8. 博客详情 GET 同步写入 `view_count`，使读取产生数据库写事务，也阻碍后续安全缓存。

## 3. 实施顺序

### 阶段 0：建立可重复基线

风险：无行为变化。

计划修改：

- 增加只读性能检查脚本，记录状态码、`Cache-Control`、ESA 状态、TTFB、总耗时和响应字节数。
- 每个路径冷访问 5 次、热访问 10 次，保存原始数据并汇总 median/p95。
- 在开发机用浏览器记录请求数、总传输量、LCP、CLS、INP 和 Cache Storage；不在 2C2G 服务器运行 Lighthouse/Playwright。
- 固定测试路径：`/`、`/library`、`/blog`、一篇公开文章、三个公共 API、`/sw.js`、一个 Next 静态文件和一个图标。

通过标准：

- 同一命令可以生成结构化 before/after 结果。
- 失败响应、超时和缺失响应头会使脚本返回非零状态。
- 结果不包含 Cookie、Token、私人响应正文或完整访问日志。

### 阶段 1A：修正 Service Worker 刷新与缓存策略

风险：低。主要影响离线能力和旧缓存迁移，不改变后端接口。

计划修改：

- 将 PWA 规则从 `next-pwa` 默认值改为显式配置。
- `/api/**`、页面导航、RSC、`/_next/data/**` 一律 `NetworkOnly`，不写入 Cache Storage。
- 设置 `cacheStartUrl: false`、`cacheOnFrontEndNav: false`、`reloadOnOnline: false`。
- 不预缓存所有路由 chunk；带 hash 的 `/_next/static/**` 在实际访问后使用 `CacheFirst`，交给 ESA 和浏览器长期复用。
- 图片只缓存明确的公共路径或不携带 Cookie/Authorization 的外部公开图；第一批可以先设为 `NetworkOnly`，验证后再放宽。
- 新 Service Worker 激活时删除旧的 `apis`、`others`、`start-url`、`next-data`、`static-data-assets` 等运行时缓存。
- `/sw.js` 继续保持 `no-store`；`workbox-*.js` 和 `/_next/static/*` 继续 immutable。

通过标准：

- 构建产物中不存在可缓存 `/api/**` 和页面导航的规则。
- Cache Storage 中不存在 API、HTML、RSC、登录页、后台页或私密页 URL。
- 普通刷新能在第一次成功网络请求后看到测试环境的新版本内容。
- 从旧版本升级后，遗留运行时缓存自动清除。
- 用户 A 退出后，即使断网，也不能从 Service Worker 读回用户 A 的 API 数据。

回滚：

- 回滚为“PWA 网络直通或暂时禁用”，不能回滚到默认 API/页面缓存策略。

### 阶段 1B：图片与无效请求优化

风险：低。只改前端加载提示和请求生命周期。

计划修改：

- 首屏封面或头像保留 eager，并给真正的 LCP 图片设置高优先级；首屏以下图片使用 `loading="lazy"` 和 `decoding="async"`。
- 为图片提供稳定的宽高或 aspect-ratio，避免图片加载后布局跳动。
- 暂不默认使用 Next 图片实时转换，避免把图片压缩 CPU 转移到 2C2G 前端进程；优先使用上传时生成的缩略图或图床缩略图。
- 给博客分页、分类切换等请求接入 `AbortController`，页面离开或筛选变化时取消旧请求，而不是只忽略旧响应。
- 公开站点资料使用页面进程内的请求去重；SPA 从前厅进入书房时复用同一份已完成请求，完整刷新仍重新取最新数据。
- 访问统计在浏览器内按“路径 + 30 分钟”去重，和后端现有去重窗口一致，减少无意义 POST。

通过标准：

- 首屏未滚动时不请求书房下方和首页下方的非首屏图片。
- 滚动到图片附近后才发出请求，图片失败仍有占位。
- CLS 小于 0.1；LCP 中位数不比修改前恶化 10% 以上。
- 快速切换三个博客分类时，旧请求被取消，最终只展示最后一个分类，后端完成请求数明显下降。
- 前厅 SPA 跳转书房不重复请求 `/api/site/profile`；浏览器完整刷新仍发起新请求。

### 阶段 2A：动态文本压缩

风险：低到中。属于 Nginx/ESA 链路配置变更，必须先在测试域验证。

计划修改：

- 在 Nginx 对 HTML、JSON、JS、CSS、SVG 和纯文本启用 gzip；设置 `gzip_vary on`、合理的最小体积和类型白名单。
- ESA 回源带有代理头，需明确验证 `gzip_proxied` 行为。
- SSE、图片、音视频和已压缩格式不启用动态压缩；聊天 SSE location 保持无缓冲并显式关闭 gzip。
- 若 ESA 控制台已有 Brotli/智能压缩能力，优先在测试域比较 ESA 压缩和源站 gzip，避免双重压缩。

通过标准：

- 带 `Accept-Encoding: gzip` 的 HTML/JSON 返回 `Content-Encoding: gzip` 和正确的 `Vary: Accept-Encoding`。
- 不带 gzip 的响应仍能正常解析，解压前后 JSON 语义完全一致。
- `/api/blog/featured`、文章列表等大于 1 KB 的文本传输字节数下降至少 60%。
- SSE 首字节和逐块输出不被聚合；图片响应不重复压缩。

### 阶段 2B：缩小公共 API 响应

风险：低到中。采用新增接口或新增响应模型，保留旧接口避免破坏 MCP/外部客户端。

计划修改：

- 为精选文章增加只返回卡片字段的向后兼容接口，前厅和博客首页改用该接口；旧 `/api/blog/featured` 暂时保留。
- 列表与精选不得返回正文 `content`；正文只由详情接口返回。
- 评估按前厅/书房拆分站点资料投影；数据量未达到阈值前不做无收益拆分。

通过标准：

- 新旧精选结果的 ID、顺序、标题、分类、封面和摘要一致。
- 卡片响应中没有 `content`，生产样本体积从约 34 KB 降至 10 KB 以下或至少下降 70%。
- 旧接口测试继续通过，MCP 与管理端不受影响。

### 阶段 3：只缓存明确的匿名公共数据

风险：中。需要同时修改 API、浏览器请求凭据、Nginx 和 ESA 规则，必须等阶段 1 完成后再做。

计划修改：

- 建立独立的 `/api/public/**` 只读命名空间，响应不得依赖 Cookie、Authorization 或用户身份，也不得返回 `Set-Cookie`。
- 浏览器调用公共接口时使用 `credentials: "omit"`，认证和私有接口继续 `private, no-store`。
- 候选边缘策略：`s-maxage=60, stale-while-revalidate=120`；实际容忍的最大陈旧时间需要用户确认。
- ESA 缓存键保留影响结果的完整查询参数，例如 `category`、`q`、`page`、`page_size`。
- 当前 ESA 免费版规则已使用 5/5；实施前先设计合并规则，不能直接挤掉核心私密绕过规则。
- 发布、编辑、删除或站点资料更新后，优先调用 ESA purge；没有可靠 purge 时以短 TTL 保证最终刷新。

通过标准：

- 同一匿名公共请求首次 `MISS`、随后 `HIT`，`Age` 增长；10 次热请求至少 8 次命中。
- Nginx 日志中相同公共请求的回源次数下降至少 80%。
- 带 Cookie 或 Authorization 的请求始终 `DYNAMIC`，任何用户专属响应都不出现 `HIT`。
- 测试域更新公开内容后，在约定 TTL 内可见；触发 purge 时应在下一次请求可见。
- 搜索、分类和分页的不同查询不会串缓存。

### 阶段 4：结构性优化

风险：中到高。只有前述改造仍不能达到目标时才进入。

- 将博客详情读取与阅读计数拆开：GET 只读，阅读计数异步、去重或批量落库。
- 聚合博客首页的分类、分页与精选响应，减少请求和重复数据库查询。
- 在上传阶段生成书房/博客缩略图，不在 2C2G Next.js 进程实时转码。
- 评估公开页面 Server Component/ISR；必须同时测量 LCP 改善与 Node CPU/内存，不能只因 SSR 理论更快就上线。
- 对站点资料和博客聚合查询增加短 TTL 进程缓存时，必须解决多进程失效和管理端更新一致性。

## 4. 测试样例

### 4.1 ESA 与 HTTP 响应头

```bash
for path in / /library /blog /api/health /api/site/profile /api/blog/featured /sw.js /icons/icon-192.png; do
  curl -sS --compressed -o /dev/null -D - "https://lovestory1314.fun${path}"
done
```

断言：

- HTML、私有 API、认证页、后台页、RSC、SSE 和 `sw.js` 不得进入 ESA 公共缓存。
- `/_next/static/*`、图标等带版本或明确公开的资源应在热请求出现 ESA `HIT`。
- 只有阶段 3 新增的 `/api/public/**` 可以出现 API `HIT`。

### 4.2 延迟与体积

```bash
curl -sS --compressed -o /dev/null \
  -w 'code=%{http_code} ttfb=%{time_starttransfer} total=%{time_total} bytes=%{size_download}\n' \
  'https://lovestory1314.fun/api/blog/featured'
```

每个路径运行相同次数，比较 median/p95，不能拿单次最快值证明优化有效。网络延迟类变更允许波动，但不能连续两个批次中位数恶化超过 15%。

### 4.3 Service Worker 构建契约

实施阶段 1A 时新增 Node 内置测试，示例入口：

```bash
cd frontend
node --test tests/pwa-cache-policy.test.cjs
npx tsc --noEmit
npm run lint
npm run build
```

测试至少断言：API/导航/RSC 为 `NetworkOnly`，静态 hash 资源才允许 `CacheFirst`，旧缓存名包含在迁移删除列表中。构建后再检查生成的 `public/sw.js`，防止配置与实际产物不一致。

### 4.4 浏览器刷新与用户隔离

在本地或测试域使用 Playwright/Chromium：

1. 建立全新浏览器上下文，加载前厅并等待 Service Worker 激活。
2. 检查 `caches.keys()` 和各 CacheStorage entry，断言不存在 `/api/`、HTML、RSC 和私密路由。
3. 用测试数据先返回版本 A，再更新为版本 B，执行普通刷新；页面必须显示 B。
4. 人工预置旧 `apis`/`others` 缓存，更新 Service Worker 后断言旧缓存被删除。
5. 使用本地测试用户 A 登录并访问私密页面，退出后断网；不得从缓存恢复用户 A 的响应。

### 4.5 公共接口回归

```bash
cd backend
venv/Scripts/python.exe -m pytest -q tests/test_blog.py tests/test_blog_pagination.py tests/test_site_profile.py
```

新增测试应验证精选卡片接口不含正文、排序与旧接口一致，公共/私有数据边界不变，查询参数不会串结果。

### 4.6 图片与 Core Web Vitals

在相同设备、相同网络节流下运行至少 5 次：

- 记录首屏请求数、图片请求数、总传输量、LCP、CLS、INP。
- 未滚动时断言非首屏图片没有请求；滚动接近图片时才加载。
- 目标为 CLS `< 0.1`、LCP 中位数不恶化，首屏总传输量明显下降。

## 5. 每批发布门禁

1. 一个批次只解决一类问题，独立测试、独立 commit、独立回滚。
2. 先通过后端测试、TypeScript、ESLint、生产构建和 Service Worker 契约测试。
3. 测试域验证缓存、刷新、登录、退出、断网与内容更新。
4. 生产发布后只做低频冒烟，保存脱敏 before/after 摘要。
5. 观察 ESA 命中、Nginx 请求数、PM2 CPU/内存和错误率；指标异常立即回滚本批次。
6. 上一批达到通过标准后，再开始下一批。

## 6. 推荐的第一个实施批次

第一批只做“阶段 0 + 阶段 1A”：建立基线脚本、修正 Service Worker、迁移删除旧缓存。它不改变数据库、API 响应或 ESA 控制台规则，却能先解决刷新陈旧和私人数据落入浏览器缓存的风险，也为后续所有性能数字提供可信测量基础。

## 7. 第一批实施记录（2026-08-31，历史中间状态）

本节保留 2026-08-31 当时的中间状态；下面的 ESA 数据是修改前生产基线，不能当作最终线上结果。最终结果见第 8 节。

已完成：

- 新增 `scripts/measure-public-performance.sh`，以 TSV 输出固定公网路径的 p50/p95 TTFB、总耗时和响应字节数，非 200 响应会使脚本失败。
- 新增 `scripts/verify-esa.sh`，自动核验动态页面、私有 API、`sw.js`、图标和实际 Next.js 静态资源的 ESA/缓存响应头。
- 将 `next-pwa` 默认策略替换为显式策略：同源 `/api/**`、页面导航、RSC 和 `/_next/data/**` 使用 `NetworkOnly`；只有按需访问的 `/_next/static/**` 使用 `CacheFirst`。
- 禁止起始页、公共目录和构建产物的主动预缓存，避免首次访问后台下载全部路由资源。
- 新 Service Worker 激活时只删除已知旧运行时缓存，保留新的 `lumino-next-static-v1` 和其他应用的无关缓存。
- 新增源码策略测试和生成产物测试；生成的 `sw.js` 不包含 `NetworkFirst`、页面/API 缓存名或任何预缓存注册。

修改前生产基线（同一机器、每个路径 3 次低频请求）：

| 路径 | p50 TTFB | p95 TTFB | 响应字节数 |
| --- | ---: | ---: | ---: |
| `/` | 0.208 s | 0.324 s | 6,213 B |
| `/library` | 0.453 s | 0.536 s | 5,983 B |
| `/blog` | 0.170 s | 0.174 s | 3,000 B |
| `/api/site/profile` | 0.161 s | 0.206 s | 7,031 B |
| `/api/blog/featured` | 0.155 s | 0.169 s | 34,414 B |
| `/api/blog/posts-page?page=1&page_size=9` | 0.140 s | 0.178 s | 11,205 B |
| `/sw.js` | 0.198 s | 0.276 s | 2,816 B |

本地验证结果：

```text
npm run test:pwa             6 passed
npm run test:pwa:generated   2 passed
npx tsc --noEmit             passed
npm run lint                 passed（仅保留原有 warning）
npm run build                passed，Next.js 23/23 静态页面生成成功
bash -n scripts/*.sh         passed
bash scripts/verify-esa.sh   passed（生产只读核验）
```

当时尚未完成（现状见第 8 节）：

- 在测试域或本地 Chromium 中验证从旧 Service Worker 升级、普通刷新、断网和用户退出后的 Cache Storage 行为。
- 按正式部署 Runbook 发布本批次；发布后重新执行相同基线脚本，并保存修改后的生产证据。
- 阶段 1B 及后续压缩、响应瘦身和匿名公共数据缓存尚未开始。

## 8. 最终实施与验证记录（2026-09-01）

已发布的优化：

- Service Worker：导航、API、RSC 和 Next data 全部网络直通，仅缓存带 hash 的 Next 静态资源，并清理旧运行时缓存。
- 部署：前端在 `.next-build` 完成构建后原子替换 `.next`；失败构建不会覆盖当前线上版本。
- Nginx：文本 gzip、`gzip_vary`、SSE 禁止压缩；移除重复手写 `Vary`。
- API：新增 `/api/public/**` 匿名只读接口，精选与列表使用无正文的轻量响应。
- ESA：在 5/5 规则限制内合并静态资源与公共 API 放行，保持 Cookie/Authorization、HTML、私有 API 和默认请求绕过。
- 博客详情：GET 只读并可边缘缓存，浏览量改为显式 POST，浏览器按文章 30 分钟去重。

量化证据：

| 项目 | 修改前 | 修改后 |
| --- | --- | --- |
| 精选接口压缩响应样本 | 约 14,425 B | 约 1,940 B，下降约 86.6% |
| 公共 API 边缘状态 | `DYNAMIC` | 首次 `MISS`、重复 `HIT`，TTL 60 秒 |
| 文章详情读取 | GET 同步写数据库 | GET 只读；POST 单独计数 |
| `Vary: Accept-Encoding` | 多层重复风险 | 线上实测仅 1 个 |
| 前端失败构建影响 | 可能污染 `.next` | 临时目录构建成功后原子切换 |

生产证据：

```text
commit: cf963b187df21b64f763530dfb6bf3822390d395
PM2: lumino-backend online, lumino-frontend online
health: backend 200, frontend 200
article detail: MISS -> HIT, Cache-Control s-maxage=60, gzip
cookie/query isolation: scripts/verify-esa.sh passed
```

本地验证：后端全量 `150 passed`；TypeScript、ESLint、PWA 测试与前端生产构建通过；Alembic 为单一 head。全仓 Ruff 仍有历史规则债务，本轮未把无关的大范围格式修复混入性能发布。

后续可选项：Core Web Vitals 多次采样、分类切换请求计数、上传期缩略图、主动 purge 和聚合接口。这些不是本轮已验证结果。
