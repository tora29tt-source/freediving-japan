-- ステータス: 実行済み（日付不明・DEV.md実装状況より）
-- ============================================================
-- clients テーブル
-- インストラクターごとのクライアント（顧客）管理
-- bookings の client_email をキーに自動同期される
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  email         text NOT NULL,
  name          text,
  phone         text,
  memo          text,
  tags          text[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (instructor_id, email)
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor can manage own clients"
  ON clients FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE user_id = auth.uid()
    )
  );

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_clients_updated_at();

-- bookings INSERT 時に clients を自動 upsert
-- → 新規予約が入るたびにクライアント行が自動生成される
CREATE OR REPLACE FUNCTION sync_client_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO clients (instructor_id, email, name, phone)
  VALUES (NEW.instructor_id, NEW.client_email, NEW.client_name, NEW.client_phone)
  ON CONFLICT (instructor_id, email) DO UPDATE SET
    name       = COALESCE(EXCLUDED.name, clients.name),
    phone      = COALESCE(EXCLUDED.phone, clients.phone),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_booking_insert_sync_client
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_from_booking();

-- 既存 bookings からバックフィル（初回実行時のみ意味がある）
INSERT INTO clients (instructor_id, email, name, phone)
SELECT DISTINCT ON (instructor_id, client_email)
  instructor_id, client_email, client_name, client_phone
FROM bookings
WHERE instructor_id  IS NOT NULL
  AND client_email   IS NOT NULL
ORDER BY instructor_id, client_email, created_at DESC
ON CONFLICT (instructor_id, email) DO NOTHING;
