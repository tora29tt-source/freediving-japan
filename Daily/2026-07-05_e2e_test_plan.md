---
tags: [test-plan]
---

# E2Eテスト手順書（2026-07-05・レビュー#1対応）

> 対象：レビュー（[2026-07-05_dev_review.md](./2026-07-05_dev_review.md)）アクション#1「ショップ出品モデル＋セキュリティ回帰の実機E2E」
> 実施環境：本番（Supabase / Vercel）※ Stripeはサンドボックスモード

---

## 0. 事前確認（コード・DB調査済み・2026-07-05）

Chrome MCP経由でSupabase本番DBを確認した結果：

- `shops` テーブルに `name` / `bio` / `areas` / `languages` / `shop_type` / `is_public` 等、`pro/index.html` のショップ作成フォームが使う全カラムが存在済み（`add_instructor_columns.sql` 適用済みを確認）
- `shops` の RLS：`shops_insert_own`（`WITH CHECK (auth.uid() = user_id)`）が存在し、本人アカウントでのINSERTが通る設定になっている
- コードレベルでは `createShopProfile()`（`pro/index.html`）の実装に問題は見当たらない

**⚠️ 見つかったブロッカー：** `tora29tt@gmail.com` は既に `instructors` テーブルにプロフィールを持っている（instructorロール）。`pro/index.html` の `boot()` は「instructors → shops」の順でチェックし、instructorsに行があればshop側は見ずに即インストラクター画面を表示する。そのため **同じアカウントのままでは「ショップとして登録」ボタンが出てくる setup-guard 画面にたどり着けない**。

→ ①のテストには **別のテストユーザーアカウント**が必要（後述 1-1）。パスワード入力を伴うアカウント作成はTakuya本人に行ってもらう必要がある（Claudeはパスワードを代理入力しない）。

---

## 1. ①ショップ単体名義の出品 → 予約 → 決済

### 1-1. テスト用ショップアカウントの作成（Takuya実施）

1. シークレットウィンドウ（or 別ブラウザ）で `https://freediving-japan.vercel.app/auth.html` を開く
2. 新規登録タブでテスト用メールアドレス（例：`shoptest+20260705@gmail.com` のようなエイリアス）とパスワードでアカウント作成
   - Google一括ログインを使う場合は別のGoogleアカウントが必要
3. `https://freediving-japan.vercel.app/pro/index.html` に移動 → 「プロフィールをまだ作成していません」画面が出ることを確認
4. 「ショップとして登録」ボタン → モーダルで屋号（例：「テストショップ」）を入力 → 「作成する」

**確認ポイント：**
- [ ] エラーなくショッププロフィールが作成される
- [ ] 作成後、コース管理・空き枠管理タブが使えるようになっている（承認待ちバナーが出ない＝ショップは承認不要の想定通りか確認）

### 1-2. コース・空き枠をショップ名義で作成

1. 「コース管理」タブ → 「コースを追加」→ 担当インストラクターは選択せず（未定のまま）保存
2. 「空き枠管理」タブ → 上記コースの空き枠を1件作成

**確認ポイント：**
- [ ] instructor_idを選ばなくても保存できる（`listings_owner_required` / `slots_owner_required` CHECK制約に引っかからない）
- [ ] `explore/index.html` の一覧にこのコースが表示される（カードのリンク先が `listing.html?shop=...` になっているか、リンク先HTMLを右クリック→検証などで確認）

### 1-3. 予約 → Stripe決済

1. 別ブラウザ（未ログインでOK）で `explore/index.html` からテストショップのコースを開く
2. 空き枠を選び、氏名・メール・人数を入力して「予約する」
3. Stripeテストカードで決済：カード番号 `4242 4242 4242 4242` / 有効期限は未来の任意日 / CVCは任意3桁
4. 決済完了 → `booking/success.html` にリダイレクトされることを確認

**確認ポイント：**
- [ ] `bookings` テーブルに新規レコードが作成され、`shop_id` が入り `instructor_id` はNULLのままである（Supabase Studioで確認）
- [ ] `status` が `pending` → 決済後 `paid` に変わる
- [ ] `booked_count` が空き枠側でインクリメントされる

---

## 2. ②既存インストラクター名義の予約が回帰していないか

Takuya本人のインストラクターアカウント（`tora29tt@gmail.com`）で、7/4以前からある通常のコースを1件、上記1-3と同じ手順で予約→決済まで通す。

**確認ポイント：**
- [ ] 7/4より前と同じように、`instructor_id` ありで正常に予約・決済が完了する（`shop_id` はNULLのままでもエラーにならない）

---

## 3. ③instructor_shops経由の所属表示

1. Takuyaのインストラクターアカウントで、テストショップ（1-1で作成したショップ）に所属を追加
   - `pro/index.html` のインストラクター側UI、または Supabase Studio で `instructor_shops` に直接INSERT（`instructor_id` = Takuyaのinstructors.id, `shop_id` = テストショップのid）
2. テストショップのpro/index.htmlダッシュボードで「所属インストラクター」欄にTakuyaが表示されるか確認（`pro/index.html` L799-806の `legacyInsts` + `linkedInsts` マージロジック）

**確認ポイント：**
- [ ] ショップ側画面に所属インストラクターとして表示される
- [ ] 逆にインストラクター側でも複数ショップ所属が問題なく扱えるか（表示があれば）

---

## 4. セキュリティ回帰E2E（S1・S3・S6）

上記1〜3と同一セッションで実施可能。

| # | 内容 | 手順 | 確認ポイント |
|---|---|---|---|
| S1 | bookings匿名INSERT不可 | ブラウザのDevToolsから直接 `supabase.from('bookings').insert(...)` を試す（コンソールから） | エラーになる（RLSでブロック、`create_pending_booking` RPC経由以外は不可） |
| S6 | TOCTOU対策 | 同じ空き枠に対して2つのタブでほぼ同時に予約を試みる（残り1席の状態で） | 片方だけ成功し、もう片方は `SLOT_FULL` エラーになる |
| 記事権限 | editor/staff/adminの記事権限マトリクス | それぞれのロールでログインし `admin/index.html` メディアタブから記事の作成・公開・削除を試す | editorは自分の下書きのみ削除可・公開不可。staff/adminは全件操作可 |

---

## 5. 完了後

- 問題が見つかった場合はこのファイルに追記し、都度Claudeに修正依頼
- 全項目パスしたら [2026-07-05_dev_review.md](./2026-07-05_dev_review.md) のアクション#1をクローズし、#2（shopsへのソフトデリート適用）に進む
