-- プロフィール・リスティング拡張カラム
-- Supabase ダッシュボード > SQL Editor で実行してください

-- instructors: 対応言語・レッスン形態
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS languages     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lesson_styles TEXT[] DEFAULT '{}';

-- listings: 設備・レンタル機材（コース単位で管理）
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS facilities  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rental_gear JSONB   DEFAULT '[]'; -- [{name, price}] 形式

-- rental_gear を TEXT[] から JSONB に変更（既に TEXT[] で追加済みの場合）
-- ALTER TABLE listings ALTER COLUMN rental_gear TYPE JSONB USING '[]'::jsonb;

-- listings: コース詳細情報
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS duration            TEXT,        -- 所要時間（例：2〜3時間）
  ADD COLUMN IF NOT EXISTS min_participants    INTEGER,     -- 最少催行人数
  ADD COLUMN IF NOT EXISTS age_min             INTEGER,     -- 参加年齢（下限）
  ADD COLUMN IF NOT EXISTS age_max             INTEGER,     -- 参加年齢（上限）
  ADD COLUMN IF NOT EXISTS season              TEXT,        -- 開催期間（例：4月〜10月）
  ADD COLUMN IF NOT EXISTS meeting_point       TEXT,        -- 集合場所
  ADD COLUMN IF NOT EXISTS booking_deadline    TEXT,        -- 予約締切（例：前日まで）
  ADD COLUMN IF NOT EXISTS has_shuttle         BOOLEAN DEFAULT false, -- 送迎あり
  ADD COLUMN IF NOT EXISTS price_includes      TEXT,        -- 料金に含まれるもの
  ADD COLUMN IF NOT EXISTS price_excludes      TEXT,        -- 料金に含まれないもの
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,        -- キャンセルポリシー
  ADD COLUMN IF NOT EXISTS what_to_bring       TEXT,        -- 服装・持ち物
  ADD COLUMN IF NOT EXISTS notes               TEXT;        -- 注意事項

-- shops: プロフィール拡張（ショップ登録機能向け）
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS languages     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_url   TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_public     BOOLEAN DEFAULT false;
