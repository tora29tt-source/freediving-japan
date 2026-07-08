-- ステータス: 未実行（Supabase SQL Editor で実行してください）
-- ソフトデリート実行不可バグ修正 2026-07-07
--
-- 症状: admin/index.html でインストラクター（【テスト】寺嶋 等）を削除しようとすると
--   「削除できませんでした: new row violates row-level security policy
--    "instructors_hide_deleted" for table "instructors"」
--
-- 原因: soft_delete_20260703.sql で追加した「論理削除済み行を隠す」RESTRICTIVE SELECT
--   ポリシー（deleted_at is null のみ許可）が、UPDATE で deleted_at をセットした
--   「更新後の行」に対しても評価される。更新後の行は deleted_at が非nullになるため
--   このポリシーに落ち、UPDATE 自体が「new row violates row-level security policy」
--   としてエラーになっていた。管理者が明示的に論理削除する操作でも、
--   結果的に自分の書いた行を自分で見られなくなるため弾かれる、という状態。
--
-- 方針: 「hide_deleted」ポリシーに “サイト管理者は論理削除済み行も見える” の例外を追加する。
--   これにより (1) 管理者による論理削除 UPDATE がブロックされなくなる
--        (2) 将来「ゴミ箱・復元」機能を作る際、管理者は削除済み行を検索・復元できるようになる
--   の両方が同時に解決する。一般ユーザー・未ログインには従来通り deleted_at is null のみ見える。

drop policy if exists "events_hide_deleted" on events;
create policy "events_hide_deleted" on events
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "articles_hide_deleted" on articles;
create policy "articles_hide_deleted" on articles
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "listings_hide_deleted" on listings;
create policy "listings_hide_deleted" on listings
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "instructors_hide_deleted" on instructors;
create policy "instructors_hide_deleted" on instructors
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "event_staff_hide_deleted" on event_staff;
create policy "event_staff_hide_deleted" on event_staff
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "event_shift_roles_hide_deleted" on event_shift_roles;
create policy "event_shift_roles_hide_deleted" on event_shift_roles
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "athlete_entries_hide_deleted" on athlete_entries;
create policy "athlete_entries_hide_deleted" on athlete_entries
  as restrictive for select using (deleted_at is null or is_site_admin());

drop policy if exists "availability_slots_hide_deleted" on availability_slots;
create policy "availability_slots_hide_deleted" on availability_slots
  as restrictive for select using (deleted_at is null or is_site_admin());
