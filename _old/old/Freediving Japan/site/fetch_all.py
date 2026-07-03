#!/usr/bin/env python3
"""
AIDA Japan data fetcher  ->  writes data/*.json for the static site.

Outputs (into ./data/):
  - jp_official_records.json : current Japanese national record per discipline x gender (+ photo)
  - rankings.json            : per-year rankings per discipline x gender, plus OVERALL totals
  - athlete_photos.json      : name -> profile photo URL for every ranked Japanese athlete

Requirements:  pip install requests
Run weekly, e.g. cron (Mondays 06:00):
  0 6 * * 1  cd /path/to/site && /usr/bin/python3 fetch_all.py >> fetch.log 2>&1

NOTE: This scrapes the public AIDA ranking pages. If AIDA changes their page
structure, the parsing constants / selectors below may need adjustment.
"""
import re, os, json, sys, time, datetime
import requests

BASE = "https://www.aidainternational.org"
RANK_PAGE = f"{BASE}/Ranking"
RANK_POST = f"{BASE}/Ranking/index.php"
S3 = "https://s3.eu-central-1.amazonaws.com/aida-international/"
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "data")

NATIONALITY_JAPAN = "108"
DISCIPLINES = [("STA", "8"), ("DYN", "6"), ("DYNB", "11"), ("DNF", "7"),
               ("CWT", "3"), ("CWTB", "12"), ("CNF", "4"), ("FIM", "5")]
GENDERS = [("Male", "0"), ("Female", "1")]
# Years to pull per-year rankings for. Adjust as needed.
YEAR_FROM = int(os.environ.get("YEAR_FROM", "2015"))
YEAR_TO = datetime.date.today().year
DEFAULT_AVATAR = "2b0e393a"  # AIDA generic silhouette -> treated as "no photo"

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
           "Content-Type": "application/x-www-form-urlencoded"}

ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
PROFILE_RE = re.compile(r'href="([^"]*Athletes/Profile-[^"]+)"', re.I)
AVATAR_RE = re.compile(r"avatar/170x170/[a-f0-9\-]+\.webp", re.I)


def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def parse_rows(html):
    """Yield (cells[list], profile_url) for every data row in the page."""
    for row in ROW_RE.findall(html):
        cells = CELL_RE.findall(row)
        if len(cells) < 5:
            continue
        prof = PROFILE_RE.search(row)
        yield [strip_tags(c) for c in cells], (prof.group(1) if prof else "")


def set_filter(session, disc_val, gender_val, year=""):
    """POST the filter (server keeps it in session); returns page-1 html."""
    r = session.post(RANK_POST, data={
        "discipline": disc_val, "nationality": NATIONALITY_JAPAN,
        "continent": "", "gender": gender_val, "year": year, "apply": "",
    }, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def all_pages(session, first_html):
    """Yield rows across all paginated pages for the current session filter."""
    html = first_html
    page = 1
    while True:
        got = False
        for cells, prof in parse_rows(html):
            got = True
            yield cells, prof
        if not got or f"page={page+1}" not in html:
            break
        page += 1
        time.sleep(0.2)
        html = session.get(f"{RANK_POST}?page={page}", headers=HEADERS, timeout=30).text


def fetch_photo(session, profile_url, cache):
    if not profile_url:
        return ""
    if profile_url in cache:
        return cache[profile_url]
    if profile_url.startswith("/"):
        profile_url = BASE + profile_url
    url = ""
    try:
        t = session.get(profile_url, headers=HEADERS, timeout=30).text
        m = AVATAR_RE.search(t)
        if m and DEFAULT_AVATAR not in m.group(0):
            url = S3 + m.group(0)
    except Exception as e:
        print(f"  ! photo fail {profile_url}: {e}", file=sys.stderr)
    cache[profile_url] = url
    time.sleep(0.25)
    return url


def clean_name(raw):
    return re.sub(r"\s*\(.*?\)\s*$", "", raw).strip()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    s = requests.Session()
    s.get(RANK_PAGE, headers=HEADERS, timeout=30)  # prime cookies
    photo_cache = {}            # profile_url -> photo url
    name_photo = {}             # name -> photo url
    name_profile = {}           # name -> profile url

    # 1) national records (all-years, rank #1) ------------------------------
    nat = []
    for disc, dval in DISCIPLINES:
        for gender, gval in GENDERS:
            html = set_filter(s, dval, gval, year="")
            top = next(iter(parse_rows(html)), None)
            if not top:
                continue
            cells, prof = top
            name = clean_name(cells[1])
            ph = fetch_photo(s, prof, photo_cache)
            if ph:
                name_photo[name] = ph
            nat.append({"discipline": disc, "gender": gender, "name": name,
                        "result": cells[2], "points": cells[4],
                        "date": cells[6] if len(cells) > 6 else "",
                        "event": cells[7] if len(cells) > 7 else "",
                        "photo": ph})
            print(f"  NR {disc}/{gender}: {name} {cells[2]}")
            time.sleep(0.3)
    json.dump({"updated": datetime.date.today().isoformat(),
               "source": "AIDA International Ranking (nationality=Japan, all years)",
               "records": nat},
              open(f"{OUTPUT_DIR}/jp_official_records.json", "w"),
              ensure_ascii=False, indent=1)
    print(f"-> jp_official_records.json ({len(nat)})")

    # 2) per-year rankings + OVERALL ---------------------------------------
    records, overall = [], []
    for year in range(YEAR_TO, YEAR_FROM - 1, -1):
        ys = str(year)
        for disc, dval in DISCIPLINES:
            for gender, gval in GENDERS:
                html = set_filter(s, dval, gval, year=ys)
                rank = 0
                for cells, prof in all_pages(s, html):
                    if not cells[0].rstrip(".").isdigit():
                        continue
                    rank += 1
                    name = clean_name(cells[1])
                    if prof and name not in name_profile:
                        name_profile[name] = prof
                    records.append({"discipline": disc, "gender": gender,
                                    "year": ys, "rank": rank, "name": name,
                                    "result": cells[2], "points": cells[4],
                                    "date": cells[6] if len(cells) > 6 else "",
                                    "event": cells[7] if len(cells) > 7 else ""})
                time.sleep(0.2)
            # OVERALL totals per year/gender
        for gender, gval in GENDERS:
            html = set_filter(s, "all", gval, year=ys)
            rank = 0
            for cells, prof in all_pages(s, html):
                if not cells[0].rstrip(".").isdigit():
                    continue
                rank += 1
                name = clean_name(cells[1])
                if prof and name not in name_profile:
                    name_profile[name] = prof
                overall.append({"year": ys, "gender": gender, "rank": rank,
                                "name": name, "total": cells[2]})
            time.sleep(0.2)
        print(f"  year {ys}: records={len(records)} overall={len(overall)}")
    json.dump({"records": records, "overall": overall},
              open(f"{OUTPUT_DIR}/rankings.json", "w"), ensure_ascii=False)
    print(f"-> rankings.json (records={len(records)}, overall={len(overall)})")

    # 3) photos for every ranked athlete -----------------------------------
    for name, prof in name_profile.items():
        if name in name_photo:
            continue
        ph = fetch_photo(s, prof, photo_cache)
        if ph:
            name_photo[name] = ph
    json.dump(name_photo, open(f"{OUTPUT_DIR}/athlete_photos.json", "w"),
              ensure_ascii=False, indent=1)
    print(f"-> athlete_photos.json ({len(name_photo)} photos / "
          f"{len(name_profile)} athletes)")


if __name__ == "__main__":
    main()
