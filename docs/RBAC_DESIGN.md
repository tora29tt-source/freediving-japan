# 権限管理設計書（RBAC）— Freediving Japan

> 最終更新：2026-06-28 | 策定：2026-06-25

---

## 1. 概要

Row Level Security（RLS）と `user_roles` テーブルを組み合わせた RBAC（Role-Based Access Control）実装。  
Supabase Auth のセッション情報を基に、ページレベル・DBレベルの両方でアクセス制御を行う。

---

## 2. ロール体系

| ロール | 管理場所 | 説明 |
|---|---|---|
| **未ログイン** | — | 公開ページ閲覧のみ |
| **ログイン済み** | Supabase Auth | 登録後デフォルト。トレーニングログ・大会情報等 |
| **インストラクター（審査中）** | `instructors.status = 'pending'` | pro/index.html でプロフィール申請後・承認待ち |
| **インストラクター（承認済み）** | `instructors.status = 'approved'` | 管理者承認後にリスティング・CRM・予約管理が使える |
| **サイト管理者 `admin`** | `user_roles.role = 'admin'` | 全権限 |
| **サイトスタッフ `staff`** | `user_roles.role = 'staff'` | 予約・インストラクター・メディア管理 |
| **エディター `editor`** | `user_roles.role = 'editor'` | メディア管理のみ |
| **大会主催者 `organizer`** | `event_staff.role = 'organizer'` | 大会ごとに任命 |
| **大会スタッフ `staff`** | `event_staff.role = 'staff'` | 大会ごとに任命 |
| **大会読み取り `readonly`** | `event_staff.role = 'readonly'` | 大会ごとに任命 |

---

## 3. ページ別アクセス制御

| ページ | 未ログイン | ログイン済み | 承認済みインストラクター | 管理者 |
|---|:---:|:---:|:---:|:---:|
| `index.html` / `explore/` / `learn/` / `articles/` | ✅ | ✅ | ✅ | ✅ |
| `auth.html` | ✅ | → mypage | → mypage | → mypage |
| `mypage.html` | → auth | ✅ | ✅ | ✅ |
| `tools/training-log.html` | → auth | ✅ | ✅ | ✅ |
| `tools/sta-timer.html` | → auth | ✅ | ✅ | ✅ |
| `events/event-athlete.html` | ✅（URLシェア公開） | ✅ | ✅ | ✅ |
| `events/event-staff.html` | readonly | 大会ロール依存 | 大会ロール依存 | ✅全権 |
| `pro/index.html` | → auth | ✅ 申請のみ | ✅ フル機能 | ✅ |
| `admin/index.html` | → auth → 弾く | ❌ | ❌ | ✅ |
| `media/admin-mobile.html` | → auth → 弾く | ❌ | ❌ | ✅（editor以上） |

### admin/index.html タブ別権限

| タブ | admin | staff | editor |
|---|:---:|:---:|:---:|
| 空き枠管理 | ✅ | ✅ | ❌ |
| 予約一覧 | ✅ | ✅ | ❌ |
| インストラクター（承認操作含む） | ✅ | ✅ | ❌ |
| リスティング | ✅ | ✅ | ❌ |
| メディア | ✅ | ✅ | ✅ |
| ユーザー管理 | ✅ | ❌ | ❌ |

---

## 4. インストラクター承認フロー

```
ユーザー登録（Supabase Auth）
  ↓
選手・愛好家として利用開始（デフォルト）
  ↓  pro/index.html でプロフィール入力・申請
instructors.status = 'pending'（審査中バナー表示・タブは profile のみ）
  ↓  管理者が admin/index.html でステータス変更
instructors.status = 'approved'
  ↓
リスティング・CRM・予約管理・空き枠管理が解放
```

### ステータス別 UI 制御（pro/index.html）

```js
if (inst.status === 'pending') {
  document.body.classList.add('status-pending');
  // CSS: .status-pending .tab:not([data-tab="profile"]) { display: none }
} else if (inst.status === 'rejected') {
  document.body.classList.add('status-rejected');
}
```

---

## 5. DB テーブル設計

### user_roles

```sql
CREATE TABLE user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'editor')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### event_staff

```sql
CREATE TABLE event_staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('organizer', 'staff', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. ヘルパー関数

```sql
-- サイト管理者判定（RLS ポリシー内で使用）
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  );
$$;
```

---

## 7. RLS ポリシー実装状況

| テーブル | RLS | 主なポリシー | 実装ファイル |
|---|:---:|---|---|
| `training_sessions` | ✅ | 本人 or `is_public=true` | `sql/rls_update_20260625.sql` |
| `training_dives` | ✅ | 本人 or 公開セッション紐づき | 同上 |
| `instructors` | ✅ | 公開: `approved+is_public` / 本人 / 管理者 | 同上 |
| `listings` | ✅ | 公開: `is_public` / 本人（approved必須）/ 管理者 | 同上 |
| `availability_slots` | ✅ | 誰でも読み / 本人インストラクターのみ書き込み | 同上 |
| `bookings` | ✅ | インストラクター本人 or 管理者のみ閲覧 / 誰でも新規作成 | 同上 |
| `shops` | ✅ | 公開 / 本人 / 管理者 | 同上 |
| `reviews` | ✅ | 公開 / 本人書き込み | 同上 |
| `user_roles` | ✅ | 管理者のみ全操作 | 同上 |

### RLS テンプレート例（bookings）

```sql
-- SELECT: インストラクター本人・管理者・予約者本人（メール一致）のみ
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (
  instructor_id = auth.uid()
  OR is_site_admin()
  OR client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- INSERT: 誰でも（Vercel Serverless Function 経由、service_role キー使用）
-- UPDATE: インストラクター本人・管理者のみ
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (
  instructor_id = auth.uid() OR is_site_admin()
);
```

---

## 8. セキュリティ上の注意

- `user_roles` テーブルへの INSERT/UPDATE は管理者のみ（フロントからの昇格申請は不可）
- `is_site_admin()` は `SECURITY DEFINER` + `SET search_path = public` で権限昇格を制御
- `anon key` はフロントエンドに置いても RLS で保護されているため安全
- `service_role key` は Vercel 環境変数にのみ設置し、フロントには絶対に置かない
