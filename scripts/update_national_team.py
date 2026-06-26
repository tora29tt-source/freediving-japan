#!/usr/bin/env python3
"""
update_national_team.py
========================
AIDA World Championships の結果ページをスクレイピングして
data/national_team.json に日本代表出場歴を自動追記する。

【使い方】
  # 特定イベントIDを指定（初回や手動更新時）
  python3 scripts/update_national_team.py --event 4852

  # 今年開催された世界選手権を自動検索して更新
  python3 scripts/update_national_team.py --auto

【設計方針】
  - 既存データは上書きしない（追記のみ）
  - 重複追記しない
  - 新規選手は自動追加

【GitHub Actions での利用】
  毎年、世界選手権シーズン後に手動 dispatch または
  --auto オプションで年次バッチとして実行。

セットアップ:
  pip install requests beautifulsoup4
"""

import re
import json
import argparse
import datetime
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE = "https://www.aidainternational.org"
DATA_DIR = Path(__file__).parent.parent / "data"
NATIONAL_TEAM_PATH = DATA_DIR / "national_team.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FreedivingJapan/1.0)",
    "Referer": f"{BASE}/Events/",
}

DISCIPLINES = [
    ("6",       "pool"),  # DYN
    ("7",       "pool"),  # DNF
    ("8",       "pool"),  # STA
    ("11",      "pool"),  # DYNB
    ("3",       "sea"),   # CWT
    ("12",      "sea"),   # CWTB
    ("4",       "sea"),   # CNF
    ("5",       "sea"),   # FIM
    ("overall", "pool"),  # プールOVERALL（最も網羅的）
]


def fetch_event_ranking(session, event_id: str, discipline: str, gender: str) -> list[str]:
    """
    指定イベント・種目・性別で出場した日本選手名を返す。
    """
    url = f"{BASE}/Events/EventRanking-{event_id}"
    payload = {"discipline": discipline, "gender": gender, "apply": ""}
    r = session.post(url, data=payload, headers=HEADERS, timeout=30)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    names = []
    for row in soup.select("table tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue
        nationality = cells[2].get_text(strip=True)
        if nationality != "JPN":
            continue
        name = cells[1].get_text(strip=True)
        # "(JPN)" サフィックスがある場合は除去
        name = re.sub(r"\s*\(JPN\)\s*$", "", name).strip()
        if name:
            names.append(name)
    return names


def get_japan_participants(event_id: str, category: str) -> list[str]:
    """
    指定イベントの全種目から日本選手を収集する。
    category: "pool" or "sea"
    """
    session = requests.Session()
    session.get(f"{BASE}/Events/EventRanking-{event_id}", headers=HEADERS, timeout=30)

    all_names: set[str] = set()
    for disc_val, disc_cat in DISCIPLINES:
        if disc_cat != category and disc_val != "overall":
            continue
        for gender in ["0", "1"]:
            try:
                names = fetch_event_ranking(session, event_id, disc_val, gender)
                all_names.update(names)
                print(f"  disc={disc_val} gender={'M' if gender=='0' else 'F'}: {len(names)}名")
                time.sleep(0.3)
            except Exception as e:
                print(f"  ⚠️  disc={disc_val} gender={gender}: {e}")

    return sorted(all_names)


def find_world_championships(year: int) -> list[dict]:
    """
    AIDAカレンダーから指定年の世界選手権イベントを検索する。
    """
    url = f"{BASE}/Events/EventCalendar"
    r = requests.get(url, params={"year": year, "type": "World Championship"}, headers=HEADERS, timeout=30)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    events = []
    for link in soup.find_all("a", href=re.compile(r"/EventPage/\d+")):
        title = link.get_text(strip=True)
        event_id = re.search(r"/EventPage/(\d+)", link["href"]).group(1)
        # プール or 海で分類
        if re.search(r"pool", title, re.I):
            cat = "pool"
        elif re.search(r"depth|sea|open water", title, re.I):
            cat = "sea"
        else:
            cat = "unknown"
        events.append({"id": event_id, "title": title, "category": cat})

    return events


def load_national_team() -> dict:
    if NATIONAL_TEAM_PATH.exists():
        return json.loads(NATIONAL_TEAM_PATH.read_text(encoding="utf-8"))
    return {"_note": "AIDA世界選手権に出場した日本代表選手の記録", "athletes": {}}


def save_national_team(data: dict):
    data["_updatedAt"] = datetime.date.today().isoformat()
    NATIONAL_TEAM_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"💾 保存: {NATIONAL_TEAM_PATH}")


def update_team(data: dict, names: list[str], year: str, category: str) -> int:
    """
    national_team.json に選手と年を追記。変更件数を返す。
    """
    athletes = data.setdefault("athletes", {})
    changed = 0
    for name in names:
        if name not in athletes:
            athletes[name] = {"pool": [], "sea": []}
            print(f"  ✨ 新規: {name}")
        entry = athletes[name]
        if year not in entry[category]:
            entry[category] = sorted(set(entry[category] + [year]))
            print(f"  ➕ {name}: {category} {year} 追記")
            changed += 1
    return changed


def main():
    parser = argparse.ArgumentParser(description="AIDA世界選手権から日本代表データを更新")
    parser.add_argument("--event", help="イベントID（例: 4852）")
    parser.add_argument("--category", choices=["pool", "sea"], default="pool",
                        help="種別（pool or sea）")
    parser.add_argument("--year", help="出場年（省略時は今年）")
    parser.add_argument("--auto", action="store_true",
                        help="今年の世界選手権を自動検索して更新")
    args = parser.parse_args()

    target_year = args.year or str(datetime.date.today().year)
    data = load_national_team()

    if args.auto:
        print(f"🔍 {target_year}年の世界選手権を検索中...")
        events = find_world_championships(int(target_year))
        if not events:
            print("  世界選手権が見つかりませんでした")
            return
        for ev in events:
            print(f"\n📋 {ev['title']} (ID:{ev['id']}, {ev['category']})")
            if ev["category"] == "unknown":
                print("  カテゴリ不明のためスキップ")
                continue
            names = get_japan_participants(ev["id"], ev["category"])
            print(f"  日本選手 {len(names)}名: {names}")
            changed = update_team(data, names, target_year, ev["category"])
            print(f"  変更: {changed}件")

    elif args.event:
        print(f"📋 イベントID {args.event} ({args.category}) を処理中...")
        names = get_japan_participants(args.event, args.category)
        print(f"  日本選手 {len(names)}名: {names}")
        changed = update_team(data, names, target_year, args.category)
        print(f"  変更: {changed}件")

    else:
        parser.print_help()
        return

    save_national_team(data)
    print("\n✅ 完了")


if __name__ == "__main__":
    main()
