-- ステータス: 実行済み（日付不明・DEV.md実装状況より）
-- ============================================================
-- bookings テーブル: guest_* → client_* カラム名変更
-- 実行日: 2026-06-19
-- ============================================================

ALTER TABLE bookings RENAME COLUMN guest_name  TO client_name;
ALTER TABLE bookings RENAME COLUMN guest_email TO client_email;
ALTER TABLE bookings RENAME COLUMN guest_phone TO client_phone;

-- インデックス再作成
DROP INDEX IF EXISTS idx_bookings_email;
CREATE INDEX idx_bookings_email ON bookings(client_email);
