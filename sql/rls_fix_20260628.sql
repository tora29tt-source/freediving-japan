-- RLS バグ修正 2026-06-28
-- Bug #1 #2: bookings SELECT/UPDATE を全認証ユーザーに開放していた問題
-- Bug #4: availability_slots を認証済みなら誰でも書き込める問題

DROP POLICY IF EXISTS "bookings_select_instructor_or_admin" ON bookings;
DROP POLICY IF EXISTS "bookings_update_instructor_or_admin" ON bookings;
DROP POLICY IF EXISTS "bookings_delete_admin" ON bookings;
DROP POLICY IF EXISTS "bookings_select_auth" ON bookings;
DROP POLICY IF EXISTS "bookings_update_auth" ON bookings;
DROP POLICY IF EXISTS "bookings_delete_auth" ON bookings;

CREATE POLICY "bookings_select_instructor_or_admin" ON bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = bookings.instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );
CREATE POLICY "bookings_update_instructor_or_admin" ON bookings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = bookings.instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );
CREATE POLICY "bookings_delete_admin" ON bookings
  FOR DELETE USING (is_site_admin());

DROP POLICY IF EXISTS "slots_insert_instructor" ON availability_slots;
DROP POLICY IF EXISTS "slots_update_instructor" ON availability_slots;
DROP POLICY IF EXISTS "slots_delete_instructor" ON availability_slots;
DROP POLICY IF EXISTS "slots_insert_auth" ON availability_slots;
DROP POLICY IF EXISTS "slots_update_auth" ON availability_slots;
DROP POLICY IF EXISTS "slots_delete_auth" ON availability_slots;

CREATE POLICY "slots_insert_instructor" ON availability_slots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = availability_slots.instructor_id AND i.user_id = auth.uid() AND i.status = 'approved')
    OR is_site_admin()
  );
CREATE POLICY "slots_update_instructor" ON availability_slots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = availability_slots.instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );
CREATE POLICY "slots_delete_instructor" ON availability_slots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM instructors i WHERE i.id = availability_slots.instructor_id AND i.user_id = auth.uid())
    OR is_site_admin()
  );
