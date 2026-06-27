# プロダッシュボード設計書（pro/index.html）— Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

インストラクター・ショップ向けの管理ダッシュボード。  
プロフィール管理・コース管理・空き枠管理・予約管理・クライアント管理・売上管理を一画面で提供。

---

## 2. ファイル

```
/pro/index.html           # メイン画面
/pro/instructor-welcome.html  # インストラクター向け紹介ページ（CTA）
```

---

## 3. ユーザーロールと初期表示

ページロード時に `boot()` を実行：

```
boot()
  ├─ getSession() → 未ログイン → auth-guard を表示して終了
  └─ ログイン済み
       ├─ instructors テーブルを user_id で検索
       ├─ shops テーブルを user_id で検索
       └─ どちらも見つからない → setup-guard を表示（プロフィール申請フォーム）
            ↓ いずれかが見つかった場合
          app を表示 → renderProfileForm() → checkNewInquiries()
```

### インストラクターステータス別 UI

| status | 表示 |
|---|---|
| `pending` | 「審査中」バナー + `profile` タブのみ表示 |
| `rejected` | 「却下」バナー表示 |
| `approved` | 全タブ表示・フル機能 |

---

## 4. タブ構成

| タブ ID | 表示名 | インストラクター | ショップ |
|---|---|:---:|:---:|
| `profile` | プロフィール | ✅ | ✅ |
| `listings` | コース管理 | ✅ | ✅（傘下インストラクター経由） |
| `slots` | 空き枠管理 | ✅ | ✅ |
| `inquiries` | 問い合わせ | ✅ | ✅ |
| `bookings` | 予約管理 | ✅ | ✅ |
| `clients` | クライアント管理 | ✅ | ✅ |
| `revenue` | 売り上げ管理 | ✅ | ✅ |

---

## 5. 機能詳細

### プロフィール管理（tab-profile）

**インストラクター：**
- 名前・経歴・資格・エリア・対応言語・写真
- `instructors` テーブルを UPDATE
- 写真は `avatars` バケットの `{user_id}/instructor.{ext}` にアップロード

**ショップ：**
- ショップ名・説明・所在地・連絡先
- `shops` テーブルを UPDATE

### コース管理（tab-listings）

```
loadListings()
  └─ listings テーブルを SELECT（instructor_id or shop傘下のinstructor_id）
       └─ 一覧テーブル表示

コース追加/編集 → saveListing()
  ├─ editListingId あり → UPDATE
  └─ なし → INSERT

削除 → deleteListing(id) → DELETE（確認ダイアログ後）
```

**listings テーブルの主要フィールド：**
`title` / `category` / `intent` / `area` / `price` / `price_unit` / `max_participants` / `duration` / `flow_steps` / `gallery_urls` / `is_public`

### 空き枠管理（tab-slots）

```
loadSlots()
  └─ availability_slots を SELECT（JOIN instructors, listings）

空き枠追加/編集 → saveSlot()
削除 → deleteSlot(slotId)
```

### 予約管理（tab-bookings）

```
loadBookings()
  └─ bookings を SELECT（JOIN availability_slots, listings, instructors）
       └─ ステータスフィルタ（全件 / pending / paid / confirmed / cancelled）

ステータス変更 → updateBookingStatus(id, newStatus)
  └─ bookings.status を UPDATE
```

### クライアント管理（tab-clients）

```
bookings テーブルから client_email でグループ集計
  └─ 顧客別：予約回数・合計金額・最終利用日
       └─ 検索（名前・メール）
            └─ 詳細モーダル：予約履歴一覧
                 └─ メモ保存（clients テーブル or bookings.notes）
```

### 売り上げ管理（tab-revenue）

```
loadRevenue()
  └─ bookings（status: paid or confirmed）を集計
       ├─ 月次サマリー：件数・合計・インストラクター取り分
       ├─ 棒グラフ（Chart.js）
       └─ 明細一覧（期間フィルタ）
```

---

## 6. DB 読み取りパターン

```js
// boot() での並列取得
const [{ data: inst }, { data: shop }] = await Promise.all([
  _sb.from('instructors').select('*').eq('user_id', currentUser.id).maybeSingle(),
  _sb.from('shops').select('*').eq('user_id', currentUser.id).maybeSingle(),
]);

// ショップ傘下のインストラクター取得
const { data: shopInsts } = await _sb
  .from('instructors').select('id, name').eq('shop_id', shop.id);
```

---

## 7. 新規プロフィール申請フロー

```
setup-guard 表示（未登録ユーザー）
  ├─ 「インストラクターとして登録」→ createProfile()
  │    └─ instructors テーブルに INSERT（status: 'pending'）
  └─ 「ショップとして登録」→ createShopProfile()
       └─ shops テーブルに INSERT
```

---

## 8. 写真アップロード

```js
// インストラクター写真のアップロードパス
const path = `${currentUser.id}/instructor.${ext}`;
await _sb.storage.from('avatars').upload(path, file, { upsert: true });
const { data } = _sb.storage.from('avatars').getPublicUrl(path);
// → instructors.photo_url に保存
```

---

## 9. 未保存警告

```js
let _isDirty = false;
document.addEventListener('input',  () => { _isDirty = true; });
document.addEventListener('change', () => { _isDirty = true; });
window.addEventListener('beforeunload', e => {
  if (!_isDirty) return;
  e.preventDefault(); e.returnValue = '';
});
// 保存成功後: _isDirty = false;
```

---

## 10. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| 問い合わせ機能 | `inquiries` タブは枠のみ、DB 実装未完 |
| ショップ機能 | 基本実装済みだが UI 整備途中 |
| 売上グラフ | Chart.js 依存（CDN 読み込み） |
