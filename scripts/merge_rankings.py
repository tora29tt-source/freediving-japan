#!/usr/bin/env python3
"""
merge_rankings.py
==================
rankings_historical.json（〜前年・固定）と
rankings_{year}.json（今年・毎週更新）を結合して
all_rankings_data.json を再生成する。

Usage:
    python3 scripts/merge_rankings.py
    python3 scripts/merge_rankings.py --year 2026   # 特定年を対象
"""

import json
import datetime
import argparse
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
HISTORICAL_PATH = DATA_DIR / "rankings_historical.json"
OUT_PATH        = DATA_DIR / "all_rankings_data.json"

CURRENT_YEAR = datetime.date.today().year


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=CURRENT_YEAR,
                        help="今年分として取り込む年（デフォルト: 今年）")
    args = parser.parse_args()

    # --- 過去データ読み込み ---
    historical = load_json(HISTORICAL_PATH)
    hist_records = historical.get("records", [])
    hist_overall = historical.get("overall", [])
    hist_years   = historical.get("years", [])
    print(f"📚 historical: {len(hist_records)} records, {len(hist_overall)} overall ({len(hist_years)}年分)")

    # --- 今年データ読み込み ---
    year_path = DATA_DIR / f"rankings_{args.year}.json"
    if not year_path.exists():
        print(f"⚠️  {year_path.name} が見つかりません。historical のみで生成します。")
        cur_records, cur_overall, cur_updated = [], [], None
    else:
        cur = load_json(year_path)
        cur_records = cur.get("records", [])
        cur_overall = cur.get("overall", [])
        cur_updated = cur.get("updatedAt") or str(cur.get("year", args.year))
        print(f"📅 {args.year}: {len(cur_records)} records, {len(cur_overall)} overall (updated: {cur_updated})")

    # --- マージ ---
    # historical に今年分が混入していても上書きされないよう、
    # 今年以外の historical + 今年の cur で構成する
    all_records = [r for r in hist_records if str(r.get("year", "")) != str(args.year)]
    all_records += cur_records

    all_overall = [o for o in hist_overall if str(o.get("year", "")) != str(args.year)]
    all_overall += cur_overall

    years_fetched = sorted(set(hist_years + [str(args.year)]), key=int)

    out = {
        "updated":       cur_updated or datetime.date.today().isoformat(),
        "years_fetched": years_fetched,
        "records":       all_records,
        "overall":       all_overall,
        "errors":        [],
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f"\n✅ 生成完了: {OUT_PATH.name}")
    print(f"   records: {len(all_records)}, overall: {len(all_overall)}, years: {years_fetched}")


if __name__ == "__main__":
    main()
