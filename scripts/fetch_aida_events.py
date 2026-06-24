#!/usr/bin/env python3
"""
AIDA International カレンダースクレイパー（Playwright API Request版）

Playwright のブラウザコンテキストを使いセッションクッキーを維持しながら
月別フィルタのPOSTリクエストを送る方式。DOMの操作は一切不要。

初回セットアップ:
  pip install playwright beautifulsoup4
  python3 -m playwright install chromium

Usage:
  python3 scripts/fetch_aida_events.py
  python3 scripts/fetch_aida_events.py --year 2027
"""

import json
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup
except ImportError:
    print("セットアップ手順:", file=sys.stderr)
    print("  pip install playwright beautifulsoup4", file=sys.stderr)
    print("  python3 -m playwright install chromium", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://www.aidainternational.org/Events/EventCalendar"


def parse_events(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for card in soup.select(".eventcalendar__events__single"):
        texts = [t.strip() for t in card.get_text("\n").split("\n") if t.strip()]
        link_tag = card.select_one("a[href*='Event']")
        link = link_tag["href"] if link_tag else ""
        if not link.startswith("http"):
            link = "https://www.aidainternational.org" + link
        if len(texts) < 4:
            continue
        events.append({
            "title": texts[0],
            "type": texts[1] if len(texts) > 1 else "",
            "venue": texts[2] if len(texts) > 2 else "",
            "cityCountry": texts[3] if len(texts) > 3 else "",
            "startDate": texts[4] if len(texts) > 4 else "",
            "endDate": texts[5] if len(texts) > 5 else "",
            "link": link,
        })
    return events


def get_max_page(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    targets = [
        int(a.get("pagination-target"))
        for a in soup.select("[pagination-target]")
        if str(a.get("pagination-target", "")).isdigit()
    ]
    return max(targets, default=1)


def post_month(context, year: int, month: int, page: int = 1) -> str:
    """Playwright のブラウザコンテキストを使ってPOST（セッションクッキー自動付与）"""
    form_data = {
        "selection": "competitions",
        "event_type_id": "",
        "country_id": "",
        "year": str(year),
        "month": str(month),
    }
    if page > 1:
        form_data["pagination"] = str(page)

    resp = context.request.post(
        BASE_URL,
        form=form_data,
        headers={
            "Referer": BASE_URL,
            "Origin": "https://www.aidainternational.org",
        },
    )
    return resp.text()


def categorize(event: dict) -> str:
    t = event.get("type", "").lower()
    if "world championship" in t:
        return "wc"
    if "depth" in t:
        return "sea"
    return "pool"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    args = parser.parse_args()
    year = args.year

    print(f"=== AIDA {year} カレンダー取得開始 ===")

    all_events: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        # まず GETしてセッションクッキーを取得
        print("セッション確立中 (GET)...")
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(1.5)

        for month in range(1, 13):
            print(f"\n{month:2d}月 取得中...", flush=True)

            # page1
            html = post_month(context, year, month, page=1)
            evts = parse_events(html)
            max_pg = get_max_page(html)
            all_events.extend(evts)
            print(f"  page 1/{max_pg}: {len(evts)}件", flush=True)

            # page2+
            for pg in range(2, max_pg + 1):
                time.sleep(0.4)
                html = post_month(context, year, month, page=pg)
                pg_evts = parse_events(html)
                all_events.extend(pg_evts)
                print(f"  page {pg}/{max_pg}: {len(pg_evts)}件", flush=True)

            time.sleep(0.5)

        browser.close()

    # 重複排除
    seen: set[str] = set()
    unique: list[dict] = []
    for e in all_events:
        key = e["link"] or (e["title"] + e["startDate"])
        if key not in seen:
            seen.add(key)
            m_str = e.get("startDate", "")
            e["month"] = int(m_str[5:7]) if len(m_str) >= 7 else 0
            e["cat"] = categorize(e)
            unique.append(e)

    print(f"\n合計: {len(unique)}件（重複排除後）")

    out_path = Path(__file__).parent.parent / "data" / f"aida_events_{year}.json"
    out_path.parent.mkdir(exist_ok=True)
    output = {
        "year": year,
        "updatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "events": unique,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"出力: {out_path}")


if __name__ == "__main__":
    main()
