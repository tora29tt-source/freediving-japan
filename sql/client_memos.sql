-- ============================================================
-- client_memos テーブル
-- インストラクターがクライアントごとにメモを残すためのテーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS client_memos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  guest_email    text NOT NULL,
  memo           text,
  updated_at     timestamptz DEFAULT now()
);

-- 同一インストラクター×メールの組み合わせはユニーク
CREATE UNIQUE INDEX IF NOT EXISTS client_memos_unique
  ON client_memos (instructor_id, guest_email);

-- RLS
ALTER TABLE client_memos ENABLE ROW LEVEL SECURITY;

-- インストラクター本人のみ読み書き可
CREATE POLICY "instructor can manage own memos"
  ON client_memos
  FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE user_id = auth.uid()
    )
  );
