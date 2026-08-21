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

## 已知问题

### ⚠️ status.snowblock.top DNS 记录缺失（站点当前不可达）

GitHub Pages 已配置自定义域名 `status.snowblock.top`（见 `CNAME`），但
Cloudflare 上 **缺少该子域的 DNS 记录**（NXDOMAIN），导致：

- 域名无法解析，站点不可访问
- GitHub Pages 的 ACME 证书签发失败（`bad_authz`）

**修复方法**：在 Cloudflare 的 `snowblock.top` 域名下添加记录：

| 类型 | 名称 | 目标 | 代理 |
| --- | --- | --- | --- |
| CNAME | `status` | `Ameiro-sudo.github.io` | 开启（与 blog 一致） |

添加后 Cloudflare 边缘证书即刻生效；GitHub Pages 侧证书会自动重试签发，
之后可在 Pages 设置中开启 Enforce HTTPS。

## 安全说明

`login.html` / `admin.html` 为**纯前端演示**：配置仅存于浏览器 localStorage，
无任何服务端鉴权，不构成真实访问控制。如需真实后台，需另行实现服务端。
