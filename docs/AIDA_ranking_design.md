# AIDA Japan ランキング画面 設計書

> 対象ファイル: `rankings/AIDA_ranking.html`
> 最終更新: 2026-06-27

---

## 1. システム全体概要

```
AIDA International (aidainternational.org)
        │ スクレイピング（HTTPSリクエスト）
        ▼
  GitHub Actions (毎日 JST 06:00)
        │ Python スクリプト群
        ▼
  data/*.json (GitHub リポジトリ)
        │ Vercel 自動デプロイ
        ▼
  rankings/AIDA_ranking.html
  （ブラウザ上で fetch() + JS レンダリング）
```

---

## 2. データファイル一覧

| ファイル | 生成スクリプト | 更新頻度 | 内容 |
|---|---|---|---|
| `data/rankings_{year}.json` | `fetch_all_rankings.py` | 毎日 | 今年の日本人選手ランキング |
| `data/rankings_historical.json` | 手動（固定） | 変更なし | 2000〜前年の全記録（約4000件） |
| `data/all_rankings_data.json` | `merge_rankings.py` | 毎日 | historical + 今年をマージした全データ |
| `data/jp_official_records.json` | `fetch_jp_records.py` | 毎日 | 種目×性別の全年度1位（日本記録） |
| `data/national_team.json` | 手動 or `update_national_team.py` | 大会後 | AIDA世界選手権に出場した日本代表選手の記録 |
| `data/athlete_photos.json` | `fetch_jp_records.py`（副産物） | 毎日 | 選手名→プロフィール写真URL |

### 2-1. `all_rankings_data.json` スキーマ

```json
{
  "updated": "2026-06-26",
  "years_fetched": ["2000", "2001", ..., "2026"],
  "records": [
    {
      "year": "2026",
      "discipline": "STA",
      "gender": "Male",
      "rank": 1,
      "name": "Takuya Terajima",
      "result": "07:54",
      "points": 94.8,
      "date": "2026-04-18",
      "event": "大会名"
    }
  ],
  "overall": [
    {
      "year": "2026",
      "gender": "Male",
      "rank": 1,
      "name": "Takuya Terajima",
      "total": "523.6",
      "disc_STA": 94.8,
      "disc_DYN": null,
      ...
    }
  ],
  "errors": []
}
```

### 2-2. `jp_official_records.json` スキーマ

```json
{
  "updated": "2026-06-26",
  "source": "AIDA International Ranking (nationality=Japan, all years)",
  "records": [
    {
      "discipline": "STA",
      "gender": "Male",
      "name": "Takuya Terajima",
      "result": "07:54 NR",
      "points": "94.8",
      "date": "2026-04-18",
      "photo": "https://s3.eu-central-1.amazonaws.com/..."
    }
  ]
}
```

> ⚠️ **注意**: `result` フィールドに NR/CR/PEN のバッジテキストが含まれる場合がある（スクレイピング由来）。`fetch_jp_records.py` 側で `re.sub(r"\s*(NR|WR|CR|AR|PEN)\s*", " ", cells[2])` でストリップ済み。

### 2-3. `national_team.json` スキーマ

```json
{
  "_note": "AIDA世界選手権に出場した日本代表選手の記録",
  "_updatedAt": "2026-06-25",
  "athletes": {
    "Hanako Hirose": {
      "pool": ["2009", "2011", "2023", "2025"],
      "sea": ["2009", "2015"]
    }
  }
}
```

---

## 3. バッチ処理（GitHub Actions）

### 3-1. `update_rankings.yml` — メインバッチ

**スケジュール**: 毎日 JST 06:00（UTC 前日 21:00）  
**手動実行**: workflow_dispatch 対応

```
ステップ:
1. fetch_all_rankings.py   → rankings_{year}.json を更新（今年のランキング）
2. fetch_jp_records.py     → jp_official_records.json を更新（全年度1位）
3. merge_rankings.py       → all_rankings_data.json を再生成
4. git add / commit / push → 変更があればコミット
```

**コミットメッセージ**: `chore: update rankings & records YYYY-MM-DD`

### 3-2. `update_national_team.yml` — 日本代表更新

**実行方式**: 手動（workflow_dispatch）のみ  
**入力パラメータ**:
- `event_id`: AIDAイベントID（例: 4852）
- `category`: `pool` or `sea`
- `year`: 出場年（省略時は今年）

```
ステップ:
1. update_national_team.py → national_team.json に選手・年を追記
2. git add / commit / push
```

---

## 4. スクリプト詳細

### 4-1. `fetch_all_rankings.py`

**役割**: AIDA ランキングページを種目×性別×年でスクレイピング

**リクエスト仕様**:
```
POST https://www.aidainternational.org/Ranking/index.php
Body: discipline={disc}&nationality=108&continent=&gender={g}&year={year}&apply=
```

- `nationality=108` = Japan 固定
- 年フィルタあり（`year=2026` など）→ その年の記録のみ返る
- PEN（Pending）ステータスの結果は年フィルタ付きページに表示されない場合がある

**パース処理**:
```python
result = re.sub(r"\s*(NR|WR|CR|AR|PEN)\s*", "", cells[2]).strip()
points = float(cells[4])
```

**出力**: `data/rankings_{year}.json`

### 4-2. `fetch_jp_records.py`

**役割**: 種目×性別の全年度日本1位（日本記録保持者）を取得

**リクエスト仕様**:
```
POST https://www.aidainternational.org/Ranking/index.php
Body: discipline={disc}&nationality=108&continent=&gender={g}&year=&apply=
```

- `year=` 空（全年度フィルタなし）
- HTMLの最初の `<td>` 行（rank #1）を取得する `first_data_row()` を使用

**⚠️ 既知の問題**: `first_data_row()` は `cells[0] == "#"` チェックなし。ヘッダー行が `<td>` を使っている場合に誤動作する可能性があるが、現状は正常動作している。

**出力**: `data/jp_official_records.json`

### 4-3. `merge_rankings.py`

**役割**: historical + 今年分をマージして `all_rankings_data.json` を生成

```python
# 今年分が historical に混入しないようフィルタ
all_records = [r for r in hist_records if str(r.get("year")) != str(args.year)]
all_records += cur_records
```

**出力**: `data/all_rankings_data.json`

### 4-4. `update_national_team.py`

**役割**: AIDAイベントページから日本代表選手をスクレイピングして追記

```
URL: https://www.aidainternational.org/Events/EventRanking-{event_id}
国籍列（cells[2]）が "JPN" の行を抽出
```

- 追記のみ（上書きなし）
- 重複追記なし

---

## 5. フロントエンド画面構成

### 5-1. データ読み込みフロー

```javascript
Promise.all([
  fetch('../data/all_rankings_data.json'),   // メインランキングデータ
  fetch('../data/national_team.json'),        // 日本代表データ
  fetch('../data/jp_official_records.json')  // 日本記録（バックアップ用）
])
.then(([json, ntJson, jpRecJson]) => {
  NATIONAL_TEAM = ntJson.athletes || {};
  // jp_official_records.json の内容で JP_RECORDS を初期化
  (jpRecJson.records || []).forEach(rec => {
    JP_RECORDS[rec.discipline + '|' + rec.gender] = rec;
  });
  DATA = { updatedAt, records, overall };
  buildYearSel();
  buildJPRecords();  // DATA.records から JP_RECORDS を上書き（最新化）
  renderHero();
  render();
})
```

### 5-2. 画面セクション構成

```
┌─────────────────────────────────────┐
│ 現在の日本記録（ヒーローセクション）   │ ← JP_RECORDS から描画
│  プール種目: DYN/DYNB/DNF/STA        │
│  海（深度）種目: CWT/CWTB/CNF/FIM    │
├─────────────────────────────────────┤
│ 各種シミュレーター・ツールボタン群    │
├─────────────────────────────────────┤
│ 種目タブ選択                         │
├─────────────────────────────────────┤
│ ランキングテーブル                   │ ← DATA.records から描画
│  フィルタ: 種目 × 性別 × 年          │
├─────────────────────────────────────┤
│ 選手詳細モーダル                     │ ← DATA.records + NATIONAL_TEAM
└─────────────────────────────────────┘
```

### 5-3. `JP_RECORDS` の構築ロジック（`buildJPRecords`）

`DATA.records`（全年度）から種目×性別ごとに最高ポイントの記録を選出し、`JP_RECORDS` を上書き:

```javascript
function buildJPRecords() {
  DATA.records.forEach(r => {
    if (r.points == null) return;
    const key = r.discipline + '|' + r.gender;
    const cur = JP_RECORDS[key];
    if (!cur || parseFloat(r.points) > parseFloat(cur.points)) {
      JP_RECORDS[key] = {
        name: r.name, result: r.result + ' NR',
        points: r.points, date: r.date,
        photo: PHOTOS[r.name] || cur?.photo || ''
      };
    }
  });
}
```

> 優先順位: `DATA.records`（全年度最高ポイント） > `jp_official_records.json` > ハードコード値（フォールバック）

### 5-4. 日本代表タグ表示ロジック（`nationalTags`）

```javascript
function nationalTags(name) {
  const t = NATIONAL_TEAM[name];
  if (!t) return '';
  // pool: ["2009","2025"] / sea: ["2019"] の年リストをバッジで表示
  return '<span class="rep-tag pool">日本代表 プール 2009/2025</span>...';
}
```

- 選手詳細モーダルで表示
- `national_team.json` の `athletes` オブジェクトを参照

### 5-5. 種目定数（`DISC`）

```javascript
const DISC = [
  ['OVERALL', '総合',            'Overall',              '全8種目のポイントを合算', 'overall'],
  ['STA',     'スタティック',     'Static Apnea',         '静止息止め',            'pool'],
  ['DYN',     'ダイナミック',     'Dynamic',              '水平距離・フィンあり',   'pool'],
  ['DYNB',    'ダイナミック・バイフィン', 'Dynamic Bi-Fins', '水平距離・バイフィン', 'pool'],
  ['DNF',     'ダイナミック・ノーフィン', 'Dynamic No Fins', '水平距離・フィンなし', 'pool'],
  ['CWT',     'コンスタント・ウェイト',   'CWT',           '深度・フィンあり',      'sea'],
  ['CWTB',    'コンスタント・バイフィン', 'CWTB',          '深度・バイフィン',      'sea'],
  ['CNF',     'コンスタント・ノーフィン', 'CNF',           '深度・フィンなし',      'sea'],
  ['FIM',     'フリー・イマージョン',     'FIM',           '深度・ロープ引き',      'sea'],
];
```

---

## 6. ハードコードされているデータ

### 6-1. `JP_RECORDS`（フォールバック値）

HTMLの `<script>` 内に定義。`buildJPRecords()` 実行後は `DATA.records` の値で上書きされる。

```javascript
let JP_RECORDS = {
  "STA|Male":  { name: "Takuya Terajima", result: "07:54 NR", points: "94.8", ... },
  "STA|Female":{ name: "Yuriko Ichihara", result: "07:52 CR", points: "94.4", ... },
  "DYN|Male":  { name: "Shinya Oi",       result: "245 m NR", points: "122.5", ... },
  // ... 16種目分（8種目×男女）
};
```

> ⚠️ `DATA.records` が正常に読み込まれる限りこの値は使われない。ただし `jp_official_records.json` フェッチ失敗時の2次フォールバックとして機能する。定期的に最新値に手動更新が必要。

### 6-2. `PHOTOS`（選手写真マップ）

```javascript
const PHOTOS = {
  "Takuya Terajima": "https://s3...webp",
  "Shinya Oi":       "https://s3...webp",
  // 約45名分ハードコード
};
```

> `fetch_jp_records.py` が `jp_official_records.json` に写真URLを含めているが、HTML側の `PHOTOS` は手動で追加された値が中心。新選手が追加された場合は `athlete_photos.json` または `jp_official_records.json` の photo フィールドを参照する。

### 6-3. AIDA APIパラメータ

スクリプト内固定値:

| 定数 | 値 | 意味 |
|---|---|---|
| `NATIONALITY_JAPAN` | `"108"` | AIDAの日本国籍コード |
| ランキングURL | `https://www.aidainternational.org/Ranking/index.php` | POSTエンドポイント |
| イベントURL | `https://www.aidainternational.org/Events/EventRanking-{id}` | イベント結果ページ |

---

## 7. AIDAデータの仕様・注意点

### バッジ種別

| バッジ | 意味 | 取得スクリプトの扱い |
|---|---|---|
| `NR` | National Record（日本記録） | `re.sub` でストリップ |
| `CR` | Continental Record（アジア記録） | `re.sub` でストリップ |
| `WR` | World Record | `re.sub` でストリップ |
| `AR` | Area Record | `re.sub` でストリップ |
| `PEN` | Pending（審査待ち） | `re.sub` でストリップ |

### PEN（Pending）の挙動

- 大会結果提出後、AIDAスタッフが承認するまでの期間に付く
- **全年度フィルタ（year=空）のランキングページには PEN 結果も表示される**
- **年フィルタ（year=2026 等）には PEN 結果が表示されないことがある**
- 承認後（White判定）は自動的に翌日のバッチで反映される

---

## 8. データ更新フロー図

```
[大会結果]
    │
    ▼ AIDAスタッフが入力
[AIDA Rankings Page]
    │
    ├─ year フィルタあり ← fetch_all_rankings.py（毎日）
    │       ↓
    │  rankings_{year}.json
    │       ↓
    │  merge_rankings.py
    │       ↓
    │  all_rankings_data.json → ランキングテーブル + buildJPRecords()
    │
    └─ year フィルタなし ← fetch_jp_records.py（毎日）
            ↓
       jp_official_records.json
            ↓
       JP_RECORDS の初期値（buildJPRecords で上書き）

[AIDA世界選手権参加]
    │ 手動: update_national_team.py --event {id}
    ▼
national_team.json → 日本代表バッジ表示
```

---

## 9. 既知の問題・TODO

| 項目 | 状況 | 対処方針 |
|---|---|---|
| `JP_RECORDS` ハードコード | 残存（フォールバック）| `buildJPRecords()` で上書きされるため実害なし。年1回程度手動更新 |
| `PHOTOS` ハードコード | 約45名分 | `athlete_photos.json` または `jp_official_records.json` の photo フィールドを優先参照するよう改善余地あり |
| PEN結果の年フィルタ除外 | 確認済み | 翌日の全年度フェッチ（`fetch_jp_records.py`）で補完される |
| Node.js 20 deprecation警告 | GitHub Actions | `actions/checkout@v4` / `setup-python@v5` を v6 等に更新で解消 |
| `rankings_historical.json` 手動固定 | 2000〜前年分 | 毎年1月に前年分を historical に移行するオペレーションが必要 |
