#!/usr/bin/env python3
"""
Chrome から AIDA データを受け取り JSON に保存する一回限りの HTTP サーバー

Usage:
  python3 scripts/receive_aida_data.py
"""
import json
import http.server
from datetime import datetime
from pathlib import Path

PORT = 8765
OUT = Path(__file__).parent.parent / "data" / "aida_events_2026.json"

HTML = (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
    "<title>AIDA Data Bridge</title></head><body>"
    "<p id=\"status\">Sending data...</p><script>"
    "(async () => {"
    "  const raw = window.name;"
    "  if (!raw) { document.getElementById('status').textContent = 'ERROR: no data'; return; }"
    "  try {"
    "    const events = JSON.parse(raw);"
    "    const r = await fetch('http://localhost:8765/post', {"
    "      method: 'POST',"
    "      headers: {'Content-Type': 'application/json'},"
    "      body: JSON.stringify({events})"
    "    });"
    "    const res = await r.json();"
    "    document.getElementById('status').textContent = 'OK: ' + res.count + ' saved!';"
    "  } catch(e) {"
    "    document.getElementById('status').textContent = 'ERROR: ' + e.message;"
    "  }"
    "})();"
    "</script></body></html>"
)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(HTML.encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            events = data.get("events", [])

            def cat(t):
                t = (t or "").lower()
                if "world championship" in t: return "wc"
                if "depth" in t: return "sea"
                return "pool"

            for e in events:
                s = e.get("startDate", "")
                e["month"] = int(s[5:7]) if len(s) >= 7 else 0
                e["cat"] = cat(e.get("type", ""))

            events.sort(key=lambda e: e.get("startDate", ""))
            output = {
                "year": 2026,
                "updatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "source": "aida_chrome_scrape",
                "events": events,
            }
            OUT.parent.mkdir(exist_ok=True)
            with open(OUT, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

            print(f"\n✅ {len(events)}件 → {OUT}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "count": len(events)}).encode())
            self.server._BaseServer__shutdown_request = True
        except Exception as ex:
            print(f"❌ エラー: {ex}")
            self.send_response(500)
            self.end_headers()

    def log_message(self, fmt, *args):
        pass


print(f"⏳ localhost:{PORT} でデータ待機中...")
print(f"   Claudeが自動でブラウザをlocalhost:{PORT}に誘導します")
with http.server.HTTPServer(("localhost", PORT), Handler) as srv:
    srv.serve_forever()
