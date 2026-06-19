-- =============================================
-- Freediving Japan — Availability & Bookings Schema
-- =============================================

-- インストラクターが登録する空き枠
CREATE TABLE availability_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id    UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  listing_id       UUID REFERENCES listings(id) ON DELETE CASCADE,

  slot_date        DATE NOT NULL,
  start_time       TIME NOT NULL,          -- 例: '09:00'
  end_time         TIME NOT NULL,          -- 例: '12:00'

  max_participants SMALLINT NOT NULL DEFAULT 4,
  booked_count     SMALLINT NOT NULL DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slots_instructor  ON availability_slots(instructor_id, slot_date);
CREATE INDEX idx_slots_listing     ON availability_slots(listing_id, slot_date);
CREATE INDEX idx_slots_date_active ON availability_slots(slot_date, is_active);

-- RLS
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- 誰でも空き枠を閲覧できる
CREATE POLICY "slots_select_all" ON availability_slots
  FOR SELECT USING (is_active = TRUE);

-- 認証済みユーザー（管理者）のみ書き込み可
CREATE POLICY "slots_insert_auth" ON availability_slots
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "slots_update_auth" ON availability_slots
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "slots_delete_auth" ON availability_slots
  FOR DELETE USING (auth.role() = 'authenticated');


-- =============================================
-- 予約テーブル
-- =============================================

CREATE TABLE bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id                  UUID REFERENCES availability_slots(id) ON DELETE SET NULL,
  instructor_id            UUID NOT NULL REFERENCES instructors(id),
  listing_id               UUID REFERENCES listings(id),

  -- クライアント情報
  client_name              TEXT NOT NULL,
  client_email             TEXT NOT NULL,
  client_phone             TEXT,
  participant_count        SMALLINT NOT NULL DEFAULT 1,

  -- 金額（円）
  unit_price               INTEGER NOT NULL,
  total_amount             INTEGER NOT NULL,
  platform_fee             INTEGER,         -- 手数料（運営取り分）
  instructor_payout        INTEGER,         -- インストラクター受取額

  -- Stripe
  stripe_session_id        TEXT UNIQUE,
  stripe_payment_intent_id TEXT,

  -- ステータス
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','paid','confirmed','cancelled','refunded')),

  notes                    TEXT,            -- 予約者からの備考
  admin_notes              TEXT,            -- 運営メモ

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_instructor ON bookings(instructor_id, created_at DESC);
CREATE INDEX idx_bookings_slot       ON bookings(slot_id);
CREATE INDEX idx_bookings_email      ON bookings(client_email);
CREATE INDEX idx_bookings_status     ON bookings(status);
CREATE INDEX idx_bookings_stripe     ON bookings(stripe_session_id);

-- RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザー（管理者）は全件閲覧可
CREATE POLICY "bookings_select_auth" ON bookings
  FOR SELECT USING (auth.role() = 'authenticated');

-- 誰でも予約を作成できる（フロントから INSERT）
CREATE POLICY "bookings_insert_anon" ON bookings
  FOR INSERT WITH CHECK (TRUE);

-- 認証済みユーザーのみ更新・削除可
CREATE POLICY "bookings_update_auth" ON bookings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "bookings_delete_auth" ON bookings
  FOR DELETE USING (auth.role() = 'authenticated');


-- =============================================
-- サンプル空き枠データ（開発用）
-- ※ instructor_id は実際のUUIDに差し替えてください
-- =============================================

-- =============================================
-- RPC: booked_count をインクリメント（webhook用）
-- =============================================

CREATE OR REPLACE FUNCTION increment_booked_count(p_slot_id UUID, p_count SMALLINT)
RETURNS VOID AS $$
  UPDATE availability_slots
  SET booked_count = booked_count + p_count,
      updated_at   = NOW()
  WHERE id = p_slot_id;
$$ LANGUAGE SQL SECURITY DEFINER;


-- =============================================
-- サンプル空き枠データ（開発用）
-- =============================================

-- INSERT INTO availability_slots (instructor_id, listing_id, slot_date, start_time, end_time, max_participants)
-- VALUES
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 3,  '09:00', '12:00', 4),
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 3,  '14:00', '17:00', 4),
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 5,  '09:00', '12:00', 4),
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 7,  '10:00', '13:00', 2),
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 10, '09:00', '12:00', 4),
--   ('YOUR_INSTRUCTOR_UUID', 'YOUR_LISTING_UUID', CURRENT_DATE + 14, '09:00', '12:00', 4);
