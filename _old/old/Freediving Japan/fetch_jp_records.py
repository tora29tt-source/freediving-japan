#!/usr/bin/env python3
"""
AIDA Japan National Records fetcher
-----------------------------------
Pulls the current Japanese national record (rank #1, all years) for each
discipline x gender from the AIDA International ranking page, plus each
record holder's profile photo, and writes jp_official_records.json.

Run weekly (e.g. cron). No external deps beyond `requests`:
    pip install requests
    python3 fetch_jp_records.py

Cron example (every Monday 06:00):
    0 6 * * 1  cd /path/to/app && /usr/bin/python3 fetch_jp_records.py >> fetch.log 2>&1
"""
import re, json, sys, time, datetime
import requests

BASE = "https://www.aidainternational.org"
RANK_PAGE = f"{BASE}/Ranking"
RANK_POST = f"{BASE}/Ranking/index.php"
S3 = "https://s3.eu-central-1.amazonaws.com/aida-international/"

NATIONALITY_JAPAN = "108"          # value from the nationality <select>
DISCIPLINES = [                    # (label, select value)
    ("STA", "8"), ("DYN", "6"), ("DYNB", "11"), ("DNF", "7"),
    ("CWT", "3"), ("CWTB", "12"), ("CNF", "4"), ("FIM", "5"),
]
GENDERS = [("Male", "0"), ("Female", "1")]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
    "Content-Type": "application/x-www-form-urlencoded",
}

ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
PROFILE_RE = re.compile(r'href="([^"]*Athletes/Profile-[^"]+)"', re.I)
AVATAR_RE = re.compile(r"avatar/170x170/[a-f0-9\-]+\.webp", re.I)


def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def first_data_row(html):
    """Return (cells, profile_url) for the first ranking row (rank #1)."""
    for row in ROW_RE.findall(html):
        cells = CELL_RE.findall(row)
        if len(cells) >= 7:
            prof = PROFILE_RE.search(row)
            return [strip_tags(c) for c in cells], (prof.group(1) if prof else "")
    return None, ""


def fetch_record(session, disc_val, gender_val):
    payload = {
        "discipline": disc_val,
        "nationality": NATIONALITY_JAPAN,
        "continent": "",
        "gender": gender_val,
        "year": "",
        "apply": "",
    }
    r = session.post(RANK_POST, data=payload, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return first_data_row(r.text)


def fetch_photo(session, profile_url):
    if not profile_url:
        return ""
    if profile_url.startswith("/"):
        profile_url = BASE + profile_url
    try:
        r = session.get(profile_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        m = AVATAR_RE.search(r.text)
        return S3 + m.group(0) if m else ""
    except Exception as e:
        print(f"  ! photo fetch failed: {e}", file=sys.stderr)
        return ""


def main():
    session = requests.Session()
    # prime cookies/session by visiting the page once
    session.get(RANK_PAGE, headers=HEADERS, timeout=30)

    records = []
    photo_cache = {}
    for disc, dval in DISCIPLINES:
        for gender, gval in GENDERS:
            cells, prof = fetch_record(session, dval, gval)
            if not cells:
                print(f"  - {disc}/{gender}: no data", file=sys.stderr)
                continue
            # columns: rank, name(country), result, announced, points, penalty, date, event
            name = re.sub(r"\s*\(.*?\)\s*$", "", cells[1]).strip()
            rec = {
                "discipline": disc,
                "gender": gender,
                "name": name,
                "result": cells[2],
                "points": cells[4],
                "date": cells[6] if len(cells) > 6 else "",
                "event": cells[7] if len(cells) > 7 else "",
                "profile": prof,
            }
            if prof not in photo_cache:
                photo_cache[prof] = fetch_photo(session, prof)
                time.sleep(0.5)
            rec["photo"] = photo_cache[prof]
            records.append(rec)
            print(f"  + {disc}/{gender}: {name} {rec['result']}")
            time.sleep(0.4)

    out = {
        "updated": datetime.date.today().isoformat(),
        "source": "AIDA International Ranking (nationality=Japan, all years)",
        "records": records,
    }
    with open("jp_official_records.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"Wrote jp_official_records.json with {len(records)} records.")

    # ---- full athlete photo map (all Japanese ranked athletes, all pages) ----
    print("Harvesting all athlete photos ...")
    name_to_profile = {}
    for disc, dval in DISCIPLINES:
        for gender, gval in GENDERS:
            # POST sets the Japan filter in the session; pages are GET ?page=N
            session.post(RANK_POST, data={
                "discipline": dval, "nationality": NATIONALITY_JAPAN,
                "continent": "", "gender": gval, "year": "", "apply": "",
            }, headers=HEADERS, timeout=30)
            page = 1
            while True:
                r = session.get(f"{RANK_POST}?page={page}", headers=HEADERS, timeout=30)
                html = r.text
                found = False
                for row in ROW_RE.findall(html):
                    cells = CELL_RE.findall(row)
                    if len(cells) < 5:
                        continue
                    prof = PROFILE_RE.search(row)
                    if not prof:
                        continue
                    nm = re.sub(r"\s*\(.*?\)\s*$", "", strip_tags(cells[1])).strip()
                    if nm and nm not in name_to_profile:
                        name_to_profile[nm] = prof.group(1)
                    found = True
                # stop when a page has no data rows or no "next" page link
                if not found or f"page={page+1}" not in html:
                    break
                page += 1
                time.sleep(0.2)

    DEFAULT_AVATAR = "2b0e393a"  # AIDA generic silhouette -> treat as no photo
    athlete_photos = {}
    for nm, prof in name_to_profile.items():
        url = fetch_photo(session, prof)
        if url and DEFAULT_AVATAR not in url:
            athlete_photos[nm] = url
        time.sleep(0.2)
    with open("athlete_photos.json", "w", encoding="utf-8") as f:
        json.dump(athlete_photos, f, ensure_ascii=False, indent=1)
    print(f"Wrote athlete_photos.json with {len(athlete_photos)} photos "
          f"(of {len(name_to_profile)} athletes).")


if __name__ == "__main__":
    main()
