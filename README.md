# SnowBlock MC 服务器状态站

Minecraft 服务器实时状态监控静态站，部署于 GitHub Pages：`status.snowblock.top`

## 功能

- 服务器在线状态 / 在线人数 / 版本 / 延迟一览
- 多数据源聚合（api.mcstatus.io / mcsrvstat.us），单源故障自动切换
- 玩家历史在线图表（Chart.js，本地 vendor，无 CDN 依赖）
- 管理页可配置服务器列表与数据源

## 目录结构

```
index.html                  主状态页
player-history-chart.html   历史图表页
admin.html / login.html     管理后台（纯前端演示）
api-management.html         数据源管理
view-logs.html              日志查看
assets/vendor/              本地化第三方资源（字体/图标/Chart.js/图片）
```

## 自定义域名

`status.snowblock.top`（`CNAME` → `Ameiro-sudo.github.io`，Cloudflare 代理开启）。
2026-09-12 复核：DNS 正常解析（Cloudflare 的 A/AAAA），`https://status.snowblock.top/` 返回 200，
GitHub Pages 证书已签发并走 HTTPS。

> 历史故障记录（若将来再次出现"域名不可达 / `bad_authz`"，按此排查）：
> Cloudflare 上缺少 `status` 子域记录会造成 NXDOMAIN，站点不可访问且 Pages 的 ACME 证书签发失败。
> 修复即在 `snowblock.top` 下补一条 `CNAME status → Ameiro-sudo.github.io`（代理开启，与 blog 一致）；
> 补记录后 Cloudflare 边缘证书即刻生效，Pages 侧证书会自动重试签发，之后可在 Pages 设置中开启 Enforce HTTPS。

## 安全说明

`login.html` / `admin.html` 为**纯前端演示**：配置仅存于浏览器 localStorage，
无任何服务端鉴权，不构成真实访问控制。如需真实后台，需另行实现服务端。
