# Freediving Japan — 開発・技術仕様

## 環境・作業フロー

- **作業場所**：`/Users/takuyaterajima/Desktop/10.Freediving/30.Freediving Japan/freediving-japan`（直接読み書き）
- **GitHubアカウント**：tora29tt-source / **リポジトリ**：tora29tt-source/freediving-japan
- **本番URL**：<https://freediving-japan.vercel.app>
- **デプロイ**：main push → Vercel 自動反映

|担当    |作業                            |
|------|------------------------------|
|Claude|Cowork でファイルを編集               |
|Takuya|GitHub Desktop で commit → push|
|自動    |Vercel がデプロイ                  |

-----

## 技術スタック

- **Web フロントエンド**：HTML / CSS / JavaScript（バニラ、フレームワークなし）
- **モバイルアプリ**：React Native（iOS・App Store配信）
- **バックエンド・認証・DB**：Supabase（Project ID: bbhqvbpsuccbdcnhnobm / Tokyo）
- **決済**：Stripe（フリーダイビングを学ぶ の有料講座）
- **動画配信**：Vimeo Pro（フリーダイビングを学ぶ の動画ホスティング）
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

-----

## 作業分担ルール

**Claudeがやること**

- コーディング全般（HTML/CSS/JS/SQL/Python）
- ファイルの作成・編集
- できる限り自律的に進めて、完了後に報告する
- Chrome MCP が使える操作（Supabase SQL実行・ブラウザ操作全般）は Claude が直接実行する
- git push できる場合は Claude が直接実行する

**Takuyaがやること**

- Claude が git push できなかった場合のみターミナルで commit → push
- 動作確認・フィードバック

**ターミナル指示のルール**

- Claude がターミナルへの指示を出す際は必ずコードブロック形式で提示する：

```
git push origin main
```

**セキュリティルール**

- `service_role`キー・パスワード等の秘匿情報はコードにハードコードしない
- anon keyはフロントエンドに含めてOK（公開前提のキー）
- 秘匿情報はTakuyaが直接Supabaseダッシュボードで操作する

**SQL実行ルール**

- SQL が必要な場合、まず Chrome MCP 経由で Supabase に直接実行を試みる
- 何らかの理由で Claude が実行できない場合のみ、チャットにコピペしやすいコードブロック形式で提示する：

```sql
-- ← このような形式で提示
```

-----

## Supabase 接続情報

- **Project URL**：`https://bbhqvbpsuccbdcnhnobm.supabase.co`
- **Project ID**：`bbhqvbpsuccbdcnhnobm`
- **Region**：ap-northeast-1（Northeast Asia / Tokyo）
- **接続ファイル**：`js/supabase-config.js`（anon key 格納済み）

### DBテーブル一覧

```
instructors        — インストラクターマスタ（id, name, bio, photo_url, certifications, areas, prefecture, city, experience_years, languages, ...）
listings           — 体験・コース（id, title, instructor_id, category, intent, prefecture, area, price, price_unit, price_includes, price_excludes, duration, season, min_participants, max_participants, age_min, age_max, meeting_point, booking_deadline, has_shuttle, cancellation_policy, what_to_bring, notes, tags, facilities, rental_gear, flow_steps, image_url, gallery_urls, is_public, ...）
availability_slots — 空き枠（id, instructor_id, listing_id, slot_date, start_time, end_time, max_participants, booked_count, is_active）
bookings           — 予約（id, slot_id, instructor_id, listing_id, guest_name, guest_email, guest_phone, participant_count, unit_price, total_amount, platform_fee, instructor_payout, status, stripe_session_id, stripe_payment_intent_id, rental_requests, ...）
training_sessions  — トレーニングセッション
dives              — ダイブ記録
events             — 大会・イベント
shops              — ショップ
reviews            — レビュー
```

**予約ステータス遷移**：`pending` → `paid` → `confirmed` → `cancelled` / `refunded`

-----

## Stripe 設定メモ

- **モード**：サンドボックス（テスト環境）
- **ビジネスモデル**：マーケットプレイス（プラットフォームが集金 → インストラクターへ送金）
- **手数料分配**：プラットフォーム 30% / インストラクター 70%
- **Webhook エンドポイント**：`https://freediving-japan.vercel.app/api/stripe-webhook`
- **リッスンイベント**：`checkout.session.completed`, `checkout.session.expired`
- **Vercel 環境変数**：`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SITE_URL` 設定済み

-----

## ファイル構成（主要）

```
/index.html               # トップページ（未ログイン＝初めての人の世界）
/auth.html                # 認証画面（メール/パスワード・Googleログイン）
/mypage.html              # ログイン後＝プロ・選手の世界
/admin/index.html         # 管理画面（空き枠・予約管理）
/js/supabase-config.js    # Supabase接続設定（anon key格納）
/data/                    # JSONデータファイル
  all_rankings_data.json
  athlete_photos.json
  jp_official_records.json
/scripts/                 # Pythonスクリプト
  fetch_all_rankings.py
  fetch_jp_records.py
  fetch_overall_fix.py
/api/                     # Vercel Serverless Functions
  create-checkout-session.js
  stripe-webhook.js
/explore/                 # マッチング（先行実装中）
  index.html
  listing.html            # リスティング詳細（旧instructor.html）
/booking/
  success.html
/articles/                # 記事
  index.html
  article.html
  article-what-is-freediving.html
/media/                   # メディア（Phase 2〜）
  index.html
  admin-mobile.html
/tools/                   # ツール類
  mouthfill-calculator.html
  session-planner.html
  sta-timer.html
  training-log.html
/events/                  # 大会・イベント
  2026_competitions.html
  competition-countdown.html
  event-athlete.html
  event-staff.html
/rankings/                # ランキング
  AIDA_ranking.html
/learn/                   # 学ぶ（Phase 1.5〜）
  freediving-learn.html
/pro/                     # インストラクター向け
  index.html
  instructor-welcome.html
/sql/                     # DBスキーマ・テストデータ
/old/                     # 旧ファイル保管庫（参照のみ）
```

## サイトマップ（二層構造）

```
■ 未ログイン ＝ 初めての人の世界
TOP (index.html)
│
├── 読む：メディア (/media/)              [Phase 2]
│
├── 探す：マッチング (/explore/)          [Phase 2・トップに前面表示]
│   ├── フリーダイビング スクール・インストラクター
│   ├── スキンダイビング スクール・インストラクター
│   ├── ダイビング船（ファンダイビング対応ショップ）
│   ├── ツアー
│   ├── マップ検索 (/explore/map/)
│   └── 詳細・マッチング (/explore/{category}/{id}/)
│
├── 学ぶ：初心者向け教材（入口商品）        [Phase 1.5・未ログインからも見せる]
│
├── 覗く：ランキング・大会のさわり        [Phase 1 データを軽く見せる]
│
└── インストラクターの方へ (instructor-welcome.html)

■ ログイン後 ＝ プロ・選手の世界
マイページ (mypage.html)
│
├── プロフィール
├── 予約履歴
├── トレーニングログ
├── STAタイマー (sta-timer.html)
├── Mouthfill Calculator (mouthfill-calculator.html)
├── ランキング（フル機能・種目別/選手別）
├── 大会情報（フル機能）
├── 学ぶ：動画教材 (/learn/)
└── プロ向け (/pro/)
    ├── CRM・顧客管理 (/pro/crm/)
    ├── 生徒管理 (/pro/students/)
    └── 予約管理 (/pro/reservations/)

■ 管理者
管理画面 (/admin/)
├── 空き枠管理
└── 予約一覧・ステータス管理
```

## iOSアプリ 機能一覧（Phase 1）

- トレーニングログ登録・履歴管理
- ログのURLシェア（誰でも閲覧可能なリンクを発行）
- ログのSNSシェア（写真＋かっこいいオーバーレイ画像を生成してInstagram/X等に投稿）
- 練習用タイマー
- カウントダウン機能
- Webマイページとのデータ連携

-----

## スケジュール（2026-06-19更新）

※ コーディングはClaude担当。Takuyaは確認・push・フィードバックのみ。

### Phase 1（目標：約2ヶ月）

|期間      |内容                                         |状況  |
|--------|-------------------------------------------|-----|
|Week 1  |Supabase導入・DB設計・ログイン画面・認証基盤                |✅完了 |
|Week 2  |トレーニングログ完成・Supabase接続・URLシェア機能             |✅完了（動作確認要）|
|Week 2後 |/learn/ 枠組みページ（撮影開始前に完成・Stripe導入）          |✅完了（learn/index.html 骨格・コース4本・メール登録UI）|
|Week 3-4|CRM実装（顧客・生徒・予約管理）                          |✅完了（予約管理・クライアント管理・売上管理タブ実装。clients テーブル設計・bookings カラム名 client_* に統一）|
|Week 5-6|マイページ完成・ランキング・大会情報のDB接続                    |✅完了（mypage.html Supabase接続済み）|
|Week 7-8|React Nativeアプリ（タイマー・ログ・SNSシェア）            |未着手 |

### Phase 2（Phase 1完了後・約2ヶ月）

未ログイントップの二層化・マッチング機能・探す全カテゴリ・メディア立ち上げ・インストラクター紹介動画

### Phase 3（Phase 2完了後・約2ヶ月〜継続）

有料動画教材・SEOコンテンツ拡充

**合計目標：約6ヶ月でフル展開**

-----

## 現在の実装状況

|ページ・機能                                              |状況                          |
|----------------------------------------------------|----------------------------|
|トップページ（index.html）                                  |✅ 完成（※二層化に向けて要再設計）          |
|ランキング（AIDA_ranking_prototype.html / site/index.html）|✅ 完成                        |
|大会情報（2026_competitions.html）                        |✅ 完成                        |
|トレーニングログ（training-log.html）                         |✅ Supabase接続・保存・読み込み・編集・URLシェア実装済み（動作確認要）|
|マイページ（mypage.html）                                  |✅ Supabase接続完了（トレーニングカレンダー・今月のサマリー・予約履歴・大会管理 すべて実データ表示）|
|STAタイマー（sta-timer.html）                             |✅ 大幅機能追加・デプロイ済み              |
|Mouthfill Calculator（mouthfill-calculator.html）     |✅ 完成・push済み                  |
|インストラクターウェルカム（instructor-welcome.html）              |✅ 作成完了                      |
|フリーダイビングを学ぶ（freediving-learn.html）                 |✅ 管理ツール完成・learn/index.html 骨格完成  |
|大会機能（events/event-athlete.html）                      |✅ Supabase接続完了（?id= でイベント取得・AP登録→event_entries INSERT・スタートリスト・リザルト表示）|
|大会カウントダウン（events/competition-countdown.html）         |✅ 完成（スタンドアロン・Supabase不要）        |
|認証画面（auth.html）                                     |✅ メール/パスワード・Googleログイン実装済み（Apple は Developer 登録待ち）|
|Supabase DB                                        |✅ テーブル作成済み（training_sessions/dives/events/shops/instructors/listings/reviews）|
|Supabase 認証接続                                      |✅ メール/パスワード・Google OAuth 接続済み|
|マッチング（/explore/）                                    |🔄 先行実装中（Supabase: shops/instructors/listings/reviews スキーマ投入済み。explore/index.html・instructor.html 動作確認済み。本格公開は Phase 2。**検索強化: リアルタイム検索・インストラクター名検索・価格帯フィルタ・ソート機能 追加済み**）|
|listings 全フィールド対応                                    |✅ pro/index.html に max_participants・flow_steps・gallery_urls 追加。instructor.html でギャラリー複数表示・price_includes/excludes・meeting_point・what_to_bring・season・booking_deadline・has_shuttle を表示対応|
|予約・決済フロー（/explore/instructor.html + /api/）           |✅ 完成・動作確認済み（カレンダーUI → Stripe Checkout → 予約完了ページのフルフロー。E2Eテスト: status=paid 確認済み）|
|Supabase: availability_slots / bookings テーブル          |✅ 作成済み・RLS設定済み|
|Vercel API: /api/create-checkout-session.js            |✅ 実装済み・デプロイ済み|
|Vercel API: /api/stripe-webhook.js                     |✅ 実装済み・Stripe Webhook登録済み|
|booking/success.html                                   |✅ 実装済み（予約番号・日時・金額・プラン表示）|
|管理画面（/admin/index.html）                              |✅ 実装済み（空き枠管理・予約一覧・ステータス変更）|
|プロダッシュボード（pro/index.html）予約管理タブ                      |✅ 実装済み・テストデータ投入済み（全ステータス確認可）|
|クライアント管理タブ（pro/index.html）                           |✅ 実装済み（bookingsから自動集約・検索・詳細・メモ保存）※ client_memos テーブル要作成（sql/client_memos.sql）|
|売り上げ管理タブ（pro/index.html）                              |✅ 実装済み（月次サマリー・棒グラフ・明細一覧・期間フィルタ）|
|/learn/ 有料講座ページ                                      |✅ learn/index.html 骨格完成・トップからリンク済み（先行通知機能なし・購入ボタンは準備中表示。Stripe/Vimeo接続は撮影後）|
|メディア（/media/）                                        |❌ 未着手（Phase 2）|
|iOSアプリ（React Native）                                 |❌ 未着手（Phase 1 Week 7-8）|

-----

## フロントエンド共通パターン

### 未保存警告（beforeunload）

編集フォームを持つページには以下の仕組みを統一実装する。

```javascript
// スクリプト末尾に追加
let _isDirty = false;
document.addEventListener('input',  () => { _isDirty = true; });
document.addEventListener('change', () => { _isDirty = true; });
window.addEventListener('beforeunload', e => {
  if (!_isDirty) return;
  e.preventDefault();
  e.returnValue = '';
});
```

保存成功後は必ず `_isDirty = false;` をセットする。

**対象ページ**：`pro/index.html`・`mypage.html`・`admin/index.html`

-----

### Supabase Storage（avatarsバケット）

ユーザー写真を管理するパブリックバケット。

| 用途 | パス | 保存先 |
|---|---|---|
| マイページ写真 | `{user_id}/mypage.{ext}` | `user_metadata.avatar_url` |
| プロ写真 | `{user_id}/instructor.{ext}` | `instructors.photo_url` |

RLSポリシー（`storage.objects`）：INSERT/UPDATE/DELETE は `auth.uid()::text = split_part(name, '/', 1)` で本人のみ。SELECT は public。

-----

*最終更新：2026-06-17（mypage.html Supabase接続完了：トレーニングカレンダー・今月のサマリー・予約履歴・大会管理）*
