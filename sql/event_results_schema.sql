-- ステータス: 実行済み（日付不明・DEV.md実装状況より）
-- =============================================
-- event_results テーブル
-- ジャッジがリアルタイム入力する競技結果
-- AIDA World Apnea Rules V17.8 対応
-- 作成: 2026-06-23
-- =============================================

CREATE TABLE IF NOT EXISTS event_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entry_id            UUID NOT NULL REFERENCES athlete_entries(id) ON DELETE CASCADE,

  -- 選手情報（非正規化・クエリ高速化用）
  athlete_name        TEXT,
  discipline          TEXT NOT NULL CHECK (discipline IN ('STA','DYN','DYNB','DNF','CWT','CWTB','CNF','FIM','VWT')),

  -- パフォーマンス
  ap                  NUMERIC(6,1),   -- Announced Performance (STA=秒 / DYN=m / 水深=m)
  rp                  NUMERIC(6,1),   -- Realized Performance  (同上)

  -- 判定
  card                TEXT CHECK (card IN ('white','penalty','dq')),
  is_valid            BOOLEAN DEFAULT FALSE,   -- DQ=false, それ以外=true

  -- DQ理由 (card='dq' のとき)
  dq_reason           TEXT CHECK (dq_reason IN (
    'DQSP',         -- Surface Protocol 不履行（15秒超え・二重OKサイン等）
    'DQBO',         -- ブラックアウト（意識喪失・心停止・不随意呼吸停止）
    'DQAIRWAYS',    -- 浮上後にAirwaysが水面下に入った
    'DQTOUCH',      -- 審判カード提示前に他者に触れた（または他者を触れた）
    'DQPULL',       -- ロープを引いた（FIM以外の水深種目）
    'DQLATESTART',  -- OT後30秒超えでスタート
    'DQOTHER'       -- その他（ルール4.1.11等）
  )),

  -- ペナルティ (card='white' or 'penalty' のとき)
  -- 各フィールドは "回数" または "秒数ユニット数" を格納
  penalty_early_start  SMALLINT DEFAULT 0,   -- Early Start: OT前スタート（5秒単位×回数）→ 1pt/unit
  penalty_late_start   SMALLINT DEFAULT 0,   -- Late Start:  OT後〜30秒以内（5秒単位×回数）→ 1pt/unit
  penalty_under_ap     NUMERIC(6,2) DEFAULT 0,  -- Under AP: 自動計算結果点数
  penalty_turn         SMALLINT DEFAULT 0,   -- Turn Miss: DYN系 端壁タッチなし（回数）→ 5pt/回
  penalty_pull         SMALLINT DEFAULT 0,   -- Pull: DYN系 支持点を引いた（回数）→ 5pt/回
  penalty_grab         SMALLINT DEFAULT 0,   -- Grab: CWT/CWTB/CNF ロープを握った（回数）→ 5pt/回
  penalty_tag          BOOLEAN DEFAULT FALSE, -- Tag Missing: 水深種目 タグ未持参 → 1pt
  penalty_lanyard      BOOLEAN DEFAULT FALSE, -- Lanyard Removal: 水深種目 競技中ランヤード外し → 10pt

  -- 集計（アプリ側で計算・保存）
  total_penalty        NUMERIC(6,2) DEFAULT 0,  -- ペナルティ合計点
  base_points          NUMERIC(6,2) DEFAULT 0,  -- RP換算点（ペナルティ前）
  final_points         NUMERIC(6,2) DEFAULT 0,  -- 最終得点 = max(0, base - penalty)

  -- Surface Protocol タイマー記録
  sp_elapsed           NUMERIC(4,1),            -- SP経過秒数（浮上から）
  sp_pass              BOOLEAN,                  -- true=15秒以内クリア / false=DQSP対象

  -- メタ
  notes                TEXT,
  judge_name           TEXT,
  judge_id             UUID REFERENCES auth.users(id),
  is_published         BOOLEAN DEFAULT FALSE,   -- true=公式発表済み

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),

  -- 1大会 × 1エントリー × 1種目 = 1結果
  UNIQUE (entry_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_event_results_event   ON event_results(event_id);
CREATE INDEX IF NOT EXISTS idx_event_results_entry   ON event_results(entry_id);
CREATE INDEX IF NOT EXISTS idx_event_results_judge   ON event_results(judge_id);
CREATE INDEX IF NOT EXISTS idx_event_results_valid   ON event_results(event_id, is_valid, final_points DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_results_updated
  BEFORE UPDATE ON event_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS（Row Level Security）
-- =============================================
ALTER TABLE event_results ENABLE ROW LEVEL SECURITY;

-- 誰でも is_published=true の結果は読める（公式リザルト表示）
CREATE POLICY "results_public_read" ON event_results
  FOR SELECT USING (is_published = TRUE);

-- ログインユーザーは自分が入力した結果を読める
CREATE POLICY "results_judge_read" ON event_results
  FOR SELECT USING (auth.uid() = judge_id);

-- ログインユーザーは INSERT できる（judge_id = 自分）
CREATE POLICY "results_judge_insert" ON event_results
  FOR INSERT WITH CHECK (auth.uid() = judge_id);

-- 自分が入力したものだけ UPDATE できる
CREATE POLICY "results_judge_update" ON event_results
  FOR UPDATE USING (auth.uid() = judge_id);

-- =============================================
-- ペナルティ点数 参照メモ（AIDA V17.8）
-- =============================================
-- EARLY START:  1pt / 5秒ユニット（5秒=1unit, 10秒=2units…）
-- LATE START:   1pt / 5秒ユニット（OT後30秒まで。超えたらDQLATESTART）
-- UNDER AP:     STA 0.2pt/秒差 / DYN 0.5pt/m差 / 水深 1pt/m差
-- TURN MISS:    5pt / 回 (DYN・DYNB・DNF)
-- PULL:         5pt / 回 (DYN・DYNB・DNF)
-- GRAB:         5pt / 回 (CWT・CWTB・CNF)
-- TAG Missing:  1pt (CWT・CWTB・CNF・FIM)
-- LANYARD:     10pt (CWT・CWTB・CNF・FIM)
-- ※ 点数はマイナスにならない（最低0点）
-- ※ ペナルティ付き結果はWorld/Continental Recordにならない

-- =============================================
-- ポイント換算 参照メモ（AIDA V17.8 §4.1.22）
-- =============================================
-- STA:  1秒 = 0.2pt → 0.2pt単位で切り捨て
-- DYN/DYNB/DNF: 1m = 0.5pt → 0.5pt単位で切り捨て
-- CWT/CWTB/CNF/FIM: 1m = 1pt → 1pt単位で切り捨て
