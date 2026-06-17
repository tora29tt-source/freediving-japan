-- プロフィール・リスティング拡張カラム
-- Supabase ダッシュボード > SQL Editor で実行してください

-- instructors: 対応言語・レッスン形態
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS languages     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lesson_styles TEXT[] DEFAULT '{}';

-- listings: 設備・レンタル機材（コース単位で管理）
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS facilities  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rental_gear TEXT[] DEFAULT '{}';
