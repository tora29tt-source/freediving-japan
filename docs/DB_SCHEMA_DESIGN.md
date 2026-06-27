# DB スキーマ設計書 — Freediving Japan

> 最終更新：2026-06-28 | DB: Supabase / PostgreSQL（Project: bbhqvbpsuccbdcnhnobm / Tokyo）

---

## 1. テーブル一覧

| テーブル | 用途 | RLS |
|---|---|:---:|
| `profiles` | ユーザー基本情報（Auth のミラー） | ✅ |
| `user_roles` | サイト管理者ロール管理 | ✅ |
| `instructors` | インストラクターマスタ | ✅ |
| `shops` | ショップマスタ | ✅ |
| `listings` | 体験・コース | ✅ |
| `availability_slots` | 空き枠 | ✅ |
| `bookings` | 予約 | ✅ |
| `reviews` | レビュー | ✅ |
| `training_sessions` | トレーニングセッション | ✅ |
| `training_dives` | ダイブ記録 | ✅ |
| `events` | 大会・イベント | ✅ |
| `event_entries` | 大会エントリー（AP登録） | ✅ |
| `event_staff` | 大会スタッフ | ✅ |

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

```sql
CREATE TABLE listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id       UUID REFERENCES instructors(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  category            TEXT,  -- フリーダイビング/スキンダイビング/etc.
  intent              TEXT,  -- 体験/講習/ツアー/etc.
  area                TEXT,
  prefecture          TEXT,
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
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

---

### availability_slots

```sql
CREATE TABLE availability_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id    UUID REFERENCES instructors(id) ON DELETE CASCADE,
  listing_id       UUID REFERENCES listings(id) ON DELETE CASCADE,
  slot_date        DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  max_participants INT NOT NULL DEFAULT 1,
  booked_count     INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

---

### bookings

```sql
CREATE TABLE bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id                   UUID REFERENCES availability_slots(id),
  instructor_id             UUID REFERENCES instructors(id),
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
  updated_at                TIMESTAMPTZ DEFAULT now()
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

```sql
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating        INT CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
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
```

---

## 4. 実装ファイル

| ファイル | 内容 |
|---|---|
| `sql/rls_update_20260625.sql` | RLS ポリシー一括更新スクリプト |
| `sql/` 以下各ファイル | テーブル作成・スキーマ変更スクリプト |
