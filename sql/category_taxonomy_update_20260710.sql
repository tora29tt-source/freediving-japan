-- ステータス: 実行済み（2026-07-10）
-- =============================================
-- listings.category タクソノミー変更（2026-07-10・secretary相談で確定）
-- 旧6値（フリーダイビング体験/スキンダイビング体験/スクール・資格取得/
--        トレーニング・アスリート向け/ツアー・ガイド/その他）は
-- 「種目」と「目的」が混在しており、ホーム3ピラー（シュノーケル/スキン/フリー）の
-- シュノーケルに対応する値が存在しなかった。
-- category を「ダイビング種別」専用の4値（シュノーケリング/スキンダイビング/フリーダイビング/その他）に統一する。
-- 種目軸(category) × 目的軸(intent: try/learn/fundive/training/coaching) の組み合わせで表現する。
-- =============================================

-- 1) 既存データの移行（新CHECK制約を追加する前に実行。タイトルキーワードによる推測移行のため、
--    実行後は admin 画面で目視確認推奨）

-- シュノーケルキーワードを含むもの → シュノーケリング
update listings set category = 'シュノーケリング'
  where category not in ('シュノーケリング','スキンダイビング','フリーダイビング','その他')
  and title ilike '%シュノーケル%';

-- スキン系（旧「スキンダイビング体験」またはタイトルにスキン含む）→ スキンダイビング
update listings set category = 'スキンダイビング'
  where category not in ('シュノーケリング','スキンダイビング','フリーダイビング','その他')
  and (category = 'スキンダイビング体験' or title ilike '%スキン%');

-- 旧「フリーダイビング体験」、フリー系キーワード、および種目不明だった
-- スクール・資格取得/トレーニング・アスリート向け/ツアー・ガイド のデフォルト行き先 → フリーダイビング
update listings set category = 'フリーダイビング'
  where category not in ('シュノーケリング','スキンダイビング','フリーダイビング','その他')
  and (
    category in ('フリーダイビング体験','スクール・資格取得','トレーニング・アスリート向け','ツアー・ガイド')
    or title ilike '%フリーダイビング%' or title ilike '%デプス%'
    or title ilike '%CWT%' or title ilike '%CNF%' or title ilike '%STA%' or title ilike '%DYN%'
  );

-- 残り（旧「その他」およびどれにも該当しなかったもの）→ その他
update listings set category = 'その他'
  where category not in ('シュノーケリング','スキンダイビング','フリーダイビング','その他');

-- 2) 既存の CHECK 制約があれば削除（動的検索。現状は無名/未設定の可能性が高いが念のため）
do $$
declare
  con text;
begin
  select conname into con
  from pg_constraint
  where conrelid = 'listings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if con is not null then
    execute format('alter table listings drop constraint %I', con);
  end if;
end $$;

-- 3) 新しい CHECK 制約を追加
alter table listings
  add constraint listings_category_check
  check (category in ('シュノーケリング','スキンダイビング','フリーダイビング','その他'));
