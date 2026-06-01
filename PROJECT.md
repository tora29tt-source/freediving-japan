# Freediving Japan — プロジェクト仕様

## 概要

フリーダイビングのプラットフォーム。初心者がフリーダイビングを始める際の情報収集・スクール/インストラクター検索・マッチングから、現役インストラクターや選手が毎日使う業務ツール（CRM・トレーニングログ・大会情報・国内ランキング）まで、業界全体をカバーする。

**ターゲット**
- 初心者：情報収集・スクール/インストラクター探し・マッチング
- インストラクター：顧客管理（CRM）・大会情報・ランキング確認
- 選手：トレーニングログ・大会情報・国内ランキング

**プラットフォーム構成**
- Webサイト（スマートフォン対応必須・全ページレスポンシブ）
- iOSアプリ（React Native・App Store配信）

---

## 環境・作業フロー

- **作業場所**：`/Users/takuyaterajima/Documents/GitHub/freediving-japan`（直接読み書き）
- **GitHubアカウント**：tora29tt-source / **リポジトリ**：tora29tt-source/freediving-japan
- **本番URL**：https://freediving-japan.vercel.app
- **デプロイ**：main push → Vercel 自動反映

| 担当 | 作業 |
|---|---|
| Claude | Cowork でファイルを編集 |
| Takuya | GitHub Desktop で commit → push |
| 自動 | Vercel がデプロイ |

---

## 技術スタック

- **Web フロントエンド**：HTML / CSS / JavaScript（バニラ、フレームワークなし）
- **モバイルアプリ**：React Native（iOS・App Store配信）
- **スタイル**：CSS変数でデザイントークン管理
- **フォント**：-apple-system / Hiragino Sans / Noto Sans JP
- **データ**：JSON（rankings.json, athlete_photos.json 等）
- **スクレイピング**：Python（fetch_all.py 等）

### カラーパレット（CSS変数）

```css
--ocean-deep:  #0b2d45
--ocean-mid:   #0e3d5c
--ocean-light: #1a5f82
--teal:        #2ec4b6
--teal-light:  #a8ece8
--foam:        #f0f9fb
--warm:        #f97316
--sand:        #fdf8f2
```

---

## フェーズロードマップ

### Phase 1：プロ向けツール（Web + iOSアプリ）

**ゴール**：インストラクター・選手が毎日使うツールを作り、プロユーザーを定着させる。友人インストラクターを初期ユーザーとして早期フィードバックを得る。

**Web機能**
- インストラクター向け CRM（顧客・予約・生徒管理）
- 国内ランキング表示（種目別・選手別）
- 大会・イベント情報

**iOSアプリ（React Native・App Store配信）**
- トレーニングログ登録・管理
- 練習用タイマー
- カウントダウン機能

**共通要件**
- 全ページ・全画面スマートフォン対応（モバイルファースト）
- ブレークポイント：768px / 480px、横スクロールなし

---

### Phase 2：マッチング + インストラクター紹介動画

**ゴール**：Phase 1 で定着したインストラクターを活用し、初心者向けマッチングを開放する。

- 初心者向けスクール・インストラクター検索
- マッチング機能（問い合わせ・予約導線）
- インストラクターが紹介動画をプロフィールに掲載できる機能（マッチングの質向上）
- 地図検索（都道府県リスト＋簡易地図）

**「探す」ページ ユーザー分類**

ユーザーを目的軸で3層に分類し、それぞれに最適な検索・マッチング体験を提供する。

| 層 | 状態 | 主な探すもの |
|---|---|---|
| ①やってみたい | 完全初心者・体験重視 | 体験ダイビング・シュノーケル・フリーダイビング体験コース |
| ②ちゃんと学びたい | 資格取得・スクール探し | フリーダイビング・スキンダイビングのコース・インストラクター |
| ③もっと潜りたい（アスリート含む） | 資格持ち・上級者 | ダイビング船・ツアー・スポット環境情報・バディ探し |

アスリート向けスポット情報として以下を提供する：
- 最大水深・透明度・ベストシーズン
- 水温・海況・カレント情報
- バディ募集・マッチング機能

**インバウンド対応方針**

- Phase 2 で英語対応を導入（探すページ・インストラクタープロフィール等）
- 実装はJSON翻訳ファイルによるi18nから開始し、Phase 3以降でWeglot等の多言語サービス導入を検討
- 全開発において英語対応を後から追加しやすい構造（テキストのハードコード禁止・翻訳キー管理）を意識する

---

### Phase 3：動画教材・SEOコンテンツ

**ゴール**：初心者から競技者まで対象の動画教材を展開。SEO強化と収益化（有料コース化）。

- レベル別動画教材（初心者・中級・競技者向け）
- 有料コース化も視野
- SEOコンテンツ拡充（「{地名} フリーダイビング スクール」等）
- 地図検索の高機能化（認定団体・コース・料金での絞り込み）

---

## 収益化設計

**3本柱**

1. **マッチング手数料**（成約ベース）
   - 予約・成約時に手数料を徴収
   - 初期は低めに設定してインストラクターを集め、プラットフォーム成長後に調整

2. **インストラクター向けCRMサブスク**（フリーミアム）
   - 基本機能は無料、フル機能は月額課金
   - 友人インストラクターには無料で使ってもらい口コミで拡大 → 普及後に課金移行

3. **有料教材**（選定制・収益シェア）
   - 運営が講師を選定（品質管理・ブランド価値の維持）
   - 収益シェア：講師60〜70% / 運営30〜40%（集客・決済・配信インフラを運営が担う）
   - 「Freediving Japanに選ばれた講師」という希少性を価値にする

---

## 成功指標

**Phase 1**
- アクティブなプロユーザー数（インストラクター・選手）
- CRMの週次利用率
- アプリDL数・トレーニングログ記録数

**Phase 2**
- マッチング成立数（問い合わせ・予約）
- インストラクター登録数

**Phase 3**
- オーガニック検索流入数 / 主要KW順位
- 動画教材の視聴数・有料コース購入数

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
```

## サイトマップ（フェーズ別）

```
TOP (index.html)
│
├── [Phase 1] ランキング (/rankings/)
│   ├── 種目別 (/rankings/category/)
│   └── 選手別 (/rankings/athlete/{id}/)
│
├── [Phase 1] 大会情報 (/events/)
│
├── [Phase 1] プロ向け (/pro/)
│   ├── CRM・顧客管理 (/pro/crm/)
│   ├── 生徒管理 (/pro/students/)
│   └── 予約管理 (/pro/reservations/)
│
├── [Phase 2] 探す (/explore/)
│   ├── フリーダイビング スクール・インストラクター
│   ├── スキンダイビング スクール・インストラクター
│   ├── ダイビング船（ファンダイビング対応ショップ）
│   ├── ツアー
│   ├── マップ検索 (/explore/map/)
│   └── 詳細・マッチング (/explore/{category}/{id}/)
│
├── [Phase 3] 学ぶ (/learn/)
│   ├── 初心者 (/learn/beginner/)
│   ├── 中級 (/learn/intermediate/)
│   └── 競技者向け (/learn/competitive/)
│
└── マイページ (/mypage/)
    ├── プロフィール
    ├── 予約履歴
    └── トレーニングログ (/mypage/training-log/)  ← Phase 1 アプリと連携
```

## iOSアプリ 機能一覧（Phase 1）

- トレーニングログ登録・履歴管理
- ログのURLシェア（誰でも閲覧可能なリンクを発行）
- ログのSNSシェア（写真＋かっこいいオーバーレイ画像を生成してInstagram/X等に投稿）
- 練習用タイマー
- カウントダウン機能
- Webマイページとのデータ連携

---

## 作業分担ルール

**Claudeがやること**
- コーディング全般（HTML/CSS/JS/SQL/Python）
- ファイルの作成・編集
- できる限り自律的に進めて、完了後に報告する

**Takuyaがやること**
- GitHub Desktop で commit → push
- Supabaseの管理者権限が必要な操作（service_roleキーが必要なもの）
- 動作確認・フィードバック

**セキュリティルール**
- `service_role`キー・パスワード等の秘匿情報はコードにハードコードしない
- anon keyはフロントエンドに含めてOK（公開前提のキー）
- 秘匿情報はTakuyaが直接Supabaseダッシュボードで操作する

---

## Supabase 接続情報

- **Project URL**：`https://bbhqvbpsuccbdcnhnobm.supabase.co`
- **Anon Key**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs`
- **Project ID**：`bbhqvbpsuccbdcnhnobm`
- **Region**：ap-northeast-1（Northeast Asia / Tokyo）
- **接続ファイル**：`js/supabase-config.js`

---

## スケジュール（2026-06-01時点）

※ コーディングはClaude担当。Takuyaは確認・push・フィードバックのみ。

### Phase 1（目標：約2ヶ月）

| 期間 | 内容 |
|---|---|
| Week 1 | Supabase導入・DB設計・ログイン画面・認証基盤 |
| Week 2 | トレーニングログ完成・Supabase接続・URLシェア機能 |
| Week 3-4 | CRM実装（顧客・生徒・予約管理） |
| Week 5-6 | マイページ完成・ランキング・大会情報のDB接続 |
| Week 7-8 | React Nativeアプリ（タイマー・ログ・SNSシェア） |

### Phase 2（Phase 1完了後・約2ヶ月）
マッチング機能・探す全カテゴリ・インストラクター紹介動画

### Phase 3（Phase 2完了後・約2ヶ月〜継続）
有料動画教材・SEOコンテンツ拡充

**合計目標：約6ヶ月でフル展開**

---

## 現在の実装状況

| ページ・機能 | 状況 |
|---|---|
| トップページ（index.html） | ✅ 完成 |
| ランキング（AIDA_ranking_prototype.html / site/index.html） | ✅ 完成 |
| 大会情報（2026_competitions.html） | ✅ 完成 |
| トレーニングログ（training-log.html） | 🔄 80% |
| マイページ（mypage.html） | 🔄 作りかけ |
| Supabase・認証 | ❌ 未着手 |
| CRM | ❌ 未着手 |
| iOSアプリ（React Native） | ❌ 未着手 |

---
*最終更新：2026-06-01（方針全面改訂）*
