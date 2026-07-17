-- ステータス: 実行済み（2026-07-17・Supabase本番に適用・実機再生確認済み）
-- =============================================
-- /learn/ 動画配信 + 視聴進捗：不足カラム追加 + course_progress 新設
-- 2026-07-17・course.html / video-progress.js / admin(course editor) が
-- 参照しているのに本番DBに未反映のカラム・テーブルをまとめて適用する。
--
-- 背景：
--  - 2026-07-16 の動画配信基盤（R2+HLS）実装で courses.preview_video_url /
--    course_chapters.video_path を使うようになったが SQL 未適用。
--  - 同日の /learn/ 改修で course_chapters.hook（つかみ文）と
--    視聴進捗テーブル course_progress を追加したが SQL 未適用。
--  何度流しても安全なよう IF NOT EXISTS / DROP POLICY IF EXISTS を使用。
-- =============================================

-- 1) courses：サマリー動画URL
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT;

-- 2) course_chapters：HLS再生パス（例 'mimi-nuki-nyumon/chapter-1/index.m3u8'）と つかみ文
ALTER TABLE course_chapters
  ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE course_chapters
  ADD COLUMN IF NOT EXISTS hook TEXT;

-- 3) course_progress（視聴進捗）
--    video-progress.js が onConflict:'user_id,chapter_id' で upsert するため
--    UNIQUE(user_id, chapter_id) が必須。
CREATE TABLE IF NOT EXISTS course_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES course_chapters(id) ON DELETE CASCADE,
  position_seconds  INTEGER NOT NULL DEFAULT 0,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user        ON course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_course ON course_progress(user_id, course_id);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

-- 本人のみ全操作可。管理者は閲覧のみ許可（進捗の書き換えはしない想定）。
DROP POLICY IF EXISTS "progress_select_own" ON course_progress;
CREATE POLICY "progress_select_own" ON course_progress
  FOR SELECT USING (auth.uid() = user_id OR is_site_admin());

DROP POLICY IF EXISTS "progress_insert_own" ON course_progress;
CREATE POLICY "progress_insert_own" ON course_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_update_own" ON course_progress;
CREATE POLICY "progress_update_own" ON course_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_delete_own" ON course_progress;
CREATE POLICY "progress_delete_own" ON course_progress
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 注意：hook（つかみ文）のデータ INSERT はこのファイルに含めていません。
--   現状チャプターは「第N回（仮）」のプレースホルダで、hook文もこうようさんとの
--   構成打ち合わせ後に確定する方針のため、仮コピーの投入は行いません。
--   確定後に course_chapters.hook を UPDATE してください。
-- =============================================
