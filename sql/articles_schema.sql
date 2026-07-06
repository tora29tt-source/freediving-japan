-- ステータス: 実行済み（2026-06-29）
-- =============================================
-- Freediving Japan — Articles Schema
-- =============================================

CREATE TABLE articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- コンテンツ
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE,                    -- URL用スラッグ（例: 'what-is-freediving'）
  excerpt         TEXT,                           -- カード表示用の短い説明
  body_md         TEXT,                           -- 本文（Markdown）
  cover_image_url TEXT,

  -- 分類
  category        TEXT CHECK (category IN (
                    'beginner',     -- 初心者向け
                    'technique',    -- テクニック
                    'gear',         -- ギア・道具
                    'competition',  -- 大会・競技
                    'interview',    -- インタビュー
                    'news'          -- ニュース
                  )),
  tags            TEXT[],

  -- メタ
  author          TEXT DEFAULT 'FreeDive Japan編集部',
  read_time_min   SMALLINT,                       -- 目安読了時間（分）

  -- 管理
  is_published    BOOLEAN DEFAULT FALSE,
  published_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_articles_published  ON articles(is_published, published_at DESC);
CREATE INDEX idx_articles_category   ON articles(category);
CREATE INDEX idx_articles_slug       ON articles(slug);

-- RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 公開済み記事は誰でも読める
CREATE POLICY "articles_select_published" ON articles
  FOR SELECT USING (is_published = TRUE);

-- 認証済みユーザー（管理者）のみ書き込み可
CREATE POLICY "articles_insert_auth" ON articles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "articles_update_auth" ON articles
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "articles_delete_auth" ON articles
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- サンプルデータ（開発用）
-- =============================================

INSERT INTO articles (title, slug, excerpt, body_md, cover_image_url, category, tags, read_time_min, is_published, published_at)
VALUES
(
  'フリーダイビングとは？スキューバとの違いをわかりやすく解説',
  'what-is-freediving',
  '道具なしで深海へ潜るフリーダイビング。スキューバダイビングとの違いや、はじめ方をわかりやすく解説します。',
  E'## フリーダイビングとは\n\nフリーダイビングとは、タンクなどの水中呼吸装置を使わず、**息を止めたまま潜水するスポーツ**です。\n\n古くは漁師や海女が食料採取のために行っていたもので、現代ではスポーツ・レクリエーションとして世界中で親しまれています。\n\n## スキューバダイビングとの違い\n\n| | フリーダイビング | スキューバダイビング |\n|---|---|---|\n| 呼吸 | 息を止める | タンクで呼吸 |\n| 装備 | 最小限 | タンク・レギュレーターなど |\n| 感覚 | 静寂・自由 | 会話・長時間滞在 |\n| 向いている人 | 自然体で海を感じたい | じっくり水中を探索したい |\n\n## こんな人におすすめ\n\n- 道具をなるべく使わずに海を楽しみたい\n- 水中の静寂と一体感を体験したい\n- 泳げるけど、スキューバは大げさに感じる\n\n## はじめ方\n\n最初は必ず**認定インストラクターの指導**のもとで体験しましょう。体験コースなら資格不要・2〜3時間で参加できます。\n\n> 一人での練習は危険です。必ずバディやインストラクターと一緒に潜りましょう。',
  '../images/hero_cnf_dive.jpg',
  'beginner',
  ARRAY['初心者', 'フリーダイビング入門', 'スキューバとの違い'],
  4,
  TRUE,
  NOW()
),
(
  '初めての体験ダイブ、何を持っていけばいい？持ち物チェックリスト',
  'first-experience-checklist',
  '初めてのフリーダイビング体験に向けて、準備しておくものをリストアップ。当日慌てないために確認しておきましょう。',
  E'## 体験コース当日の持ち物\n\n### 必須アイテム\n\n- **水着**（ウェットスーツは通常レンタルあり）\n- **タオル**（大判のものが便利）\n- **日焼け止め**（海洋環境に配慮したミネラルタイプ推奨）\n- **飲み物・軽食**（運動前後の補給用）\n\n### あると便利なもの\n\n- ラッシュガード（日焼け・クラゲ対策）\n- 防水バッグ（スマートフォンや貴重品の保護）\n- 酔い止め（ボートに乗る場合）\n\n## 前日の準備\n\n体験の前日は**十分な睡眠**を取ることが大切です。疲れた状態では息止め能力が下がります。また、直前の飲酒は絶対に避けましょう。\n\n## 当日の注意\n\n食事は体験の**2時間前**までに済ませましょう。満腹状態での潜水は気分が悪くなることがあります。',
  '../images/beginner_pair.jpg',
  'beginner',
  ARRAY['初心者', '持ち物', '体験コース'],
  3,
  TRUE,
  NOW() - INTERVAL '3 days'
);
