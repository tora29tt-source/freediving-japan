-- ステータス: 実行済み（2026-07-11・ユーザーがSupabase SQL Editorで実行）
-- 2026-07-11: インストラクター用カバー画像（バナー）機能追加用カラム
-- 出典: koyoさんのプロフィール確認をきっかけに「インストラクター画面にバナーはあるが登録場所がない」ことが判明し、
--       shops.cover_url / shops.cover_position（sql/shops_cover_position_20260705.sql）と同様の仕組みをinstructorsにも追加

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT '50% 50%';
