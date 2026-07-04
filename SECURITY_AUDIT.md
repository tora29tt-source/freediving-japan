# セキュリティ & バグ棚卸し

*自動生成: 2026-07-04（scheduled task: bug-and-security-maintainance）*
*対応: 2026-07-04（全件対応済み。詳細は末尾「対応状況」を参照）*

対象: `api/`, `js/`, `sql/`, フロントエンド各 `*.html`。`app/ios/Pods` 等の外部依存は除外。
本レポートは静的レビューによる指摘であり、実際の攻撃可否は本番RLS設定に依存する。深刻度は High → Medium → Low の順。

---

## サマリー（一覧）

| # | 深刻度 | 種別 | 箇所 | 概要 | 状態 |
|---|---|---|---|---|---|
| S1 | **High** | 認可(RLS) | `sql/bookings_schema.sql` | `bookings` の匿名INSERTが `WITH CHECK (TRUE)`。任意ステータス/金額で偽「paid」予約を注入可能 | ✅対応済み |
| S2 | **High** | XSS(格納型) | `media/article.html` | 記事`content`を`sanitizeContent()`と称して無害化せず`innerHTML`に注入。実体はサニタイズ無し | ✅対応済み |
| S3 | **High** | 認可(RLS) | `sql/articles_schema.sql` | `articles_insert` が「認証済みなら誰でも」。一般ユーザーが `is_published=true` の記事を投入可能（→S2と連鎖で全訪問者へXSS） | ✅対応済み |
| S4 | **Medium** | XSS(属性破壊) | `explore/*.html`, `mypage.html`, `media/*.html` | `esc()` が `"` `'` を非エスケープ。DB値を `src`/`href`/`alt` 属性に生挿入し属性ブレイクアウト可能 | ✅対応済み |
| S5 | **Medium** | XSS(javascript:) | `explore/*.html`, `events/2026_competitions.html` | `href="${url}"` にスキーム検証なし。`javascript:` URL 実行の恐れ | ✅対応済み |
| S6 | **Medium** | 競合(TOCTOU) | `api/create-checkout-session.js` | 空き枠チェックとINSERTが非アトミック。同時実行でオーバーブッキング可能 | ✅対応済み |
| S7 | **Low** | DB堅牢化 | `sql/rls_update_20260625.sql`, `bookings_schema.sql` | `is_site_admin()` / `increment_booked_count()` が `SECURITY DEFINER` かつ `search_path` 未固定 | ✅対応済み |
| S8 | **Low** | 認可(RLS) | `sql/event_results_schema.sql` | `results_judge_update` に `WITH CHECK` 無し。judge が `judge_id` を他者へ付け替え可能 | ✅対応済み |
| S9 | **Low** | データ整合 | `api/create-checkout-session.js` | クライアント指定の `listingId` を検証せず保存。slot の listing と不一致になり得る | ✅対応済み |
| S10 | **Low** | 設定 | `vercel.json` | `Access-Control-Allow-Origin: *`（GET限定なので実害は小、要確認） | ✅確認済み（対応不要と判断） |

---

## High

### S1. `bookings` 匿名INSERTが無制限（`WITH CHECK (TRUE)`）
`sql/bookings_schema.sql`:
```sql
CREATE POLICY "bookings_insert_anon" ON bookings
  FOR INSERT WITH CHECK (TRUE);
```
後続の `rls_fix_20260628.sql` / `rls_update_20260625.sql` は SELECT/UPDATE/DELETE のみ修正しており、この INSERT ポリシーは残存。anon キーだけで `status='paid'`, 任意の `total_amount` / `instructor_payout` を持つ行を直接挿入できる。決済を経ない偽予約・データ汚染・インストラクター向け画面の情報かく乱につながる。

**対応案**: 予約作成はサーバー（service_role）経由のみに限定し、匿名INSERTポリシーを削除するか、`WITH CHECK (status = 'pending' AND stripe_session_id IS NULL AND total_amount = 0 ...)` のように厳格化する。現状フロントからの直接INSERTは確認されなかったため、ポリシー削除が最も安全。

### S2. 記事本文のサニタイズが実質無効（格納型XSS）
`media/article.html:497,583`:
```js
${sanitizeContent(a.content) || ...}   // innerHTML に注入
function sanitizeContent(html){ /* 旧テンプレの末尾を切るだけ。HTMLは無害化しない */ }
```
`a.content` は DB 由来の生 HTML。関数名に反しスクリプト除去を一切行わず `innerHTML` へ渡すため、`content` に悪意ある HTML/JS が入れば全記事訪問者で実行される。

**対応案**: DOMPurify 等でサニタイズするか、Markdown を許可リスト方式でレンダリングする。書き込み側（S3）と併せて塞ぐ。

### S3. 記事INSERTが「認証済みなら誰でも公開可能」
`sql/articles_schema.sql`:
```sql
CREATE POLICY "articles_insert_auth" ON articles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```
`articles_review_flow_20260629.sql` は UPDATE/DELETE をロール別（admin/staff/editor）に制限したが、**INSERT は未修正**。一般登録ユーザーが `is_published=true` の記事を新規作成でき、承認フローを迂回して即公開できる。S2 と連鎖すると、任意ユーザーが全訪問者に対する格納型XSSを成立させられる。

**対応案**: INSERT を `is_admin_or_staff() OR (auth.uid() = created_by AND is_published = FALSE AND status IN ('draft','review'))` 等に制限。

---

## Medium

### S4. `esc()` が引用符を非エスケープ → 属性ブレイクアウトXSS
`media/article.html:580`, `media/index.html:231` などの `esc/escHtml` は `& < >` のみ変換し `"` `'` を残す。一方でDB値が属性内に生挿入されている:
```js
// explore/listing.html:550, explore/index.html:356, mypage.html:1381 など
`<img src="${inst.photo_url}" alt="${inst.name}" onerror="...">`
`<img src="${l.image_url}" alt="${l.title}">`
// media/article.html:544
`<img src="${r.thumbnail_url}" alt="" ...>`
```
インストラクターは RLS 上自分の `instructors`/`listings` 行を編集できる（`*_update_own`）ため、`photo_url` を `x" onerror="alert(document.cookie)` のような値にすると、閲覧者側でスクリプトが走る。半信頼ユーザー起点の格納型XSS。

**対応案**: 属性用エスケープ（`"`→`&quot;`, `'`→`&#39;`）を追加し、全ての `src`/`href`/`alt` 挿入に適用。

### S5. `href` にURLスキーム検証がない
`explore/index.html:366-368`, `explore/listing.html:675-677`, `events/2026_competitions.html:324` で `inst.website_url` / `e.link` を `href="${...}"` に直挿入。`javascript:` スキームが入るとクリック時に実行される（`rel="noopener"` は無関係）。

**対応案**: `http(s):` のみ許可する検証を挟む。

### S6. 予約確定の競合（オーバーブッキング）
`api/create-checkout-session.js:60-121`: 残席計算（SELECT）→ 予約INSERT が別クエリで非アトミック。同一枠に同時アクセスが来ると、両方が残席チェックを通過し `max_participants` を超過し得る。

**対応案**: 在庫デクリメントを含む単一の `SECURITY DEFINER` RPC（行ロック/条件付きUPDATE）で予約枠確保を原子化する。

---

## Low

### S7. `SECURITY DEFINER` 関数の `search_path` 未固定
`is_site_admin()`（`rls_update_20260625.sql`）と `increment_booked_count()`（`bookings_schema.sql`）は `SECURITY DEFINER` だが `SET search_path` を指定していない（後発の `is_admin_or_staff()` は `SET search_path = public` 済み）。search_path 汚染による関数乗っ取りの一般的リスク。全 DEFINER 関数に `SET search_path = public` を付与推奨。

### S8. `event_results` UPDATE に `WITH CHECK` が無い
`results_judge_update` は `USING (auth.uid() = judge_id)` のみ。更新後値が未検証のため、judge が自分の行の `judge_id` を他人に付け替え可能。`WITH CHECK (auth.uid() = judge_id)` を追加。

### S9. `listingId` 未検証（データ整合）
`create-checkout-session.js` は価格を `slot.listings.price` から取るが、`booking.listing_id` にはクライアント指定の `listingId` をそのまま保存。slot の listing と異なる ID を送れる。`listingId` が `slot.listing_id` と一致することを検証すべき。

### S10. CORS ワイルドカード
`vercel.json` の `Access-Control-Allow-Origin: *`。メソッドを GET に限定しており静的公開データ配信としては許容範囲だが、将来 API を同ドメインに増やす場合は要見直し。

---

## 補足（バグ / 品質メモ）
- ~~`js/ranking_data.js` は 0 バイト（空ファイル）。~~ → 確認の結果 933KB で空ではなく、かつどのファイルからも参照されていない（未使用ファイル）。実害なし。
- `reviews` に UPDATE ポリシーが無く、レビュー編集は不可（仕様なら問題なし）。レビュー本文を画面で `innerHTML` 描画している場合は S4 と同様のXSS注意。→ `explore/listing.html` のレビュー描画箇所は今回の対応でエスケープ済み。
- `bookings.stripe_session_id` は UNIQUE。webhook 冪等性は status 判定で担保されているが、`increment_booked_count` は webhook 側でのみ加算されるため、`checkout.session.completed` の重複到達時に status='paid' 済みで break される設計は妥当。
- 全体としてシークレット（service_role / Stripe秘密鍵）のフロント露出は検出されず。anon キー公開は設計通りで問題なし。`.env` は `.gitignore` 済み。

## 推奨対応順
1. **S3 + S2**（記事INSERT制限 + 本文サニタイズ）— 連鎖で全訪問者XSSのため最優先。
2. **S1**（bookings 匿名INSERT 削除）。
3. **S4 / S5**（属性エスケープ + URLスキーム検証）。
4. S6（予約原子化）、S7〜S10。

---

## 対応状況（2026-07-04）

全10件 + 補足事項すべて対応済み。SQLは `sql/security_fix_20260704.sql` にまとめ、Supabase本番に実行済み（Chrome MCP経由で直接実行・動作確認済み）。

### S1・S3（DB側）
`sql/security_fix_20260704.sql` で `bookings_insert_anon` を削除。articles は `articles_insert_auth` を承認フローに準拠した `articles_insert_role`（admin/staff は無条件、それ以外は自分の下書き/レビュー中のみ）に置換。

**調査中に判明した追加の重大な穴**: `articles` テーブルに Supabase Studio 上で作成されたと見られる重複ポリシー `"auth insert"`（INSERT, check=true）・`"auth update"`（UPDATE, qual=true, check=NULL）・`"auth delete"`（DELETE, 下書き制限なし）・`"auth read all"`（SELECT, qual=true）が存在し、これらが `articles_insert_auth` 等による制限を実質無効化していた。特に `"auth update"` は認証済みユーザーなら誰でも任意の記事を任意の内容・`is_published=true` へ書き換え可能な状態で、S3の説明（新規投稿のみ）より深刻だった。すべて削除済み。

### S2
`media/article.html` に DOMPurify（CDN）を導入し、`sanitizeContent()` で実際にHTMLサニタイズするよう修正。`<script>`・`on*`属性・`javascript:` スキームの除去を確認済み（Chromeで実際にペイロードを実行して検証）。

### S4・S5
`explore/index.html`・`explore/listing.html`・`mypage.html`・`media/index.html`・`media/article.html`・`events/2026_competitions.html` に `esc()`（`& < > " '` エスケープ）と `safeUrl()`（http/https以外のスキームを拒否）を追加し、DB由来の値をすべてラップ。

### S6・S9
`create_pending_booking()` RPC（`SECURITY DEFINER`、行ロック）を新設し、残席チェック→INSERTを単一トランザクションで原子化。`service_role` のみ実行可（anon/authenticatedはREVOKE済み・確認済み）。`api/create-checkout-session.js` をこのRPC呼び出しに変更し、`listingId` はクライアント指定値を検証のみに使い実際の保存には `slot.listing_id` を使用するよう修正。

### S7・S8
`is_site_admin()` / `increment_booked_count()` に `SET search_path = public` を追加（`is_site_admin()` の既存の `SET row_security = off` は保持）。`event_results.results_judge_update` に `WITH CHECK (auth.uid() = judge_id)` を追加。

### S10
`vercel.json` の CORS ワイルドカードは確認の結果、GET限定かつ `api/booking-result.js` が `booking_id` + `stripe_session_id`（推測不可能なトークン）の一致を要求するため、ワイルドカードでも実害がないことを確認。対応不要と判断。

### 追加修正（本監査対象外・調査中に発見）
`event_safety_assignments` / `event_shift_roles` / `event_staff_shifts` の書き込み系ポリシーが `roles=public` のままで、**未ログインでも** INSERT/UPDATE/DELETE できる状態だった。`event-staff.html` の設計（未ログイン=readonly）に反するため、書き込み系ポリシーの対象ロールを `authenticated` に限定（読み取り系は元々の設計通り public のまま）。
