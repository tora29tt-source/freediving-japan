#!/usr/bin/env python3
"""
AIDA Wild Cards fetcher（Playwright版）
--------------------------------------
AIDA の Ranking/WildCards ページから、今年の種目×性別ごとの
ワイルドカード上位10名を取得し、日本人選手を抽出して
data/wildcard_data.json に書き出す。

requests 直叩きは bot 対策で 403 になるため、fetch_aida_events.py と同じく
実ブラウザ（headful + xvfb）でページを開いてセッションを確立し、
ページ内 fetch で POST する方式にしている。

ローカル実行:
  pip install playwright && python3 -m playwright install chromium
  python3 scripts/fetch_wildcards.py            # 画面ありで起動
  AIDA_HEADLESS=1 python3 scripts/fetch_wildcards.py   # headless（ブロックされやすい）
GitHub Actions:
  xvfb-run --auto-servernum python3 scripts/fetch_wildcards.py

取得が0件（ブロック・HTML構造変更など）のときは既存ファイルを上書きせず exit 1。
"""
import re, json, datetime, time, os, sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright が見つかりません: pip install playwright && python3 -m playwright install chromium", file=sys.stderr)
    sys.exit(1)

BASE     = "https://www.aidainternational.org"
WC_URL   = f"{BASE}/Ranking/WildCards"
YEAR     = str(datetime.date.today().year)
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "wildcard_data.json")

# (label, form value) — fetch_jp_records.py と同じ ID
DISCIPLINES = [
    ("STA","8"), ("DYN","6"), ("DYNB","11"), ("DNF","7"),
    ("CWT","3"), ("CWTB","12"), ("CNF","4"), ("FIM","5"),
]
GENDERS = [("Male","0"), ("Female","1")]

ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)

# ページ内で同一オリジンに POST する（Cookie・ブラウザ指紋をそのまま使う）
_FETCH_JS = """
async (params) => {
    const r = await fetch(location.origin + "/Ranking/WildCards", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams(params).toString(),
        credentials: "include"
    });
    return {status: r.status, html: await r.text()};
}
"""

_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = window.chrome || {runtime: {}};
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
"""

def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()

def parse_name_nationality(cell_html):
    """'Hanako Hirose (Japan)' → ('Hanako Hirose', 'Japan')"""
    text = strip_tags(cell_html)
    m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text.strip(), ""

def parse_wc_table(html):
    """列: # / Name / Result / Announced / Points / Penalties / Date / Event"""
    results = []
    for row in ROW_RE.findall(html):
        cells = CELL_RE.findall(row)
        if len(cells) < 6:
            continue
        rank_text = strip_tags(cells[0]).rstrip(".")
        if not rank_text.isdigit():
            continue
        name, nationality = parse_name_nationality(cells[1])
        try:
            points = float(strip_tags(cells[4]))
        except ValueError:
            points = 0.0
        results.append({
            "rank":        int(rank_text),
            "name":        name,
            "nationality": nationality,
            "result":      strip_tags(cells[2]),
            "points":      points,
            "date":        strip_tags(cells[6]) if len(cells) > 6 else "",
            "event":       strip_tags(cells[7]) if len(cells) > 7 else "",
        })
    return results

def is_japan(nationality):
    return nationality.strip().lower() in ("japan", "日本")

def open_wc_page(page):
    """WildCards ページを開き、フォームが出るまでリトライ。"""
    for attempt in range(1, 4):
        try:
            resp = page.goto(WC_URL, wait_until="networkidle", timeout=45000)
            status = resp.status if resp else "?"
        except Exception as e:
            status = f"goto例外: {e}"
        time.sleep(2)
        if page.query_selector("select[name=discipline]") is not None:
            print(f"✅ WildCards フォーム検出（試行{attempt}, status={status}）")
            return True
        print(f"  ⏳ 試行{attempt}: フォーム未検出（status={status}）。再試行...", flush=True)
        time.sleep(4)
    try:
        title = page.title()
        body = page.evaluate("() => (document.body ? document.body.innerText : '').slice(0, 300)")
    except Exception:
        title, body = "?", "?"
    print(f"❌ フォームが見つかりません（bot対策の可能性）。title={title!r} body={body!r}", file=sys.stderr)
    return False

def main():
    headless = os.environ.get("AIDA_HEADLESS", "0") == "1"
    print(f"=== AIDA WildCards {YEAR} 取得開始（{'headless' if headless else 'headful'}）===")

    japan_wc, all_wc = {}, {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
                  "--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"),
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        context.add_init_script(_STEALTH_JS)
        page = context.new_page()

        if not open_wc_page(page):
            browser.close()
            sys.exit(1)

        for disc_label, disc_id in DISCIPLINES:
            for gender_label, gender_id in GENDERS:
                key = f"{disc_label}|{gender_label}"
                try:
                    res = page.evaluate(_FETCH_JS, {
                        "discipline": disc_id, "gender": gender_id, "year": YEAR, "apply": "",
                    })
                    if res["status"] != 200:
                        raise RuntimeError(f"HTTP {res['status']}")
                    rows = parse_wc_table(res["html"])
                    all_wc[key] = rows
                    jp = [r for r in rows if is_japan(r["nationality"])]
                    if jp:
                        japan_wc[key] = jp
                        for r in jp:
                            print(f"  {key}: 🇯🇵 #{r['rank']} {r['name']} {r['result']}")
                    else:
                        print(f"  {key}: 日本人なし（top {len(rows)}）")
                except Exception as e:
                    print(f"  {key}: ! 取得失敗 {e}", file=sys.stderr)
                time.sleep(0.8)

        browser.close()

    total = sum(len(v) for v in all_wc.values())
    if total == 0:
        print("❌ WildCards を1件も取得できませんでした。既存の wildcard_data.json は更新しません。", file=sys.stderr)
        sys.exit(1)

    out = {
        "updated": datetime.date.today().isoformat(),
        "year":    int(YEAR),
        "japan":   japan_wc,
        "all":     all_wc,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    jp_count = sum(len(v) for v in japan_wc.values())
    print(f"\nWrote data/wildcard_data.json（全{total}行 / 日本人 {jp_count}件・{len(japan_wc)}種目性別）")

if __name__ == "__main__":
    main()
