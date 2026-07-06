# フォローアップ一覧（自動生成）

生成: 2026-07-06 00:28 / `node ops/scan_followups.mjs`

## 🔴 未実行のSQL（1件）

- `sql/insert_upper_layer_articles_20260702.sql`

## 📋 MD内の積み残し（10件）

- **APP.md:127** — | タブバー（6タブ） | ❌ 未着手 |
- **APP.md:128** — | トレーニングログ画面 | ❌ 未着手 |
- **APP.md:130** — | SNSシェア（画像生成） | ❌ 未着手 |
- **DEV.md:228** — - **未着手（フォローアップ）**：`shops` テーブルはまだソフトデリート対象外（物理削除のまま）／ショップ名義商品ページの「指導歴」等インストラクター由来ラベルの文言調整／実機での動作確認未実施
- **DEV.md:230** — - **2026-07-05追記**：`shops`にカバー画像の表示位置調整機能を追加（`pro/index.html`のショップ編集画面・記事エディタの`ae-cover-pos`と同方式のドラッグ/矢印UI）。DB側に`shops.cover_position`カラム（TEXT、例`"50% 50%"`）が必要。
- **DEV.md:241** — - **未着手（フォローアップ）**：カラム自体の削除（マイグレーション）は現時点で不要と判断、必要になれば別途対応
- **DEV.md:250** — - **未着手（フォローアップ）**：実機での動作確認未実施
- **DEV.md:258** — - DB側に`articles.author_bio`カラム（TEXT、nullable）が必要。**手動でSupabaseに以下を適用すること（未実施）**：
- **DEV.md:263** — - **未着手（フォローアップ）**：既存記事の`author_bio`は未設定のためデフォルト文表示のまま。個別に紹介文を設定したい記事があれば管理画面から追記
- **DEV.md:614** — - **`admin/admin-mobile.html` 認証なし** — localStorage のみで本番 DB には触れない（Phase 2 本番化時に要対応）

## ⚪ ステータスヘッダが無いSQL（17件）

> 先頭に `-- ステータス: 実行済み（YYYY-MM-DD） / 未実行` を追記すること（DEV.mdルール）

- `sql/add_instructor_columns.sql`
- `sql/articles_author_bio_20260705.sql`
- `sql/articles_schema.sql`
- `sql/bookings_schema.sql`
- `sql/clients.sql`
- `sql/event_results_schema.sql`
- `sql/events_delete_policy_20260703.sql`
- `sql/matching_schema.sql`
- `sql/rename_guest_to_client.sql`
- `sql/rls_fix_20260628.sql`
- `sql/rls_update_20260625.sql`
- `sql/shop_direct_listings_20260704.sql`
- `sql/soft_delete_20260703.sql`
- `sql/supabase_schema.sql`
- `sql/test_data_bookings.sql`
- `sql/test_data_delete.sql`
- `sql/test_data_insert.sql`
