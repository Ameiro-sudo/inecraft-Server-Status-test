# 后端接口真实化提案

> 起草：无人值守冲刺轮 · 状态：**方案A代码已实现，部署待 VPS 恢复**
> 交付物：`sampler.py`（零依赖采样器，已实测）+ `assets/js/status.js` 远端注水层
> （`REMOTE_HISTORY_BASE` 渐进增强开关）+ `deploy/DEPLOY.md`（systemd/nginx/计划任务）
> 本文基于对现有前端代码的完整走读（status.js / admin-config.js / servers.js）。

## 一、现状（纯客户端架构）

| 数据 | 现存位置 | 问题 |
| --- | --- | --- |
| 服务器列表配置 | `localStorage` (admin-config.js STORE_KEY) | 只存在单浏览器；换设备/清缓存即丢 |
| 在线人数历史 | `localStorage` (status.js HIST_PREFIX) | **只有页面开着才采样**；访客关页即断档 |
| 操作日志 | `localStorage` (LOG_KEY) | 同上，且无全局审计能力 |
| 实时状态 | 浏览器直连 mcstatus.io / mcsrvstat.us | 可用（两提供商均支持 CORS），可保留 |

核心结论：**当前最大的价值缺口不是"有没有后端"，而是"没有采样器"**——
玩家历史曲线的连续性完全依赖访客浏览器。

## 二、方案对比

### 方案 A：极简 JSON 存储 + 定时采样器（推荐）

```
┌─────────────┐   cron 每 1-5 分钟    ┌──────────────┐
│  采样器      │ ──→ mcstatus.io ──→  │  JSON 存储    │
│ (任何常驻机) │                      │ /history/*.json│
└─────────────┘                      └──────┬───────┘
                                            ↑ read
GitHub Pages(静态站) ── fetch ──────────────┘
```

- 采样器：一个 <100 行的 Python 脚本跑在 MC 服务器同机上
  （systemd timer / Windows 计划任务），追加写 `history/<server>-<date>.json`
- 存储层三选一：
  a. **MC 服务器所在 VPS 直接起静态文件服务**（nginx alias）——零新依赖
  b. Cloudflare Workers + R2/KV（免费额度足够）
  c. GitHub 私有仓库 + Actions 每 5 分钟 commit（不推荐：提交噪声大）
- 管理端配置：加一个带 token 的极小写接口（FastAPI ~50 行）或干脆继续
  用 localStorage + 手动导出 JSON 文件签入仓库

优点：改动面最小、免费、历史数据 7×24 连续。
缺点：写接口若暴露需自己管鉴权。

### 方案 B：完整小后端（FastAPI + SQLite）

复用 IReckon 的技术栈经验：单文件 FastAPI，端点：

```
GET  /api/status?provider=mcstatus     # 服务端代理探测(可选)
GET  /api/history/{server}?days=7      # 历史曲线
POST /api/config                       # 管理配置(token 鉴权)
POST /api/samples                      # 采样器上报(token 鉴权)
```

优点：一切集中、日志真实化。缺点：多一个要运维的服务。

### 不推荐：Serverless 全家桶 / 大数据库 —— 对一个状态页过重。

## 三、API 契约草案（方案 A 的 history 格式）

```json
// history/java-<host>-<port>-2026-08-21.json（按日分文件，天然滚动清理）
{
  "server": "java:play.example.com:25565",
  "samples": [
    {"t": 1755744000, "online": true, "players": 12, "latency_ms": 43}
  ],
  "interval_sec": 60
}
```

前端改造点（约 30 行）：`loadHistory()` 优先 fetch 后端 JSON，
404/离线时回退现有 localStorage 逻辑——渐进增强，不破坏现状。

## 四、实施清单（若采纳方案 A）

1. [ ] 写 sampler.py（mcstatus.io 拉取 → 追加当日 JSON）
2. [ ] VPS 上配 systemd timer（每 60s）
3. [ ] nginx 暴露 /history/ 只读静态目录
4. [ ] status.js 加 loadHistory 远程优先逻辑
5. [ ] admin 配置导出/导入按钮（JSON 文件落库进仓库）

## 五、决策点（需要站长拍板）

- 采样器跑在哪？（MC 服务器 VPS 是否可用）
- 历史数据保留策略？（建议按日分文件 + 保留 90 天）
- 管理配置要不要上真后端，还是维持 localStorage + 导出？