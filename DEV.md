---
tags: [dev, core-doc]
---

# Freediving Japan — 開発・技術仕様

## リリース判定（2026-07-11・定期タスクによる自動判定／前回2026-07-10判定を更新）

**問い：今すぐ友人インストラクターを1人招待して良いか → 判定：NO（ただし前回より前進。残りは実質2件・半日規模）**

### 前回（07-10）からの変化

- ✅ **旧ブロッカー2「直近改修の実機スモーク」はほぼ解消**：検索UI刷新（トップ＋ピラー3ページ＋explore）・エリア検索刷新一式（explore/pro/admin）を07-10にChrome MCPで実機確認完了（admin一覧の都道府県列バグも発見・修正済み）。category/intent推測移行も本番全2件の目視確認完了
- ✅ learn講座購入の本番E2E完了・法務ページ一式（about/contact/privacy/terms/**特商法**）新設 — 決済を伴う招待の前提が整った
- ⚠️ ただし07-10 20:36のコミットで`pro/index.html`・`explore/listing.html`・legal各ページに**新規SQL2件に依存する変更**が入った（下記ブロッカー1）

### 残タスク（優先順位順・上から着手）

**必須（ブロッカー）**

1. **新規SQL2件の本番適用を確認（未適用なら実行）** — 数分で終わるが、放置すると中核機能が壊れる
   - `sql/listings_course_template_20260710.sql`（`listings.target_level`/`goal`追加）：**未適用だとpro/index.htmlのコース保存とexplore/listing.htmlの詳細表示が失敗する**（フロントは既に両カラムを読み書きしている）
   - `sql/contact_messages_schema_20260710.sql`：未適用だとlegal/contact.htmlのお問い合わせ送信が失敗する
   - 両ファイルともステータスヘッダ無し（DEV.mdルール違反状態）。確認後に`-- ステータス: 実行済み（日付）`を追記すること
2. **予約→決済のフルE2Eを現行コードで1回通す**（前回から継続・依然として結果記載なし）
   - 経路：explore→listing.html→空き枠カレンダー→Stripe Checkout（4242）→webhook→`bookings.status=paid`→success.html
   - ショップ名義商品（instructor_id無し）でも1回通す（カレンダー表示までは07-07確認済み・決済まで未実施）
   - 併せて：pro/index.htmlから新category/intent/エリア/対象レベル入力で**新規コースを1件実登録→explore反映**まで確認（旧スモーク最低ライン②の未消化分。ブロッカー1のカラム確認も兼ねられる）
   - 根拠：招待するのはインストラクター＝予約・決済と出品が中核価値。旧E2E成功は07-04ショップモデル・07-08検索UI・07-10タクソノミー/エリア/講習テンプレ変更より前のもので現行コードの保証にならない

**後回しで良い（招待のブロッカーではない）**

- **iOSアプリ**（タブバー・ログ・Supabase連携・SNSシェア未実装）— Phase 1ゴールの「毎日使うツール」はWeb版（トレーニングログ・CRM・予約管理・STAタイマー）で提供済み。友人にはWeb版で先行利用してもらい、アプリは後追いで良い
- **docs/instructor/sales.md** — 友人への声かけは口頭で足りる。第三者に営業を始める段階までに作成
- **docs/instructor/manual.md** — オンボーディングは一緒に触りながらで良い（早期フィードバック自体がPhase 1の目的）。招待直後の質問対応から得た知見をここに落とす運用を推奨
- スマホ幅375pxの通し確認（旧スモーク最低ライン③・明示記録なし。E2Eのついでに1周すれば十分）
- explore/shops.htmlの旧エリア刷新／shopsのソフトデリート対象化／shop_typeカラム削除／既存記事のauthor_bio設定／learn動画アップロード（購入ボタンは「準備中」ガードあり課金事故なし）／contact_messagesの管理画面閲覧UI（当面はSupabaseダッシュボードで確認）

### 判定の根拠

- **STRATEGY.md Phase 1ゴール照合**：友人招待に必要な機能（CRM・予約管理・トレーニングログ・プロフィール・リスティング）はWeb側で全て「✅完了」。前回唯一の障害だった「大改修の実機未検証」は07-10のQAでほぼ解消
- **残る障害は2点のみ**：①07-10夜に追加された講習テンプレ・お問い合わせのDB依存が本番適用未確認（ステータスヘッダ無しのSQL2件をops/scan_followups.mjsも検出済み）②予約決済E2Eが現行コードで未実施。いずれも実装ではなく確認作業
- **RLS・セキュリティ**：ブロッカー無し。2026-06-26レビュー11件・2026-07-04監査S1〜S10全件対応済み。bookingsのINSERTはRPC限定、記事サニタイズ・XSS・ソフトデリートadminバグ対応済み。新設contact_messagesもINSERT文字数・カテゴリ制限＋SELECT/UPDATE管理者限定のRLS付きで設計されている（適用確認はブロッカー1に含む）→ 友人の実データが入っても事故らない状態
- 判断方針：全部を完璧にしてからではなく「最小限で招待できる状態」を基準にした。ブロッカー2件を潰した時点でYESに切り替えてよい

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
| `bookings` | ✅ | 本人インストラクター or 本人ショップ or 管理者のみ閲覧 / 新規作成は `create_pending_booking()` RPC 経由のみ（直接INSERT不可・S1対応） |
| `shops` | ✅ | 公開 / 本人 / 管理者 |
| `reviews` | ✅ | 公開 / 本人書き込み |
| `inquiries` | ✅ | 誰でも新規作成 / 本人インストラクター or 本人ショップ or 管理者のみ閲覧・更新（2026-07-04追加） |
| `articles` | ✅ | 公開済み: 全員 / 認証済み: 全件 / 管理者: 全件（`articles_select` ポリシー）/ UPDATE: admin/staff は全件・editor は自分の記事のみ（published 変更不可）/ DELETE: admin/staff は全件・editor は自分の下書きのみ（`articles_review_flow_20260629.sql`） |
| `user_roles` | ✅ | is_site_admin()=true のみ全操作（admin/staff/editor） |

### ショップ／インストラクター 出品モデル（2026-07-04・secretary相談で確定）

**背景**：以前は listings/bookings 等が instructor_id 必須で、必ず個人インストラクター単位の商品という前提だった。実態はショップが担当者未定のまま商品を出すこともあり、インストラクターは複数ショップに同時に所属する（例：夏はVolcano Cup、冬は流氷フリーダイビング）。

- **ショップは単体で商品を出品できる**（`listings.shop_id`）。担当インストラクター未定でもショップ名義で完結してよい
- **インストラクターは複数ショップに同時所属できる**：新設した `instructor_shops`（N:M中間テーブル）で管理。季節・期間ラベルは持たず、フラットな所属一覧
- **ショップ名義の商品に参考として担当インストラクターを併記することも可能**（`listings.instructor_id` と `shop_id` 両方セット可）
- `listings` / `availability_slots` / `bookings` / `inquiries` / `reviews` は `instructor_id` を nullable化し `shop_id` を追加。`CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)` でどちらか必須を担保
- `create_pending_booking()` RPC に `p_shop_id` を追加。未指定なら `availability_slots.shop_id` から自動補完（既存呼び出し側の互換維持）
- 個人インストラクターが「自分をショップとして登録する」従来の運用は不要になったが、既存データはそのままで問題ない（併用可）
- 実装（DB）：`sql/shop_direct_listings_20260704.sql`（Supabase本番適用済み）
- 実装（UI・同日追加）：`pro/index.html`（ショップロールでコース/空き枠/予約/問い合わせをショップ名義対応、`instructor_shops`統合）／`admin/index.html`（ショップ選択・フィルタ追加）／`explore/index.html`・`explore/listing.html`（商品一覧・詳細・予約カレンダー・決済がショップ名義商品にも対応、`normalizeOwner()`でinstructor/shop共通化）／`api/create-checkout-session.js`（`shopId`対応）
- **未着手（フォローアップ）**：`shops` テーブルはまだソフトデリート対象外（物理削除のまま）／ショップ名義商品ページの「指導歴」等インストラクター由来ラベルの文言調整
- **2026-07-07：Chrome MCPでショップ名義商品の予約カレンダー表示を確認済み**（`explore/shops.html`→ショップカード→コース詳細→空き状況カレンダーが正常表示、コンソールエラーなし）。ただし決済（Stripe Checkout）までの一気通貫E2Eは未実施
- **2026-07-05追記**：`pro/index.html`の`applyShopOwnerFilter()`は当初`instructor_shops`（在籍インストラクター）のIDも管理対象に含めていたが、在籍インストラクターを追加しただけでその人個人の既存商品・予約・問い合わせまでショップの管理画面に出てきてしまう不具合につながったため、`shop_id = 自ショップ`のみに限定するよう修正。**在籍インストラクター（instructor_shops）は「プロフィール表示用のロースター」であり、商品・予約等の管理権限を拡張するものではない**という方針を明確化
- **2026-07-05追記**：`shops`にカバー画像の表示位置調整機能を追加（`pro/index.html`のショップ編集画面・記事エディタの`ae-cover-pos`と同方式のドラッグ/矢印UI）。DB側の`shops.cover_position`カラム（TEXT、例`"50% 50%"`）は **2026-07-06 Supabase本番に適用済み**（`sql/shops_cover_position_20260705.sql`・information_schemaで確認済み）
- **2026-07-11追記**：instructor向けプロフィールページ（`explore/profile.html`）にバナー（カバー画像）表示枠があるにもかかわらず、`instructors`側に登録UI・カラムが存在しなかった不具合を修正。`shops`と同方式で`instructors.cover_url`／`instructors.cover_position`を追加し、`pro/index.html`のインストラクタープロフィール編集画面にアップロード＋ドラッグ/矢印での表示位置調整UIを追加（`handleInstructorCoverFile()` / `ip*`関数群）。`explore/profile.html`・`explore/listing.html`の表示側も`raw.cover_url`を参照するよう修正。**DB側`sql/instructors_cover_20260711.sql`は未実行（Supabase本番へのSQL Editor実行が必要）**
- **2026-07-11 フルE2Eテスト実施（Chrome MCP・Stripeサンドボックス）**：予約→決済→webhook→booked_count増加→success表示の一連は正常動作を確認。ただし以下の不具合を発見・修正：
  - 🔴**ブロッカー**：ショップ名義（instructor_id IS NULL）の予約が `api/create-checkout-session` で500エラーになり実質予約不可能だった。真因は`sql/clients.sql`の`sync_client_from_booking()`トリガーが`clients.instructor_id NOT NULL`前提のまま`shop_direct_listings_20260704.sql`のnullable化に追従しておらず、ショップ名義予約のINSERT時にトリガー内のNOT NULL制約違反で`create_pending_booking()`ごとロールバックしていたため（QA当初の「.eq nullが原因」という推測は誤りで、実際はこのトリガーが原因）。`NEW.instructor_id IS NULL`ならclients同期をスキップするよう修正済み（**要Supabase本番再適用**）
  - 🔴**セキュリティ**：anonキーでbookingsが全件SELECT可能（client_email等漏洩）と報告。`sql/`内のポリシー定義は正しく owner/admin限定になっているため、本番にStudio経由の重複ポリシー（S3のarticlesと同型の問題）が残っている可能性が高い。要本番pg_policies確認・再適用
  - ⚠️ `api/create-checkout-session.js`：クライアント指定のinstructorIdをそのまま予約に保存していた（ショップ名義枠に任意のinstructorIdを送りつけられる状態）→ 常にslot由来の値のみを信頼するよう修正
  - ⚠️ `booking/success.html`：ショップ名義予約でも「インストラクターから連絡」固定表示・ショップ名非表示だった → 担当名＋インストラクター/ショップの呼称出し分けに修正（`api/booking-result.js`にinstructors/shops名を追加）
  - ⚠️ `explore/listing.html`：`?listing=`のみ（owner指定なし）だと「見つかりませんでした」になっていた → listingsテーブルからownerを引いてリダイレクトするフォールバックを追加
  - **未対応（要判断・意図的に見送り）**：ショップ名義予約でもinstructor_payout/platform_feeがインストラクター向け70/30分配のまま計算されている。ショップ精算をインストラクターと同じ分配にするか別設計にするか要確認

### `listings.category` タクソノミー変更（2026-07-10・secretary相談で確定）

**背景**：旧6値（フリーダイビング体験／スキンダイビング体験／スクール・資格取得／トレーニング・アスリート向け／ツアー・ガイド／その他）は「ダイビング種別」と「目的」が混在しており、ホームの3ピラー（シュノーケル／スキン／フリー）に対応するcategory値が存在しなかった（特にシュノーケルに相当する値が皆無）。そのため`snorkeling.html`/`skindiving.html`は実データ接続ができず静的モックのまま、`freediving.html`はcategory一致＋タイトルキーワードOR条件という力技で絞り込んでいた。

- `category`を「ダイビング種別」専用の4値（**シュノーケリング／スキンダイビング／フリーダイビング／その他**）に統一。ダイビング種別軸(category) × 目的軸(intent) の組み合わせで表現する方針に変更
- ピラーページのchips（「体験ツアー」「認定コース」等）をDB分類（tags列）に紐付ける案は当初見送ったが、同日中に再検討して実装（詳細は下記「ピラーページの人気タグチップ」参照）
- `intent`の`dive`→`fundive`/`training`/`coaching`分割（`sql/intent_taxonomy_update_20260708.sql`）も同時に本番適用する
- **DB移行**：`sql/category_taxonomy_update_20260710.sql`・`sql/intent_taxonomy_update_20260708.sql`ともに**2026-07-10 Supabase本番に実行済み**（intent側は制約追加とデータ移行の順序が逆になっていたバグを発見・修正してから実行）。categoryの既存リスティング再分類はタイトルキーワードによる推測移行のため、admin画面で目視確認推奨→**2026-07-10 Chrome MCPで目視確認完了**：本番listings全2件とも問題なし（「コーチングセッション」=フリーダイビング/coaching・「フリーダイビング体験(プールでも可能です」=フリーダイビング/try。手動修正不要）
- **実装済み**：`pro/index.html`（カテゴリselect→新4値、検索タブ分類select→try/learn/fundive/training/coaching）／`admin/index.html`（カテゴリ名入力欄のプレースホルダーを新値に更新。intentのselectは元から新分類対応済みだった）／`index.html`（フリー枠の絞り込みにcategory条件を追加し、他種目の商品が紛れ込むのを修正）／`snorkeling.html`・`skindiving.html`（freediving.html同様にSupabase実データ接続を追加。該当0件時はモックを残す方針でfreediving.htmlより安全側に倒した）／`freediving.html`（category一致のみのシンプルなクエリに整理、タイトルキーワードOR条件を廃止）
- explore/index.html・explore/shops.htmlはcategoryを表示・テキスト検索補助にしか使っておらず変更不要（確認済み）

**この変更がデータ・検索に与える影響（確認用メモ）**

- 1件のリスティングは「ダイビング種別（category）」と「目的（intent）」を**独立した2つの列**として持つ。1つのコースは必ずどちらも1つずつ選ぶ（ダイビング種別×目的の掛け合わせで表現。例：スキンダイビング×learn＝スキンダイビングの認定コース）
- **実例（本番の唯一のリスティングで確認済み）**：「コーチングセッション」というリスティングは移行前 `category=トレーニング・アスリート向け` / `intent=dive` だったが、移行後は `category=フリーダイビング` / `intent=coaching` になった。旧categoryがダイビング種別不明だったためフリーダイビング扱いにフォールバックし、タイトルに「コーチング」を含んでいたためintent側はcoachingと判定された（推測移行なので、狙い通りか要目視確認）
- **検索・表示への影響**：
  - ホーム（index.html）の3タブ（シュノーケル／スキン／フリー）と各ピラーページ（snorkeling/skindiving/freediving.html）は`category`（ダイビング種別）で絞り込む。**ホームのタブ切り替えはこのcategory列と直接リンクしている**
  - 探すページ（explore/index.html）の「やってみたい／ちゃんと学びたい／もっと潜りたい」タブは`category`ではなく`intent`で絞り込む（従来通り）
  - この2軸は独立しているため、explore側でダイビング種別（シュノーケル/スキン/フリー）による絞り込みは今回追加していない。ホームの3ピラー経由でダイビング種別別に見せる導線と、探すページのintent別導線の2つが並立する形
- **新規リスティング登録（pro/index.html）**：ダイビング種別は4択（シュノーケリング／スキンダイビング／フリーダイビング／その他）、目的は5択（やってみたい／ちゃんと学びたい／もっと潜りたい・ファンダイブ／もっと潜りたい・トレーニング／もっと潜りたい・コーチング）から選ぶだけになった

**ダイビング種別ごとの目的（intent）制限（2026-07-10・同日追記で確定）**

種目によって成立する「目的」が異なるため（スキン/シュノーケルにトレーニング・コーチングという競技的な目的は基本的に存在しない）、`pro/index.html`のUI側で選択肢を制限した。

| ダイビング種別 | 選べる目的（intent） |
|---|---|
| シュノーケリング | やってみたい（try）のみ |
| スキンダイビング | やってみたい／ちゃんと学びたい／もっと潜りたい・ファンダイブ |
| フリーダイビング | 全5種（やってみたい／ちゃんと学びたい／ファンダイブ／トレーニング／コーチング） |
| その他 | 全5種（制限なし） |

- 実装：`pro/index.html`に`INTENT_BY_CATEGORY`マップと`applyCategoryIntentOptions()`を追加。ダイビング種別selectのonchangeで目的selectの選択肢を絞り込み、フォーム初期化時・編集読み込み時にも適用
- DB側のCHECK制約は今回追加していない（admin/index.htmlの「カテゴリ名」欄が自由入力のままで、制約があるとadmin経由の保存が壊れるリスクがあるため）。UI側の制限のみで運用し、必要になればDB側も検討する

**ピラーページの人気タグチップ（2026-07-10・同日追記で確定）**

以前「chipsをtags列に紐付けるのは不要」と決めた件の再検討。固定チップではなく、実際のリスティングに付いた自由タグ（`pro/index.html`の「タグ」欄で入力済み）を集計し、使用頻度順に表示する形に変更した。

- `snorkeling.html`／`skindiving.html`／`freediving.html`：各ページで`category`一致の公開リスティングの`tags`を集計し、上位6件をチップとして表示（`loadPopularTags()`）。該当タグが1件も無ければ既存の見本チップ（体験ツアー等）を残す
- チップクリック時のリンク先は`explore/index.html?tag=<タグ名>`
- `explore/index.html`：`applyUrlParams()`に`tag`パラメータの読み込みを追加。該当タグを「こだわり条件」の`activeTags`に反映し、候補一覧（`#conditionChips`）に無いタグなら動的にチップを追加した上でパネルを開く
- freediving.htmlの「動画で学ぶ／ランキング／大会」の3リンクはチップ集計の対象外（別枠として存置）
- 本番データがまだ少ないため、当面は多くのページで「該当0件→見本チップのまま」になる見込み。リスティング登録が増えるにつれて自然に実データのチップへ切り替わる設計

### エリア設計の刷新（2026-07-10・secretary相談で確定）

**背景**：`listings`には`prefecture`（47都道府県＋海外の自由選択）と`area`（沖縄/伊豆/鹿児島など14項目の固定タクソノミー、探すページの地図・チップ絞り込みに使用）の2つの場所関連フィールドがあり、出品者（インストラクター・ショップ）が`prefecture`だけ設定して`area`を未選択のまま保存すると、探すページの地図・チップからは見えなくなる（テキスト検索でのみヒット）落とし穴があった。実際に鹿児島県のショップ出品（Volcano Cupコーチング）がこの状態になり、地図上で0件に見える不具合として発覚した。

- 「エリア」という固定14タクソノミーの概念を廃止し、**都道府県を検索・絞り込みの主軸**にする
- 事業者は都道府県配下の具体的なスポット名を**自由入力**で登録できる（例：沖縄県の恩納村）
- 登録時（`pro/index.html`・`admin/index.html`）・検索時（探すページ・トップの検索バー）の両方で、**既存のスポット名をサジェストする同じ仕組み**を使う（事業者側／利用者側でUIロジックを揃える）
- サジェストの初期データは今の14スポット名（沖縄・伊豆・紀伊半島・瀬戸内・鹿児島・東京・北海道・石垣島・宮古島・西表島・与那国島・久米島・慶良間諸島・奄美大島）を種にし、以降は実際の出品データ（DB上の`area`の重複しない値）を積み増していく
- 探すページのSVG日本地図（`js/area-map.js`、14スポットのみピンがある）は**廃止**。都道府県チップ＋自由入力サジェストのテキスト中心UIに一本化する
- **実装済み（2026-07-10）**：`js/location-data.js`（新規・47都道府県リスト＋スポット名サジェストの共通データ。`loadKnownSpots()`が種データ14件＋`listings.area`の実データをマージ）／`js/area-picker.js`（トップ・ピラーページの検索ドロップダウンを「人気の都道府県」＋「よく検索されるスポット名」チップに全面書き換え）／`explore/index.html`（SVG地図・`js/area-map.js`の読み込みを削除。`#areaChips`は`listings.prefecture`集計による動的生成に変更、`currentArea`→`currentPref`にリネーム。検索入力に`datalist`でスポット名サジェストを追加）／`pro/index.html`・`admin/index.html`（「エリア」固定select＋その他入力を廃止し、`datalist`付きテキスト入力に変更。保存・編集読み込みロジックも追随）
- **未着手（フォローアップ）**：`explore/shops.html`は今回のスコープ外。まだ旧`js/area-map.js`＋14タクソノミーの`areas`部分一致フィルタのまま残っている（`shops`/`instructors`の`prefecture`列がフィルタに使える状態か未確認のため、データ確認してから着手する）。`js/area-map.js`自体は`explore/shops.html`が使用中のため削除しない
- **2026-07-10：Chrome MCPで実機QA完了（エリア検索刷新一式）**
  - `explore/index.html`：都道府県チップの表示・絞り込みOK（鹿児島県=2件／沖縄県=0件で正しく動作）、検索入力のdatalistサジェストOK（47都道府県＋スポット名の計61件）、旧SVG地図の要素・`js/area-map.js`の読み込みが完全に消えていることを確認。コンソールエラーなし（既知のGoTrueClient多重インスタンス警告のみ）
  - `pro/index.html`：`#l-area`（datalist付きテキスト入力）にサジェスト14件が流し込まれることを実機確認。保存（`area`）・編集読み込み（`l.area`復元）のロジックもコードレビューで問題なし。コンソールエラーなし
  - `admin/index.html`：リスティング編集モーダルで既存データ（都道府県=鹿児島県／スポット名=空欄）が正しく読み込まれること、`#listing-area`のdatalist（14件）を確認。**バグ発見・修正済み**：`loadListings()`のselectに`prefecture`が含まれておらず、一覧の「都道府県」列が常に「—」表示になっていた→selectに`prefecture`を追加して修正
  - `explore/shops.html`（状態把握のみ・修正なし）：旧14タクソノミーチップ＋SVG地図のまま正常動作、コンソールエラーなし。**`shops.prefecture`／`instructors.prefecture`は全レコードNULL**のため、都道府県軸への移行はデータバックフィルが先に必要。現状の`areas`部分一致（例：「鹿児島（6月~10月）」が「鹿児島」チップにヒット）は機能しており、新方式（`listings.prefecture`軸）とはテーブルも画面も別のため直接の矛盾・重複は起きていない

### /learn/ 有料講座：詳細ページ・視聴の実装方針（2026-07-10・secretary相談で確定）

**背景**：`learn/index.html`のコースカードは骨組みのみで、購入ボタンは全て`disabled`（準備中表示）。詳細ページが存在せず押した先が無い状態だった。撮影開始（耳抜き入門・基礎完全講座から）に合わせて、詳細ページと視聴の実装方針を先に固めた。

- 講座詳細ページは静的量産ではなく、**`courses`テーブル（既存`listings`と同様の設計思想）から動的生成**する
- 購入導線：既存`/api/create-checkout-session.js`（予約決済用）を講座購入向けに拡張し、Stripe Checkout経由で決済
- 購入記録：`course_purchases`的な新規テーブルに保存（`bookings`と同パターン）
- 視聴：mypage側に新設タブから、購入済み講座のみ**Vimeo Player APIで再生**（購入履歴で認証。Vimeo動画自体は限定公開設定）
- 着手順：4講座まとめてではなく、**耳抜き入門・基礎完全講座から**先行実装（撮影もここから開始予定）
- **未着手**：`courses`/`course_chapters`/`course_purchases`のカラムまで含めた詳細スキーマ設計、詳細ページ・視聴タブの実装（次はpmスキルで着手）

### `shops.shop_type` 廃止（2026-07-05・secretary相談で確定）

**背景**：`shops.shop_type`（individual / school / operator）はショップ作成・編集フォームで選択させていたが、どこの検索・フィルタ・バッジ表示にも使われておらず装飾的な項目だった。また個人／ショップの区分は pro/index.html の登録導線（`showCreateProfile('instructor' | 'shop')`）で既に明示的に分かれており、`shops` 側に「個人」を残す意味がない。「スクールで探す」等の検索軸も listings の intent（try/learn/dive）で実現済みのため、ショップ単位の type 分けは不要と判断。

- `pro/index.html` のショップ作成モーダル・ショッププロフィール編集フォームから「ショップタイプ」選択欄を削除。insert/update ペイロードからも `shop_type` を除外
- DB側の `shops.shop_type` カラム・CHECK制約（`individual`/`school`/`operator`）は既存データ保護のため**未変更**。今後どのコードからも参照されない想定
- **未着手（フォローアップ）**：カラム自体の削除（マイグレーション）は現時点で不要と判断、必要になれば別途対応

### ショップ/インストラクタープロフィールページと商品ページの分離（2026-07-05・secretary相談で確定）

**背景**：`explore/listing.html`が「プロフィール表示」と「商品（コース）詳細＋予約」の2役を1ファイルで兼務しており、コース未選択でアクセスした場合でも内部的に1件目のlistingを仮の「アクティブコース」として扱っていた。そのためコースを持たないショップ（登録直後など）は情報欄が空欄だらけになり、コースを持つショップでも「プロフィールを見に来たら特定コースの予約画面が出る」という混乱が生じていた。

- **プロフィールページ**（bio・在籍インストラクター一覧・取り扱いコース一覧・レビュー。予約カレンダーなし）と、**商品ページ**（特定コースの詳細＋予約カレンダー。プロフィール要素は最小限）を別ファイルに分離する方針に変更
- 新規ファイル：`explore/profile.html`（プロフィール専用）。`explore/listing.html`は商品詳細専用に縮小し、`listing=`パラメータで指す商品が無い場合は`profile.html`にフォールバックする
- リンク更新対象：`explore/shops.html`（カードのリンク先）／`explore/index.html`（インストラクタープレビューモーダルのCTA）／`explore/listing.html`自身（運営者カードのリンク先）
- **2026-07-07：Chrome MCPで動作確認済み**：`explore/shops.html`のショップカード→`profile.html`（自己紹介・在籍インストラクター・取り扱いコース表示）→コースカードクリックで`listing.html`（詳細＋予約カレンダー）への遷移、および`listing.html`にlistingパラメータ無しでアクセスした際の`profile.html`へのフォールバックをすべて確認。コンソールエラーなし

### 記事の著者紹介文をDBカラム化（2026-07-05）

**背景**：記事詳細ページ・記事エディタのプレビューに表示される「著者紹介文」（編集部/著者の説明文）が`admin/index.html`と`media/article.html`双方のJS内にハードコードされており、特定個人名を含む文言が編集不可のまま埋め込まれていた。

- `admin/index.html`の記事エディタに「著者紹介文（任意）」欄（`#ae-author-bio`）を追加。入力するとプレビュー・保存時に反映される
- 空欄の場合は編集部/著者いずれも汎用的なデフォルト文（特定個人名なし）にフォールバック
- DB側の`articles.author_bio`カラム（TEXT、nullable）は **2026-07-06 Supabase本番に適用済み**（`sql/articles_author_bio_20260705.sql`・information_schemaで確認済み）
- **未着手（フォローアップ）**：既存記事の`author_bio`は未設定のためデフォルト文表示のまま。個別に紹介文を設定したい記事があれば管理画面から追記

-----

### 論理削除（ソフトデリート）方針（2026-07-03導入）

**ユーザー操作による「削除」はデータを物理削除せず `deleted_at` を立てて非表示化する。**
`sql/soft_delete_20260703.sql` で導入済み。

- **対象テーブル**（`deleted_at timestamptz` 追加済み）：`events` / `articles` / `listings` / `instructors` / `event_staff` / `event_shift_roles` / `athlete_entries` / `availability_slots`
- **非表示の仕組み**：各テーブルに `RESTRICTIVE` な SELECT ポリシー `<table>_hide_deleted`（`USING (deleted_at IS NULL)`）を付与。既存の許可ポリシーに AND されるため、既存ポリシーを書き換えず DB レベルで削除行を隠せる。
- **コード側**：削除は `.delete()` ではなく **`.update({ deleted_at: new Date().toISOString() })`** を使う。
- **連鎖**：親を消したら子も連鎖ソフト削除（instructor → listings・slots、listing → slots）。大会は親が非表示になれば子（AP・リザルト等）も辿れず隠れるため個別更新は不要。
- **ユニーク制約**：論理削除行が値を占有して再作成をブロックしないよう、`articles.slug` / `events.aida_id` は **部分ユニークインデックス**（`WHERE deleted_at IS NULL`）に置換済み。
- **物理削除のまま残すもの**：内部の「全消し→入れ直し」系（`event_schedule` のラベル/マイルストーン/day/startlist、`event_staff_shifts`、`event_safety_assignments`、`athlete_entries` の一括再インポート）と `user_roles`（権限剥奪）。
- **新テーブル追加時のルール**：ユーザーが削除しうるテーブルは原則 `deleted_at` カラム＋`<table>_hide_deleted` ポリシーを付け、削除は UPDATE で行う。
- **復元UI**：未実装（当面は必要時に Supabase から直接 `deleted_at` を NULL に戻す）。

**バグ：管理者がソフトデリートできない（2026-07-07発見・修正済み）**

admin/index.html でインストラクター等を削除しようとすると「new row violates row-level security policy "<table>_hide_deleted"」でUPDATE自体が失敗していた。`<table>_hide_deleted` ポリシーは `deleted_at IS NULL` の行のみ可視化するRESTRICTIVEポリシーだが、`deleted_at` をセットした更新後の行がこの条件を満たさなくなるため、管理者による論理削除の書き込みそのものが弾かれていた。対象8テーブル全てのポリシーに `OR is_site_admin()` を追加するSQL（チャットでユーザーに提示・Supabase側で実行済み）で解消。

**副作用バグ：admin一覧に削除済み行が残り続ける（2026-07-07発見・修正済み）**

上記の `OR is_site_admin()` 追加により、管理者（is_site_admin）が実行するSELECTはRLS側で`deleted_at`を絞り込まなくなった。admin/index.htmlの一覧クエリ（`loadInstructors` / `loadListings` / `loadArticles` / `loadSlots` / `loadMasterData`）はこれまでRLSの`hide_deleted`ポリシーに絞り込みを委ねてクエリ側に`deleted_at`条件を書いていなかったため、削除操作後も一覧に残り続けていた。該当6箇所に`.is('deleted_at', null)`を追加して修正済み。
**要フォローアップ**：`events` / `event_staff` / `event_shift_roles` / `athlete_entries` を読む他の画面（`mypage.html`, `events/event-staff.html` 等）も同じ仕組みで潜在的に同じ問題を抱えている可能性がある。管理者アカウントでそれらの画面を使う際に削除済みの大会・スタッフ等が残って見えたら、同様に`.is('deleted_at', null)`を追加する。

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

|ページ・機能                                              |状況                          |
|----------------------------------------------------|----------------------------|
|トップページ（index.html）                                  |✅ Airbnb風マーケットプレイスに全面刷新（2026-07-03）。白基調・検索バー・ピラータブでその場切替・横スクロールカード列。**カード内容は代表ダミー（値段/★/レビュー数）で実データ差し替えは未**。**2026-07-10追記**：フリーダイビングタブに「フリーダイビングの記事」セクション（`id="free-articles-row"`）を新設し、シュノーケル/スキンタブの記事セクション（`snorkel-article-row`/`skin-article-row`）と同一仕様に統一。従来「トレーニング・コーチング」枠（`free-article-row`、実体はlistings/コース表示）が`data-dynamic`属性を持つ存在しない要素を参照しており記事が一切差し込まれないデッドコードだったのを、`fillRow()`で`articles`テーブル（`slug`が`freediving-`始まり or `what-is-freediving`）を流し込む実装に修正|
|ピラー専用3ページ（snorkeling/skindiving/freediving.html）    |✅ 新設（2026-07-03）。種目別の検索＋関連カテゴリチップ＋体験カード＋記事リスト。共通 css/home.css・js/home.js。**2026-07-10：category(ダイビング種別)タクソノミー整理に伴い3ページとも実データ接続化。人気タグ集計チップ（`loadPopularTags()`）も追加**|
|検索バー連携（トップ／ピラー → explore）                      |✅ 実装（2026-07-03）。js/home.js が q/area/intent を組み立て /explore/ へ遷移。explore 側は applyUrlParams() で URL パラメータを読み初期絞り込み。**日程(date)は listings に該当データが無く現状フィルタ未使用**。**2026-07-10：`tag`パラメータ対応を追加（ピラーページの人気タグチップから絞り込み済みで遷移）**|
|ランキング（AIDA_ranking_prototype.html / site/index.html）|✅ 完成                        |
|大会情報（2026_competitions.html）                        |✅ 完成                        |
|トレーニングログ（training-log.html）                         |✅ Supabase接続・保存・読み込み・編集・URLシェア・カレンダー表示実装済み。バグ修正済み（2026-06-29：一覧表示崩れ・編集フォーム空白・タブ遷移時フォームリセット・ベストタイム計算）|
|マイページ（mypage.html）                                  |✅ Supabase接続完了（トレーニングカレンダー・今月のサマリー・予約履歴・大会管理 すべて実データ表示）|
|STAタイマー（sta-timer.html）                             |✅ 大幅機能追加・デプロイ済み              |
|Mouthfill Calculator（mouthfill-calculator.html）     |✅ 完成・push済み                  |
|インストラクターウェルカム（instructor-welcome.html）              |✅ 作成完了                      |
|フリーダイビングを学ぶ（freediving-learn.html）                 |✅ 管理ツール完成・learn/index.html 骨格完成  |
|大会カウントダウン（events/competition-countdown.html）         |✅ 完成（スタンドアロン・Supabase不要）        |
|認証画面（auth.html）                                     |✅ メール/パスワード・Googleログイン実装済み（Apple は Developer 登録待ち）|
|Supabase DB                                        |✅ テーブル作成済み（training_sessions/dives/events/shops/instructors/listings/reviews）|
|Supabase 認証接続                                      |✅ メール/パスワード・Google OAuth 接続済み|
|マッチング（/explore/）                                    |🔄 先行実装中（Supabase: shops/instructors/listings/reviews スキーマ投入済み。explore/index.html・instructor.html 動作確認済み。本格公開は Phase 2。**検索強化: リアルタイム検索・インストラクター名検索・価格帯フィルタ・ソート機能 追加済み**。**2026-07-05: 位置情報の検索を都道府県ベースに刷新。** ①コースが無いショップ/インストラクターも見つけられるよう`explore/shops.html`（ショップ・インストラクターディレクトリ）を新設、フッター導線もそちらに変更。②当初コース登録フォームの「エリア」を自由入力→14種チップの選択式に変更したが、リストにない地名（鹿児島など）が検索から漏れる問題自体は残ったため、③根本対応として`listings.prefecture`を47都道府県＋「海外」のCHECK制約で固定し検索の正データに格上げ（`explore/index.html`に都道府県`<select>`フィルタ新設）。旧来の14種チップは「人気スポット」の任意タグに格下げして残す。海外掲載時の国名は新設`country`カラムに格納。詳細はEXPLORE_DESIGN.md・DB_SCHEMA_DESIGN.md参照）|
|listings 全フィールド対応                                    |✅ pro/index.html に max_participants・flow_steps・gallery_urls 追加。instructor.html でギャラリー複数表示・price_includes/excludes・meeting_point・what_to_bring・season・booking_deadline・has_shuttle を表示対応|
|予約・決済フロー（/explore/instructor.html + /api/）           |✅ 完成・動作確認済み（カレンダーUI → Stripe Checkout → 予約完了ページのフルフロー。E2Eテスト: status=paid 確認済み）|
|Supabase: availability_slots / bookings テーブル          |✅ 作成済み・RLS設定済み|
|Vercel API: /api/create-checkout-session.js            |✅ 実装済み・デプロイ済み|
|Vercel API: /api/stripe-webhook.js                     |✅ 実装済み・Stripe Webhook登録済み|
|booking/success.html                                   |✅ 実装済み（予約番号・日時・金額・プラン表示）|
|管理画面（/admin/index.html）                              |✅ 実装済み（空き枠管理・予約一覧・ステータス変更）|
|プロダッシュボード（pro/index.html）予約管理タブ                      |✅ 実装済み・テストデータ投入済み（全ステータス確認可）|
|クライアント管理タブ（pro/index.html）                           |✅ 実装済み（bookingsから自動集約・検索・詳細・メモ保存）|
|売り上げ管理タブ（pro/index.html）                              |✅ 実装済み（月次サマリー・棒グラフ・明細一覧・期間フィルタ）|
|/learn/ 有料講座ページ                                      |🔄 learn/index.html 骨格完成・トップからリンク済み（先行通知機能なし）。**2026-07-10**：`courses`/`course_chapters`/`course_purchases`スキーマを本番Supabaseに実行済み（`sql/learn_courses_schema_20260710.sql`。courses=1件/course_chapters=8件、耳抜き入門講座`mimi-nuki-nyumon`をstatus=publishedで投入）。動的詳細ページ`learn/course.html`実装（slugでSupabaseから読込・シラバス表示）。**講座購入フロー実装**：`/api/create-course-checkout-session.js`（新規・Supabaseアクセストークンで本人確認→Stripe Checkoutセッション作成。既存`/api/create-checkout-session.js`はbookings用の空き枠ロジックが強く結合しているため流用せず新規作成）／`/api/stripe-webhook.js`にcourse_purchases分岐を追加（`metadata.purchase_id`で判別・冪等）／`learn/purchase-success.html`新規（決済後、webhook反映をポーリングして購入完了を表示）／`auth.html`に`?next=`遷移先パラメータ対応を追加（相対パスのみ許可・オープンリダイレクト対策）し、未ログインで購入しようとした場合に元のページへ戻れるようにした。**購入ボタンの出し分け**：`course_chapters.vimeo_id`が1件も無いうちは「準備中」表示のまま販売しない設計（動画0本の状態で課金しないためのガード）。チャプター名は「第n回（仮）」のプレースホルダーのまま（こうようさんとの構成打ち合わせが検討中のため）。**2026-07-10（続）視聴タブ実装**：`mypage.html`に「学んだ講座」セクション追加（`loadLearnedCourses()`。`course_purchases.status=paid`が0件なら非表示、あれば購入講座カードを表示・`learn/watch.html?slug=...`へリンク）。`learn/watch.html`新規（ログイン必須・`course_purchases`で本人の購入を確認してからチャプター一覧とVimeo Player埋め込みを表示。vimeo_idが無いチャプターは「動画準備中」でクリック不可）。**2026-07-10（続）本番E2Eテスト完了**：Chrome MCP経由で本番環境で実際にテスト決済まで確認済み（chapter_num=1に一時的にダミーvimeo_idを設定→購入ボタン有効化を確認→Stripeテストカード4242での決済→webhookがcourse_purchases.status=paidに更新→purchase-success.htmlが購入完了表示→mypage「学んだ講座」に表示→learn/watch.htmlで本人購入確認・動画再生・他チャプターロックまで一通り成功。テスト後は元のvimeo_id=NULL・購入レコード削除で本番データをクリーンな状態に復元済み）。**未着手**：実際の動画アップロード・vimeo_id登録（これが入って初めて購入ボタンが実際に有効化される）|
|メディア（/media/）                                        |✅ 基盤完成・media/ 一本化（2026-06-29）index.html Supabase動的取得・article.html 記事詳細。CMS は admin/index.html メディアタブに統合。articles テーブル・カテゴリ9区分・RLS設定・初記事2本投入済み。articles/ → _old/ 退避済み。スマホ対応・ヘッダー統一済み|
|サイト動線整備（2026-07-08）                             |✅ sitemap.xml/robots.txt/404.html 新設。skindiving/snorkeling/learn のフッターに大会・ランキング導線追加でナビ統一。行き止まり4ページ（AIDA_ranking/mouthfill/event-athlete/freediving-learn）に戻る導線追加。buoyancy の死にリンク（/tools/）修正。tools/session-planner.html 削除。**孤立ページ方針（2026-07-10決定）**：3ページとも公開ナビへの掲載は不要と判断。①`events/event-athlete.html`——大会管理画面（event-staff.html等）から主催者が選手ごとに個別URLを発行して共有する「選手用画面」という設計。**2026-07-10実装**：`event-staff.html`概要タブに「選手用ページ」カードを追加し、`event-athlete.html?id=<大会ID>`のURLを自動生成・ワンクリックコピーできるようにした（`copyAthleteLink()`）。②`learn/freediving-learn.html`——「フリーダイビングを学ぶ」動画コースの制作進捗管理ツール（チャプター追加・ステータス切替・メモ）で、Takuya向けの内製コンテンツ管理画面であり公開ページではない。③`pro/instructor-welcome.html`——リリース時に扱いを再検討（保留）。|
|検索UI刷新・SVG地図検索（2026-07-08）                        |✅ 検索の重複UIを大胆に統合＋地図検索を自前SVG化。①explore/index.html：検索バーの「タイプ」selectを削除（intentタブに一本化）、都道府県`<select>`を廃止しフリーテキスト検索対象に`prefecture`を追加（?pref=リンクは検索語として互換維持）、条件・価格帯は「こだわり条件」折りたたみ（選択数バッジ付き）に集約。②地図：Google Maps依存を全廃（js/maps-config.js削除・APIキー不要）し、`js/area-map.js`（ブランドカラーのデフォルメSVG日本地図＋南西諸島拡大枠＋件数ピル。クリック絞込・再クリック解除・0件は減光・人気3エリアはパルス強調）を新設。explore はデフォルト表示、shops.html にも同コンポーネント導入（トグル式・ショップ/インストラクター件数連動）。③トップ＋ピラー3ページの検索バーからもタイプselect削除（エリア＋日程のみ）。スタイルは css/home.css の `.fj-*`/`.adv-*` に共通定義。※SVG地図は2026-07-10のエリア設計刷新でexplore/index.htmlからは廃止（shops.htmlのみ残存）。**2026-07-10 Chrome MCPで実機確認完了**：トップ＋ピラー3ページの検索ドロップダウン（area-picker.js：人気の都道府県7件＋よく検索されるスポット名チップ14件）が4ページとも正常表示、explore/index.htmlの都道府県チップ絞り込み・datalistサジェストも動作確認済み。全ページコンソールエラーなし|
|iOSアプリ（React Native）                                 |🔄 開発中（環境構築済み・Expo Go動作確認済み。タブバー・ログ・Supabase連携・SNSシェアが未実装）|

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

*調査日：2026-06-26（コードベース全体レビュー + Bugbot 差分レビュー）*

**Bugbot（ブランチ差分）**：指摘なし  
**手動レビュー**：予約・RLS・決済まわりに 11 件 → **全件 2026-06-28 対応済み**

### サマリー

| 重要度 | 件数 | 主な領域 |
|--------|------|----------|
| 高 | ~~4~~ → **0** | ✅ すべて対応済み |
| 中 | ~~4~~ → **0** | ✅ すべて対応済み |
| 低 | ~~3~~ → **0** | ✅ すべて対応済み |

### ✅ 高（対応済み）

| # | 内容 | 対応日 | 対応内容 |
|---|------|--------|----------|
| ~~1~~ | ~~予約データがログインユーザー全員に読める~~ | 2026-06-28 | `sql/rls_fix_20260628.sql` 実行済み |
| ~~2~~ | ~~予約の更新もログインユーザー全員に許可~~ | 2026-06-28 | `sql/rls_fix_20260628.sql` 実行済み |
| ~~3~~ | ~~予約完了ページが未ログインだと失敗~~ | 2026-06-28 | `api/booking-result.js` 追加・`success.html` API経由に変更・E2Eテスト済み |
| ~~4~~ | ~~空き枠の書き込み権限が広すぎる~~ | 2026-06-28 | `sql/rls_fix_20260628.sql` 実行済み |

### ✅ 中（対応済み）

| # | 内容 | 対応日 | 対応内容 |
|---|------|--------|----------|
| ~~5~~ | ~~同時予約で満席超過~~ | 2026-06-28 | `pending` の `participant_count` 合計を残席計算に含める |
| ~~6~~ | ~~Webhook の二重処理~~ | 2026-06-28 | 冪等性チェック（`status === 'paid'` ならスキップ）実装済み |
| ~~7~~ | ~~Webhook の DB エラーを無視~~ | 2026-06-28 | `updateErr` / `rpcErr` 時に 500 を返す実装済み |
| ~~8~~ | ~~非アクティブ枠も予約可能~~ | 2026-06-28 | `is_active` チェック追加、false なら 409 を返す |

### ✅ 低（対応済み）

| # | 内容 | 対応日 | 対応内容 |
|---|------|--------|----------|
| ~~9~~ | ~~存在しない確認メール表示~~ | 2026-06-28 | 「インストラクターからご連絡をお送りします」に文言修正 |
| ~~10~~ | ~~Stripe キャンセル URL でリスティング情報が消える~~ | 2026-06-28 | `cancel_url` に `&listing=<listing_id>` を付与 |
| ~~11~~ | ~~XSS の余地~~ | 2026-06-28 | `escHtml()` で対応済み（コードレビューで確認） |

### 問題なし・軽微

- **`guest_*` vs `client_*` カラム名** — `sql/rename_guest_to_client.sql` 適用済み。API・フロントと整合
- **`admin/admin-mobile.html` 認証なし** — localStorage のみで本番 DB には触れない（Phase 2 本番化時に要対応）

-----

## セキュリティ監査（2026-07-04）→ 全件対応済み

| # | 内容 | 対応内容 |
|---|------|----------|
| S1 | bookings 匿名INSERTが無制限 | ポリシー削除、予約作成は新設RPC `create_pending_booking()`（service_role限定）経由に一本化 |
| S2 | 記事本文のサニタイズが実質無効 | DOMPurify導入、実際にサニタイズするよう修正 |
| S3 | articles INSERTが認証済みなら誰でも公開可能 | 承認フロー準拠のポリシーに置換。**調査中に発見**：Studio上の重複ポリズが `articles` の INSERT/UPDATE/DELETE/SELECT を実質無制限化していたため合わせて削除（特に UPDATE は既存公開記事も改ざん可能な状態だった） |
| S4 | `esc()` が属性用エスケープ非対応 | `explore/*`, `mypage.html`, `media/*` に `"` `'` も含む `esc()` を追加・適用 |
| S5 | `href` にURLスキーム検証なし | `safeUrl()` を追加し http/https 以外を拒否（`explore/*`, `events/2026_competitions.html`） |
| S6 | 予約確定のTOCTOU競合 | `create_pending_booking()` RPCで行ロック・原子化（旧・項目5の対応をさらに強化） |
| S7 | SECURITY DEFINER関数のsearch_path未固定 | `is_site_admin()` / `increment_booked_count()` に `SET search_path = public` 追加 |
| S8 | `event_results` UPDATEにWITH CHECKなし | `WITH CHECK (auth.uid() = judge_id)` 追加 |
| S9 | `listingId` 未検証 | API側で `slot.listing_id` との一致を検証、保存はslot由来の値のみ使用 |
| S10 | CORSワイルドカード | 確認の結果、`booking-result.js` がトークン照合方式のため実害なしと判断（対応不要） |
| 追加 | `event_safety_assignments`/`event_shift_roles`/`event_staff_shifts` の書き込み系が未ログインでも可能だった | 対象ロールを `authenticated` に限定（読み取り系は現状維持） |

**SQL**: `sql/security_fix_20260704.sql`（Supabase本番に実行済み・Chrome MCPで動作確認済み）

-----

*最終更新：2026-07-03（トップをAirbnb風マーケットプレイスに全面刷新・ピラー3ページ新設・共通 css/home.css＋js/home.js 導入・検索バー→explore の URLパラメータ連携実装）*
