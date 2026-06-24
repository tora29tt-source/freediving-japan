# Freediving Japan — バッチ処理仕様書

バッチ処理（定期自動実行・手動実行）の一覧と仕様をまとめたドキュメント。

*最終更新：2026-06-24*

---

## 一覧

| # | 処理名 | スクリプト | 頻度 | 自動化 | 出力先 |
|---|---|---|---|---|---|
| 1 | AIDA 2026大会データ更新 | `scripts/fetch_aida_events.py` | 毎日 | ✅ GitHub Actions | `data/aida_events_2026.json` |
| 2 | 今年のランキング更新 | `scripts/fetch_all_rankings.py` | 毎週月曜 | ✅ GitHub Actions | `data/rankings_{year}.json` |
| 3 | 日本記録更新 | `scripts/fetch_jp_records.py` | 毎週月曜 | ✅ GitHub Actions | `data/jp_official_records.json` |

---

## データ設計

### ランキングデータの分割方針

過去のランキングは一度確定したら変わらないため、静的ファイルとして保持する。
バッチで毎回再取得するのは **今年分のみ**。

```
data/
  rankings_historical.json   ← 2025年以前の確定データ（静的・変更不要）
  rankings_2026.json         ← 2026年分（週次バッチで上書き更新）
  rankings_2027.json         ← 来年になったら自動作成
  aida_events_2026.json      ← AIDA大会データ（日次バッチで更新）
  jp_official_records.json   ← 日本記録（週次バッチで更新）
```

**年度をまたぐ運用（例：2026 → 2027）**
1. `rankings_2026.json` の内容を `rankings_historical.json` にマージ
2. GitHub Actions ワークフローの `--year` を `2027` に変更
3. `aida_events_2026.json` → `aida_events_2027.json` を新規作成

---

## 1. AIDA 大会データ更新

### 概要

AIDA公式サイトの大会カレンダーをスクレイピングして `data/aida_events_{year}.json` を更新する。

### 仕組み

```
GitHub Actions（毎日 JST 08:00）
  └─ xvfb-run python3 scripts/fetch_aida_events.py --year 2026
       └─ Playwright（headless=False + xvfb 仮想ディスプレイ）
            └─ jQuery で月フィルタを操作（1〜12月）
                 └─ DOMから大会情報をパース → data/aida_events_2026.json
```

**AIDA サイトが PHP セッション＋ Select2（jQuery）でフィルタを管理しているため、通常の HTTP リクエストでは月別データが取得できない。xvfb 上で Chromium を実際に動かすことで解決。**

### ファイル

| ファイル | 役割 |
|---|---|
| `scripts/fetch_aida_events.py` | スクレイパー本体（xvfb + jQuery 方式） |
| `scripts/receive_aida_data.py` | 手動収集用ブリッジサーバー（緊急時・デバッグ用） |
| `.github/workflows/update_aida_events.yml` | GitHub Actions ワークフロー |
| `data/aida_events_2026.json` | 出力データ |

### JSON 構造

```json
{
  "year": 2026,
  "updatedAt": "2026-06-24T10:33:34Z",
  "source": "aida_playwright_scrape",
  "events": [
    {
      "title": "AIDA Pool World Championship 2026",
      "type": "Pool Competition",
      "venue": "会場名",
      "cityCountry": "City, Country",
      "startDate": "2026-01-15",
      "endDate": "2026-01-18",
      "link": "https://www.aidainternational.org/Events/...",
      "month": 1,
      "cat": "wc"
    }
  ]
}
```

`cat` フィールド：`"wc"`（世界選手権）/ `"sea"`（深度競技）/ `"pool"`（プール競技）

### HTML での読み込み

`events/2026_competitions.html` は起動時に `/data/aida_events_2026.json` を fetch して動的表示。
取得失敗時は HTML 内のフォールバックデータ（`INTL_EVENTS_FALLBACK`）を使用。

### スケジュール

```
cron: '0 23 * * *'  # UTC 23:00 = JST 08:00（毎日）
```

### 障害時の手動収集手順

```bash
cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
python3 scripts/receive_aida_data.py
# → Chrome MCP で AIDA サイトを操作し localhost:8765 にデータを送る
```

---

## 2. ランキング更新

### 概要

AIDA 公式ランキングから今年（当年）の日本人選手データのみを取得し `rankings_{year}.json` を更新する。

### 仕組み

```
GitHub Actions（毎週月曜 JST 06:00）
  └─ python3 scripts/fetch_all_rankings.py
       └─ requests で AIDA ランキングページに POST
            └─ 種目×性別×全ページ をパース → data/rankings_2026.json
```

### スクリプトの使い方

```bash
# 今年のみ更新（週次バッチ・デフォルト）
python3 scripts/fetch_all_rankings.py

# 特定年を取得
python3 scripts/fetch_all_rankings.py --year 2025

# 複数年を取得
python3 scripts/fetch_all_rankings.py --years 2024 2025

# 全年度を再取得（初回のみ・30〜60分）
python3 scripts/fetch_all_rankings.py --all
```

### JSON 構造（rankings_{year}.json）

```json
{
  "year": 2026,
  "updatedAt": "2026-06-24",
  "records": [
    {
      "year": "2026", "discipline": "STA", "gender": "Male",
      "rank": 1, "name": "Takuya Terajima",
      "result": "07:54", "points": 94.8,
      "date": "2026-04-18", "event": "AIDA Mabini Pool Competition"
    }
  ],
  "overall": [
    {
      "year": "2026", "gender": "Male", "rank": 1,
      "name": "Noriyuki Yabe", "total": "332.2",
      "disc_STA": 81.2, "disc_DYN": 93.0, ...
    }
  ]
}
```

---

## 3. 日本記録更新

### 概要

各種目の日本記録（AIDA 公式ランキング 1 位）と記録保持者のプロフィール写真を取得する。

### 取得種目

STA / DYN / DYNB / DNF / CWT / CWTB / CNF / FIM × 男女 = 16 件

### スクリプトの使い方

```bash
python3 scripts/fetch_jp_records.py
```

### スケジュール

ランキング更新と同じワークフロー（毎週月曜 JST 06:00）で実行される。

---

## GitHub Actions ワークフロー一覧

| ファイル | トリガー | 処理 |
|---|---|---|
| `.github/workflows/update_aida_events.yml` | 毎日 JST 08:00 | 大会データ更新 |
| `.github/workflows/update_rankings.yml` | 毎週月曜 JST 06:00 | ランキング＋日本記録更新 |

---

## ローカル開発環境セットアップ

```bash
pip install requests playwright beautifulsoup4 openpyxl
playwright install chromium --with-deps
```
