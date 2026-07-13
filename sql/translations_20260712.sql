-- ステータス: 実行済み（2026-07-13）
-- =============================================
-- Freediving Japan — 多言語対応（i18n） translations テーブル
-- DEV.md「多言語対応（i18n）方式（2026-07-12・secretary相談で確定）」に対応する恒久スキーマ
-- UGC（インストラクター/ショップの自己紹介・コース説明・レビュー等）の
-- 自動翻訳結果（英・韓・中）を保存時キャッシュするための共通テーブル。
-- =============================================

CREATE TABLE translations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  table_name         TEXT NOT NULL,   -- 翻訳元テーブル名（例: 'instructors' / 'shops' / 'listings' / 'reviews'）
  row_id             UUID NOT NULL,   -- 翻訳元テーブルの行ID
  field_name         TEXT NOT NULL,   -- 翻訳元カラム名（例: 'bio' / 'name' / 'description'）
  lang               TEXT NOT NULL CHECK (lang IN ('en', 'ko', 'zh')),

  translated_text    TEXT,            -- 翻訳結果（未翻訳・翻訳失敗時はNULL→フロントは原文にフォールバック）
  source_hash        TEXT,            -- 翻訳時点の原文（日本語）のハッシュ。原文が変わっていなければ再翻訳をスキップする判定に使う
  is_manually_edited BOOLEAN NOT NULL DEFAULT FALSE,  -- 本人が翻訳結果を手直しした場合はTRUE。TRUEの行は自動再翻訳で上書きしない

  translated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),

  -- 同じ対象・同じフィールド・同じ言語の翻訳は1行のみ（upsertの一意キー）
  UNIQUE (table_name, row_id, field_name, lang)
);

CREATE INDEX idx_translations_lookup ON translations (table_name, row_id, lang);

-- RLS：閲覧は誰でも可（翻訳結果は公開情報）。書き込みはservice_role経由のみ
--（api/translate-content.js が SUPABASE_SERVICE_ROLE_KEY で呼び出す想定。
--   service_role はデフォルトでRLSをバイパスするため、anon/authenticated向けの
--   INSERT/UPDATE/DELETEポリシーは意図的に用意しない＝直接書き込みは常に拒否される）
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY translations_public_select ON translations
  FOR SELECT
  USING (true);
