#!/usr/bin/env python3
"""
AIDA Japan Rankings Fetcher
============================
単年取得モード（デフォルト）で rankings_{year}.json を更新する。
過去データは rankings_historical.json に固定済みのため再取得不要。

Usage:
    # 今年（2026）を更新（週次バッチ用）
    python3 scripts/fetch_all_rankings.py

    # 特定年を取得
    python3 scripts/fetch_all_rankings.py --year 2025

    # 複数年を取得
    python3 scripts/fetch_all_rankings.py --years 2024 2025 2026

    # 全年度を再取得（初回セットアップ時のみ・30〜60分）
    python3 scripts/fetch_all_rankings.py --all

セットアップ:
    pip install requests openpyxl
"""
import re, json, sys, time, datetime, argparse
from pathlib import Path
import requests

BASE      = "https://www.aidainternational.org"
RANK_POST = f"{BASE}/Ranking/index.php"
RANK_GET  = f"{BASE}/Ranking/index.php"

NATIONALITY_JAPAN = "108"
CURRENT_YEAR      = datetime.date.today().year
ALL_YEARS         = [str(y) for y in range(CURRENT_YEAR, 1992, -1)]

DISCIPLINES = [
    ("STA",  "8"), ("DYN",  "6"), ("DYNB", "11"), ("DNF",  "7"),
    ("CWT",  "3"), ("CWTB", "12"), ("CNF", "4"),   ("FIM",  "5"),
]
DISC_OVERALL = "all"
GENDERS      = [("Male", "0"), ("Female", "1")]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": f"{BASE}/Ranking/",
}

ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)

DATA_DIR = Path(__file__).parent.parent / "data"


def strip(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()

def extract_name(raw):
    return re.sub(r"\s*\([^)]+\)\s*$", "", raw).strip()

def set_filter(session, disc_val, gender_val, year_val):
    payload = {
        "discipline": disc_val, "nationality": NATIONALITY_JAPAN,
        "continent": "", "gender": gender_val, "year": year_val, "apply": "",
    }
    r = session.post(RANK_POST, data=payload, headers=HEADERS, timeout=30, allow_redirects=True)
    r.raise_for_status()
    return r.text

def fetch_page(session, page_num):
    url = RANK_GET if page_num == 1 else f"{RANK_GET}?page={page_num}"
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def parse_records_rows(html, year, disc_name, gender_name):
    results = []
    for row in ROW_RE.findall(html):
        cells = [strip(c) for c in CELL_RE.findall(row)]
        if len(cells) < 7 or cells[0] == "#":
            continue
        try:
            rank = int(re.sub(r"\D", "", cells[0]))
        except ValueError:
            continue
        result = re.sub(r"\s*(NR|WR|CR|AR)\s*", "", cells[2]).strip()
        try:
            points = float(cells[4])
        except (ValueError, IndexError):
            points = None
        results.append({
            "year": year, "discipline": disc_name, "gender": gender_name,
            "rank": rank, "name": extract_name(cells[1]), "result": result,
            "points": points, "date": cells[6] if len(cells) > 6 else "",
            "event": cells[7] if len(cells) > 7 else "",
        })
    return results

def parse_overall_rows(html, year, gender_name):
    results = []
    disc_order = ["STA","DYN","DYNB","DNF","CWT","CWTB","CNF","FIM"]
    for row in ROW_RE.findall(html):
        cells = [strip(c) for c in CELL_RE.findall(row)]
        if len(cells) < 3 or cells[0] == "#":
            continue
        try:
            rank = int(re.sub(r"\D", "", cells[0]))
        except ValueError:
            continue
        try:
            total = float(cells[2])
        except ValueError:
            continue
        disc_pts = {}
        for i, dn in enumerate(disc_order):
            try:
                v = cells[3 + i]
                disc_pts[dn] = float(v) if v not in ("-", "") else None
            except (IndexError, ValueError):
                disc_pts[dn] = None
        results.append({
            "year": year, "gender": gender_name, "rank": rank,
            "name": extract_name(cells[1]), "total": str(total),
            **{f"disc_{k}": v for k, v in disc_pts.items()},
        })
    return results

def has_next_page(html, page):
    return f"page={page + 1}" in html

def scrape_year(session, year: str) -> tuple[list, list, list]:
    """1年分をスクレイピングして (records, overall, errors) を返す"""
    records, overall, errors = [], [], []
    for gender_name, gender_val in GENDERS:
        for disc_name, disc_val in DISCIPLINES:
            try:
                html = set_filter(session, disc_val, gender_val, year)
                time.sleep(0.25)
                page = 1
                while True:
                    rows = parse_records_rows(html, year, disc_name, gender_name)
                    records.extend(rows)
                    if not rows or not has_next_page(html, page):
                        break
                    page += 1
                    html = fetch_page(session, page)
                    time.sleep(0.25)
                print(f"  ✓ {year} {gender_name} {disc_name}: {len(rows)}名")
            except Exception as e:
                print(f"  ✗ {year} {gender_name} {disc_name}: {e}")
                errors.append(f"{year}/{gender_name}/{disc_name}: {e}")
            time.sleep(0.35)

        # OVERALL
        try:
            html = set_filter(session, DISC_OVERALL, gender_val, year)
            time.sleep(0.25)
            rows = parse_overall_rows(html, year, gender_name)
            overall.extend(rows)
            print(f"  ✓ {year} {gender_name} OVERALL: {len(rows)}名")
        except Exception as e:
            print(f"  ✗ {year} {gender_name} OVERALL: {e}")
            errors.append(f"{year}/{gender_name}/OVERALL: {e}")
        time.sleep(0.35)

    return records, overall, errors


def save_year_json(year: str, records: list, overall: list):
    """rankings_{year}.json として保存（上書き）"""
    out_path = DATA_DIR / f"rankings_{year}.json"
    out = {
        "year": int(year),
        "updatedAt": datetime.date.today().isoformat(),
        "records": records,
        "overall": overall,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"  💾 保存: {out_path.name}  (records={len(records)}, overall={len(overall)})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year",  type=str, help="取得する年（デフォルト: 今年）")
    parser.add_argument("--years", nargs="+", help="複数年を指定 例: --years 2024 2025 2026")
    parser.add_argument("--all",   action="store_true", help="全年度取得（初回のみ・30〜60分）")
    args = parser.parse_args()

    if args.all:
        years = ALL_YEARS
        print(f"📚 全年度取得モード: {years[-1]}〜{years[0]} ({len(years)}年)")
    elif args.years:
        years = args.years
        print(f"📅 指定年取得: {years}")
    else:
        years = [args.year or str(CURRENT_YEAR)]
        print(f"🔄 単年取得モード: {years[0]}")

    session = requests.Session()
    session.get(f"{BASE}/Ranking/", headers=HEADERS, timeout=30)

    total_errors = []
    for year in years:
        print(f"\n=== {year} ===")
        records, overall, errors = scrape_year(session, year)
        total_errors.extend(errors)
        if records or overall:
            save_year_json(year, records, overall)
        else:
            print(f"  （{year}年のデータなし）")

    print(f"\n✅ 完了")
    if total_errors:
        print(f"⚠️  エラー {len(total_errors)}件:")
        for e in total_errors:
            print(f"   • {e}")

    if not records and not overall:
        print("❌ データが取れませんでした", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
