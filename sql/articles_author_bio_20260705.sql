-- 2026-07-05: 記事の著者紹介文をハードコードから編集可能なDBカラムに変更
-- admin/index.html の記事エディタに「著者紹介文（任意）」欄を追加し、
-- 空欄の場合は media/article.html 側で汎用デフォルト文を表示するフォールバックとした。

ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_bio TEXT;
