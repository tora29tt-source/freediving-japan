-- ステータス: 未実行
-- =============================================
-- listings.intent タクソノミー変更
-- 'dive'（曖昧）を廃止し 'fundive' / 'training' / 'coaching' に分割
-- 検索ページの「もっと潜りたい」タブは3つをまとめて1グループとして扱う（コード側で対応）
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

-- 2) 新しい制約を追加
alter table listings
  add constraint listings_intent_check
  check (intent in ('try', 'learn', 'fundive', 'training', 'coaching'));

-- 3) 既存データの移行（'dive' だったものを内容に応じて再分類）
update listings set intent = 'coaching' where intent = 'dive' and (title ilike '%コーチング%' or category ilike '%コーチング%');
update listings set intent = 'training' where intent = 'dive' and (title ilike '%トレーニング%' or category ilike '%トレーニング%');
update listings set intent = 'fundive'  where intent = 'dive';
