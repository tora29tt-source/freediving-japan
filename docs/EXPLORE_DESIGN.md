# マッチング（探す）設計書 — Freediving Japan

> 最終更新：2026-07-05

---

## 1. 概要

インストラクター・コース・スクールを検索・閲覧・予約できるマッチングページ。  
現在は先行実装中（Phase 1）で、本格公開は Phase 2 予定。

> **2026-07-04 変更：** ショップは担当インストラクター未定でも単体で商品を掲載できる。カード・詳細ページ・予約導線は `instructor_id` が null でも壊れないよう対応済み（`?shop=` パラメータ経由）。詳細は [DB_SCHEMA_DESIGN.md](./DB_SCHEMA_DESIGN.md) を参照。
>
> **2026-07-05 変更：位置情報を「都道府県」＋「人気スポット」の二層構造にした。** 経緯：当初14種の固定チップ（`listings.area`）だけで検索していたが、リストにない地名（鹿児島など）が出るたびに4ファイルを手動修正する必要があり、日本全国・海外をカバーするには無理があった。そこで `listings.prefecture` を47都道府県＋「海外」に固定（CHECK制約）し、検索の正データに格上げ。従来のチップ（`area`）は「人気スポット」タグとして残すが任意項目に格下げした。詳細は下記3節と[DB_SCHEMA_DESIGN.md](./DB_SCHEMA_DESIGN.md)を参照。

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
| 都道府県（`#prefSelect`） | ✅ | `listings.prefecture` の完全一致。47都道府県＋「海外」の`<select>`（2026-07-05〜・検索の正データ） |
| 人気スポット（チップ・任意） | ✅ | `listings.area` の完全一致（下記チップ一覧参照）。都道府県フィルタと AND で併用可能 |
| キーワード検索 | ✅ | `title` / `area` / `location_detail` / `category` / インストラクター名・ショップ名の部分一致 |
| カテゴリ | ✅ | `category`（フリーダイビング / スキンダイビング / ファンダイビング等） |
| 目的 | ✅ | `intent`（体験 / 講習 / ツアー等） |
| 価格帯 | ✅ | `price` 範囲フィルタ |
| ソート | ✅ | 価格昇順 / 価格降順 / 評価順 |

**都道府県とエリア（人気スポット）の使い分け：** 都道府県は47都道府県＋「海外」を網羅する必須の正データ（コース登録フォームで`<select>`から選ぶ、CHECK制約あり）。人気スポットは石垣島・宮古島など「都道府県より細かい・複数県にまたがる」観光的な区分を14種に絞ったタグで、任意入力。都道府県だけで検索は必ず機能し、人気スポットは補助的な絞り込み。

**人気スポットチップの一覧（`explore/index.html` `#areaChips`）：** 沖縄 / 石垣島 / 宮古島 / 西表島 / 与那国島 / 久米島 / 慶良間諸島 / 奄美大島 / 鹿児島 / 伊豆 / 東京 / 紀伊半島 / 瀬戸内 / 北海道

同じ一覧を`explore/shops.html`のエリアチップ、`pro/index.html`・`admin/index.html`のコース登録フォーム「人気スポット（任意）」`<select>`、`explore/index.html`の地図用`AREA_COORDS`座標にも反映している。**この一覧は今後も増やせるが、増やさなくても都道府県フィルタだけで全国・海外をカバーできる**ため、2026-07-05以降は「よく使われる有名スポットを追加でピックアップする」程度の位置づけ。

人気スポットチップは `listings.area` との**完全一致**でフィルタする（`l.area !== currentArea`）。都道府県フィルタ（`currentPrefecture`・`listings.prefecture`との完全一致）と AND 条件で併用される。トップページ検索バーの「エリア」もこのチップ値と一致すれば絞り込みに反映される（`applyUrlParams()`の`area`パラメータ。`pref`パラメータで都道府県を直接指定することも可能）。

> **経緯（2026-07-05・2段階の修正）：** ①まず人気スポット（`area`）を自由入力→上記14種の`<select>`に変更したが、「リストにない地名は検索から漏れる」問題自体は解決しなかった（鹿児島がリストに無く選べない、という形で発覚）。②そこで根本対応として `listings.prefecture` を47都道府県＋「海外」に固定し検索の正データに格上げ、人気スポットは任意の補助タグに位置づけを変更した。既存データで①以前の自由入力のまま残っているものは、編集画面を開くと自動的に「その他」＋元の値で復元される（`prefecture`側も同様に「海外」＋自由入力欄で復元）。

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
| エリアチップ | `explore/index.html`と同じ14種の人気スポットチップ。`(o.areas || []).some(a => a.includes(currentArea))` で部分一致判定（`areas`は「沖縄（4月〜10月）」のような季節ラベル付き文字列のため） |
| キーワード検索 | 名前・bio の部分一致 |
| ソート | おすすめ順 / 評価順（`avg_rating`） |

> **既知の制限：** `listings`側は2026-07-05に都道府県（47+海外・CHECK制約）を検索の正データにしたが、`shops.areas` / `instructors.areas`（本セクションのエリアチップが参照する側）は自由入力のまま。同じ「固定リストに無い地名は拾えない」問題がショップ/インストラクターのプロフィール検索にも残っている。listings側の対応が定着したら同様の都道府県フィールド化を検討する。

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
| `prefecture` | text | 都道府県（2026-07-05〜、47都道府県＋「海外」のCHECK制約あり。探すページの検索・絞り込みの正データ） |
| `country` | text | 海外掲載時の国名（`prefecture`='海外'のときのみ・自由入力、2026-07-05〜追加） |
| `area` | text | 人気スポットタグ（探すページの人気スポットチップと同じ14択・任意。都道府県フィルタと併用できる補助的な絞り込み） |
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
