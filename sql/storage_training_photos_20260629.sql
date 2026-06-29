-- ステータス: 実行済み（2026-06-29）
-- 目的: training-photos バケット作成 + RLSポリシー設定

-- バケット作成（publicバケット：写真URLを直接表示可能）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-photos',
  'training-photos',
  true,
  10485760,  -- 10MB上限
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS有効化
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- アップロード：本人のみ自分のフォルダに
CREATE POLICY "training_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'training-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 閲覧：全員OK（publicバケット）
CREATE POLICY "training_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'training-photos');

-- 削除：本人のみ
CREATE POLICY "training_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'training-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
