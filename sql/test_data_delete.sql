-- =============================================
-- テストデータ DELETE
-- test_data_insert.sql で追加したデータのみ削除
-- =============================================

DELETE FROM instructors
WHERE name IN (
  '鈴木 大輔',
  '林 陽子',
  '中村 拓海',
  '岡本 海'
);
-- instructors を削除すると listings / inquiries は CASCADE で自動削除されます
