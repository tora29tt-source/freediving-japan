-- =========================================
-- listings：講習内容テンプレ項目の追加（2026-07-10）
-- 対象レベル・到達目標を構造化項目として追加
-- （1日の流れ=flow_steps・定員・持ち物等は既存カラムでテンプレ化済み）
-- =========================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS target_level text,  -- 対象レベル（pro出品フォームのプリセットから選択）
  ADD COLUMN IF NOT EXISTS goal text;          -- 到達目標（このコースでできるようになること）

COMMENT ON COLUMN listings.target_level IS '対象レベル：完全初心者OK／初心者OK／経験者向け／資格保持者向け／競技者向け';
COMMENT ON COLUMN listings.goal IS '到達目標：受講後にできるようになることの説明文';
