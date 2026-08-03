# Lumino 访问洞察

## 数据最小化

- 只统计前厅、书房、博客首页和公开文章。
- 不记录查询参数、Cookie、完整 User-Agent、完整来源 URL、后台页面或静态资源请求。
- 同一 IP 在同一路径上的访问以 30 分钟为窗口去重。
- 原始 IP 明细默认保留 48 小时；每日匿名汇总默认保留 180 天。
- 每日独立访客使用带服务端密钥的不可逆哈希计算，哈希值按日期变化。

## ESA 回源请求头

先在 ESA 的“托管转换”中启用真实客户端 IP 标头。ESA 会在回源请求中写入 `ali-real-client-ip`，后端只有在这个可信标头存在时才采信地域字段。

在“规则 → 转换规则 → 修改请求头 → ESA 到源站”中为所有请求增加以下动态请求头：

| 请求头 | 动态表达式 |
| --- | --- |
| `X-Lumino-Country` | `ip.geoip.country` |
| `X-Lumino-Province` | `ip.src.subdivision_1_iso_code` |
| `X-Lumino-City` | `ip.src.city_name` |
| `X-Lumino-ISP` | `ip.src.isp` |

城市级归属地可能不精确，VPN 或代理也会改变显示结果，因此这些字段只用于访问分析，不用于鉴权或封禁。

## 保留周期

保留周期可通过后端环境变量调整：

- `VISIT_RAW_RETENTION_HOURS`
- `VISIT_SUMMARY_RETENTION_DAYS`
- `VISIT_SUMMARY_INTERVAL_SECONDS`
- `VISIT_DEDUPE_MINUTES`

后台汇总线程每小时检查一次已完成日期，先生成日汇总，再删除超过保留时间的原始记录。部署脚本同时安装 PM2 日志轮转规则：日志按天轮转，最多保留 7 份，单文件达到 10 MB 时提前轮转。
