-- ステータス: 実行済み（日付不明・DEV.md実装状況より）
-- =============================================
-- Freediving Japan — Matching Schema
-- shops / instructors / listings / inquiries / reviews
-- =============================================

-- ① ショップ・スクールテーブル（個人インストラクターの場合は自分がショップ）
CREATE TABLE shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- オーナーアカウント

  -- 基本情報
  name            TEXT NOT NULL,
  name_en         TEXT,
  bio             TEXT,
  bio_en          TEXT,

  -- エリア情報
  prefecture      TEXT,
  city            TEXT,
  areas           TEXT[],

  -- メディア
  logo_url        TEXT,
  cover_url       TEXT,
  website_url     TEXT,
  instagram_url   TEXT,
  youtube_url     TEXT,

  -- タイプ（個人 or 法人）
  shop_type       TEXT DEFAULT 'individual'
    CHECK (shop_type IN ('individual', 'school', 'operator')),

  -- 集計（reviews から定期更新 or トリガー）
  avg_rating      NUMERIC(3,2),
  review_count    INTEGER DEFAULT 0,

  -- 管理
  is_verified     BOOLEAN DEFAULT FALSE,
  is_public       BOOLEAN DEFAULT TRUE,
  sort_priority   SMALLINT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ③ インストラクターテーブル
CREATE TABLE instructors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id         UUID REFERENCES shops(id) ON DELETE SET NULL,       -- 所属ショップ（個人なら自分のショップ）

  -- 基本プロフィール
  name            TEXT NOT NULL,
  name_en         TEXT,                         -- 英語名（インバウンド対応）
  bio             TEXT,
  bio_en          TEXT,                         -- 英語bio（インバウンド対応）

  -- エリア情報
  prefecture      TEXT,                         -- 都道府県
  city            TEXT,                         -- 市区町村
  areas           TEXT[],                       -- 活動エリア複数可（例: ['沖縄', '伊豆', '石垣島']）

  -- 資格・専門
  certifications  TEXT[],                       -- 例: ['AIDA インストラクター', 'PADI OW', 'SSI フリーダイビング']
  specialties     TEXT[],                       -- 例: ['フリーダイビング体験', 'スキンダイビング', '競技トレーニング']
  experience_years SMALLINT,                    -- 指導歴（年）

  -- メディア
  photo_url       TEXT,
  intro_video_url TEXT,                         -- 紹介動画（Vimeo / YouTube URL）

  -- SNS・外部リンク
  website_url     TEXT,
  instagram_url   TEXT,
  youtube_url     TEXT,

  -- 管理
  is_verified     BOOLEAN DEFAULT FALSE,        -- 運営による確認済みフラグ
  is_public       BOOLEAN DEFAULT TRUE,         -- 一覧表示するか
  sort_priority   SMALLINT DEFAULT 0,           -- 上位表示調整用

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ④ リスティングテーブル（体験コース・スクール・ツアーなど）
-- 1インストラクターが複数のリスティングを持てる
CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id   UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,

  -- 内容
  title           TEXT NOT NULL,
  title_en        TEXT,
  description     TEXT,
  description_en  TEXT,

  -- 分類
  category        TEXT NOT NULL,                -- 表示カテゴリ（例: 'フリーダイビング体験', 'スクール・資格取得'）
  intent          TEXT NOT NULL                 -- 検索タブ対応: 'try' | 'learn' | 'fundive' | 'training' | 'coaching'
                                                 -- （2026-07-08〜 'dive' は fundive/training/coaching に分割。検索ページの「もっと潜りたい」タブはこの3つをまとめて1グループ扱い）
    CHECK (intent IN ('try', 'learn', 'fundive', 'training', 'coaching')),

  -- 場所
  prefecture      TEXT,
  area            TEXT,                         -- 表示用エリア名（例: '沖縄', '伊豆'）
  location_detail TEXT,                         -- 詳細場所（例: '恩納村', '下田'）

  -- 価格
  price           INTEGER,                      -- 円（最低価格）
  price_unit      TEXT DEFAULT '〜/人',

  -- タグ・条件
  tags            TEXT[],                       -- 例: ['初心者OK', '当日予約OK', '英語対応']

  -- 詳細情報（Activity Japan 参考）
  duration_minutes  SMALLINT,                  -- 所要時間（分）
  min_participants  SMALLINT DEFAULT 1,        -- 最少催行人数
  max_participants  SMALLINT,                  -- 最大参加人数
  min_age           SMALLINT,                  -- 参加可能最低年齢
  flow_steps        JSONB,                     -- 当日の流れ [{step:1, title:'集合', desc:'〇〇で集合'}]
  meeting_location  TEXT,                      -- 集合場所
  required_items    TEXT[],                    -- 持ち物・服装
  cancellation_policy TEXT,                   -- キャンセルポリシー
  notes             TEXT,                      -- 注意事項

  -- メディア
  image_url         TEXT,
  gallery_urls      TEXT[],                    -- 複数写真ギャラリー

  -- 管理
  is_public         BOOLEAN DEFAULT TRUE,
  sort_order        SMALLINT DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ⑤ 問い合わせテーブル（マッチングの核心）
CREATE TABLE inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES listings(id) ON DELETE SET NULL,
  instructor_id   UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,

  -- 問い合わせ者情報
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,

  -- 問い合わせ内容
  message         TEXT NOT NULL,
  preferred_date  TEXT,                         -- 希望日（フリーテキスト）
  participant_count SMALLINT DEFAULT 1,

  -- 管理
  status          TEXT DEFAULT 'new'            -- 'new' | 'replied' | 'closed'
    CHECK (status IN ('new', 'replied', 'closed')),
  read_at         TIMESTAMPTZ,                  -- インストラクターが既読した時刻

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ⑥ レビューテーブル
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  instructor_id   UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  shop_id         UUID REFERENCES shops(id) ON DELETE SET NULL,

  -- 投稿者（ログインユーザーのみ）
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name   TEXT,                         -- 表示名（匿名可）

  -- 評価
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,

  -- 管理
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- インデックス
-- =============================================
CREATE INDEX idx_shops_prefecture        ON shops(prefecture);
CREATE INDEX idx_shops_public            ON shops(is_public, sort_priority DESC);
CREATE INDEX idx_instructors_shop        ON instructors(shop_id);
CREATE INDEX idx_instructors_prefecture  ON instructors(prefecture);
CREATE INDEX idx_instructors_public      ON instructors(is_public, sort_priority DESC);
CREATE INDEX idx_listings_instructor     ON listings(instructor_id);
CREATE INDEX idx_listings_intent         ON listings(intent);
CREATE INDEX idx_listings_prefecture     ON listings(prefecture);
CREATE INDEX idx_listings_public         ON listings(is_public, sort_order);
CREATE INDEX idx_inquiries_instructor    ON inquiries(instructor_id, created_at DESC);
CREATE INDEX idx_inquiries_listing       ON inquiries(listing_id);
CREATE INDEX idx_inquiries_status        ON inquiries(instructor_id, status);

-- =============================================
-- RLS（Row Level Security）
-- =============================================

-- shops: 公開ショップは誰でも読める。オーナーのみ編集。
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shops_select_public" ON shops
  FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "shops_insert_own" ON shops
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shops_update_own" ON shops
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "shops_delete_own" ON shops
  FOR DELETE USING (auth.uid() = user_id);

-- instructors: 公開プロフィールは誰でも読める。本人のみ編集。
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructors_select_public" ON instructors
  FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "instructors_insert_own" ON instructors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "instructors_update_own" ON instructors
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "instructors_delete_own" ON instructors
  FOR DELETE USING (auth.uid() = user_id);

-- listings: 公開リスティングは誰でも読める。インストラクター本人のみ編集。
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings_select_public" ON listings
  FOR SELECT USING (
    is_public = TRUE
    OR EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "listings_insert_own" ON listings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "listings_update_own" ON listings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "listings_delete_own" ON listings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

-- reviews: ログインユーザーのみ投稿。公開レビューは誰でも読める。本人のみ削除。
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "reviews_insert_auth" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- inquiries: 誰でも送信可（未ログインOK）。インストラクター本人のみ閲覧。
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiries_insert_anyone" ON inquiries
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "inquiries_select_own_instructor" ON inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "inquiries_update_own_instructor" ON inquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instructors i
      WHERE i.id = instructor_id AND i.user_id = auth.uid()
    )
  );

-- =============================================
-- サンプルデータ（開発用・本番では削除）
-- =============================================

-- ショップサンプル（個人インストラクターはshop_type='individual'）
INSERT INTO shops (name, bio, prefecture, city, areas, shop_type, is_verified, is_public)
VALUES
  ('山田 海斗', '沖縄を拠点に10年以上フリーダイビングを指導。', '沖縄県', '恩納村', ARRAY['沖縄', '石垣島'], 'individual', TRUE, TRUE),
  ('田中 美咲', '伊豆・下田を中心に活動するインストラクター。', '静岡県', '下田市', ARRAY['伊豆', '東京'], 'individual', TRUE, TRUE),
  ('佐藤 龍一', '宮古島・下地島を拠点にアスリート向けトレーニングを提供。', '沖縄県', '宮古島市', ARRAY['宮古島', '沖縄'], 'individual', FALSE, TRUE);

-- インストラクターサンプル（shop_idはサブクエリで取得）
INSERT INTO instructors (
  shop_id,
  name, bio, prefecture, city, areas,
  certifications, specialties, experience_years,
  photo_url, is_verified, is_public
) VALUES
(
  (SELECT id FROM shops WHERE name = '山田 海斗'),
  '山田 海斗',
  '沖縄を拠点に10年以上フリーダイビングを指導。初心者の「はじめての素潜り」から競技者のトレーニングまで幅広く対応。青の洞窟をはじめ沖縄の美しい海を知り尽くしたガイドです。',
  '沖縄県', '恩納村',
  ARRAY['沖縄', '石垣島'],
  ARRAY['AIDA インストラクター', 'SSI フリーダイビング インストラクター'],
  ARRAY['フリーダイビング体験', 'スキンダイビング', '初心者指導'],
  11,
  '../images/pool_portrait.jpg',
  TRUE, TRUE
),
(
  (SELECT id FROM shops WHERE name = '田中 美咲'),
  '田中 美咲',
  '伊豆・下田を中心に活動するインストラクター。AIDA2〜AIDA4の資格取得コースを専門とし、丁寧な指導で多くの競技フリーダイバーを輩出。英語・中国語での指導も可能。',
  '静岡県', '下田市',
  ARRAY['伊豆', '東京'],
  ARRAY['AIDA インストラクター', 'PADI フリーダイバー インストラクター'],
  ARRAY['スクール・資格取得', '英語対応', '競技トレーニング'],
  8,
  '../images/beginner_pair.jpg',
  TRUE, TRUE
),
(
  (SELECT id FROM shops WHERE name = '佐藤 龍一'),
  '佐藤 龍一',
  '宮古島・下地島を拠点にアスリート向けトレーニングを提供。自身もCWT選手として活躍中。最大水深40mの透明度抜群の海でのバディダイブ・ディープトレーニングが得意。',
  '沖縄県', '宮古島市',
  ARRAY['宮古島', '沖縄'],
  ARRAY['AIDA インストラクター'],
  ARRAY['競技トレーニング', 'ディープダイブ', 'アスリート向け'],
  6,
  '../images/dive_deep_rope.jpg',
  FALSE, TRUE
);

-- リスティングサンプル（instructors の id を参照するため、サブクエリで取得）
INSERT INTO listings (instructor_id, title, description, category, intent, prefecture, area, location_detail, price, price_unit, tags, image_url)
VALUES
(
  (SELECT id FROM instructors WHERE name = '山田 海斗'),
  '沖縄・青の洞窟フリーダイビング体験 — 素潜りで別世界へ',
  '世界的に有名な青の洞窟をフリーダイビングで体験。泳げない方・素潜り未経験でも安心。丁寧な説明と安全管理で、はじめてでも必ず潜れます。',
  'フリーダイビング体験', 'try',
  '沖縄県', '沖縄', '恩納村',
  8800, '〜/人',
  ARRAY['初心者OK', '当日予約OK'],
  '../images/light_rays.jpg'
),
(
  (SELECT id FROM instructors WHERE name = '田中 美咲'),
  'AIDA2 フリーダイビングコース — 東京・伊豆で資格取得',
  'プール講習（東京）＋海洋実習（伊豆・下田）のセットコース。学科・プール・海の3ステップで確実にAIDA2を取得できます。英語での指導も対応。',
  'スクール・資格取得', 'learn',
  '静岡県', '伊豆', '下田',
  52000, '〜/コース',
  ARRAY['資格取得コース', '英語対応'],
  '../images/dive_deep_rope.jpg'
),
(
  (SELECT id FROM instructors WHERE name = '佐藤 龍一'),
  '宮古島・透明度抜群ディープダイブスポット — 最大水深40m',
  '下地島の伊良部海峡など、宮古エリアの最高の場所をガイド。バディとして同潜しながら深度・フォーム・メンタルを指導します。競技選手の合宿にも最適。',
  'トレーニング・アスリート向け', 'dive',
  '沖縄県', '宮古島', '下地島沖',
  18000, '〜/人',
  ARRAY['貸切可'],
  '../images/gear_fins_beach.jpg'
),
(
  (SELECT id FROM instructors WHERE name = '山田 海斗'),
  '石垣島シュノーケリング＆スキンダイビングツアー',
  '石垣島の幻の島・マンタポイントをスキンダイビングで。家族・カップル歓迎。シュノーケルからスキンダイビングまでレベルに合わせて対応します。',
  'スキンダイビング体験', 'try',
  '沖縄県', '石垣島', '石垣市',
  6500, '〜/人',
  ARRAY['初心者OK', '子ども参加OK'],
  '../images/snorkeling_reef_okinawa_aerial.jpg'
),
(
  (SELECT id FROM instructors WHERE name = '田中 美咲'),
  'AIDA3/AIDA4 ステップアップコース — 競技フリーダイビングへ',
  'AIDA2取得者向けの上位資格コース。競技種目別のテクニック指導・アルゴリズムトレーニング・安全管理を体系的に学べます。',
  'スクール・資格取得', 'learn',
  '静岡県', '伊豆', '下田',
  78000, '〜/コース',
  ARRAY['資格取得コース', '競技者向け'],
  '../images/pool_dynb.jpg'
);
