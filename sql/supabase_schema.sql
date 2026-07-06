-- ステータス: 実行済み（日付不明・初期スキーマ）
-- =============================================
-- Freediving Japan — Supabase Schema
-- training_sessions + training_dives
-- =============================================

-- ① セッションテーブル（1練習 = 1行）
CREATE TABLE training_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本情報
  date          DATE NOT NULL,
  env           TEXT NOT NULL CHECK (env IN ('sea', 'pool', 'dry')),
  location      TEXT,                        -- フリーテキスト（オートコンプリート用）

  -- 主観データ（セッション全体）
  condition     SMALLINT CHECK (condition BETWEEN 1 AND 5),
  rhr           SMALLINT,                    -- 朝の安静時心拍数 (bpm)

  -- メモ
  note          TEXT,

  -- シェア機能
  is_public     BOOLEAN DEFAULT FALSE,
  share_token   TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,

  -- タイムスタンプ
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ② ダイブテーブル（1本 = 1行）
CREATE TABLE training_dives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 順番
  dive_number     SMALLINT NOT NULL,         -- セッション内の何本目か

  -- 種目
  discipline      TEXT NOT NULL,             -- CWT / CWTB / CNF / FIM / STA / DYN / DNF / DYNB / RVSTA / FRCSTA / WALK / STR / GYM / CARDIO / EQ

  -- 目標
  target_depth    NUMERIC(5,1),              -- 目標深度 (m)
  target_time     SMALLINT,                  -- 目標タイム (秒)

  -- 結果
  result_depth    NUMERIC(5,1),              -- 実際の深度 (m)
  result_time     SMALLINT,                  -- 実際のタイム (秒)

  -- インターバル（セット練習の場合）
  interval_dist   SMALLINT,                  -- 距離 (m)
  interval_rest   SMALLINT,                  -- 休憩時間 (秒)
  interval_sets   SMALLINT,                  -- 本数
  hold_time       SMALLINT,                  -- ホールド時間・秒（STA用）

  -- 主観データ（このダイブ）
  hypoxia         SMALLINT DEFAULT 0 CHECK (hypoxia BETWEEN 0 AND 3),    -- 酸欠感
  squeeze         SMALLINT DEFAULT 0 CHECK (squeeze BETWEEN 0 AND 3),    -- スクイズ感
  dcs             SMALLINT DEFAULT 0 CHECK (dcs BETWEEN 0 AND 2),        -- DCS感
  narcosis        SMALLINT DEFAULT 0 CHECK (narcosis BETWEEN 0 AND 2),   -- ナーコシス感

  -- UDDFプロファイルデータ
  uddf_profile    JSONB,                     -- 深度プロファイル [{t:0, d:0}, {t:10, d:5}, ...]
  uddf_speed      JSONB,                     -- 速度データ

  -- メモ
  note            TEXT,

  -- タイムスタンプ
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- インデックス
-- =============================================
CREATE INDEX idx_sessions_user_date ON training_sessions(user_id, date DESC);
CREATE INDEX idx_dives_session ON training_dives(session_id);
CREATE INDEX idx_dives_user ON training_dives(user_id);

-- =============================================
-- RLS（Row Level Security）
-- =============================================
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_dives ENABLE ROW LEVEL SECURITY;

-- セッション：本人のみ読み書き（公開セッションは誰でも読める）
CREATE POLICY "sessions_select" ON training_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_public = TRUE
  );

CREATE POLICY "sessions_insert" ON training_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update" ON training_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete" ON training_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ダイブ：本人のみ読み書き（公開セッションのダイブは誰でも読める）
CREATE POLICY "dives_select" ON training_dives
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM training_sessions s
      WHERE s.id = session_id AND s.is_public = TRUE
    )
  );

CREATE POLICY "dives_insert" ON training_dives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dives_update" ON training_dives
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "dives_delete" ON training_dives
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- オートコンプリート用ビュー（場所の候補）
-- =============================================
CREATE VIEW location_suggestions AS
  SELECT DISTINCT location
  FROM training_sessions
  WHERE location IS NOT NULL AND location != ''
  ORDER BY location;
