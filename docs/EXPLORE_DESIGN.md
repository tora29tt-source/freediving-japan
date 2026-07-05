# マッチング（探す）設計書 — Freediving Japan

> 最終更新：2026-07-05

---

## 1. 概要

インストラクター・コース・スクールを検索・閲覧・予約できるマッチングページ。  
現在は先行実装中（Phase 1）で、本格公開は Phase 2 予定。

> **2026-07-04 変更：** ショップは担当インストラクター未定でも単体で商品を掲載できる。カード・詳細ページ・予約導線は `instructor_id` が null でも壊れないよう対応済み（`?shop=` パラメータ経由）。詳細は [DB_SCHEMA_DESIGN.md](./DB_SCHEMA_DESIGN.md) を参照。

---

## 2. ファイル構成

```
/explore/index.html     # コース・体験の検索・一覧ページ
/explore/shops.html     # ショップ・インストラクターのディレクトリページ（2026-07-05〜）
/explore/listing.html   # リスティング詳細・予約ページ（ショップ/インストラクターのプロフィール表示も兼ねる）
```

---

## 3. 検索・フィルタ機能

### 検索バー

```js
document.getElementById('searchInput').addEventListener('input', () => applyFilters());
// リアルタイム検索：インストラクター名・コース名・エリアにマッチ
```

### フィルタ条件

| フィルタ | 実装 | 値 |
|---|---|---|
| エリア（チップ） | ✅ | `listings.area` の完全一致（下記チップ一覧参照） |
| キーワード検索 | ✅ | `title` / `area` / `location_detail` / `category` / インストラクター名・ショップ名の部分一致 |
| カテゴリ | ✅ | `category`（フリーダイビング / スキンダイビング / ファンダイビング等） |
| 目的 | ✅ | `intent`（体験 / 講習 / ツアー等） |
| 価格帯 | ✅ | `price` 範囲フィルタ |
| ソート | ✅ | 価格昇順 / 価格降順 / 評価順 |

**エリアチップの一覧（`explore/index.html` `#areaChips`）：** 沖縄 / 石垣島 / 宮古島 / 西表島 / 与那国島 / 久米島 / 慶良間諸島 / 奄美大島 / 伊豆 / 東京 / 紀伊半島 / 瀬戸内 / 北海道

エリアチップは `listings.area` との**完全一致**でフィルタする（`l.area !== currentArea`）。トップページ検索バーの「エリア」もこのチップ値と一致すれば絞り込みに反映される（`applyUrlParams()`）。

> **2026-07-05 修正：** 以前は `pro/index.html` のコース登録フォームの「エリア」が自由入力で、上記チップの文字列と完全一致しないと絞り込みに乗らなかった（例：「沖縄本島」と入力するとチップ「沖縄」で拾えない）。エリアを上記チップと同じ選択肢の `<select>` に変更し、リストにない場合のみ「その他」で自由入力できるようにした（その他扱いの場合はチップ検索の対象外になる旨をUI上に明記）。既存データで自由入力のまま残っているものは編集画面を開くと自動的に「その他」＋元の値で復元される。

### フィルタロジック

```js
async function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = allListings.filter(l => {
    // テキスト検索：タイトル・インストラクター名・エリア
    if (q && !`${l.title} ${l.instructors?.name} ${l.area}`.toLowerCase().includes(q)) return false;
    // フィルタ各条件をチェック
    return true;
  });
  // ソート
  if (currentSort === 'price_asc')  filtered = [...filtered].sort((a,b) => a.price - b.price);
  if (currentSort === 'rating')     filtered = [...filtered].sort((a,b) =>
    (b.instructors?.shops?.avg_rating || 0) - (a.instructors?.shops?.avg_rating || 0));
  renderListings(filtered);
}
```

---

## 4. データ取得

### 一覧（explore/index.html）

> `shop_id` が入っている（＝担当インストラクター未定・ショップ名義）カードにも対応するため、`shop_id` と `shops(...)` の JOIN を追加済み（2026-07-04〜）。カードのリンク先は `l.instructor_id ? id=... : shop=...` で振り分ける。

```js
async function loadListings() {
  const { data, error } = await _sb
    .from('listings')
    .select(`
      id, title, category, intent, area, location_detail,
      price, price_unit, tags, image_url, instructor_id, shop_id,
      instructors (
        id, name, is_verified,
        shops ( avg_rating, review_count )
      ),
      shops ( id, name, avg_rating, review_count )
    `)
    .eq('is_public', true)
    .order('sort_order', { ascending: true });
  allListings = data || [];
  applyFilters();
}
```

### インストラクターモーダル

```js
async function openInstructorModal(instructorId, e) {
  const { data, error } = await _sb
    .from('instructors')
    .select('*')
    .eq('id', instructorId)
    .single();
  // モーダル表示
}
```

---

## 5. リスティング詳細（listing.html）

URL: `/explore/listing.html?id={instructorId}` または `/explore/listing.html?shop={shopId}`（担当者未定・ショップ名義、2026-07-04〜）

instructor/shop 共通の `normalizeOwner(raw, type)` ヘルパーで所有者データを正規化し、詳細表示・空き枠クエリ（`instructor_id` or `shop_id` で絞り込み）・チェックアウトの各処理を owner の種類を意識せず扱えるようにしている。

### 表示コンテンツ

- インストラクター情報（写真・経歴・資格・エリア・言語）
- コース一覧（タイトル・価格・所要時間・定員・ギャラリー画像）
- 空き枠カレンダー（日程選択）
- 予約フォーム（参加人数・氏名・メール・電話・備考・レンタル希望）
- レビュー一覧

### 予約処理

```
ユーザーが日程・人数を選択 → 「予約する」クリック
  └─ POST /api/create-checkout-session
       └─ → Stripe Checkout へ（BOOKING_DESIGN.md 参照）
```

---

## 6. ショップ・インストラクターディレクトリ（shops.html・2026-07-05〜）

コース単位ではなく、ショップ・インストラクター単体を検索するための専用ページ。フッターの「ショップ/インストラクターを探す」リンク先（従来は`explore/index.html`への自己参照になっていた導線を修正）。

**背景：** 探すページ（`index.html`）は`listings`単位の検索で、ショップ・インストラクターの「活動エリア」（`shops.areas` / `instructors.areas`）はコースの`area`フィールドとは別物のため検索に反映されていなかった。ショップがまだ1件もコースを掲載していない場合、そのショップは`explore/index.html`のエリアチップ検索では一切見つけられない、という穴があった。

### データ取得

```js
// ショップ
_sb.from('shops').select('id, name, bio, shop_type, areas, logo_url, avg_rating, review_count, is_verified').eq('is_public', true);
// インストラクター
_sb.from('instructors').select('id, name, bio, areas, photo_url, is_verified, shops ( avg_rating, review_count )').eq('is_public', true).eq('status', 'approved');
```

型ごとに初回取得時にキャッシュし、「ショップ」「インストラクター」タブ切替では再フェッチしない。

### フィルタ

| フィルタ | 実装 |
|---|---|
| エリアチップ | `explore/index.html`と同じ13種。`(o.areas || []).some(a => a.includes(currentArea))` で部分一致判定（`areas`は「沖縄（4月〜10月）」のような季節ラベル付き文字列のため） |
| キーワード検索 | 名前・bio の部分一致 |
| ソート | おすすめ順 / 評価順（`avg_rating`） |

### カードのリンク先

`listing.html?shop={shopId}` または `listing.html?id={instructorId}` へ遷移（新規ページを作らず、既存の`listing.html`のオーナー表示モードを再利用。コースが0件のショップ/インストラクターでもプロフィール自体は表示される）。

---

## 7. DB テーブル

### listings（主要カラム）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `instructor_id` | UUID | インストラクター FK（nullable、2026-07-04〜） |
| `shop_id` | UUID | ショップ FK（追加、2026-07-04〜。instructor_id と shop_id はどちらか必須） |
| `title` | text | コース名 |
| `category` | text | カテゴリ |
| `intent` | text | 目的（体験/講習/ツアー） |
| `area` | text | エリア（探すページのエリアチップと同じ13択の選択式。検索・絞り込みで実際に使われるのはこちら） |
| `prefecture` | text | 都道府県（2026-07-05〜 コース登録フォームから削除。列は残すが新規入力は無し。`area`と重複する情報でどこにも表示に使われていなかったため） |
| `price` | int | 価格（円） |
| `price_unit` | text | 価格単位（per_person 等） |
| `price_includes` | text | 料金に含まれるもの |
| `price_excludes` | text | 別途必要なもの |
| `duration` | text | 所要時間 |
| `max_participants` | int | 最大定員 |
| `age_min` / `age_max` | int | 年齢制限 |
| `meeting_point` | text | 集合場所 |
| `flow_steps` | jsonb | 当日の流れ |
| `image_url` | text | メイン画像 |
| `gallery_urls` | jsonb | ギャラリー画像リスト |
| `tags` | jsonb | タグ |
| `is_public` | boolean | 公開フラグ |
| `sort_order` | int | 表示順 |

### instructors（主要カラム）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | ユーザー FK |
| `name` | text | 氏名 |
| `bio` | text | 経歴・自己紹介 |
| `photo_url` | text | 写真 URL |
| `certifications` | jsonb | 資格リスト |
| `areas` | jsonb | 対応エリアリスト |
| `prefecture` | text | 都道府県 |
| `city` | text | 市区町村 |
| `experience_years` | int | 経験年数 |
| `languages` | jsonb | 対応言語 |
| `is_verified` | boolean | 認証済みバッジ |
| `status` | text | `pending` / `approved` / `rejected` |
| `shop_id` | UUID | 所属ショップ FK（単一・任意、旧来カラム） |

> 2026-07-04〜、複数ショップへの同時所属は別テーブル `instructor_shops`（N:M）で管理する。詳細は [DB_SCHEMA_DESIGN.md](./DB_SCHEMA_DESIGN.md#instructor_shops2026-07-04n-m-所属) を参照。

### reviews

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `instructor_id` | UUID | インストラクター FK |
| `user_id` | UUID | 投稿者 FK |
| `rating` | int | 評価（1〜5） |
| `comment` | text | コメント |
| `created_at` | timestamptz | |

---

## 8. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| 本格公開 | Phase 2（現在は先行実装中） |
| マップ検索 | `explore/map/` 未実装 |
| レビュー投稿 | 閲覧のみ実装・投稿フォーム未実装 |
| お気に入り | 未実装 |
| 比較機能 | 未実装 |
