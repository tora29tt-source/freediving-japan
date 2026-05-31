# Takuya のプロジェクトメモ

## フリーダイビング業界プラットフォーム（Freediving Japan）

### 概要
フリーダイビングの業界向けプラットフォーム。SEO集客を最優先に、スクール掲載とAIDAランキング表示を中核とする。

### 作業フォルダ
- **作業場所**：`/Users/takuyaterajima/Documents/GitHub/freediving-japan`
- ここを直接読み書きする。編集後は Takuya が GitHub Desktop で push。

### Git / Vercel
- **GitHubアカウント**：tora29tt-source
- **リポジトリ**：tora29tt-source/freediving-japan
- **本番URL**：https://freediving-japan.vercel.app
- **デプロイ**：Vercel 自動デプロイ設定済み（main ブランチへの push で自動反映）

### 作業フロー（Cowork → Vercel 反映）
1. Cowork でファイルを編集 ← **Claude が担当**
2. GitHub Desktop で変更を確認 → commit → push ← **Takuya が担当**
3. Vercel が自動デプロイ → 本番に反映 ← **自動**

---

## 技術スタック
- **フロントエンド**：HTML / CSS / JavaScript（バニラ、フレームワークなし）
- **スタイル**：CSS変数でデザイントークン管理（ocean-deep, teal, sand 等）
- **フォント**：-apple-system / Hiragino Sans / Noto Sans JP
- **データ**：JSON（rankings.json, athlete_photos.json 等）
- **スクレイピング**：Python（fetch_all.py 等）

## カラーパレット（CSS変数）
```
--ocean-deep: #0b2d45
--ocean-mid:  #0e3d5c
--ocean-light:#1a5f82
--teal:       #2ec4b6
--teal-light: #a8ece8
--foam:       #f0f9fb
--warm:       #f97316
--sand:       #fdf8f2
```

---

## Phase 1 スコープ（優先順）
1. **スクール・インストラクター掲載**（都道府県別・スクール詳細ページ）
2. **AIDAランキング表示**（種目別・選手別ページ）
3. **地図検索（軽量版）**（都道府県リスト→スクール一覧への導線）
4. **看板教材数本**（Phase 1.5）

## Phase 2 以降
- 大会・イベント情報
- 地図検索の高機能化（絞り込み）
- 教材コンテンツ拡充

## SEO狙いキーワード
- 「{地名} フリーダイビング スクール」
- 「フリーダイビング 日本記録」
- 「{選手名}」「{種目} ランキング」

## 成功指標
- インデックス登録ページ数
- オーガニック検索流入数 / 主要KW順位
- スクール詳細ページの問い合わせ・外部リンククリック率

---

## ファイル構成（主要）
```
/index.html               # トップページ
/AIDA_ranking_prototype.html
/2026_competitions.html
/training-log.html
/mypage.html
/ranking_data.js
/athlete_photos.json
/site/
  index.html
  data/
    rankings.json
    athlete_photos.json
    jp_official_records.json
  fetch_all.py
/Phase1_MVP仕様.md
```

---

## サイトマップ

```
TOP (index.html)
│
├── 探す (/explore/)
│   ├── マップ検索 (/explore/map/)
│   ├── ショップ一覧 (/explore/shops/)
│   ├── インストラクター一覧 (/explore/instructors/)
│   └── 詳細・予約 (/explore/shops/{id}/ , /explore/instructors/{id}/)
│
├── 学ぶ (/learn/)
│   ├── 初心者 (/learn/beginner/)
│   ├── 中級 (/learn/intermediate/)
│   └── 競技 (/learn/competitive/)
│
├── イベント / ランキング
│   ├── 大会情報 (/events/)  ← 2026_competitions.html
│   └── 日本ランキング (/rankings/)  ← site/index.html
│
├── マイページ (/mypage/)  ← mypage.html
│   ├── プロフィール
│   ├── 予約履歴
│   └── トレーニングログ (/mypage/training-log/)  ← training-log.html
│
└── イントラ向け (/pro/)
    ├── 掲載申請 (/pro/apply/)
    ├── 予約管理 (/pro/reservations/)
    └── 生徒管理 (/pro/students/)
```

---
*最終更新：2026-06-01*
