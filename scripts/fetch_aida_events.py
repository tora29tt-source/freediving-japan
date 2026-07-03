#!/usr/bin/env python3
"""
AIDA International カレンダースクレイパー（Playwright headful + フォームPOST 版）

2026-07 改修:
  1) 旧版は jQuery 依存で、ヘッドレスブラウザに jQuery が無いレスポンスが返り異常終了していた。
  2) さらに AIDA 側の bot 対策強化により、CI のヘッドレスブラウザ／データセンターIPには
     検索フォーム(#form_search)を含まないページが返るようになった（全件0件で失敗）。

  対策:
   - jQuery/AJAX 依存を排し、検索フォームをページ内 fetch で直接 POST（サーバサイド
     レンダリングされたカードHTMLを取得）。
   - bot 検知を避けるため、既定で headful（実ブラウザ）起動。CI では xvfb-run 経由で
     仮想ディスプレイに描画する。stealth フラグと navigator.webdriver 隠蔽も付与。
   - フォーム未検出時はリトライし、それでも駄目ならページ内容の診断ログを出力する
     （Cloudflare チャレンジ／IPブロック等の切り分け用）。

環境変数:
   AIDA_HEADLESS=1  … ローカル検証用にヘッドレス起動（既定は headful）

初回セットアップ:
  pip install playwright beautifulsoup4
  python3 -m playwright install chromium --with-deps

Usage:
  xvfb-run --auto-servernum python3 scripts/fetch_aida_events.py --year 2026
  AIDA_HEADLESS=1 python3 scripts/fetch_aida_events.py   # ローカル
"""

import os
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

# 自動化検知を避けるための初期化スクリプト（各ページ生成前に実行）
_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = window.chrome || {runtime: {}};
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
"""


def normalize_date(date_str: str) -> str:
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


def load_calendar_page(page):
    """カレンダーページを開き、検索フォームが現れるまでリトライ。
    現れなければ診断情報を出力して False を返す。"""
    for attempt in range(1, 4):
        try:
            resp = page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
            status = resp.status if resp else "?"
        except Exception as e:
            status = f"goto例外: {e}"
        time.sleep(2)
        if page.query_selector("#form_search") is not None:
            print(f"✅ 検索フォーム検出（試行{attempt}, status={status}）")
            return True
        print(f"  ⏳ 試行{attempt}: #form_search 未検出（status={status}）。待機して再試行...", flush=True)
        time.sleep(4)

    # 診断: 何が返っているのか
    try:
        title = page.title()
    except Exception:
        title = "?"
    try:
        body_snippet = page.evaluate(
            "() => (document.body ? document.body.innerText : '').slice(0, 500)"
        )
    except Exception:
        body_snippet = "?"
    print("❌ 検索フォームが見つかりません。bot対策でブロックされている可能性があります。", file=sys.stderr)
    print(f"   [診断] title = {title!r}", file=sys.stderr)
    print(f"   [診断] body先頭 = {body_snippet!r}", file=sys.stderr)
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=datetime.now().year)
    args = parser.parse_args()
    year = args.year

    headless = os.environ.get("AIDA_HEADLESS", "0") == "1"
    print(f"=== AIDA {year} カレンダー取得開始 ===")
    print(f"モード: {'headless' if headless else 'headful (xvfb/実ディスプレイ想定)'}")

    all_events: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        context.add_init_script(_STEALTH_JS)
        page = context.new_page()

        print("ページ初期ロード中（セッション確立）...")
        if not load_calendar_page(page):
            browser.close()
            sys.exit(1)

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
