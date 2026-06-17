#!/usr/bin/env python3
"""OVERALLデータのみ再取得"""
import re, json, time, datetime, requests

BASE      = "https://www.aidainternational.org"
RANK_POST = f"{BASE}/Ranking/index.php"
RANK_GET  = f"{BASE}/Ranking/index.php"
NAT_JP    = "108"
HEADERS   = {"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             "Content-Type":"application/x-www-form-urlencoded",
             "Referer":f"{BASE}/Ranking/"}
ROW_RE  = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S|re.I)
CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S|re.I)

def strip(h): return re.sub(r"\s+"," ",re.sub(r"<[^>]+>","",h)).strip()
def clean_name(r): return re.sub(r"\s*\([^)]+\)\s*$","",r).strip()

def set_filter_and_get(session, gender_val, year_val):
    """POST sets Japan+year+overall filter, response body is page 1"""
    resp = session.post(RANK_POST,
        data={"discipline":"all","nationality":NAT_JP,"continent":"",
              "gender":gender_val,"year":year_val,"apply":""},
        headers=HEADERS, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    return resp.text

def fetch_page(session, page):
    url = RANK_GET if page == 1 else f"{RANK_GET}?page={page}"
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def parse_overall(html, year, gender):
    disc_order = ["STA","DYN","DYNB","DNF","CWT","CWTB","CNF","FIM"]
    results = []
    for row in ROW_RE.findall(html):
        cells = [strip(c) for c in CELL_RE.findall(row)]
        if len(cells) < 3 or cells[0] == "#" or not cells[0].replace(".","").strip().isdigit():
            continue
        try: rank = int(re.sub(r"\D","",cells[0]))
        except: continue
        try: total = float(cells[2])
        except: continue
        disc_pts = {}
        for i, dn in enumerate(disc_order):
            try:
                v = cells[3+i]
                disc_pts[dn] = float(v) if v not in ("-","","–") else None
            except: disc_pts[dn] = None
        results.append({
            "year": year, "gender": gender, "rank": rank,
            "name": clean_name(cells[1]), "total": str(total),
            **{f"disc_{k}": v for k,v in disc_pts.items()}
        })
    return results

def main():
    with open("all_rankings_data.json") as f:
        data = json.load(f)
    years = sorted(set(r["year"] for r in data["records"]))
    print(f"Fetching OVERALL for {len(years)} years: {years[0]}–{years[-1]}")

    session = requests.Session()
    # Prime session
    session.get(f"{BASE}/Ranking/", headers=HEADERS, timeout=30)
    time.sleep(0.5)

    all_overall = []
    genders = [("Male","0"), ("Female","1")]

    for year in reversed(years):
        for gender_name, gender_val in genders:
            try:
                html = set_filter_and_get(session, gender_val, year)
                time.sleep(0.3)

                # Debug: check if Japan data is in html
                has_japan = "Japan" in html
                page_match = re.search(r"Page \d+ of (\d+)", html)
                total_pages = int(page_match.group(1)) if page_match else 1

                rows = []
                for page in range(1, total_pages + 1):
                    if page > 1:
                        html = fetch_page(session, page)
                        time.sleep(0.25)
                    r = parse_overall(html, year, gender_name)
                    rows.extend(r)
                    if f"page={page+1}" not in html:
                        break

                flag = "✓" if rows else "–"
                print(f"  {flag} {year} {gender_name}: {len(rows)} athletes, {total_pages}p, japan_in_html={has_japan}")
                all_overall.extend(rows)
            except Exception as e:
                print(f"  ✗ {year} {gender_name}: {e}")
            time.sleep(0.4)

    print(f"\nTotal overall entries: {len(all_overall)}")
    if len(all_overall) == 0:
        print("ERROR: No overall data found. Check internet connection or AIDA site.")
        return

    data["overall"] = all_overall
    data["updated"] = datetime.date.today().isoformat()
    with open("all_rankings_data.json","w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"✅ Saved {len(all_overall)} overall entries to all_rankings_data.json")

if __name__ == "__main__":
    main()
