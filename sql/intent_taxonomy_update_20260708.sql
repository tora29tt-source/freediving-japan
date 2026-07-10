-- ステータス: 実行済み（2026-07-10）
-- =============================================
-- listings.intent タクソノミー変更
-- 'dive'（曖昧）を廃止し 'fundive' / 'training' / 'coaching' に分割
-- 検索ページの「もっと潜りたい」タブは3つをまとめて1グループとして扱う（コード側で対応）
--
-- 2026-07-10 修正：制約追加とデータ移行の順序が逆で、既存の'dive'行がある状態で
-- CHECK制約を追加すると 23514 (check_violation) で失敗するバグがあったため、
-- 「制約削除 → データ移行 → 制約追加」の順に並べ替えて実行した。
-- 2026-07-10：Chrome MCP経由でSupabase本番に再実行・確認済み（listings.intent集計：coaching=1件、dive=0件）。
-- =============================================

-- 1) 既存の CHECK 制約を探して削除（列定義時の無名制約でも対応できるよう動的に検索）
do $$
declare
  con text;
begin
  select conname into con
  from pg_constraint
  where conrelid = 'listings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%intent%';
  if con is not null then
    execute format('alter table listings drop constraint %I', con);
  end if;
end $$;

-- 2) 既存データの移行（'dive' だったものを内容に応じて再分類。制約を追加する前に済ませる）
update listings set intent = 'coaching' where intent = 'dive' and (title ilike '%コーチング%' or category ilike '%コーチング%');
update listings set intent = 'training' where intent = 'dive' and (title ilike '%トレーニング%' or category ilike '%トレーニング%');
update listings set intent = 'fundive'  where intent = 'dive';

-- 3) 新しい制約を追加（データ移行が終わってから）
alter table listings
  add constraint listings_intent_check
  check (intent in ('try', 'learn', 'fundive', 'training', 'coaching'));
