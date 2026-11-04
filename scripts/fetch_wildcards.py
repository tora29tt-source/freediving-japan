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

WildCards ページが 403（GitHub Actions の IP はブロックされる）のときは、
世界ランキング（/Ranking/index.php・requests で取得可）の上位10位＋同記録で代替する。
強制的に代替方式を使う: WC_SOURCE=ranking python3 scripts/fetch_wildcards.py
取得が0件のときは既存ファイルを上書きせず exit 1。
"""
import re, json, datetime, time, os, sys
import requests

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

# ---------------------------------------------------------------------------
# フォールバック：WildCards ページが 403 のとき（GitHub Actions の IP は弾かれる）
# 世界ランキング（/Ranking/index.php・国籍指定なし・今年）の上位10位＋10位と同記録を
# ワイルドカードとして組み立てる。WildCards ページと同じ定義・同じ列構成。
# ---------------------------------------------------------------------------
RANK_POST = f"{BASE}/Ranking/index.php"
RANK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": f"{BASE}/Ranking/",
}
MARK_RE = re.compile(r"\s*\b(NR|WR|CR|AR|PEN)\b", re.I)

def _clean_result(r):
    return MARK_RE.sub("", r).strip()

def fetch_from_ranking(session, disc_id, gender_id, year):
    r = session.post(RANK_POST, data={
        "discipline": disc_id, "nationality": "", "continent": "",
        "gender": gender_id, "year": year, "apply": "",
    }, headers=RANK_HEADERS, timeout=30)
    r.raise_for_status()
    rows = parse_wc_table(r.text)
    # 10位と同記録の選手が次ページにいる場合は追加で取得
    page = 2
    while len(rows) >= 10 and page <= 3:
        tenth = rows[9]["points"]
        if rows[-1]["points"] != tenth:
            break
        rp = session.get(f"{RANK_POST}?page={page}", headers=RANK_HEADERS, timeout=30)
        more = [x for x in parse_wc_table(rp.text) if x["points"] == tenth]
        if not more:
            break
        rows.extend(more)
        if len(more) < 10:
            break
        page += 1
        time.sleep(0.3)
    out = [x for x in rows if x["rank"] <= 10 or (len(rows) >= 10 and x["points"] == rows[9]["points"])]
    for x in out:
        x["result"] = _clean_result(x["result"])
    return out

def collect_from_ranking():
    session = requests.Session()
    # fetch_all_rankings.py と同じ手順でセッション確立（Actions でも通る実績のある方法）
    session.get(f"{BASE}/Ranking/", headers=RANK_HEADERS, timeout=30)
    all_wc = {}
    for disc_label, disc_id in DISCIPLINES:
        for gender_label, gender_id in GENDERS:
            key = f"{disc_label}|{gender_label}"
            try:
                all_wc[key] = fetch_from_ranking(session, disc_id, gender_id, YEAR)
            except Exception as e:
                print(f"  {key}: ! ランキング取得失敗 {e}", file=sys.stderr)
                if not all_wc:
                    # 診断：IPごと締め出されているのか、国籍なし（世界）検索だけ弾かれるのかを切り分け
                    try:
                        rj = session.post(RANK_POST, data={
                            "discipline": disc_id, "nationality": "108", "continent": "",
                            "gender": gender_id, "year": YEAR, "apply": "",
                        }, headers=RANK_HEADERS, timeout=30)
                        print(f"  [診断] 同条件・国籍Japan指定 → HTTP {rj.status_code}", file=sys.stderr)
                    except Exception as e2:
                        print(f"  [診断] 国籍Japan指定も失敗: {e2}", file=sys.stderr)
                    print("  最初の取得で失敗したため残りはスキップします", file=sys.stderr)
                    return all_wc
            time.sleep(0.5)
    return all_wc

def collect_from_wc_page():
    """WildCards ページを実ブラウザで取得。ページが開けなければ None。"""
    headless = os.environ.get("AIDA_HEADLESS", "0") == "1"
    all_wc = {}
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
            return None
        for disc_label, disc_id in DISCIPLINES:
            for gender_label, gender_id in GENDERS:
                key = f"{disc_label}|{gender_label}"
                try:
                    res = page.evaluate(_FETCH_JS, {
                        "discipline": disc_id, "gender": gender_id, "year": YEAR, "apply": "",
                    })
                    if res["status"] != 200:
                        raise RuntimeError(f"HTTP {res['status']}")
                    all_wc[key] = parse_wc_table(res["html"])
                except Exception as e:
                    print(f"  {key}: ! 取得失敗 {e}", file=sys.stderr)
                time.sleep(0.8)
        browser.close()
    return all_wc

def main():
    print(f"=== AIDA WildCards {YEAR} 取得開始 ===")
    source = "wildcards_page"
    all_wc = None
    if os.environ.get("WC_SOURCE") != "ranking":
        all_wc = collect_from_wc_page()
    if not all_wc or sum(len(v) for v in all_wc.values()) == 0:
        print("↪ WildCards ページが使えないため、世界ランキング上位10位から組み立てます")
        source = "ranking_top10"
        all_wc = collect_from_ranking()

    japan_wc = {}
    for key, rows in all_wc.items():
        jp = [r for r in rows if is_japan(r["nationality"])]
        if jp:
            japan_wc[key] = jp
            for r in jp:
                print(f"  {key}: 🇯🇵 #{r['rank']} {r['name']} {r['result']}")
        else:
            print(f"  {key}: 日本人なし（top {len(rows)}）")

    total = sum(len(v) for v in all_wc.values())
    if total == 0:
        print("❌ WildCards を1件も取得できませんでした。既存の wildcard_data.json は更新しません。", file=sys.stderr)
        sys.exit(1)

    out = {
        "updated": datetime.date.today().isoformat(),
        "year":    int(YEAR),
        "source":  source,
        "japan":   japan_wc,
        "all":     all_wc,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    jp_count = sum(len(v) for v in japan_wc.values())
    print(f"\nWrote data/wildcard_data.json（source={source} / 全{total}行 / 日本人 {jp_count}件・{len(japan_wc)}種目性別）")

if __name__ == "__main__":
    main()
