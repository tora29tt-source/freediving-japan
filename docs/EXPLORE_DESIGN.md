# マッチング（探す）設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

インストラクター・コース・スクールを検索・閲覧・予約できるマッチングページ。  
現在は先行実装中（Phase 1）で、本格公開は Phase 2 予定。

---

## 2. ファイル構成

```
/explore/index.html     # 検索・一覧ページ
/explore/listing.html   # リスティング詳細・予約ページ
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
| エリア | ✅ | prefecture / area |
| カテゴリ | ✅ | `category`（フリーダイビング / スキンダイビング / ファンダイビング等） |
| 目的 | ✅ | `intent`（体験 / 講習 / ツアー等） |
| 価格帯 | ✅ | `price` 範囲フィルタ |
| ソート | ✅ | 価格昇順 / 価格降順 / 評価順 |

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

```js
async function loadListings() {
  const { data, error } = await _sb
    .from('listings')
    .select(`
      id, title, category, intent, area, location_detail,
      price, price_unit, tags, image_url, instructor_id,
      instructors (
        id, name, is_verified,
        shops ( avg_rating, review_count )
      )
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

URL: `/explore/listing.html?id={instructorId}`

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

## 6. DB テーブル

### listings（主要カラム）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `instructor_id` | UUID | インストラクター FK |
| `title` | text | コース名 |
| `category` | text | カテゴリ |
| `intent` | text | 目的（体験/講習/ツアー） |
| `area` | text | エリア |
| `prefecture` | text | 都道府県 |
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
| `shop_id` | UUID | 所属ショップ FK（任意） |

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

## 7. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| 本格公開 | Phase 2（現在は先行実装中） |
| マップ検索 | `explore/map/` 未実装 |
| レビュー投稿 | 閲覧のみ実装・投稿フォーム未実装 |
| お気に入り | 未実装 |
| 比較機能 | 未実装 |
