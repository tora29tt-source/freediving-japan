-- インストラクタープロフィール拡張カラム
-- Supabase ダッシュボード > SQL Editor で実行してください

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS languages    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lesson_styles TEXT[] DEFAULT '{}';
