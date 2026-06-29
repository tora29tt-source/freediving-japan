-- ステータス: 実行済み（2026-06-29）
-- 目的: training_sessions に buddy / photo_urls カラム追加

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS buddy      TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN training_sessions.buddy      IS 'バディ名（フリーテキスト）';
COMMENT ON COLUMN training_sessions.photo_urls IS '写真URLの配列（Supabase Storage public URL）';
