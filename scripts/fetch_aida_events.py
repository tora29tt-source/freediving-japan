#!/usr/bin/env python3
"""
AIDA International カレンダースクレイパー（xvfb + jQuery 版）

GitHub Actions では xvfb-run 経由で実行（ワークフロー側で設定済み）。
ローカルでも同様に動作する。

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


def apply_filter(page, year: int, month: int):
    """jQuery で年月フィルタを適用してAJAX更新を待つ"""
    page.evaluate(f"""() => {{
        jQuery('#year').val('{year}').trigger('change.select2').trigger('change');
        jQuery('#month').val('{month}').trigger('change.select2').trigger('change');
        jQuery('.js-applyFilter').trigger('click');
    }}""")
    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except Exception:
        pass
    time.sleep(1.0)


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
    print("モード: headless=False (xvfb または 実ディスプレイ)")

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

        print("ページ初期ロード中...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        has_jquery = page.evaluate("() => typeof jQuery !== 'undefined'")
        if not has_jquery:
            print("❌ jQuery が見つかりません。ページ構造が変わった可能性があります。", file=sys.stderr)
            browser.close()
            sys.exit(1)
        print("✅ jQuery 確認済み")

        for month in range(1, 13):
            print(f"\n{month:2d}月 取得中...", flush=True)
            apply_filter(page, year, month)

            html = page.content()
            evts = parse_events(html)
            max_pg = get_max_page(html)
            all_events.extend(evts)
            print(f"  page 1/{max_pg}: {len(evts)}件", flush=True)

            for pg in range(2, max_pg + 1):
                try:
                    page.click(f'[pagination-target="{pg}"]', timeout=5000)
                    page.wait_for_load_state("networkidle", timeout=10000)
                    time.sleep(0.8)
                except Exception as e:
                    print(f"  ⚠️ pagination {pg} クリック失敗: {e}", flush=True)
                pg_evts = parse_events(page.content())
                all_events.extend(pg_evts)
                print(f"  page {pg}/{max_pg}: {len(pg_evts)}件", flush=True)

            time.sleep(0.5)

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
