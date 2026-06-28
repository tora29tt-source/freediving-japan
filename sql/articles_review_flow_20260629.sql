-- ステータス: 実行済み（2026-06-29）
-- 承認フロー用カラム追加 & RLS 更新（2026-06-29）
-- =========================================

-- 1. created_by: 記事作成者を追跡（editor の権限範囲を絞るため）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. review_comment: 差し戻し理由（admin/staff → editor へのフィードバック）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- 3. status CHECK 制約を確実に設定（draft / review / published の3値）
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'review', 'published'));

-- =========================================
-- 4. admin/staff 判定ヘルパー関数
--    ※ is_site_admin() は editor も含むため、公開権限の判定には使わない
-- =========================================
CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public SET row_security = off;

-- =========================================
-- 5. RLS ポリシー更新
-- =========================================

-- UPDATE: admin/staff は全記事を変更可。editor は自分が作成した記事のみ、
--         かつ status を 'published' に変更不可・is_published を true にできない。
DROP POLICY IF EXISTS "articles_update_auth"  ON articles;
DROP POLICY IF EXISTS "articles_update_role"  ON articles;

CREATE POLICY "articles_update_role" ON articles
  FOR UPDATE
  USING (
    is_admin_or_staff()              -- admin/staff: 全記事対象
    OR auth.uid() = created_by       -- editor/一般: 自分の記事のみ
  )
  WITH CHECK (
    is_admin_or_staff()              -- admin/staff: 制限なし（公開OK）
    OR (
      auth.uid() = created_by
      AND status IN ('draft', 'review')   -- editor: published に変更不可
      AND is_published = FALSE            -- editor: 公開フラグを立てられない
    )
  );

-- DELETE: admin/staff は全削除可。editor は自分の下書きのみ。
DROP POLICY IF EXISTS "articles_delete_auth" ON articles;
DROP POLICY IF EXISTS "articles_delete_role" ON articles;

CREATE POLICY "articles_delete_role" ON articles
  FOR DELETE
  USING (
    is_admin_or_staff()
    OR (auth.uid() = created_by AND status = 'draft')
  );
