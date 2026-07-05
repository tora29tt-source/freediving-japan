# DB スキーマ設計書 — Freediving Japan

> 最終更新：2026-07-05 | DB: Supabase / PostgreSQL（Project: bbhqvbpsuccbdcnhnobm / Tokyo）

---

## 1. テーブル一覧

| テーブル | 用途 | RLS |
|---|---|:---:|
| `profiles` | ユーザー基本情報（Auth のミラー） | ✅ |
| `user_roles` | サイト管理者ロール管理 | ✅ |
| `instructors` | インストラクターマスタ | ✅ |
| `shops` | ショップマスタ | ✅ |
| `instructor_shops` | インストラクター所属（N:M・2026-07-04〜） | ✅ |
| `listings` | 体験・コース（instructor_id / shop_id いずれか必須） | ✅ |
| `availability_slots` | 空き枠（instructor_id / shop_id いずれか必須） | ✅ |
| `bookings` | 予約（instructor_id / shop_id いずれか必須） | ✅ |
| `inquiries` | 問い合わせ（instructor_id / shop_id いずれか必須） | ✅ |
| `reviews` | レビュー（instructor_id / shop_id いずれか必須） | ✅ |
| `training_sessions` | トレーニングセッション | ✅ |
| `training_dives` | ダイブ記録 | ✅ |
| `events` | 大会・イベント | ✅ |
| `event_entries` | 大会エントリー（AP登録） | ✅ |
| `event_staff` | 大会スタッフ | ✅ |

> **2026-07-04 変更点：** ショップは担当インストラクター未定でも単体で商品を出品できるようになった。インストラクターは複数ショップに同時所属できる（N:M、季節ラベルなし）。詳細は [[project_shop_instructor_model_20260704]]（メモリ）および `sql/shop_direct_listings_20260704.sql` を参照。

---

## 2. テーブル詳細

### profiles（Auth ミラー・自動生成）

> `handle_new_user()` トリガーにより `auth.users` に新規ユーザーが追加されると自動 INSERT される。

```sql
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**トリガー関数：**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### user_roles

```sql
CREATE TABLE user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'editor')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

---

### instructors

```sql
CREATE TABLE instructors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id           UUID REFERENCES shops(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  bio               TEXT,
  photo_url         TEXT,
  certifications    JSONB DEFAULT '[]',
  areas             JSONB DEFAULT '[]',
  prefecture        TEXT,
  city              TEXT,
  experience_years  INT,
  languages         JSONB DEFAULT '[]',
  is_verified       BOOLEAN DEFAULT false,
  is_public         BOOLEAN DEFAULT true,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

> `shop_id` は旧来の「単一所属」用カラム（残置・併用可）。2026-07-04 以降、複数同時所属は下記 `instructor_shops` で管理する。

---

### instructor_shops（2026-07-04〜・N:M 所属）

```sql
CREATE TABLE instructor_shops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (instructor_id, shop_id)
);
```

- インストラクター1人が複数ショップに同時所属できる（例：夏はショップA、冬はショップBで同時に有効）。季節・期間ラベルは持たず、フラットな所属一覧。
- SELECT は全員に公開（ショップ側の「所属インストラクター」表示に使用）。INSERT/DELETE はショップオーナー本人・インストラクター本人・管理者のみ。

---

### shops

```sql
CREATE TABLE shops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  name         TEXT NOT NULL,
  description  TEXT,
  prefecture   TEXT,
  city         TEXT,
  address      TEXT,
  phone        TEXT,
  website      TEXT,
  avg_rating   NUMERIC(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### listings

> `instructor_id` は nullable。`shop_id` を追加し `CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)` でどちらか必須を担保（2026-07-04〜、ショップ単体出品対応）。
>
> **2026-07-05〜：位置情報を二層化。** `prefecture` を47都道府県＋「海外」に固定するCHECK制約（`listings_prefecture_check`）を追加し、探すページの検索・絞り込みの正データとした。`area`（探すページの「人気スポット」チップ・任意）と併用する。詳細は [EXPLORE_DESIGN.md](./EXPLORE_DESIGN.md) を参照。

```sql
CREATE TABLE listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id       UUID REFERENCES instructors(id) ON DELETE CASCADE,  -- nullable（2026-07-04〜）
  shop_id             UUID REFERENCES shops(id) ON DELETE SET NULL,       -- 追加（2026-07-04〜）
  title               TEXT NOT NULL,
  category            TEXT,  -- フリーダイビング/スキンダイビング/etc.
  intent              TEXT,  -- 体験/講習/ツアー/etc.
  area                TEXT,  -- 人気スポットタグ（任意・14種の固定リスト。探すページのチップと連動）
  prefecture          TEXT,  -- 47都道府県 + '海外' のいずれか（CHECK制約・2026-07-05〜。検索の正データ）
  country             TEXT,  -- prefecture='海外' のときの国名（自由入力・2026-07-05〜追加）
  location_detail     TEXT,
  price               INT,
  price_unit          TEXT,  -- per_person / per_group / etc.
  price_includes      TEXT,
  price_excludes      TEXT,
  duration            TEXT,
  season              TEXT,
  min_participants    INT DEFAULT 1,
  max_participants    INT,
  age_min             INT,
  age_max             INT,
  meeting_point       TEXT,
  booking_deadline    INT,   -- 何日前まで予約可（日数）
  has_shuttle         BOOLEAN DEFAULT false,
  cancellation_policy TEXT,
  what_to_bring       TEXT,
  notes               TEXT,
  tags                JSONB DEFAULT '[]',
  facilities          JSONB DEFAULT '[]',
  rental_gear         JSONB DEFAULT '[]',
  flow_steps          JSONB DEFAULT '[]',
  image_url           TEXT,
  gallery_urls        JSONB DEFAULT '[]',
  is_public           BOOLEAN DEFAULT false,
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT listings_owner_required CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL),
  CONSTRAINT listings_prefecture_check CHECK (prefecture IS NULL OR prefecture IN (
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県',
    '三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
    '海外'
  ))  -- 2026-07-05〜
);

CREATE INDEX idx_listings_prefecture ON listings(prefecture);  -- 2026-07-05〜
```

> 実装ファイル：`sql/listings_prefecture_authoritative_20260705.sql`（Supabase本番に実行済み・実行前に既存データ確認済み：NULL 4件／沖縄県 3件／静岡県 2件のみで全件許可リスト内）。

---

### availability_slots

> `instructor_id` は nullable。`shop_id` を追加し同様の owner-required CHECK を追加（2026-07-04〜）。

```sql
CREATE TABLE availability_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id    UUID REFERENCES instructors(id) ON DELETE CASCADE,  -- nullable（2026-07-04〜）
  shop_id          UUID REFERENCES shops(id) ON DELETE SET NULL,       -- 追加（2026-07-04〜）
  listing_id       UUID REFERENCES listings(id) ON DELETE CASCADE,
  slot_date        DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  max_participants INT NOT NULL DEFAULT 1,
  booked_count     INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT slots_owner_required CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)
);
```

---

### bookings

> `instructor_id` は nullable。`shop_id` を追加し同様の owner-required CHECK を追加（2026-07-04〜）。予約作成は `create_pending_booking()` RPC 経由に一本化済み（`bookings_insert_anon` ポリシーは撤廃済み、[[project_security_bugs_20260628]] S1）。

```sql
CREATE TABLE bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id                   UUID REFERENCES availability_slots(id),
  instructor_id             UUID REFERENCES instructors(id),  -- nullable（2026-07-04〜）
  shop_id                   UUID REFERENCES shops(id) ON DELETE SET NULL,  -- 追加（2026-07-04〜）
  listing_id                UUID REFERENCES listings(id),
  client_name               TEXT NOT NULL,
  client_email              TEXT NOT NULL,
  client_phone              TEXT,
  notes                     TEXT,
  rental_requests           TEXT,
  participant_count         INT NOT NULL,
  unit_price                INT NOT NULL,
  total_amount              INT NOT NULL,
  platform_fee              INT NOT NULL,
  instructor_payout         INT NOT NULL,
  status                    TEXT DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','confirmed','cancelled','refunded')),
  stripe_session_id         TEXT,
  stripe_payment_intent_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT bookings_owner_required CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)
);
```

---

### inquiries

> マッチングの問い合わせテーブル。`instructor_id` は nullable、`shop_id` を追加し owner-required CHECK を追加（2026-07-04〜）。誰でも送信可（未ログインOK）、閲覧・返信は所有者（インストラクター本人 or ショップオーナー）または管理者のみ。

```sql
CREATE TABLE inquiries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID REFERENCES listings(id) ON DELETE SET NULL,
  instructor_id     UUID REFERENCES instructors(id) ON DELETE CASCADE,  -- nullable（2026-07-04〜）
  shop_id           UUID REFERENCES shops(id) ON DELETE SET NULL,       -- 追加（2026-07-04〜）
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  message           TEXT NOT NULL,
  preferred_date    TEXT,
  participant_count SMALLINT DEFAULT 1,
  status            TEXT DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT inquiries_owner_required CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)
);
```

---

### training_sessions

```sql
CREATE TABLE training_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  env          TEXT CHECK (env IN ('sea','pool','dry')),
  location     TEXT,
  notes        TEXT,
  rhr          INT,
  is_public    BOOLEAN DEFAULT false,
  share_token  UUID DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### training_dives

```sql
CREATE TABLE training_dives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  dive_number      INT,
  discipline       TEXT,  -- CWT/FIM/STA/DNF/etc.
  target_depth     NUMERIC,
  actual_depth     NUMERIC,
  dive_time        INT,   -- 秒
  surface_interval INT,   -- 秒
  result           TEXT CHECK (result IN ('ok','bo','lmc','dq')),
  notes            TEXT,
  waypoints        JSONB  -- ダイブプロファイル
);
```

---

### events

```sql
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  date         DATE NOT NULL,
  date_end     DATE,
  location     TEXT,
  aida_id      TEXT,
  disciplines  JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT false,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### event_entries

```sql
CREATE TABLE event_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id),
  name          TEXT NOT NULL,
  category      TEXT,
  registered_at TIMESTAMPTZ DEFAULT now()
);
```

---

### event_staff

```sql
CREATE TABLE event_staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('organizer','staff','readonly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

---

### reviews

> `shop_id` は元々存在（`matching_schema.sql`）。2026-07-04 に `instructor_id` の NOT NULL 制約を解除し owner-required CHECK を追加。

```sql
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,  -- nullable（2026-07-04〜）
  shop_id       UUID REFERENCES shops(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating        INT CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT reviews_owner_required CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)
);
```

---

## 3. ヘルパー関数・RPC

```sql
-- サイト管理者判定
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','staff')
  );
$$;

-- booked_count インクリメント（Webhook から呼び出し）
CREATE OR REPLACE FUNCTION increment_booked_count(p_slot_id UUID, p_count INT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE availability_slots SET booked_count = booked_count + p_count WHERE id = p_slot_id;
$$;

-- 仮予約作成（行ロックで残席チェック＋INSERTを原子化。TOCTOU対策 S6）
-- service_role 専用（anon/authenticated からの直接呼び出しは REVOKE 済み）。
-- p_shop_id は2026-07-04追加。未指定時は対象枠(availability_slots)のshop_idから自動補完し、
-- instructor_id/shop_idどちらも無い場合は OWNER_REQUIRED で例外。
CREATE OR REPLACE FUNCTION create_pending_booking(
  p_slot_id UUID, p_instructor_id UUID, p_listing_id UUID,
  p_client_name TEXT, p_client_email TEXT, p_client_phone TEXT, p_notes TEXT,
  p_rental_requests JSONB, p_participant_count SMALLINT,
  p_unit_price INTEGER, p_total_amount INTEGER, p_platform_fee INTEGER, p_instructor_payout INTEGER,
  p_shop_id UUID DEFAULT NULL
) RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  -- 1. 対象枠を FOR UPDATE でロック（同時リクエストを直列化）
  -- 2. instructor_id/shop_id は引数優先、未指定なら枠の値で補完
  -- 3. pending込みの残席チェック（SLOT_FULL）→ bookings に INSERT して返す
$$;
```

> 詳細な予約フローは [BOOKING_DESIGN.md](./BOOKING_DESIGN.md) を参照。

---

## 4. 実装ファイル

| ファイル | 内容 |
|---|---|
| `sql/matching_schema.sql` | listings / instructors / shops / inquiries / reviews 初期スキーマ |
| `sql/rls_update_20260625.sql` | RLS ポリシー一括更新スクリプト |
| `sql/shop_direct_listings_20260704.sql` | ショップ単体出品対応：`instructor_shops` 新設、listings/slots/bookings/inquiries/reviews の shop_id 追加・instructor_id nullable化、`create_pending_booking()` RPC 更新 |
| `sql/listings_prefecture_authoritative_20260705.sql` | `listings.country` 追加、`listings.prefecture` を47都道府県+海外のCHECK制約で固定、検索用インデックス追加 |
| `sql/` 以下各ファイル | テーブル作成・スキーマ変更スクリプト |
