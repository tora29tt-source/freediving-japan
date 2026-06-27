# 管理画面設計書（admin/index.html）— Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

サイト管理者・スタッフが使用する管理ダッシュボード。  
空き枠管理・予約管理・インストラクター承認・リスティング管理・メディア管理・ユーザー管理をタブで切り替え。

---

## 2. ファイル

```
/admin/index.html          # メイン管理画面
/media/admin-mobile.html   # メディア管理（モバイル向け別ページ）
```

---

## 3. アクセス制御

```
boot()
  ├─ getSession() → 未ログイン → auth.html へリダイレクト
  └─ ログイン済み
       └─ user_roles テーブルで role 確認
            ├─ admin / staff / editor → 許可
            └─ 上記以外 → 「管理者権限がありません」表示して終了
```

### ロール別タブ表示

| タブ | admin | staff | editor |
|---|:---:|:---:|:---:|
| 空き枠管理 | ✅ | ✅ | ❌（非表示） |
| 予約一覧 | ✅ | ✅ | ❌（非表示） |
| インストラクター | ✅ | ✅ | ❌（非表示） |
| リスティング | ✅ | ✅ | ❌（非表示） |
| メディア | ✅ | ✅ | ✅ |
| ユーザー管理 | ✅ | ❌（非表示） | ❌（非表示） |

```js
// editor のみの場合
if (!roles.some(r => ['admin', 'staff'].includes(r.role))) {
  // 管理・予約系タブを非表示にしてメディアタブを初期表示
  ['slots', 'bookings', 'instructors', 'listings'].forEach(t => {
    document.getElementById(`tab-btn-${t}`).style.display = 'none';
  });
  document.getElementById('tab-media').style.display = '';
}
```

---

## 4. タブ構成と機能

### 空き枠管理（tab-slots）

```
loadSlots()
  └─ availability_slots SELECT（JOIN instructors, listings）
       └─ テーブル表示（日付・時間・定員・予約数・アクティブ状態）

空き枠追加/編集モーダル → saveSlot()
  ├─ instructor / listing を選択
  ├─ 日付・時間・定員を入力
  └─ INSERT または UPDATE

削除 → deleteSlot(slotId) → DELETE
```

### 予約一覧（tab-bookings）

```
loadBookings()
  └─ bookings SELECT（JOIN availability_slots, listings, instructors）
       └─ ステータス別カラー表示

ステータス変更（ドロップダウン）
  └─ bookings.status を UPDATE
       ステータス遷移: pending → paid → confirmed → cancelled / refunded
```

### インストラクター管理（tab-instructors）

```
loadInstructors()
  └─ instructors SELECT（全件）
       └─ ステータス（pending / approved / rejected）で色分け表示

承認操作
  └─ ドロップダウンで status 変更 → instructors.status を UPDATE
       pending → approved: リスティング・CRM・予約管理が解放
       pending → rejected: pro/index.html に却下バナー表示
```

### リスティング管理（tab-listings）

```
loadListings()
  └─ listings SELECT（JOIN instructors）
       └─ 公開/非公開・タイトル・担当インストラクター表示

公開/非公開切り替え
  └─ listings.is_public を UPDATE
```

### メディア管理（tab-media）

- 記事の一覧・公開/非公開切り替え
- `media/admin-mobile.html` と機能的に共通

### ユーザー管理（tab-users）

- `user_roles` テーブルで admin / staff / editor ロールを付与・削除
- admin ロールのみ操作可能

---

## 5. 共通マスターデータ読み込み

```js
async function loadMasterData() {
  const [{ data: instructors }, { data: listings }] = await Promise.all([
    _sb.from('instructors').select('id, name').order('name'),
    _sb.from('listings').select('id, title, instructor_id').order('title'),
  ]);
  // プルダウン選択肢として使用
}
```

---

## 6. DB 操作サマリー

| 操作 | テーブル | 権限 |
|---|---|---|
| 空き枠 CRUD | `availability_slots` | admin / staff |
| 予約ステータス更新 | `bookings` | admin / staff |
| インストラクター承認 | `instructors.status` | admin / staff |
| リスティング公開管理 | `listings.is_public` | admin / staff |
| ロール付与 | `user_roles` | admin のみ |

---

## 7. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| メディア管理 | `media/admin-mobile.html` と統合予定（Phase 2） |
| ユーザー検索 | 現状は全件取得のみ。ユーザー数増加時にページネーション必要 |
| 操作ログ | 誰がいつ承認・変更したかのログ未実装 |
| 返金処理 | Stripe Dashboard での手動対応（自動返金 API 未実装） |
