#!/usr/bin/env python3
"""
AIDA International カレンダースクレイパー（Playwright + フォームPOST 版）

2026-07 改修:
  旧版は jQuery の存在に依存し、`jQuery('#year').trigger(...)` で AJAX フィルタを
  適用していた。AIDA 側の変更（ヘッドレスブラウザに対して jQuery を含まない
  レスポンスを返すようになった）により jQuery チェックで異常終了していた。

  新版は実ブラウザ（Playwright/Chromium）でセッションを確立したうえで、
  ページ内 fetch から検索フォーム（form_search）を直接 POST する。
  サーバがイベントカードをサーバサイドレンダリングして返すため、jQuery/AJAX に
  依存しない。フィルタはセッション状態で保持されるため、月ごとに
  search_button で絞り込み → change_page でページ送り、という順序で取得する。

初回セットアップ:
  pip install playwright beautifulsoup4
  python3 -m playwright install chromium --with-deps

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
    print("  python3 -m playwright install chromium --with-deps", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://www.aidainternational.org/Events/EventCalendar"

MONTH_NAMES = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# ページ内で検索フォームを POST し、返ってきた HTML を文字列で返す JS。
# params は {year, month, event_type_id, country_id, search_button?, change_page?}
_FETCH_JS = """
async (params) => {
    const body = new URLSearchParams(params).toString();
    const r = await fetch("https://www.aidainternational.org/Events/EventCalendar", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: body,
        credentials: "include"
    });
    return await r.text();
}
"""


def normalize_date(date_str: str) -> str:
    """各種フォーマット → YYYY-MM-DD に統一"""
    if not date_str:
        return ""
    s = date_str.strip()
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    parts = s.split()
    if len(parts) == 3:
        try:
            day = int(parts[0])
            month = MONTH_NAMES.get(parts[1].lower())
            year = int(parts[2])
            if month:
                return f"{year:04d}-{month:02d}-{day:02d}"
        except ValueError:
            pass
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


def parse_events(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for card in soup.select(".eventcalendar__events__single"):
        texts = [t.strip() for t in card.get_text("\n").split("\n") if t.strip()]
        link_tag = card.select_one("a[href*='Event']")
        link = link_tag["href"] if link_tag else ""
        if link and not link.startswith("http"):
            link = "https://www.aidainternational.org" + link
        if len(texts) < 3:
            continue
        events.append({
            "title": texts[0],
            "type": texts[1] if len(texts) > 1 else "",
            "venue": texts[2] if len(texts) > 2 else "",
            "cityCountry": texts[3] if len(texts) > 3 else "",
            "startDate": normalize_date(texts[4] if len(texts) > 4 else ""),
            "endDate": normalize_date(texts[5] if len(texts) > 5 else ""),
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


def fetch_html(page, year: int, month: int, change_page: int | None = None) -> str:
    """検索フォームを POST して結果 HTML を取得。
    change_page=None → search_button で月フィルタを適用（=1ページ目）
    change_page=N    → 直前のフィルタ状態のまま N ページ目を取得
    """
    params = {
        "year": str(year),
        "month": str(month),
        "event_type_id": "",
        "country_id": "",
    }
    if change_page is None:
        params["search_button"] = ""
    else:
        params["change_page"] = str(change_page)
    return page.evaluate(_FETCH_JS, params)


def categorize(event: dict) -> str:
    t = event.get("type", "").lower()
    if "world championship" in t:
        return "wc"
    if "depth" in t:
        return "sea"
    return "pool"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=datetime.now().year)
    args = parser.parse_args()
    year = args.year

    print(f"=== AIDA {year} カレンダー取得開始 ===")

    all_events: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        print("ページ初期ロード中（セッション確立）...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # 動作確認: 検索フォームが存在するか（構造変化の早期検知）
        if page.query_selector("#form_search") is None:
            print(
                "⚠️  #form_search が見つかりません。ページ構造が変わった可能性があります。",
                file=sys.stderr,
            )

        for month in range(1, 13):
            print(f"\n{month:2d}月 取得中...", flush=True)
            html = fetch_html(page, year, month)
            evts = parse_events(html)
            max_pg = get_max_page(html)
            all_events.extend(evts)
            print(f"  page 1/{max_pg}: {len(evts)}件", flush=True)

            for pg in range(2, max_pg + 1):
                try:
                    html_pg = fetch_html(page, year, month, change_page=pg)
                    pg_evts = parse_events(html_pg)
                except Exception as e:
                    print(f"  ⚠️ page {pg} 取得失敗: {e}", flush=True)
                    pg_evts = []
                all_events.extend(pg_evts)
                print(f"  page {pg}/{max_pg}: {len(pg_evts)}件", flush=True)

            time.sleep(0.4)

        browser.close()

    seen: set[str] = set()
    unique: list[dict] = []
    for e in all_events:
        key = e["link"] or (e["title"] + e["startDate"])
        if key not in seen:
            seen.add(key)
            m_str = e.get("startDate", "")
            e["month"] = int(m_str[5:7]) if len(m_str) >= 7 and m_str[4] == "-" else 0
            e["cat"] = categorize(e)
            unique.append(e)

    unique.sort(key=lambda e: e.get("startDate", ""))
    print(f"\n合計: {len(unique)}件（重複排除後）")

    by_month: dict[int, int] = {}
    for e in unique:
        m = e.get("month", 0)
        by_month[m] = by_month.get(m, 0) + 1
    print(f"月別: {dict(sorted(by_month.items()))}")

    if len(unique) < 50:
        print(
            f"⚠️  取得件数が {len(unique)} 件と少なすぎます。スクレイピング失敗の可能性あり。",
            file=sys.stderr,
        )
        sys.exit(1)

    out_path = Path(__file__).parent.parent / "data" / f"aida_events_{year}.json"
    out_path.parent.mkdir(exist_ok=True)
    output = {
        "year": year,
        "updatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "aida_playwright_scrape",
        "events": unique,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ 出力: {out_path}")


if __name__ == "__main__":
    main()
