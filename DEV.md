---
tags: [dev, core-doc]
---

# Freediving Japan — 開発・技術仕様

## リリース判定（2026-07-13・ブロッカー2件とも解消）

**問い：今すぐ友人インストラクターを1人招待して良いか → 判定：YES**

**2026-07-13追記**：ブロッカー1（新規SQL2件＋i18n用SQL計3件の本番適用）・ブロッカー2（予約決済フルE2E）とも解消。

- ブロッカー1：Chrome経由でSupabase SQL Editorに直接実行し、`information_schema`で存在確認まで完了
- ブロッカー2：Chrome MCPで本番実機E2Eを実施し、以下すべて成功を確認
  - インストラクター名義商品：explore→listing.html→カレンダー→Stripe Checkout（4242）→webhook→`bookings.status=paid`→success.html まで通過
  - ショップ名義商品（instructor_id無し）：同経路で決済まで通過（07-11の`sync_client_from_booking()`500エラー修正が本番で機能していることを確認）
  - pro/index.htmlから新category/intent/エリア/対象レベル入力で新規コースを1件実登録→explore反映・都道府県フィルタ正常動作を確認（テスト用に作成した「QAテスト：スキンダイビング体験」は確認後に非公開化してexploreから除去済み）

### 前回（07-10）からの変化

- ✅ **旧ブロッカー2「直近改修の実機スモーク」はほぼ解消**：検索UI刷新（トップ＋ピラー3ページ＋explore）・エリア検索刷新一式（explore/pro/admin）を07-10にChrome MCPで実機確認完了（admin一覧の都道府県列バグも発見・修正済み）。category/intent推測移行も本番全2件の目視確認完了
- ✅ learn講座購入の本番E2E完了・法務ページ一式（about/contact/privacy/terms/**特商法**）新設 — 決済を伴う招待の前提が整った
- ⚠️ ただし07-10 20:36のコミットで`pro/index.html`・`explore/listing.html`・legal各ページに**新規SQL2件に依存する変更**が入った（下記ブロッカー1）

### 残タスク（ブロッカーは0件・以下は招待後でも良い後回しタスクのみ）

**必須（ブロッカー）** — なし（2026-07-13時点で全解消）

1. ~~**新規SQL2件の本番適用を確認（未適用なら実行）**~~ **2026-07-13 実行済み・解消**
   - `sql/listings_course_template_20260710.sql`（`listings.target_level`/`goal`追加）：Chrome経由でSupabase SQL Editorに適用し、`information_schema.columns`で両カラムの存在を確認済み
   - `sql/contact_messages_schema_20260710.sql`：同様に適用し、`information_schema.tables`でテーブル存在を確認済み
   - 併せて`sql/translations_20260712.sql`（多言語対応i18n基盤）も同日適用済み
   - 3ファイルとも`-- ステータス: 実行済み（2026-07-13）`ヘッダを追記済み
2. ~~**予約→決済のフルE2Eを現行コードで1回通す**~~ **2026-07-13 実施済み・解消**
   - 経路：explore→listing.html→空き枠カレンダー→Stripe Checkout（4242）→webhook→`bookings.status=paid`→success.html を実機で確認
   - ショップ名義商品（instructor_id無し）でも決済まで成功を確認
   - pro/index.htmlから新category/intent/エリア/対象レベル入力で新規コースを1件実登録→explore反映・都道府県フィルタも確認（テストコースは確認後に非公開化済み）

**後回しで良い（招待のブロッカーではない）**

- **iOSアプリ**（タブバー・ログ・Supabase連携・SNSシェア未実装）— Phase 1ゴールの「毎日使うツール」はWeb版（トレーニングログ・CRM・予約管理・STAタイマー）で提供済み。友人にはWeb版で先行利用してもらい、アプリは後追いで良い
- **docs/instructor/sales.md** — 友人への声かけは口頭で足りる。第三者に営業を始める段階までに作成
- **docs/instructor/manual.md** — オンボーディングは一緒に触りながらで良い（早期フィードバック自体がPhase 1の目的）。招待直後の質問対応から得た知見をここに落とす運用を推奨
- スマホ幅375pxの通し確認（旧スモーク最低ライン③・明示記録なし。E2Eのついでに1周すれば十分）
- explore/shops.htmlの旧エリア刷新／shopsのソフトデリート対象化／shop_typeカラム削除／既存記事のauthor_bio設定／learn動画アップロード（購入ボタンは「準備中」ガードあり課金事故なし）／contact_messagesの管理画面閲覧UI（当面はSupabaseダッシュボードで確認）

### 判定の根拠

- **STRATEGY.md Phase 1ゴール照合**：友人招待に必要な機能（CRM・予約管理・トレーニングログ・プロフィール・リスティング）はWeb側で全て「✅完了」
- **予約決済E2Eも現行コードで実機確認済み**（インストラクター名義・ショップ名義とも決済成功、新規コース登録→explore反映も確認）
- **RLS・セキュリティ**：ブロッカー無し。2026-06-26レビュー11件・2026-07-04監査S1〜S10全件対応済み。bookingsのINSERTはRPC限定、記事サニタイズ・XSS・ソフトデリートadminバグ対応済み。新設contact_messagesもINSERT文字数・カテゴリ制限＋SELECT/UPDATE管理者限定のRLS付きで設計・適用確認済み → 友人の実データが入っても事故らない状態
- 判断方針：全部を完璧にしてからではなく「最小限で招待できる状態」を基準にした。ブロッカー2件とも解消したためYES

-----

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
- **動画配信**：Cloudflare R2 + HLS（自前ホスティング）/ Cloudflare Worker（認証プロキシ）/ hls.js（ブラウザ再生）
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

**設計書管理ルール**

- 仕様変更・機能追加を行ったら、`docs/` 内の対応する設計書を**必ず同時に更新**する
- 設計書が存在しない機能を新たに実装する場合は、**設計書を作成してから**コーディングを始める
- 設計書と機能のマッピングは `docs/INDEX.md` で管理する（追加・変更のたびに更新）
- 設計書のファイル名規則：`docs/{機能名}_DESIGN.md`（例：`AUTH_DESIGN.md`、`BOOKING_DESIGN.md`）

**セキュリティルール**

- `service_role`キー・パスワード等の秘匿情報はコードにハードコードしない
- anon keyはフロントエンドに含めてOK（公開前提のキー）
- 秘匿情報はTakuyaが直接Supabaseダッシュボードで操作する

**SQL実行ルール**

- SQL が必要な場合、まず Chrome MCP 経由で Supabase に直接実行を試みる
- 何らかの理由で Claude が実行できない場合のみ、チャットにコピペしやすいコードブロック形式で提示する

**SQLファイル管理ルール**

- `sql/` ディレクトリの各ファイル先頭に実行状況を明記する：
  ```sql
  -- ステータス: 実行済み（2026-XX-XX） / 未実行
  ```
- 実行済みのSQLファイルには冒頭に `-- ステータス: 実行済み（日付）` を追記する
- `DBテーブル一覧` の RLS 実装状況も実行のたびに更新する

**Claudeのファイル書き込みに関する注意**

- Claude の Write ツールが Mac のファイルシステムに反映されない場合がある
- SQLファイルなど新規ファイルが GitHub Desktop に現れない場合は、ターミナルで直接作成する：
  ```bash
  cat > path/to/file.sql << 'EOF'
  -- SQL内容
  EOF
  ```

-----

## Supabase 接続情報

- **Project URL**：`https://bbhqvbpsuccbdcnhnobm.supabase.co`
- **Project ID**：`bbhqvbpsuccbdcnhnobm`
- **Region**：ap-northeast-1（Northeast Asia / Tokyo）
- **接続ファイル**：`js/supabase-config.js`（anon key 格納済み）

### DBテーブル一覧

```
instructors        — インストラクターマスタ（id, name, bio, photo_url, cover_url[バナー画像・2026-07-11追加], cover_position[表示位置調整・2026-07-11追加], certifications, areas, prefecture, city, experience_years, languages, ...）
instructor_shops   — インストラクター所属（N:M・2026-07-04追加。instructor_id, shop_id。複数ショップに同時所属可）
listings           — 体験・コース（id, instructor_id[nullable], shop_id[nullable・2026-07-04追加], title, category, intent, prefecture[47都道府県+海外のCHECK制約・2026-07-05〜検索の正データ], country[海外時の国名・2026-07-05追加], area[人気スポットタグ・任意], price, price_unit, price_includes, price_excludes, duration, season, min_participants, max_participants, age_min, age_max, meeting_point, booking_deadline, has_shuttle, cancellation_policy, what_to_bring, notes, tags, facilities, rental_gear, flow_steps, image_url, gallery_urls, is_public, ...）
availability_slots — 空き枠（id, instructor_id[nullable], shop_id[nullable・2026-07-04追加], listing_id, slot_date, start_time, end_time, max_participants, booked_count, is_active）
bookings           — 予約（id, slot_id, instructor_id[nullable], shop_id[nullable・2026-07-04追加], listing_id, guest_name, guest_email, guest_phone, participant_count, unit_price, total_amount, platform_fee, instructor_payout, status, stripe_session_id, stripe_payment_intent_id, rental_requests, ...）
articles           — メディア記事（id, slug, title, category[A-T], author_type, author_name, lead_text, content[HTML], tags[], read_time_min, status[draft/review/published], is_published, published_at, thumbnail_url, created_by[UUID], review_comment）
training_sessions  — トレーニングセッション
dives              — ダイブ記録
events             — 大会・イベント
shops              — ショップ（単体でも商品出品可・2026-07-04〜）
reviews            — レビュー
inquiries          — 問い合わせ（instructor_id[nullable] / shop_id[nullable]）
```

**予約ステータス遷移**：`pending` → `paid` → `confirmed` → `cancelled` / `refunded`

-----

## 権限管理設計（RBAC）

*策定：2026-06-25*

### ロール体系

| ロール | 管理場所 | 説明 |
|---|---|---|
| **未ログイン** | — | 公開ページ閲覧のみ |
| **ログイン済み**（選手・愛好家） | Supabase Auth | 登録後デフォルト。トレーニングログ・大会情報等 |
| **インストラクター（承認済み）** | `instructors.status = 'approved'` | 管理者承認後にリスティング・CRM・予約管理が使える。選手との兼任あり |
| **インストラクター（審査中）** | `instructors.status = 'pending'` | pro/index.html でプロフィール申請後・承認待ち。リスティング等は不可 |
| **サイト管理者** | `user_roles` テーブル | `admin`（全権限）/ `staff`（予約・インストラクター・メディア）/ `editor`（メディアのみ） |
| **大会ロール** | `event_staff` テーブル | 大会ごとに主催者が任命。`organizer` / `staff` / `readonly` |

### ページ別アクセス制御

| ページ | 未ログイン | ログイン済み | インストラクター承認済み | 管理者 |
|---|:---:|:---:|:---:|:---:|
| index / explore / learn / articles | ✅ | ✅ | ✅ | ✅ |
| mypage.html | → auth | ✅ | ✅ | ✅ |
| tools/training-log.html | → auth | ✅ | ✅ | ✅ |
| tools/sta-timer.html | → auth | ✅ | ✅ | ✅ |
| events/event-staff.html | readonly | 大会ロール依存 | 大会ロール依存 | ✅全権 |
| pro/index.html | → auth | ✅申請フォームのみ | ✅フル機能 | ✅ |
| admin/index.html | → auth → 弾く | ❌ | ❌ | ✅ |
| admin/admin-mobile.html | → auth → 弾く | ❌ | ❌ | ✅（editor以上） |

### インストラクター承認フロー

```
ユーザー登録（Supabase Auth）
    ↓
選手・愛好家として利用開始（デフォルト）
    ↓（pro/index.html でプロフィール入力・申請）
instructors.status = 'pending'（審査中バナー表示）
    ↓（管理者が admin/index.html で承認）
instructors.status = 'approved'（リスティング・CRM・予約管理が解放）
```

### mypage.htmlのロール別表示（2026-07-14・secretary相談で確定）

**背景**：`mypage.html`はこれまでinstructors/shopsのロール判定を一切行っておらず、「講習・ツアー管理」カード（/pro/への大きな導線）と「インストラクター向け導線」バナー（開発中の未実装プレースホルダー）が、未登録の一般ゲストにも常時表示されていた。一般ゲストにとって無関係な事業者向け要素が常に目に入ることが、マイページの見づらさの主因と判断。

**方針**：`mypage.html`の起動処理に、`pro/index.html`の`boot()`と同様の判定（`instructors`/`shops`をuser_idで検索）を追加し、以下の通り出し分ける。

- **未登録**（instructors/shopsどちらにも紐づかない）：「講習・ツアー管理」の大きいカードは表示せず、代わりに「事業者の方へ」という控えめな一行リンクのみ表示。リンク先は`/pro/`（未登録者には既存の登録フォーム＝setup-guardが表示される）
- **登録済み**（`instructors`/`shops`に紐づきあり。pending/approved問わず）：現行の「プロダッシュボード」カードをそのまま表示
- 承認待ち（pending）・却下（rejected）等のステータス表示はマイページ側では持たず、`/pro/`側の既存バナー（pending-banner/rejected-banner）に一本化する（二重管理を避ける）
- 現行の「インストラクター向け導線」バナー（開発中のダミー表示・実質何もしていない）は「事業者の方へ」リンクと役割が重複するため撤去する

**実装済み**：上記の`mypage.html`側ロール判定・条件分岐表示（`loadMypageData()`に`instructors`/`shops`をuser_idで検索する処理を追加、`#proDashboardSection`/`#bizLinkSection`を出し分け）

### mypage.htmlの画面構成再設計（2026-07-14・secretary相談で確定）

**背景**：ロール別表示（上記）だけでは、9個のセクションが優先順位もグルーピングもなくフラットに縦一列に並ぶ問題は残っていた。マイページを使う人には「一般ゲスト（自分の予約を見たい）」「事業者（顧客対応・CRM）」の2系統があり、事業者本人も一般ゲストとしての利用（自分の予約確認等）があるため、事業者向け要素を隠すのではなく優先順位を下げる形で共存させる方針とした。

**方針**：全セクションを優先度で2グループに分け、PC幅（900px超）ではメイン/サイドレールの2カラム、スマホ幅ではメイングループ→サブグループの順で縦積みにする。

- **メイングループ**（優先順）：予約確認 → 事業者導線（`#proDashboardSection`／`#bizLinkSection`、既存のロール判定をそのまま利用） → トレーニング記録（今月のサマリー・トレーニングカレンダー・トレーニングツールへのリンク）
- **サブグループ**：学んだ講座 → 大会（近日のスケジュール・大会管理） → 設定
- **大会管理は権限変更なし**：`events`の作成は`instructors`/`shops`登録の有無と無関係に、ログイン済みなら誰でも可能な既存仕様のまま維持する（/pro/への統合は「大会作成を事業者限定にする」というアクセス権限変更を伴うため見送り、表示上の優先度を下げるだけに留めた）
- **レイアウト**：`/pro/index.html`の`.pf-split-wrap`（メイン＋幅400px程度のサイドレール、900px以下で1カラムに戻る）と同型のCSS gridパターンを`mypage.html`にも新設し、意匠の一貫性を保つ

**未実装**：上記の`mypage.html`セクション並び替え・グルーピングCSS・レスポンシブグリッド

### admin/index.html タブ権限

| タブ | admin | staff | editor |
|---|:---:|:---:|:---:|
| 空き枠管理 | ✅ | ✅ | ❌ |
| 予約一覧 | ✅ | ✅ | ❌ |
| インストラクター（承認操作含む） | ✅ | ✅ | ❌ |
| リスティング | ✅ | ✅ | ❌ |
| メディア | ✅ | ✅ | ✅ |
| ユーザー管理 | ✅ | ❌ | ❌ |

### DB・RLS 実装済み（2026-06-25完了・2026-06-28追記）

- `instructors.status` カラム追加済み（`pending` / `approved` / `rejected`）
- `user_roles.role` の値：`admin` / `staff` / `editor`（check constraint 適用済み）
- `is_site_admin()` ヘルパー関数作成済み（SECURITY DEFINER + `SET row_security = off` で user_roles の RLS をバイパス）
- RLS更新スクリプト：`sql/rls_update_20260625.sql`（実行済み）
- 2026-06-28：`is_site_admin()` に `SET row_security = off` 追加（user_roles RLS との無限ループ回避）

### Supabase RLS 実装状況

| テーブル | RLS | 主なポリシー |
|---|:---:|---|
| `training_sessions` | ✅ | 本人 or is_public=true |
| `training_dives` | ✅ | 本人 or 公開セッション紐づき |
| `instructors` | ✅ | 公開: approved+is_public / 本人 / 管理者 |
| `instructor_shops` | ✅ | 公開読み取り / 追加・削除はショップ本人 or インストラクター本人 or 管理者（2026-07-04追加） |
| `listings` | ✅ | 公開: is_public / 本人インストラクター or 本人ショップ（owner） / 管理者 |
| `availability_slots` | ✅ | 誰でも読み / 本人インストラクター or 本人ショップ（owner）のみ書き込み |
| `bookings` | ✅ | 本人インストラクター or 本人ショップ or 管理者 or 予約者本人（`client_email = auth.email()`・2026-07-12追加）のみ閲覧 / 新規作成は `create_pending_booking()` RPC 経由のみ（直接INSERT不可・S1対応） |
| `shops` | ✅ | 公開 / 本人 / 管理者 |
| `reviews` | ✅ | 公開 / 本人書き込み |
| `inquiries` | ✅ | 誰でも新規作成 / 本人インストラクター or 本人ショップ or 管理者のみ閲覧・更新（2026-07-04追加） |
| `articles` | ✅ | 公開済み: 全員 / 認証済み: 全件 / 管理者: 全件（`articles_select` ポリシー）/ UPDATE: admin/staff は全件・editor は自分の記事のみ（published 変更不可）/ DELETE: admin/staff は全件・editor は自分の下書きのみ（`articles_review_flow_20260629.sql`） |
| `user_roles` | ✅ | is_site_admin()=true のみ全操作（admin/staff/editor） |

### ショップ／インストラクター 出品モデル（2026-07-04確定）

ショップは単体で商品を出品可能（`listings.shop_id`）、インストラクターは複数ショップに同時所属可能（`instructor_shops` N:M中間テーブル）。`listings`/`availability_slots`/`bookings`/`inquiries`/`reviews`は`instructor_id`をnullable化し`shop_id`を追加、`CHECK`でどちらか必須。実装済み・本番適用済み（DB: `sql/shop_direct_listings_20260704.sql`）。

**未着手**：`shops`テーブルはソフトデリート対象外（物理削除のまま）／ショップ名義商品ページの「指導歴」等インストラクター由来ラベルの文言調整

経緯・発見したバグ（ショップ管理範囲の誤り、カバー画像機能追加、E2Eテストで見つかったブロッカー・セキュリティ課題など）は[DECISIONS.md](docs/DECISIONS.md#2026-07-0407-11ショップインストラクター-出品モデル)参照。

### 1アカウントで個人インストラクター＋自分のショップを両方登録できるようにする（2026-07-11確定）

個人アカウントはインストラクター登録が基本で、自分の店を持つ場合は同じアカウントでショップも追加登録できる。`pro/index.html`にrole-switch（両方持つユーザーのみ表示）とadd-role-banner（追加登録の導線）を実装済み。

**未実施**：実機QA未着手（個人のみ／ショップのみ／両方持つテストアカウントの3パターンで確認要）

詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-111アカウントで個人インストラクター自分のショップを両方登録できるようにする)参照。

### `listings.category` タクソノミー変更（2026-07-10確定）

`category`は「ダイビング種別」専用の4値（**シュノーケリング／スキンダイビング／フリーダイビング／その他**）に統一。ダイビング種別軸(category) × 目的軸(intent) の組み合わせで表現。DB移行済み・本番実行済み（`sql/category_taxonomy_update_20260710.sql`等）。1件のリスティングは`category`と`intent`を独立した2列として持つ。

**検索・表示への影響**：ホーム3タブ・各ピラーページ（snorkeling/skindiving/freediving.html）は`category`で絞り込み。探すページ（explore/index.html）のタブは`intent`で絞り込み（従来通り、2軸は独立）。

**ダイビング種別ごとの目的（intent）制限**（`pro/index.html`のUI側`INTENT_BY_CATEGORY`マップで選択肢を制限。DB側CHECK制約は未追加）：

| ダイビング種別 | 選べる目的（intent） |
|---|---|
| シュノーケリング | やってみたい（try）のみ |
| スキンダイビング | やってみたい／ちゃんと学びたい／もっと潜りたい・ファンダイブ |
| フリーダイビング | 全5種（やってみたい／ちゃんと学びたい／ファンダイブ／トレーニング／コーチング） |
| その他 | 全5種（制限なし） |

**ピラーページの人気タグチップ**：固定チップではなく、実際のリスティングに付いた自由タグを集計し使用頻度順に表示（`loadPopularTags()`）。該当タグが無ければ見本チップを残す。チップクリックは`explore/index.html?tag=<タグ名>`に遷移。

経緯・実例・実機確認結果は[DECISIONS.md](docs/DECISIONS.md#2026-07-10listingscategory-タクソノミー変更エリア設計刷新learn実装方針)参照。

### エリア設計の刷新（2026-07-10確定）

「エリア」固定14タクソノミーを廃止し、**都道府県（`listings.prefecture`）を検索・絞り込みの主軸**にする。事業者は都道府県配下のスポット名を自由入力（`datalist`サジェスト、種データ14件＋実データをマージ）。探すページのSVG地図（`js/area-map.js`）は`explore/index.html`からは廃止。

実装済み：`js/location-data.js`（新規）／`js/area-picker.js`／`explore/index.html`・`pro/index.html`・`admin/index.html`。2026-07-10 Chrome MCPで実機QA完了（admin側`loadListings()`の`prefecture`欠落バグを発見・修正済み）。

**2026-07-14追記**：`explore/shops.html`（ショップ・インストラクターディレクトリ）も同方式に統一し旧SVG地図を撤去。`pro/index.html`のプロフィール編集・新規作成フォームに「拠点の都道府県」欄を追加し`shops.prefecture`/`instructors.prefecture`（既存列）に保存するようにした。既存データはareas列からのベストエフォート推定バックフィルSQL（チャット提示）を本番実行済み。詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-14exploreshopshtmlのエリア軸を都道府県に統一旧svg地図を撤去)参照。2026-07-14 Chrome MCPで実機QA完了（shops.htmlの都道府県チップ絞り込み・タブ切替・pro/index.htmlのプロフィール編集画面での初期値表示を確認）。

**完了（2026-07-15）**：`shops`/`instructors`の`prefecture`バックフィル完了。本番確認SQLで NULL は `shops.Takuya Terajima freediving school` の1件のみと判明し、`UPDATE shops SET prefecture = '鹿児島県' WHERE id = 'f633a59f-...'` を本番実行済み。`explore/shops.html` の都道府県フィルタ全レコードで動作可能な状態になった。

### /learn/ 有料講座：詳細ページ・視聴の実装方針（2026-07-10確定）

講座詳細ページは`courses`テーブルから動的生成。購入導線は`/api/create-course-checkout-session.js`でStripe Checkout、購入記録は`course_purchases`テーブル。視聴はmypage新設タブからVimeo Player APIで再生。耳抜き入門・基礎完全講座から先行実装。

**2026-07-10 本番E2Eテスト完了**（Chrome MCP）。**未着手**：実際の動画アップロード・vimeo_id登録（これが入って初めて購入ボタンが実際に有効化される）

経緯・実機QA詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-10listingscategory-タクソノミー変更エリア設計刷新learn実装方針)参照。

### `shops.shop_type` 廃止（2026-07-05確定）

`shops.shop_type`（individual/school/operator）はどこの検索・フィルタにも使われていなかったため、`pro/index.html`のフォームから選択欄を削除。DB側カラム・CHECK制約は既存データ保護のため未変更（未参照）。

### ショップ/インストラクタープロフィールページと商品ページの分離（2026-07-05確定）

`explore/listing.html`が「プロフィール表示」と「商品詳細＋予約」を兼務し混乱していたため分離。新規`explore/profile.html`（プロフィール専用）、`listing.html`は商品詳細専用に縮小し`listing=`が無ければ`profile.html`にフォールバック。2026-07-07 Chrome MCPで動作確認済み。

### 記事の著者紹介文をDBカラム化（2026-07-05）

著者紹介文が`admin/index.html`と`media/article.html`双方にハードコードされ編集不可だった問題を解消。`admin/index.html`に「著者紹介文（任意）」欄を追加、`articles.author_bio`カラム本番適用済み。既存記事は未設定のためデフォルト文表示のまま。

経緯詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-05shop_type廃止プロフィール-商品ページ分離記事著者紹介文dbカラム化)参照。

### マッチング手数料率変更・キャンセル返金ポリシー設計（2026-07-12確定）

競合Dibee（手数料12%）を参考に、マッチング手数料率をプラットフォーム30%/インストラクター70%→**プラットフォーム10%/インストラクター90%**に変更（実装済み）。ショップ名義予約も同一分配。

**キャンセル料率（3段階、`cancellation_policy`未設定時のフォールバック）**：開催7日以上前＝全額返金／3〜6日前＝50%返金／2日前〜当日・無連絡＝返金なし／ショップ都合の中止＝無条件全額返金。返金時に手元に残る分は通常予約と同じ10/90分配。

実装済み：`sql/bookings_cancellation_20260712.sql`（**2026-07-13本番適用済み**）／`api/cancel-booking.js`（RLS認可→Stripe返金→DB更新）／`admin/index.html`のキャンセル/返金ボタン／`legal/terms.html`等への明記／`mypage.html`からのログイン予約者本人によるセルフキャンセル（2026-07-12実装）。

**2026-07-13〜14 Stripeサンドボックス返金E2E実施（全経路完了）**：
- **adminパス：完了・成功**。Chrome経由で実際にゲスト予約を作成→Stripeテストカード4242で決済→`bookings.status=paid`確認→`admin/index.html`の「キャンセル/返金」ボタンから実行→提案額が3段階ルール通り自動計算されているのを確認（開催3日前のケースで50%＝¥4,000を確認）→実行後`status=refunded`・`cancellation_reason='guest'`・`decrement_booked_count`により`availability_slots.booked_count`が0に戻ることまで確認済み
- **mypageパス：完了・成功**。テスト中に**本番バグを発見**：`mypage.html`の`loadBookingHistory()`が参照する`#booking-history-list`コンテナ要素がHTML側に一度も追加されておらず、ログイン予約者向けセルフキャンセルUI（予約履歴セクション自体）が本番で常に非表示になっていた。`#bookingHistorySection`（学んだ講座セクションと同じ表示/非表示パターン）を追加して修正し、`gcp`でpush・デプロイ済み。デプロイ後に実際の`paid`予約（開催3日前・¥8,000）でセルフキャンセルを実行し、`status=refunded`・`refund_amount=4000`・`cancellation_reason='guest'`まで確認済み
- **追加スポットチェック（2026-07-14）**：push直後の本番反映確認を兼ね、別の実予約（開催日2日超過・無連絡扱い）でもmypageパスのセルフキャンセルを実行。モーダルの自動計算が「返金はありません（開催-2日前）」を正しく表示し、実行後`status=cancelled`・`refund_amount=0`・`cancellation_reason='guest'`・`booked_count`0への復元まで確認。これで3段階（100%／50%／0%）すべてのティアが本番で実地確認済みとなった
- 予約者本人が自分の予約を閲覧できるようにするRLS修正SQLは2026-07-13にSupabaseへ適用済み（`pg_policies`で確認済み）
- `explore/listing.html`の`cancellation_policy`未設定時フォールバック表示も、テスト用非公開リスティングを一時的に公開設定にして目視確認済み（確認後は非公開に戻し済み）。表示文言は想定通り

詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-12マッチング手数料率変更キャンセル返金ポリシー)参照。

-----

### 論理削除（ソフトデリート）方針（2026-07-03導入）

**ユーザー操作による「削除」はデータを物理削除せず `deleted_at` を立てて非表示化する。** `sql/soft_delete_20260703.sql` で導入済み。

- **対象テーブル**：`events`/`articles`/`listings`/`instructors`/`event_staff`/`event_shift_roles`/`athlete_entries`/`availability_slots`
- **非表示の仕組み**：各テーブルに`RESTRICTIVE`な SELECTポリシー`<table>_hide_deleted`（`USING (deleted_at IS NULL)`）を付与
- **コード側**：削除は`.delete()`ではなく`.update({ deleted_at: new Date().toISOString() })`を使う
- **連鎖**：親を消したら子も連鎖ソフト削除（instructor→listings・slots、listing→slots）
- **物理削除のまま残すもの**：内部の「全消し→入れ直し」系と`user_roles`（権限剥奪）
- **復元UI**：未実装（当面はSupabaseから直接`deleted_at`をNULLに戻す）

**要フォローアップ**：`events`/`event_staff`/`event_shift_roles`/`athlete_entries`を読む他画面（`mypage.html`等）で削除済み行が残って見える場合、`.is('deleted_at', null)`条件の追加漏れの可能性あり（同種のバグを2026-07-07に2件発見・修正済み）。

経緯詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-03論理削除ソフトデリート方針)参照。

-----

## 多言語対応（i18n）方式（2026-07-12確定）

対応言語は英語・韓国語・中国語。固定UI（ナビ・ボタン等）はJSON翻訳ファイルで人力対応、UGC（自己紹介文・コース説明・レビュー）はGoogle Cloud Translation APIによる自動翻訳（選定理由等の経緯は[DECISIONS.md](docs/DECISIONS.md#2026-07-12多言語対応i18n方式)参照）。

**翻訳のタイミング＝保存時キャッシュ方式（閲覧時にAPIは呼ばない）**：保存・投稿の瞬間にサーバーレス関数が英・韓・中3言語分をまとめて生成・保存し、閲覧者は保存済み翻訳を読むだけ。翻訳が無い・失敗した場合は日本語原文にフォールバック。

**保存先：専用`translations`テーブルに集約**（`_en`/`_ko`/`_zh`のようにカラムを言語×フィールドの数だけ増やす方式は対象が増えるたびに破綻するため不採用）

```
translations(
  table_name       TEXT,   -- 'instructors' / 'shops' / 'listings' / 'reviews' 等
  row_id           UUID,
  field_name       TEXT,   -- 'bio' / 'name' / 'description' 等
  lang             TEXT,   -- 'en' / 'ko' / 'zh'
  translated_text  TEXT,
  source_hash      TEXT,   -- 元の日本語テキストのハッシュ（再翻訳要否の判定用）
  is_manually_edited BOOLEAN DEFAULT FALSE,  -- 本人が手直しした場合はTRUE
  translated_at    TIMESTAMPTZ
)
```

- `source_hash`で元テキストが前回翻訳時から変わっていないか判定し、変わっていなければ再翻訳（＝API課金）をスキップする
- `is_manually_edited`がTRUEの行は、日本語側が更新されても自動上書きしない（本人の手直しを機械翻訳が消す事故を防ぐ）。既存の`name_en`/`bio_en`手入力欄はこの「手動修正」の入り口として位置づけを変えて流用する想定
- レビューは投稿後に編集されない前提のため、投稿時に1回翻訳して終わり（`source_hash`判定は不要）

**対象範囲**：探す系（探すページ・インストラクター/ショッププロフィール・コース詳細）から着手。メディア記事は後続フェーズ（翻訳運用コストが継続的に発生するため）

**実装済み（2026-07-12・pmスキルで着手）**：
- `sql/translations_20260712.sql`（新規・`translations`テーブルDDL。ステータス: 実行済み・2026-07-13）
- `api/translate-content.js`（新規・POST。`{tableName, rowId, fields}`を受け取り、`source_hash`で変更検知・`is_manually_edited`行はスキップしつつGoogle Cloud Translation APIで英・韓・中を翻訳し`translations`テーブルにupsertする。構文チェック済み）

**完了（2026-07-13）**：
- Google Cloud Translation APIの有効化・APIキー取得・Vercel環境変数`GOOGLE_TRANSLATE_API_KEY`設定（Production/Preview/Development全環境に設定・Redeploy済み）

**完了（2026-07-15）**：
- `pro/index.html`のプロフィール保存（`saveProfile`）・ショッププロフィール保存（`saveShopProfile`）・コース保存（`saveListing`）から`api/translate-content.js`を呼ぶ配線（fire-and-forget）
- `explore/profile.html`の言語切り替えUI（日本語/EN/한국어/中文）と`translations`テーブル参照ロジック（bio・nameフィールド）
- `explore/listing.html`の言語切り替えUI（日本語/EN/한국어/中文）と`translations`テーブル参照ロジック（title・descriptionフィールド）

**完了（2026-07-15）**：
- `api/translate-content.js`を拡張し、`manualTranslations`パラメータで`is_manually_edited=TRUE`の手動訳を保存できるようにした
- `pro/index.html`の`saveProfile`に`name_en`/`bio_en`の手入力値を`translations`テーブルに`is_manually_edited=TRUE`で保存する処理を追加
- `js/i18n.js`を新規作成（英語・韓国語・中国語の固定UI文言辞書 + `applyI18n(lang)`関数）
- `explore/profile.html`・`explore/listing.html`のセクションタイトル・ラベル・ボタン等に`data-i18n`キーを付与し、`switchLang()`で`I18N.apply(lang)`を呼ぶよう実装。言語切り替え時に固定UI文言も追従するようになった

**完了（2026-07-16）**：
- `explore/profile.html`の`switchLang()`を修正：非同期でbioのinnerHTMLを書き換えた後に`I18N.apply(lang)`を再呼び出しするよう変更（`lang_notice`スパンが動的生成後も正しく切り替わらない不具合を解消）
- Chrome MCPによる本番実機QA完了（profile.html：EN/ko/zh全15キー・ja復元 ✅、listing.html：EN全16キー・ja復元 ✅）
- `js/lang-switcher.js` 新規作成：ブラウザ言語自動検出・`localStorage(fj_lang)`永続化・ヘッダーグローブアイコンUI注入（全ページ共通）
- `index.html`・`explore/*.html`・`freediving.html`・`skindiving.html`・`snorkeling.html` にナビ `data-i18n` 属性追加＋`LangSwitcher.init()` 統合
- profile.html/listing.html ヘッダーに `<div class="hdr-right">` 追加（グローブアイコン注入先）
- 本番QA完了（2026-07-16）：全ページ globe ✅ / localStorage 復元 ✅ / ページ間言語引き継ぎ ✅（index→explore→profile→listing で zh/ko/en が維持されることを Chrome MCP で確認）

**未着手**：
- レビュー投稿フローへの接続（投稿フォーム自体が未実装のため後回し）
- メディア記事の多言語化（翻訳運用コストが継続的に発生するため後続フェーズ）
- ホームページ・explore一覧・shopsページ等のナビゲーション部分の言語切り替えUI（現状は profile/listing のコンテンツページのみ）

-----

## Stripe 設定メモ

- **モード**：サンドボックス（テスト環境）
- **ビジネスモデル**：マーケットプレイス（プラットフォームが集金 → インストラクターへ送金）
- **手数料分配**：プラットフォーム 10% / インストラクター 90%（2026-07-12更新。旧30%/70%）
- **Webhook エンドポイント**：`https://freediving-japan.vercel.app/api/stripe-webhook`
- **リッスンイベント**：`checkout.session.completed`, `checkout.session.expired`
- **Vercel 環境変数**：`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SITE_URL` 設定済み

-----

## ファイル構成（主要）

```
/index.html               # トップ（Airbnb風マーケットプレイス：検索バー＋ピラータブ切替＋横スクロールカード）
/snorkeling.html          # ピラー専用ページ：シュノーケリング（検索＋関連カード＋記事）
/skindiving.html          # ピラー専用ページ：スキンダイビング
/freediving.html          # ピラー専用ページ：フリーダイビング
/css/home.css             # トップ＋ピラー3ページ共通のライトテーマ（design-system.cssとは別系統）
/js/home.js               # 共通挙動（お気に入り♡・ピラータブ切替・検索バー送信）
/js/area-map.js           # 自前SVG日本地図のエリア選択コンポーネント（explore/shops共用・2026-07-08）
/auth.html                # 認証画面（メール/パスワード・Googleログイン）
/sitemap.xml              # 公開10ページの静的サイトマップ（2026-07-08。記事の動的生成は今後の課題）
/robots.txt               # admin/pro/api/booking/mypage/auth をクロール除外（2026-07-08）
/404.html                 # 404ページ（2026-07-08）
/mypage.html              # ログイン後＝プロ・選手の世界
/admin/index.html         # 管理画面（空き枠・予約管理）
/js/supabase-config.js    # Supabase接続設定（anon key格納）
/data/                    # JSONデータファイル
  all_rankings_data.json
  athlete_photos.json
  jp_official_records.json
/scripts/                 # Python・Nodeスクリプト
  fetch_all_rankings.py
  fetch_jp_records.py
  fetch_overall_fix.py
  insert_article.mjs      # 記事MD→Supabase下書きINSERT（media-writerスキル用・2026-07-06）
/api/                     # Vercel Serverless Functions
  create-checkout-session.js
  stripe-webhook.js
/explore/                 # マッチング（先行実装中）
  index.html
  shops.html              # ショップ・インストラクターディレクトリ（2026-07-05〜）
  listing.html            # リスティング詳細（旧instructor.html）
/booking/
  success.html
/media/                   # メディア（Phase 2〜）
  index.html              # 記事一覧（Supabase動的取得）
  article.html            # 記事詳細（?slug= で動的表示）
/admin/
  index.html              # 管理画面（メディアタブで記事入稿・編集・承認）
  admin-mobile.html       # アイデアリスト専用（運用しない）
/_old/articles/           # 旧静的記事（2026-06-29 退避・参照のみ）
/tools/                   # ツール類
  buoyancy-simulator.html
  mouthfill-calculator.html
  sta-timer.html
  training-log.html
/events/                  # 大会・イベント
  2026_competitions.html
  competition-countdown.html
  event-staff.html
/rankings/                # ランキング
  AIDA_ranking.html
/learn/                   # 学ぶ（Phase 1.5〜）
  index.html
  freediving-learn.html
/pro/                     # インストラクター向け
  index.html
  instructor-welcome.html
/sql/                     # DBスキーマ・テストデータ（先頭にステータスヘッダ必須）
/ops/                     # 運用・自動化ツール（QAスモークテスト・フォローアップスキャナ・Skillソース。ops/README.md参照・2026-07-06導入）
/old/                     # 旧ファイル保管庫（参照のみ）
```

## サイトマップ（二層構造）

```
■ 未ログイン ＝ 初めての人の世界
TOP (index.html)  ── Airbnb風マーケットプレイス（白基調）
│   ├── 検索バー（エリア／日程／タイプ）→ /explore/?q=&area=&intent= へ遷移
│   ├── ピラータブ（すべて／シュノーケル／スキン／フリー）＝その場でカード列を切替
│   └── 各タブ「もっと見る」→ ピラー専用ページ
│
├── ピラー専用ページ（snorkeling / skindiving / freediving.html）
│   └── 種目別の検索＋関連カテゴリ＋体験カード＋記事（共通 css/home.css・js/home.js）
│
├── 読む：メディア (/media/)              [Phase 2]
│
├── 探す：マッチング (/explore/)          [Phase 2・トップの検索バーから連携。URLパラメータ q/area/intent で初期絞り込み対応済み]
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
|Week 7-8|React Nativeアプリ（タイマー・ログ・SNSシェア）            |🔄 開発中 |

### Phase 2（Phase 1完了後・約2ヶ月）

未ログイントップの二層化・マッチング機能・探す全カテゴリ・メディア立ち上げ・インストラクター紹介動画

### Phase 3（Phase 2完了後・約2ヶ月〜継続）

有料動画教材・SEOコンテンツ拡充

**合計目標：約6ヶ月でフル展開**

-----

## 現在の実装状況

各項目の経緯・実装詳細は該当セクション（本ファイル内）または[DECISIONS.md](docs/DECISIONS.md)参照。

|ページ・機能                                              |状況                          |
|----------------------------------------------------|----------------------------|
|トップページ（index.html）                                  |✅ Airbnb風マーケットプレイスに全面刷新（2026-07-03）。**カード内容は代表ダミーで実データ差し替えは未**|
|ピラー専用3ページ（snorkeling/skindiving/freediving.html）    |✅ 新設（2026-07-03）。category実データ接続・人気タグ集計チップ済み|
|検索バー連携（トップ／ピラー → explore）                      |✅ 実装済み。**日程(date)フィルタは未使用**（該当データなし）|
|ランキング（AIDA_ranking_prototype.html / site/index.html）|✅ 完成                        |
|大会情報（2026_competitions.html）                        |✅ 完成                        |
|トレーニングログ（training-log.html）                         |✅ Supabase接続・保存・読み込み・編集・URLシェア・カレンダー表示実装済み|
|マイページ（mypage.html）                                  |✅ Supabase接続完了（トレーニングカレンダー・サマリー・予約履歴・大会管理）|
|STAタイマー（sta-timer.html）                             |✅ 大幅機能追加・デプロイ済み。2026-07-14：録画状態不整合3件修正。2026-07-15：Wake Lock取得漏れ修正。2026-07-16：iOS Safari固有バグ（timeslice無視・onstop/ondataavailable逆順発火）を特定し、onstop 200ms遅延・iOS用preBuf無効化・visibilitychange拡張の3件を修正。**実機（iPhone Safari）での最終確認が必要**（O2 Basic・Rest 2:00・録画ONで各セットのクリップ長を確認）。詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-16staタイマー録画1秒しか録れない再々発--ios-safari-mediarecorder-固有動作が真因)参照|
|Mouthfill Calculator（mouthfill-calculator.html）     |✅ 完成・push済み                  |
|インストラクターウェルカム（instructor-welcome.html）              |✅ 作成完了                      |
|フリーダイビングを学ぶ（freediving-learn.html）                 |✅ 管理ツール完成・learn/index.html 骨格完成  |
|大会カウントダウン（events/competition-countdown.html）         |✅ 完成（スタンドアロン・Supabase不要）        |
|認証画面（auth.html）                                     |✅ メール/パスワード・Googleログイン実装済み（Apple は Developer 登録待ち）|
|Supabase DB / 認証接続                                  |✅ テーブル作成・RLS設定・メール/Google OAuth接続済み|
|マッチング（/explore/）                                    |🔄 先行実装中（本格公開はPhase 2）。検索強化・都道府県ベースの位置検索・ショップ/インストラクターディレクトリ実装済み|
|listings 全フィールド対応                                    |✅ pro/index.html・listing.htmlとも全項目の入力・表示対応済み|
|予約・決済フロー                                            |✅ 完成・動作確認済み（カレンダーUI→Stripe Checkout→予約完了ページ、E2Eテスト済み）|
|管理画面（/admin/index.html）                              |✅ 実装済み（空き枠・予約・インストラクター・リスティング・メディア・ユーザー管理）|
|プロダッシュボード（pro/index.html）予約・クライアント・売上管理タブ            |✅ 実装済み|
|/learn/ 有料講座ページ                                      |🔄 骨格完成・`courses`/`course_chapters`/`course_purchases`スキーマ本番適用済み。購入フロー・視聴タブとも2026-07-10本番E2Eテスト完了。**未着手**：実際の動画アップロード・vimeo_id登録（これが入るまで購入ボタンは有効化されない）|
|メディア（/media/）                                        |✅ 基盤完成・media/一本化（2026-06-29）。admin/index.htmlメディアタブに統合|
|サイト動線・検索UI・エリア設計                                    |✅ sitemap/robots/404新設、SVG地図→都道府県軸検索に刷新済み（詳細は[DECISIONS.md](docs/DECISIONS.md#2026-07-08サイト動線整備検索ui刷新svg地図後に一部廃止)参照）|
|iOSアプリ（React Native）                                 |🔄 開発中（環境構築済み・Expo Go動作確認済み）。6タブのタブバー実装済み（2026-07-14・ホーム/ログ/タイマー/探す/情報/マイページ、探す・情報・マイページはWeb版へのブリッジ）。Supabase Auth（メール/パスワード）を追加し、STAタイマーの保存処理を実スキーマ（`training_sessions`+`training_dives`）に合わせて修正済み（2026-07-14、詳細は[APP.md](APP.md#phase-1-実装状況2026-07-14更新)）。**実機での保存動作確認は未実施**。ログ画面は公開セッション一覧のみ・SNSシェアは未実装|
|多言語対応（i18n）基盤                                      |✅ 完了（2026-07-16）。DB/API/Translate APIキー/pro保存配線/profile・listing言語切替UI/js/i18n.js（固定UI文言辞書）/name_en手動翻訳保存/lang-switcher.js（全ページ共通グローブUI・ブラウザ言語自動検出・localStorage永続化）すべて実装・本番QA済み。残：レビュー投稿フロー・メディア記事多言語化|

-----

## ドキュメントTODO（未作成）

- `docs/instructor/sales.md` — インストラクター向け営業資料。骨格：①現状の課題（技術はあるが集客が苦手）②Freediving Japanが解決すること（業界全体をマーケティングして初心者を集める）③ターゲット2層（未集客層／既集客層）④使える機能（CRM・生徒管理・予約管理・プロフィール・マッチング）⑤収益モデル（基本無料・フル機能はサブスク）
- `docs/instructor/manual.md` — インストラクター向け使い方マニュアル。「こう使うと効果的」という運用ノウハウ集。会話の中で出てきた知見を随時追加

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
| インストラクターカバー画像 | `{user_id}/instructor-cover.{ext}` | `instructors.cover_url` |
| ショップロゴ | `{user_id}/shop-logo.{ext}` | `shops.logo_url` |
| ショップカバー画像 | `{user_id}/shop-cover.{ext}` | `shops.cover_url` |

RLSポリシー（`storage.objects`）：INSERT/UPDATE/DELETE は `auth.uid()::text = split_part(name, '/', 1)` で本人のみ。SELECT は public。

-----

### Supabase Storage（article-imagesバケット）

記事用画像を管理するパブリックバケット（2026-06-29 作成）。

| 用途 | パス | 保存先 |
|---|---|---|
| カバー画像 | `covers/{timestamp}_{filename}.{ext}` | `articles.thumbnail_url` |
| 本文内画像 | `inline/{timestamp}_{filename}.{ext}` | 記事 HTML に直接 `<img src="...">` |

RLSポリシー（`storage.objects`）：INSERT は `is_site_admin()` のみ。SELECT は public。バケット作成・RLSは Supabase ダッシュボードから手動実施済み。

-----

## training-log.html 実装仕様メモ

### ベストタイム（bestTime）計算ルール

セッションに STA系種目（STA / RVSTA / FRCSTA）が含まれるかどうかで分岐する。

| 条件 | bestTime |
|---|---|
| STA系ダイブがある | STA系ダイブの中で最長の保持時間（`hold_time` / `result_time`） |
| STA系なし・海ダイブあり（CWT/CWTB/CNF/FIM） | 最大深度ダイブの `result_time`（実際の潜水時間） |
| STA系なし・プールダイブのみ（DYN/DNF/DYNB） | 最大距離ダイブの `result_time` |

**背景**：インターバルモードの DYN/DNF ダイブは `result_time` にレスト時間が格納されるため、全ダイブの `max(result_time)` でベストタイムを計算するとレスト時間が混入するバグがあった（2026-06-29 修正）。

### ページ遷移・フォーム管理

- `goto(page)` — ページ切り替え。`entry` に遷移するたびに `resetForm()` を呼んでフォームをクリア
- `editSession(id)` — セッションをフォームに展開して編集モードにする（`goto` は呼ばない）
- `switchEntryTab(tab)` — タブ切り替え。`?.` で null-safe に

### インターバルモード（`applyIntervalToDives`）

インターバルテーブルの行を個別ダイブレコードに変換。

| 種目 | `time` フィールド | `holdTime` フィールド |
|---|---|---|
| STA系 | ホールド時間（文字列） | 同じ値（秒数） |
| 非STA（DYN等） | レスト時間（文字列） | null |

DB 保存時：`result_time = t2s(d.time)`、`hold_time = d.holdTime`。
非STA インターバルダイブでは `result_time` = レスト時間（秒）になるため、bestTime 計算では「最大深度/距離ダイブの result_time」ロジックで対処している。

-----

## 既知のバグ・セキュリティ課題

**2026-06-26コードベース全体レビュー**（予約・RLS・決済まわり11件）→ **全件2026-06-28対応済み**
**2026-07-04セキュリティ監査**（S1〜S10 + 追加1件）→ **全件対応済み**（SQL: `sql/security_fix_20260704.sql`本番実行済み）

対応内容の詳細（各項目の原因・修正方法）は[DECISIONS.md](docs/DECISIONS.md#2026-0626202606-28既知のバグセキュリティ課題コードベース全体レビュー→-全件対応済み)・[DECISIONS.md](docs/DECISIONS.md#2026-07-04セキュリティ監査-→-全件対応済み)参照。新しい脆弱性調査を行った場合はこの2セクションと同じ形式でDECISIONS.mdに追記する。
