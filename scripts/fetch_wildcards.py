#!/usr/bin/env python3
"""
AIDA Wild Cards fetcher
-----------------------
Fetches the wild card ranking table for each discipline/gender for the
current year, filters for Japanese athletes, and writes
data/wildcard_data.json.

Run alongside fetch_all_rankings.py in the GitHub Actions workflow.
Requires only `requests` (no BeautifulSoup).
"""
import re, json, datetime, time, os
import requests

BASE    = "https://www.aidainternational.org"
WC_URL  = f"{BASE}/Ranking/WildCards"
YEAR    = str(datetime.date.today().year)

# (label, form value) — same numeric IDs as fetch_jp_records.py
DISCIPLINES = [
    ("STA","8"), ("DYN","6"), ("DYNB","11"), ("DNF","7"),
    ("CWT","3"), ("CWTB","12"), ("CNF","4"), ("FIM","5"),
]
GENDERS = [("Male","0"), ("Female","1")]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": WC_URL,
}

ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)

def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()

def parse_name_nationality(cell_html):
    """'Hanako Hirose (Japan)' → ('Hanako Hirose', 'Japan')"""
    text = strip_tags(cell_html)
    m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text.strip(), ""

def fetch_wc_page(session, disc_id, gender_id, year):
    # WildCards page uses "disc" (not "discipline") with numeric IDs
    payload = {
        "disc":   disc_id,
        "gender": gender_id,
        "year":   year,
        "apply":  "Apply",
    }
    r = session.post(WC_URL, data=payload, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def parse_wc_table(html):
    """Return list of dicts: rank, name, nationality, result, points, date"""
    results = []
    for row in ROW_RE.findall(html):
        cells = CELL_RE.findall(row)
        if len(cells) < 6:
            continue
        rank_text = strip_tags(cells[0]).rstrip(".")
        if not rank_text.isdigit():
            continue
        name, nationality = parse_name_nationality(cells[1])
        result  = strip_tags(cells[2])
        points_raw = strip_tags(cells[4])
        try:
            points = float(points_raw)
        except ValueError:
            points = 0.0
        date = strip_tags(cells[6]) if len(cells) > 6 else ""
        results.append({
            "rank":        int(rank_text),
            "name":        name,
            "nationality": nationality,
            "result":      result,
            "points":      points,
            "date":        date,
        })
    return results

def is_japan(nationality):
    return nationality.strip().lower() in ("japan", "日本")

def main():
    session = requests.Session()
    # Prime session / cookies
    session.get(WC_URL, headers={"User-Agent": HEADERS["User-Agent"]}, timeout=30)
    time.sleep(0.5)

    japan_wc = {}   # key: "DISC|Gender" → list of JP WC holders (all top-10)
    all_wc   = {}   # full top-10 for every disc/gender (for reference)

    for disc_label, disc_id in DISCIPLINES:
        for gender_label, gender_id in GENDERS:
            key = f"{disc_label}|{gender_label}"
            print(f"  Fetching WC {key} ({YEAR})...")
            try:
                html = fetch_wc_page(session, disc_id, gender_id, YEAR)
                rows = parse_wc_table(html)
                all_wc[key] = rows
                jp = [r for r in rows if is_japan(r["nationality"])]
                if jp:
                    japan_wc[key] = jp
                    for r in jp:
                        print(f"    🇯🇵 #{r['rank']} {r['name']} {r['result']}")
                else:
                    print(f"    (no JP athletes in top {len(rows)})")
            except Exception as e:
                print(f"    ! Error: {e}")
            time.sleep(0.6)

    out = {
        "updated": datetime.date.today().isoformat(),
        "year":    int(YEAR),
        "japan":   japan_wc,
        "all":     all_wc,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/wildcard_data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    jp_count = sum(len(v) for v in japan_wc.values())
    print(f"\nWrote data/wildcard_data.json")
    print(f"Japanese WC entries: {jp_count} across {len(japan_wc)} disc/gender combos")

if __name__ == "__main__":
    main()
