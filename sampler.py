#!/usr/bin/env python3
"""SnowBlock 状态站历史采样器（方案A · 零依赖，仅 Python 标准库）。

对 servers 列表中的每个服务器周期性探测 mcstatus.io，追加写入按日分文件
的 JSON 档案，并维护一个供前端直接 fetch 的 recent.json（最近3天、与前端
localStorage 相同的 [{t:ms, n:players}] 格式）。

用法：
  python sampler.py --once                      # 单次采样(配合 systemd timer)
  python sampler.py                             # 自循环，默认 60s
  python sampler.py --list servers.json --out ./history

目录契约（nginx 只读暴露即可）：
  <out>/<server_id>/<YYYY-MM-DD>.json   按日档案，保留 retention-days 天
  <out>/<server_id>/recent.json         最近3天合并，前端 status.js 直接消费
"""

import argparse
import json
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

API_JAVA = "https://api.mcstatus.io/v2/status/java/"
API_BEDROCK = "https://api.mcstatus.io/v2/status/bedrock/"
RECENT_DAYS = 3


def load_servers(path: Path) -> list:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):  # 允许 {"servers":[...]} 或直接 [...]
        data = data.get("servers", [])
    out = []
    for s in data:
        sid = str(s.get("id", "")).strip()
        host = str(s.get("address", "")).strip()
        if not sid or not host:
            continue
        stype = "bedrock" if str(s.get("type", "")).lower() == "bedrock" else "java"
        port = int(s.get("port") or 0)
        out.append({"id": sid, "host": host, "port": port, "type": stype})
    return out


def probe(server: dict, timeout: float = 10.0) -> dict | None:
    base = API_BEDROCK if server["type"] == "bedrock" else API_JAVA
    target = f"{server['host']}:{server['port']}" if server["port"] else server["host"]
    url = base + target
    req = urllib.request.Request(url, headers={"User-Agent": "snowblock-sampler/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[warn] {server['id']} 探测失败: {e}", flush=True)
        return None
    players = ((data.get("players") or {}).get("online") or 0)
    return {
        "t": int(time.time()),
        "online": bool(data.get("online")),
        "players": int(players),
    }


def atomic_write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(path)


def sample_once(servers: list, out_dir: Path, retention_days: int) -> None:
    today = date.today()
    for srv in servers:
        sdir = out_dir / srv["id"]
        point = probe(srv)
        if point is None:
            continue
        # 1) 按日档案（富格式）
        daily_path = sdir / f"{today.isoformat()}.json"
        try:
            daily = json.loads(daily_path.read_text(encoding="utf-8")) if daily_path.exists() else []
        except Exception:
            daily = []
        daily.append(point)
        atomic_write(daily_path, daily)
        # 2) recent.json（前端格式：[{t:ms, n:players}]，最近 RECENT_DAYS 天）
        points = []
        cutoff = time.time() - RECENT_DAYS * 86400
        for i in range(RECENT_DAYS):
            f = sdir / f"{(today - timedelta(days=i)).isoformat()}.json"
            try:
                for p in json.loads(f.read_text(encoding="utf-8")):
                    if p["t"] >= cutoff:
                        points.append({"t": p["t"] * 1000, "n": p["players"]})
            except Exception:
                continue
        points.sort(key=lambda p: p["t"])
        # 压缩到 ~1500 点以内：均匀抽点，保两端
        if len(points) > 1500:
            step = len(points) / 1500
            points = [points[int(i * step)] for i in range(1500)]
        atomic_write(sdir / "recent.json", points)
        print(f"[ok] {srv['id']}: online={point['online']} players={point['players']}", flush=True)
    # 3) 过期档案清理
    limit = (date.today() - timedelta(days=retention_days)).isoformat()
    for sdir in out_dir.iterdir() if out_dir.exists() else []:
        if not sdir.is_dir():
            continue
        for f in sdir.glob("*.json"):
            if f.stem != "recent" and f.stem < limit:
                f.unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="MC 状态历史采样器")
    ap.add_argument("--list", default="servers.json", help="服务器列表 JSON")
    ap.add_argument("--out", default="./history", help="输出根目录")
    ap.add_argument("--interval", type=int, default=60, help="自循环间隔秒(默认60)")
    ap.add_argument("--retention-days", type=int, default=90, help="按日档案保留天数")
    ap.add_argument("--once", action="store_true", help="单次采样后退出(交给外部调度器)")
    args = ap.parse_args()

    servers = load_servers(Path(args.list))
    if not servers:
        print(f"NO_SERVERS: {args.list} 中没有有效条目", file=sys.stderr)
        return 1
    out_dir = Path(args.out)
    print(f"[sampler] {len(servers)} 台服务器 → {out_dir} (interval={args.interval})", flush=True)

    while True:
        sample_once(servers, out_dir, args.retention_days)
        if args.once:
            return 0
        time.sleep(max(15, args.interval))


if __name__ == "__main__":
    sys.exit(main())