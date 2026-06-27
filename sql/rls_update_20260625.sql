-- ============================================================
-- RLS 差分アップデート
-- 2026-06-25
-- 既存ポリシーの穴を塞ぐ修正
-- ============================================================

-- ============================================================
-- ① ヘルパー関数: サイト管理者チェック
--    user_roles に admin / staff / editor があれば true
--    SECURITY DEFINER で RLS をバイパスして user_roles を読む
-- ============================================================
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'editor')
  );
$$;

-- ============================================================
-- ② instructors — pending インストラクターの公開漏れを修正
-- ============================================================

-- 既存の公開ポリシーを削除して再作成
DROP POLICY IF EXISTS "instructors_select_public" ON instructors;

-- 公開: approved + is_public のみ
CREATE POLICY "instructors_select_public" ON instructors
  FOR SELECT USING (
    status = 'approved' AND is_public = TRUE
  );

-- 本人は自分のレコードを常に閲覧可
DROP POLICY IF EXISTS "instructors_select_own" ON instructors;
CREATE POLICY "instructors_select_own" ON instructors
  FOR SELECT USING (auth.uid() = user_id);

-- 管理者は全件閲覧・更新可
DROP POLICY IF EXISTS "instructors_select_admin" ON instructors;
CREATE POLICY "instructors_select_admin" ON instructors
  FOR SELECT USING (is_site_admin());

DROP POLICY IF EXISTS "instructors_update_admin" ON instructors;
CREATE POLICY "instructors_update_admin" ON instructors
  FOR UPDATE USING (is_site_admin());

-- listings も approved インストラクターのみ作成可（既存の insert ポリシーを更新）
DROP POLICY IF EXISTS "listings_insert_own" ON listings;
CREATE POLICY "listings_insert_own" ON listings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id
        AND i.user_id = auth.uid()
        AND i.status = 'approved'
    )
    OR is_site_admin()
  );

-- ============================================================
-- ③ bookings — 全ログイン済みユーザーが全件見える問題を修正
-- ============================================================

DROP POLICY IF EXISTS "bookings_select_auth" ON bookings;

-- インストラクター本人 or 管理者のみ閲覧可
CREATE POLICY "bookings_select_instructor_or_admin" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- 管理者は更新・削除可
DROP POLICY IF EXISTS "bookings_update_auth" ON bookings;
CREATE POLICY "bookings_update_admin" ON bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "bookings_delete_auth" ON bookings;
CREATE POLICY "bookings_delete_admin" ON bookings
  FOR DELETE USING (is_site_admin());

-- ============================================================
-- ④ availability_slots — 任意ログイン済みユーザーが書き込める問題を修正
-- ============================================================

DROP POLICY IF EXISTS "slots_insert_auth" ON availability_slots;
CREATE POLICY "slots_insert_instructor" ON availability_slots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id
        AND i.user_id = auth.uid()
        AND i.status = 'approved'
    )
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "slots_update_auth" ON availability_slots;
CREATE POLICY "slots_update_instructor" ON availability_slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

DROP POLICY IF EXISTS "slots_delete_auth" ON availability_slots;
CREATE POLICY "slots_delete_instructor" ON availability_slots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- ============================================================
-- ⑤ user_roles — RLS 未設定を修正（管理者のみ操作可）
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 管理者は全操作可
CREATE POLICY "user_roles_admin_all" ON user_roles
  FOR ALL USING (is_site_admin());

-- ============================================================
-- ⑥ shops / listings の管理者バイパスを追加
-- ============================================================

-- shops: 管理者が全件読める
DROP POLICY IF EXISTS "shops_select_admin" ON shops;
CREATE POLICY "shops_select_admin" ON shops
  FOR SELECT USING (is_site_admin());

DROP POLICY IF EXISTS "shops_update_admin" ON shops;
CREATE POLICY "shops_update_admin" ON shops
  FOR UPDATE USING (is_site_admin());

-- listings: 管理者が全件読める
DROP POLICY IF EXISTS "listings_select_admin" ON listings;
CREATE POLICY "listings_select_admin" ON listings
  FOR SELECT USING (is_site_admin());

DROP POLICY IF EXISTS "listings_update_admin" ON listings;
CREATE POLICY "listings_update_admin" ON listings
  FOR UPDATE USING (is_site_admin());

DROP POLICY IF EXISTS "listings_delete_admin" ON listings;
CREATE POLICY "listings_delete_admin" ON listings
  FOR DELETE USING (is_site_admin());
