-- 大会削除バグ修正 2026-07-03
-- 症状: 「大会を削除」してもエラーなく完了扱いになるのに行が消えない
-- 原因: events および関連子テーブルに DELETE ポリシーが存在せず、
--        RLS が「エラーを返さず0行削除」の挙動になっていた
-- 方針: 大会の所有者 (events.created_by = auth.uid()) またはサイト管理者に DELETE を許可

-- ========== events 本体 ==========
DROP POLICY IF EXISTS "events_delete_owner_or_admin" ON events;
CREATE POLICY "events_delete_owner_or_admin" ON events
  FOR DELETE USING (
    created_by = auth.uid()
    OR is_site_admin()
  );

-- ========== 関連子テーブル ==========
-- events を親とする行の DELETE を、その大会の所有者/管理者に許可する共通条件。
-- deleteEvent() が子テーブルを個別に delete しているため、各テーブルにも必要。

-- athlete_entries
DROP POLICY IF EXISTS "athlete_entries_delete_event_owner" ON athlete_entries;
CREATE POLICY "athlete_entries_delete_event_owner" ON athlete_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = athlete_entries.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_results
DROP POLICY IF EXISTS "event_results_delete_event_owner" ON event_results;
CREATE POLICY "event_results_delete_event_owner" ON event_results
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_results.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_schedule
DROP POLICY IF EXISTS "event_schedule_delete_event_owner" ON event_schedule;
CREATE POLICY "event_schedule_delete_event_owner" ON event_schedule
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_schedule.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_staff
DROP POLICY IF EXISTS "event_staff_delete_event_owner" ON event_staff;
CREATE POLICY "event_staff_delete_event_owner" ON event_staff
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_staff.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_shift_roles
DROP POLICY IF EXISTS "event_shift_roles_delete_event_owner" ON event_shift_roles;
CREATE POLICY "event_shift_roles_delete_event_owner" ON event_shift_roles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_shift_roles.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_staff_shifts
DROP POLICY IF EXISTS "event_staff_shifts_delete_event_owner" ON event_staff_shifts;
CREATE POLICY "event_staff_shifts_delete_event_owner" ON event_staff_shifts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_staff_shifts.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );

-- event_safety_assignments
DROP POLICY IF EXISTS "event_safety_assignments_delete_event_owner" ON event_safety_assignments;
CREATE POLICY "event_safety_assignments_delete_event_owner" ON event_safety_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_safety_assignments.event_id AND e.created_by = auth.uid())
    OR is_site_admin()
  );
