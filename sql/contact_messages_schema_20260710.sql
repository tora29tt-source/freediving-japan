-- =========================================
-- contact_messages：お問い合わせフォーム（legal/contact.html）
-- 2026-07-10 法務ページ新設に伴い作成
-- =========================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  category    text NOT NULL,            -- booking / course / listing / privacy / other
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new',  -- new / replied / closed
  deleted_at  timestamptz                -- 論理削除方針（2026-07-03）に準拠
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- 誰でも送信できる（INSERTのみ）。SELECT/UPDATEはadmin・staffのみ
DROP POLICY IF EXISTS "contact_insert_public" ON contact_messages;
CREATE POLICY "contact_insert_public" ON contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 100
    AND char_length(email) BETWEEN 3 AND 200
    AND char_length(message) BETWEEN 1 AND 4000
    AND category IN ('booking','course','listing','privacy','other')
  );

DROP POLICY IF EXISTS "contact_select_admin" ON contact_messages;
CREATE POLICY "contact_select_admin" ON contact_messages
  FOR SELECT TO authenticated
  USING (is_admin_or_staff());

DROP POLICY IF EXISTS "contact_update_admin" ON contact_messages;
CREATE POLICY "contact_update_admin" ON contact_messages
  FOR UPDATE TO authenticated
  USING (is_admin_or_staff());

-- 論理削除の非表示（RESTRICTIVE）
DROP POLICY IF EXISTS "contact_hide_deleted" ON contact_messages;
CREATE POLICY "contact_hide_deleted" ON contact_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
