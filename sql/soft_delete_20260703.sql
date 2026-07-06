-- ステータス: 実行済み（2026-07-03）
-- サイト全体 論理削除（ソフトデリート）導入 2026-07-03
-- 方針: ユーザー操作による「削除」はデータを物理削除せず deleted_at を立てて非表示化する。
--       内部の「全消し→入れ直し」系 delete と user_roles（権限剥奪）は物理削除のまま。
-- 対象: events, articles, listings, instructors, event_staff, event_shift_roles,
--       athlete_entries, availability_slots

-- ============================================================
-- 1) deleted_at カラム追加
-- ============================================================
alter table events             add column if not exists deleted_at timestamptz;
alter table articles           add column if not exists deleted_at timestamptz;
alter table listings           add column if not exists deleted_at timestamptz;
alter table instructors        add column if not exists deleted_at timestamptz;
alter table event_staff        add column if not exists deleted_at timestamptz;
alter table event_shift_roles  add column if not exists deleted_at timestamptz;
alter table athlete_entries    add column if not exists deleted_at timestamptz;
alter table availability_slots add column if not exists deleted_at timestamptz;

-- ============================================================
-- 2) 論理削除行を隠す RESTRICTIVE SELECT ポリシー
--    既存の許可(PERMISSIVE)ポリシーに AND されるため、
--    既存ポリシーを書き換えずに「deleted_at IS NULL の行だけ見える」を強制できる。
-- ============================================================
drop policy if exists "events_hide_deleted" on events;
create policy "events_hide_deleted" on events
  as restrictive for select using (deleted_at is null);

drop policy if exists "articles_hide_deleted" on articles;
create policy "articles_hide_deleted" on articles
  as restrictive for select using (deleted_at is null);

drop policy if exists "listings_hide_deleted" on listings;
create policy "listings_hide_deleted" on listings
  as restrictive for select using (deleted_at is null);

drop policy if exists "instructors_hide_deleted" on instructors;
create policy "instructors_hide_deleted" on instructors
  as restrictive for select using (deleted_at is null);

drop policy if exists "event_staff_hide_deleted" on event_staff;
create policy "event_staff_hide_deleted" on event_staff
  as restrictive for select using (deleted_at is null);

drop policy if exists "event_shift_roles_hide_deleted" on event_shift_roles;
create policy "event_shift_roles_hide_deleted" on event_shift_roles
  as restrictive for select using (deleted_at is null);

drop policy if exists "athlete_entries_hide_deleted" on athlete_entries;
create policy "athlete_entries_hide_deleted" on athlete_entries
  as restrictive for select using (deleted_at is null);

drop policy if exists "availability_slots_hide_deleted" on availability_slots;
create policy "availability_slots_hide_deleted" on availability_slots
  as restrictive for select using (deleted_at is null);

-- ============================================================
-- 3) 非PKユニーク制約を「論理削除行を除外する部分ユニークインデックス」に置換
--    ※ 論理削除済みの行が slug / aida_id を占有して再作成をブロックしないように。
-- ============================================================
-- articles.slug
alter table articles drop constraint if exists articles_slug_key;
drop index if exists articles_slug_key;
create unique index if not exists articles_slug_active_key
  on articles (slug) where deleted_at is null;

-- events.aida_id
alter table events drop constraint if exists events_aida_id_key;
drop index if exists events_aida_id_key;
create unique index if not exists events_aida_id_active_key
  on events (aida_id) where deleted_at is null;

-- ============================================================
-- 4) 一覧絞り込み用インデックス（任意・性能向上）
-- ============================================================
create index if not exists events_deleted_at_idx   on events (deleted_at);
create index if not exists articles_deleted_at_idx  on articles (deleted_at);
create index if not exists listings_deleted_at_idx  on listings (deleted_at);
