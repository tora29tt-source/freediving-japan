-- ステータス: 実行済み（2026-07-06・Chrome MCP経由でSupabase本番に適用・カラム存在確認済み）
-- 2026-07-05: ショップカバー画像の表示位置調整機能（pro/index.html）用カラム
-- 出典: DEV.md「ショップ／インストラクター出品モデル」2026-07-05追記

ALTER TABLE shops ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT '50% 50%';
