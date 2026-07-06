-- ステータス: 実行済み（2026-07-04）
-- ============================================================
-- ショップ単体での商品出品 対応
-- 2026-07-04
--
-- 背景（secretary相談で確定）：
-- 従来は listings / availability_slots / bookings / inquiries が
-- instructor_id 必須（NOT NULL）で、必ず個人インストラクター単位の
-- 商品・予約という前提だった。
--
-- 実態：
-- - ショップは「担当者未定」でも商品を出せる（ショップ名義で完結してよい）
-- - インストラクターは複数ショップに同時に所属できる
--   （例：夏はVolcano Cup、冬は流氷フリーダイビング）
-- - ショップ名義の商品に「参考としての担当インストラクター」を
--   紐づけたいこともある（両方セット可）
--
-- 対応：
-- 1. instructor_shops（新規・N:M中間テーブル）でインストラクターと
--    ショップの所属関係を管理（同時に複数所属可）
-- 2. listings / availability_slots / bookings / inquiries の
--    instructor_id を nullable にし、shop_id を追加。
--    CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL) で
--    「どちらか必須」を担保
-- 3. reviews は既に shop_id を持っているため instructor_id の
--    NOT NULL 制約解除 + CHECK 追加のみ
-- 4. 上記に伴い RLS ポリシーへショップオーナーのアクセス経路を追加
-- 5. create_pending_booking() RPC に p_shop_id を追加
--
-- 注意：
-- - 個人インストラクターが「自分をショップとして登録する」従来の運用は
--   不要になるが、既存データはそのままで問題ない（併用可）
-- - shops テーブルはまだソフトデリート対象外（deleted_at なし）。
--   ショップを物理削除すると、そのショップ専有の listings/slots/bookings/inquiries
--   は shop_id が SET NULL され、instructor_id も無ければ
--   CHECK 制約違反でショップ削除自体が失敗する（＝安全弁として機能する想定）。
--   本格的な運用に入る前に shops のソフトデリート対応は別途検討する。
-- ============================================================

-- ============================================================
-- ① instructor_shops — インストラクター所属（N:M・複数同時可）
-- ============================================================

CREATE TABLE instructor_shops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (instructor_id, shop_id)
);

CREATE INDEX idx_instructor_shops_instructor ON instructor_shops(instructor_id);
CREATE INDEX idx_instructor_shops_shop       ON instructor_shops(shop_id);

ALTER TABLE instructor_shops ENABLE ROW LEVEL SECURITY;

-- 所属関係は公開情報（ショップの「所属インストラクター」表示に使うため）
CREATE POLICY "instructor_shops_select_public" ON instructor_shops
  FOR SELECT USING (TRUE);

-- 追加はショップオーナー or 本人インストラクター or 管理者
CREATE POLICY "instructor_shops_insert_own" ON instructor_shops
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );

-- 削除も同様
CREATE POLICY "instructor_shops_delete_own" ON instructor_shops
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );

-- ============================================================
-- ② listings — shop_id 追加 + instructor_id を任意化
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE listings
  ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE listings
  ADD CONSTRAINT listings_owner_required
  CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_listings_shop ON listings(shop_id);

DROP POLICY IF EXISTS "listings_select_public" ON listings;
CREATE POLICY "listings_select_public" ON listings
  FOR SELECT USING (
    is_public = TRUE
    OR EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "listings_insert_own" ON listings;
CREATE POLICY "listings_insert_own" ON listings
  FOR INSERT WITH CHECK (
    (
      instructor_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM instructors i
        WHERE i.id = instructor_id AND i.user_id = auth.uid() AND i.status = 'approved'
      )
    )
    OR (
      shop_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    )
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "listings_update_own" ON listings;
CREATE POLICY "listings_update_own" ON listings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "listings_delete_own" ON listings;
CREATE POLICY "listings_delete_own" ON listings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

-- ============================================================
-- ③ availability_slots — shop_id 追加 + instructor_id を任意化
-- ============================================================

ALTER TABLE availability_slots
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE availability_slots
  ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE availability_slots
  ADD CONSTRAINT slots_owner_required
  CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_slots_shop ON availability_slots(shop_id, slot_date);

-- 現状(rls_fix_20260628時点)の最新ポリシー名を置き換える
DROP POLICY IF EXISTS "slots_insert_instructor" ON availability_slots;
CREATE POLICY "slots_insert_owner" ON availability_slots
  FOR INSERT WITH CHECK (
    (
      instructor_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM instructors i
        WHERE i.id = instructor_id AND i.user_id = auth.uid() AND i.status = 'approved'
      )
    )
    OR (
      shop_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    )
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "slots_update_instructor" ON availability_slots;
CREATE POLICY "slots_update_owner" ON availability_slots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "slots_delete_instructor" ON availability_slots;
CREATE POLICY "slots_delete_owner" ON availability_slots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

-- ============================================================
-- ④ bookings — shop_id 追加 + instructor_id を任意化
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE bookings
  ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_owner_required
  CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_bookings_shop ON bookings(shop_id, created_at DESC);

-- 現状(rls_fix_20260628時点)の最新ポリシー名を置き換える
-- ※ bookings_insert_anon は security_fix_20260704.sql (S1) で既に削除済み。
--   予約作成は create_pending_booking() RPC 経由に一本化されているため、
--   INSERT ポリシーはここでは復活させない。
DROP POLICY IF EXISTS "bookings_select_instructor_or_admin" ON bookings;
CREATE POLICY "bookings_select_owner_or_admin" ON bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "bookings_update_instructor_or_admin" ON bookings;
CREATE POLICY "bookings_update_owner_or_admin" ON bookings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

-- bookings_delete_admin（管理者のみ削除可）は変更なし

-- ============================================================
-- ⑤ inquiries — shop_id 追加 + instructor_id を任意化
-- ============================================================

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE inquiries
  ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_owner_required
  CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_inquiries_shop ON inquiries(shop_id, created_at DESC);

-- inquiries_insert_anyone（誰でも問い合わせ送信可）は変更なし
DROP POLICY IF EXISTS "inquiries_select_own_instructor" ON inquiries;
CREATE POLICY "inquiries_select_own" ON inquiries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "inquiries_update_own_instructor" ON inquiries;
CREATE POLICY "inquiries_update_own" ON inquiries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR is_site_admin()
  );

-- ============================================================
-- ⑥ reviews — instructor_id を任意化（shop_id は既存カラム）
-- ============================================================

ALTER TABLE reviews
  ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_owner_required
  CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL);

-- ============================================================
-- ⑦ create_pending_booking() RPC 更新 — p_shop_id 追加
--    引数を増やすため一度 DROP してから再作成する。
--    p_shop_id を末尾に DEFAULT NULL で追加しているので、
--    既存の呼び出し側（api/create-checkout-session.js）は
--    変更なしでも動作する（内部で slot.shop_id から補完する）。
-- ============================================================

DROP FUNCTION IF EXISTS create_pending_booking(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, SMALLINT, INTEGER, INTEGER, INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION create_pending_booking(
  p_slot_id           UUID,
  p_instructor_id     UUID,
  p_listing_id        UUID,
  p_client_name       TEXT,
  p_client_email      TEXT,
  p_client_phone      TEXT,
  p_notes             TEXT,
  p_rental_requests   JSONB,
  p_participant_count SMALLINT,
  p_unit_price        INTEGER,
  p_total_amount      INTEGER,
  p_platform_fee      INTEGER,
  p_instructor_payout INTEGER,
  p_shop_id           UUID DEFAULT NULL
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot           availability_slots%ROWTYPE;
  v_pending        INTEGER;
  v_remaining      INTEGER;
  v_booking        bookings%ROWTYPE;
  v_instructor_id  UUID;
  v_shop_id        UUID;
BEGIN
  -- 対象枠を行ロック。同時リクエストはここで直列化されるためTOCTOUが発生しない
  SELECT * INTO v_slot FROM availability_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  IF NOT v_slot.is_active THEN
    RAISE EXCEPTION 'SLOT_INACTIVE';
  END IF;

  -- instructor_id / shop_id は呼び出し側の指定を優先し、
  -- 未指定なら枠(availability_slots)の値で補完する
  -- （ショップ名義・担当者未定の枠でも予約を作れるようにするため）
  v_instructor_id := COALESCE(p_instructor_id, v_slot.instructor_id);
  v_shop_id       := COALESCE(p_shop_id, v_slot.shop_id);

  IF v_instructor_id IS NULL AND v_shop_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_REQUIRED';
  END IF;

  SELECT COALESCE(SUM(participant_count), 0) INTO v_pending
  FROM bookings
  WHERE slot_id = p_slot_id AND status = 'pending';

  v_remaining := v_slot.max_participants - v_slot.booked_count - v_pending;

  IF p_participant_count > v_remaining THEN
    RAISE EXCEPTION 'SLOT_FULL:%', v_remaining;
  END IF;

  INSERT INTO bookings (
    slot_id, instructor_id, shop_id, listing_id,
    client_name, client_email, client_phone,
    notes, rental_requests, participant_count,
    unit_price, total_amount, platform_fee, instructor_payout,
    status
  ) VALUES (
    p_slot_id, v_instructor_id, v_shop_id, p_listing_id,
    p_client_name, p_client_email, p_client_phone,
    p_notes, p_rental_requests, p_participant_count,
    p_unit_price, p_total_amount, p_platform_fee, p_instructor_payout,
    'pending'
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- サーバーAPI（service_role）のみ実行可。anon/authenticatedからの直接呼び出しは禁止
REVOKE ALL ON FUNCTION create_pending_booking(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, SMALLINT, INTEGER, INTEGER, INTEGER, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_pending_booking(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, SMALLINT, INTEGER, INTEGER, INTEGER, INTEGER, UUID
) TO service_role;
