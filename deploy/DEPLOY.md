# 历史采样器部署指南（方案A）

> 状态：**代码就绪，部署待 VPS 恢复**（2026-08 无人值守轮交付）

## 架构

```
sampler.py --once ──(systemd timer 每60s)──→ history/<id>/日期.json + recent.json
                                                    │
GitHub Pages 静态站 ← fetch recent.json ← nginx 只读暴露 /history-data/
```

前端激活：`assets/js/status.js` 中 `REMOTE_HISTORY_BASE` 设为
`https://<你的域名>/history-data` 即可（空字符串=维持纯本地行为）。

## 1. 准备服务器列表

复制 `deploy/servers.sample.json` 为 `servers.json`，与 `assets/js/servers.js`
保持同源（id/address/port/type 一一对应）：

```json
{ "servers": [
  { "id": "survival", "address": "play.example.com", "port": 25565, "type": "java" },
  { "id": "bedrock",  "address": "bedrock.example.com", "port": 19132, "type": "bedrock" }
]}
```

## 2. 手动试跑

```bash
python3 sampler.py --list servers.json --out ./history --once
cat history/survival/recent.json   # 应看到 [{\"t\":...,\"n\":...}]
```

## 3. systemd 常驻（推荐二选一）

**方式一：timer + --once（调度权交给 systemd）**

```ini
# /etc/systemd/system/mc-sampler.service
[Unit]
Description=SnowBlock MC status sampler
[Service]
Type=oneshot
User=mcstatus
WorkingDirectory=/opt/mc-sampler
ExecStart=/usr/bin/python3 sampler.py --list servers.json --out ./history --once
```

```ini
# /etc/systemd/system/mc-sampler.timer
[Unit]
Description=Sample MC status every minute
[Timer]
OnCalendar=*-*-* *:*:30
AccuracySec=10s
Persistent=false
[Install]
WantedBy=timers.target
```

**方式二：自循环服务**（省事，进程崩了要靠 Restart=always）

```ini
[Service]
ExecStart=/usr/bin/python3 sampler.py --list servers.json --out ./history
Restart=always
RestartSec=10
```

启用：`systemctl enable --now mc-sampler.timer`

## 4. nginx 只读暴露

```nginx
location /history-data/ {
    alias /opt/mc-sampler/history/;
    add_header Cache-Control "public, max-age=30";
    try_files $uri =404;
}
```

CORS 同域则无需额外头；若状态站与数据域名不同源，加：
`add_header Access-Control-Allow-Origin "https://status.snowblock.top";`

## 5. Windows 计划任务（备选）

```bat
schtasks /create /tn "MC Sampler" /sc minute /mo 1 ^
  /tr "C:\Python313\python.exe D:\mc-sampler\sampler.py --list servers.json --out D:\mc-sampler\history --once"
```

## 数据契约速查

| 文件 | 格式 | 消费方 |
| --- | --- | --- |
| `<id>/<日期>.json` | `[{t:秒, online, players}]` 追加式 | 归档/审计 |
| `<id>/recent.json` | `[{t:毫秒, n}]` 全量重写，≤1500点 | status.js 注水 |

## VPS 恢复后清单

- [ ] 上传 sampler.py + servers.json
- [ ] 配置 systemd timer
- [ ] nginx location 生效 + curl 抽查 recent.json
- [ ] status.js 打开 REMOTE_HISTORY_BASE，观察历史弹窗出现跨天连续曲线