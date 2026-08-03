# Lumino ESA 接入与回滚记录

记录日期：2026-07-31  
目标域名：`lovestory1314.fun`  
接入原则：保留现有 ECS 源站与阿里云 DNS 架构，优先使用 CNAME 接入，不让应用依赖 ESA。

## 切换前基线

### 公网 DNS

以下结果已经同时通过公共权威链路和阿里云云解析控制台导出文件核对。

| 记录 | 当前值 | TTL | 说明 |
| --- | --- | ---: | --- |
| 根域名 A | `114.55.55.110` | 600 秒 | 当前 ECS 直连地址，也是主要回滚值 |
| 根域名 AAAA | 无 | — | 未发现 IPv6 记录 |
| 根域名 CNAME | 无 | — | 当前尚未接入 ESA |
| `_acme-challenge` CNAME | ESA 托管 DCV | 600 秒 | 仅用于 Let’s Encrypt 证书签发与自动续期，不承载网站流量 |
| NS | `dns25.hichina.com` | 21600 秒 | 保持不变 |
| NS | `dns26.hichina.com` | 21600 秒 | 保持不变 |
| `www` | NXDOMAIN | — | 当前没有 `www` 记录 |
| 根域名 MX、TXT、CAA | 公网未发现 | — | 不能替代控制台全量导出结论 |

当前 SOA 序列：`2026060413`。

切换前 DNS 原始导出已归档为：

`docs/ops/evidence/lovestory1314.fun-dns-export-20260731.xlsx`

文件 SHA-256：`1ef4a55414890af94f89fbaa32ee584b50b7866fce7ec390d5007a05b9ac1545`。

导出文件只有 1 个工作表和 4 条启用记录：根域名 A、ESA 所有权验证 TXT、托管 DCV CNAME、测试子域 CNAME；未包含 MX、AAAA、CAA 或其他业务记录。验证记录的完整值只保留在原始导出和权威 DNS 中，不在运维说明正文重复。

### HTTPS 与源站

- 公网与 ECS 直连的 HTTPS 均正常。
- 源站协议为 HTTPS 443。
- 回源 Host 与 TLS SNI 均应固定为 `lovestory1314.fun`。
- 证书覆盖 `lovestory1314.fun`，签发方为 Let’s Encrypt，有效期至 2026-10-25。
- 服务器已配置每日 `certbot renew` 与 Nginx reload。
- Nginx 上传上限为 20 MB。
- 后端只监听 `127.0.0.1:8000`，前端监听 3000，图片服务由 Nginx 转发。

### 应用协议与隐私

- Lumino 不使用 WebSocket。
- AI 对话使用 HTTP SSE，路径为 `/api/chat/sessions/*`，需要保持流式回源、禁用缓冲与缓存。
- 登录 Cookie 已启用 `Secure`、`HttpOnly`、`SameSite=Lax`。
- 正式 CORS 来源包含 `https://lovestory1314.fun`。
- `/api/*`、后台、登录、内院、空间、对话、健康记录等路径必须始终绕过 ESA 缓存。
- 源站曾有部分 Next.js 公共页面返回较长 `s-maxage`；现已在 Nginx 统一改为 `no-store`，同时保留 ESA 的显式 HTML 绕过规则作为第二层保护。

## 已完成的源站保护

变更前 Nginx 备份：

`/opt/backups/lumino-esa-preflight-20260731-01`

源站已增加以下防御性响应头，并已通过 `nginx -t` 与 reload：

| 路径 | 源站缓存策略 |
| --- | --- |
| `/api/*` | `private, no-store, no-cache, must-revalidate` |
| `/admin/*`、`/dashboard/*`、`/spaces/*`、`/chat/*`、`/discipline/*`、`/courtyard/*` | `private, no-store, no-cache, must-revalidate` |
| `/blog/manage/*`、`/blog/write/*`、`/login`、`/register` | `private, no-store, no-cache, must-revalidate` |
| `/sw.js` | `no-store, no-cache, must-revalidate, max-age=0` |
| `/i/*` | `public, max-age=2592000, immutable` |
| `/_next/static/*` | `public, max-age=31536000, immutable` |
| 其余前端页面与 RSC 响应 | `no-store, no-cache, must-revalidate` |

Nginx 访问日志已额外记录 `ali-real-client-ip` 与请求耗时，但应用不会直接信任来自公网的同名请求头。ESA 启用托管转换后，可通过日志确认边缘节点是否正确注入真实客户端 IP，同时继续保留 ECS 直连回滚能力。

本次公共页面缓存兜底的增量备份为：

`/opt/backups/lumino-esa-preflight-20260731-01/lumino.conf.before-public-html-no-store`

已复核 `/`、`/library`、`/blog` 返回 `no-store`，`/login` 返回 `private, no-store`，`/sw.js` 返回 `no-store`，`/_next/static/*` 返回一年不可变缓存；Nginx 配置检查与 reload 均成功。

## ESA 计划配置

### 接入方式

- 站点：`lovestory1314.fun`
- 套餐：绑定已购买的免费版套餐，不启用按量付费
- 加速区域：中国内地
- 接入：CNAME
- 源站：`114.55.55.110`
- 回源协议：HTTPS 443
- 回源 Host：`lovestory1314.fun`
- 回源 SNI：`lovestory1314.fun`
- 首次所有权验证如需 TXT，只增加 ESA 提供的 `_esaauth` 记录，不改变现有业务流量

正式根域名切换前，先在同一根站点中增加 `esa-test.lovestory1314.fun` 的代理记录。该记录使用相同 ECS 源站，但回源 Host 与 SNI 仍为 `lovestory1314.fun`。测试子域通过后才允许修改根域名记录。

### ESA 缓存规则顺序

ESA 免费版的缓存规则配额为 5 条，单条规则最多包含 10 个内嵌条件，不支持正则表达式，并采用从上到下的优先级。因此配置 5 条规则，实施严格的静态资源白名单：

1. `lumino-core-bypass`：以下条件使用 OR 合并，缓存资格选择绕过缓存，并放在规则列表最顶部。
   - `Cookie` 不等于空字符串。
   - `Authorization` 请求标头存在。
   - URL 路径分别以 `/api`、`/admin`、`/dashboard`、`/spaces`、`/chat`、`/discipline` 开头。
   - URL 路径为 `/login` 或 `/register` 中的任意一项。
2. `lumino-html-bypass`：以下条件使用 OR 合并，缓存资格选择绕过缓存。
   - 请求标头 `Accept` 包含 `text/html`。
   - URL 路径分别以 `/courtyard`、`/invite-request`、`/blog/manage`、`/blog/write` 开头。
   - URL 路径等于 `/sw.js`。
3. `lumino-public-images`：匿名请求命中 `/i/*` 时，缓存资格选择符合缓存条件，浏览器和边缘缓存 30 天。
4. `lumino-next-static`：匿名请求命中 `/_next/static/*` 时，缓存资格选择符合缓存条件，浏览器和边缘使用长期缓存。
5. `lumino-default-bypass`：匹配所有传入请求，缓存资格选择绕过缓存，并固定放在规则列表最后。只有前面明确匹配的匿名图片与 Next.js 静态资源可以缓存，其余请求全部回源。

源站对 API、私密页面和 `sw.js` 的 `no-store` 响应头是第二道保护。ESA 文档说明不能仅靠自定义响应标记代替 URL 或请求头规则，因此正式切换前必须在控制台确认第一条规则已启用并位于顶部。

当前部署状态：

- `lumino-core-bypass` 已创建并启用，顺序为 1，匹配 Cookie、Authorization 与核心私密路径，缓存资格为绕过缓存。
- `lumino-html-bypass`、`lumino-public-images` 与 `lumino-next-static` 已按计划顺序创建。
- 控制台曾显示测试 DNS 记录自动生成了第 5 条 `网站页面-esa-test...` 模板缓存规则，导致普通 HTML/RSC 与个别私密页面出现 `MISS` 后转为 `HIT`。该自动模板规则已经删除，并用释放的配额创建末尾 `lumino-default-bypass`；免费版缓存规则使用 `5/5`。
- 删除自动模板并启用末尾兜底后，普通 `Accept: */*` 的 HTML、浏览器 HTML、RSC 与 `/discipline` 连续请求均保持 `DYNAMIC`；Next.js 静态 CSS 仍正常从 `MISS` 转为 `HIT`。
- 源站 CORS 允许列表已增加 `https://esa-test.lovestory1314.fun`。直连源站的预检请求返回 200 和预期的 `Access-Control-Allow-Origin`，原配置已备份。
- Let’s Encrypt 根域名与泛域名边缘证书均已签发并处于正常状态，分别覆盖 `lovestory1314.fun` 与 `*.lovestory1314.fun`，到期时间均为 2026-10-29；免费证书配额使用 `2/5`。
- ESA 已固定使用 HTTPS 443 回源并启用源站证书校验，回源双向校验保持关闭。
- 回源规则 `lumino-origin-host` 已创建并启用，对所有传入请求固定回源 Host 为 `lovestory1314.fun`；默认回源 SNI 跟随该 Host，回源规则配额使用 `1/5`。
- ESA 测试记录 `esa-test.lovestory1314.fun` 已创建，源站仍为 ECS，并关闭了自动规则模板；权威 DNS 已将该测试主机 CNAME 指向 ESA 分配的唯一接入地址。
- 公共 DNS 已确认测试子域的 CNAME 正常生效；HTTPS 请求由 ESA 节点响应 200，源站 HTTPS、源站证书校验、固定回源 Host 与 SNI 链路均已通过。
- 测试发现 HTTP 请求暂未自动跳转 HTTPS。正式业务验收前必须开启站点级“强制 HTTPS”并验证返回 301；HSTS 在测试和可回滚阶段保持关闭。
- 站点级“强制 HTTPS”已经开启，公网 HTTP 请求返回 301 并跳转到同路径 HTTPS。
- Next.js 静态 CSS 冷缓存返回 `MISS`，后续请求返回 `HIT`，一年不可变缓存头保持正常。
- API、登录、后台、空间等核心路径重复请求返回 `DYNAMIC`。普通 `Accept: */*` 的主页、RSC 以及 `/discipline` 曾在自动模板规则存在时出现 `MISS` 后转为 `HIT`；删除自动模板并创建末尾全局绕过规则后，重新验收均保持 `DYNAMIC`。
- 源站 Nginx 已为 `/icons/*` 增加 30 天不可变缓存，为带哈希的 `/workbox-*.js` 增加一年不可变缓存；`manifest.json` 与 `sw.js` 继续保持 `no-store`。增量备份为 `/opt/backups/lumino-esa-preflight-20260731-01/lumino.conf.before-static-whitelist`，配置检查与 reload 成功。
- 由于末尾全局绕过规则已经生效，ESA 侧已把 `/icons/*` 合并进 `lumino-public-images`，并把 `/workbox-*` 合并进 `lumino-next-static`，只让这些明确的公开静态资源进入缓存。
- ESA 白名单条件已补齐：真实博客图片、站点图标、带哈希 Workbox 与 Next.js 静态资源均通过冷缓存 `MISS`、热缓存 `HIT` 验证；HTML、RSC、公开博客详情及公开博客 API 均保持 `DYNAMIC`。
- `manifest.json` 与 `sw.js` 连续请求均保持 `DYNAMIC`，没有被 PWA 静态规则误缓存。
- 前厅、书房、博客、内院门廊、登录、注册、后台、工作台、空间、对话与健康记录入口均返回预期状态，响应保持 `no-store` 或 `private, no-store`，ESA 状态为 `DYNAMIC`。
- 测试域名的合法 CORS 预检返回 200、允许凭据并回显准确来源；未授权来源返回 400，没有错误放行。
- 小型 multipart 上传请求可穿过 ESA 到达应用鉴权并返回 401；21 MB 请求由源站既定 20 MB 上限拒绝为 413，两类响应均为 `DYNAMIC`。
- 源站访问日志确认 ESA 托管转换注入的 `ali-real-client-ip` 非空，并与转发链中的客户端地址一致；应用仍不直接信任公网伪造的同名标头。
- 测试子域边缘证书为 Let’s Encrypt 泛域名证书，覆盖 `*.lovestory1314.fun`，有效期至 2026-10-29。测试子域解析到 ESA 节点，根域名仍解析到原 ECS 地址。
- 用户已在实际浏览器中确认测试子域公开页面观感与基础交互未发现异常。

### 不启用的功能

- 不启用智能路由。
- 不启用边缘函数。
- 不启用边缘存储。
- 不启用任何按量付费或可能产生后付费的增值能力。
- 原普通 CDN 50 GB 资源包保留，不删除、不迁移。

### 免费版限制

- 免费版不提供 SLA，峰值带宽和单请求速率可能受限，因此必须保留 ECS 快速回滚路径。
- 免费版当前提供 5 条缓存规则配额，ESA 可能调整免费版能力与配额。
- ESA 默认允许最大 300 MB 的回源上传，但 Lumino 源站限制为 20 MB，因此实际上传上限仍为 20 MB。
- 免费版不作为 WebSocket 方案使用；Lumino 当前只使用 SSE，不受该限制阻塞。

## DNS 切换与回滚

正式切换前必须记录 ESA 为测试子域和根域名分别分配的唯一 CNAME，并先完成测试子域验收。

切换方式：

1. 保持 NS 为 `dns25.hichina.com` 与 `dns26.hichina.com`。
2. 仅把根域名当前 A 记录替换为 ESA 分配的 CNAME。
3. TTL 保持 600 秒。
4. 切换后立即核验 HTTPS、静态命中、动态不命中和登录态。

回滚方式：

1. 删除或暂停根域名的 ESA CNAME。
2. 恢复根域名 A 记录为 `114.55.55.110`，TTL 为 600 秒。
3. 等待 DNS 生效并验证公网直接回到 ECS。
4. 应用和 Nginx 无需回滚，ESA 到期不会停止 ECS 源站服务，但根域名在 DNS 回滚生效前仍会受到 ESA 停服影响。

CNAME 与同名 A 记录不能同时作为自动主备。免费版到期时不会自动切回 ECS；当前方案提供的是 600 秒 TTL 的快速人工回滚。若未来需要自动故障转移，必须另行评估 DNS 健康检查或全局流量调度及其费用。

如需回滚本次 Nginx 防御性响应头，可将备份目录中的 `lumino.conf` 恢复到 `/etc/nginx/conf.d/lumino.conf`，执行 `nginx -t` 后 reload。

## 控制台与验收证据

- 阿里云云解析 DNS 全量记录导出文件已归档并校验哈希。
- ESA 添加站点第 2 步已确认选择“中国内地”和“CNAME”。
- ESA 第 3 步已确认选择已购免费版套餐，状态为“生效中”，绑定名额为 `0/1`，到期时间为 2027-08-01；页面未选择新购或按量付费。
- ESA 站点已创建，控制台要求通过 `_esaauth` TXT 完成域名所有权验证；验证值仅从控制台复制，不写入本记录。
- 域名所有权验证已通过；公共 DNS 独立查询返回 1 条 `_esaauth` TXT，TTL 为 600 秒，记录值前缀符合 ESA 验证格式。
- Let’s Encrypt 托管 DCV 的 `_acme-challenge` CNAME 已添加并启用；阿里云公共 DNS 独立查询返回预期 ESA 托管目标与 600 秒 TTL，同时根域名 A 记录仍为原 ECS 地址。
- ESA 分配的唯一 CNAME 与边缘证书状态。
- 测试子域的 ESA 唯一 CNAME 已生效，根域名 A 记录仍保持 ECS 直连。
- `lumino-public-images` 对 `/icons/*` 与 `lumino-next-static` 对 `/workbox-*` 的白名单条件证据。
- 测试节点或正式切换后的冷热缓存命中头、节点归属、错误率与回源数据。
