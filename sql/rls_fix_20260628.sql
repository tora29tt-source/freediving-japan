-- ============================================================
-- RLS バグ修正
-- 2026-06-28
-- Bug #1 #2: bookings — 全ログイン済みユーザーが全件閲覧・更新できる問題
-- Bug #4:    availability_slots — 認証済みなら誰でも書き込める問題
-- ============================================================

-- ヘルパー関数（既存の is_site_admin を使用）
-- ※ rls_update_20260625.sql で作成済みのため再作成不要
--   ただし未作成の場合に備え CREATE OR REPLACE で冪等に実行
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
-- bookings: Bug #1 — SELECT を全認証ユーザーに開放していた問題
-- ============================================================

-- 旧ポリシーを削除
DROP POLICY IF EXISTS "bookings_select_auth" ON bookings;

-- インストラクター本人 or 管理者のみ閲覧可
CREATE POLICY "bookings_select_instructor_or_admin" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = bookings.instructor_id
        AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- ============================================================
-- bookings: Bug #2 — UPDATE を全認証ユーザーに開放していた問題
-- ============================================================

DROP POLICY IF EXISTS "bookings_update_auth" ON bookings;

-- インストラクター本人 or 管理者のみ更新可
CREATE POLICY "bookings_update_instructor_or_admin" ON bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = bookings.instructor_id
        AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- DELETE も管理者のみに制限（既存ポリシーが残っている場合に備え）
DROP POLICY IF EXISTS "bookings_delete_auth" ON bookings;
CREATE POLICY "bookings_delete_admin" ON bookings
  FOR DELETE USING (is_site_admin());

-- ============================================================
-- availability_slots: Bug #4 — 認証済みなら誰でも書き込める問題
-- ============================================================

-- INSERT: インストラクター本人（approved）または管理者のみ
DROP POLICY IF EXISTS "slots_insert_auth" ON availability_slots;
CREATE POLICY "slots_insert_instructor" ON availability_slots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = availability_slots.instructor_id
        AND i.user_id = auth.uid()
        AND i.status = 'approved'
    )
    OR is_site_admin()
  );

-- UPDATE: インストラクター本人または管理者のみ
DROP POLICY IF EXISTS "slots_update_auth" ON availability_slots;
CREATE POLICY "slots_update_instructor" ON availability_slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = availability_slots.instructor_id
        AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- DELETE: インストラクター本人または管理者のみ
DROP POLICY IF EXISTS "slots_delete_auth" ON availability_slots;
CREATE POLICY "slots_delete_instructor" ON availability_slots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = availability_slots.instructor_id
        AND i.user_id = auth.uid()
    )
    OR is_site_admin()
  );

-- ============================================================
-- 確認クエリ（実行後に現在のポリシー一覧を確認できる）
-- ============================================================
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('bookings', 'availability_slots')
-- ORDER BY tablename, policyname;
