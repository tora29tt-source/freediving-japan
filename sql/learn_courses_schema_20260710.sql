-- ステータス: 実行済み（2026-07-10・Chrome MCP経由でSupabase本番に実行・確認済み。courses=1件/course_chapters=8件/status=published）
-- =============================================
-- /learn/ 有料講座：courses / course_chapters / course_purchases
-- 2026-07-10・secretary相談で方針確定 → pmスキルで実装
--
-- 設計方針：
--  - courses      … 講座マスタ（learn/index.html カードの元データ。slugで詳細ページを動的生成）
--  - course_chapters … チャプター（シラバス表示用。vimeo_idは動画アップロード後に追記）
--  - course_purchases … 購入記録（bookingsテーブルと同パターン。Stripe Checkout連携）
--
-- 注意（vimeo_id の扱い）：
--  course_chapters は誰でもSELECTできる（シラバスは未購入者にも見せる集客要素のため）。
--  vimeo_id 自体もこのテーブルに含まれるため技術的には未購入者からも見えるが、
--  Vimeo側を「限定公開（unlisted）」にしておけば実害は小さい想定。
--  真のアクセス制御は視聴ページ（mypage側・未実装）で course_purchases を確認してから
--  Vimeo Playerを埋め込む、というアプリ層のチェックで担保する。
-- =============================================

-- =============================================
-- 1) courses（講座マスタ）
-- =============================================
CREATE TABLE courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,        -- 例: 'mimi-nuki-nyumon'
  title             TEXT NOT NULL,
  category          TEXT NOT NULL
                     CHECK (category IN ('beginner','mid','comp','inst')),  -- learn/index.html のcat-tabと対応
  level_label       TEXT,                        -- 例: '入門'（level-badgeに表示）
  instructor_name   TEXT NOT NULL,
  instructor_title  TEXT,                        -- 例: 'AIDA インストラクター'
  instructor_bio    TEXT,
  target_level      TEXT,                        -- 例: '初心者〜水深20m'
  price             INTEGER NOT NULL DEFAULT 0,   -- 円（税込）
  description       TEXT,                         -- 詳細ページの説明文
  thumbnail_url     TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_slug   ON courses(slug);
CREATE INDEX idx_courses_status ON courses(status);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- 公開済みの講座は誰でも閲覧可
CREATE POLICY "courses_select_published" ON courses
  FOR SELECT USING (status = 'published' OR is_site_admin());

-- 管理者のみ作成・更新・削除可
CREATE POLICY "courses_insert_admin" ON courses
  FOR INSERT WITH CHECK (is_site_admin());

CREATE POLICY "courses_update_admin" ON courses
  FOR UPDATE USING (is_site_admin());

CREATE POLICY "courses_delete_admin" ON courses
  FOR DELETE USING (is_site_admin());


-- =============================================
-- 2) course_chapters（チャプター・シラバス）
-- =============================================
CREATE TABLE course_chapters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_num   SMALLINT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  vimeo_id      TEXT,                 -- 撮影・アップロード完了後に追記（NULL=未収録）
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (course_id, chapter_num)
);

CREATE INDEX idx_chapters_course ON course_chapters(course_id, chapter_num);

ALTER TABLE course_chapters ENABLE ROW LEVEL SECURITY;

-- シラバスは誰でも閲覧可（vimeo_idの扱いはファイル冒頭の注意を参照）
CREATE POLICY "chapters_select_all" ON course_chapters
  FOR SELECT USING (TRUE);

CREATE POLICY "chapters_insert_admin" ON course_chapters
  FOR INSERT WITH CHECK (is_site_admin());

CREATE POLICY "chapters_update_admin" ON course_chapters
  FOR UPDATE USING (is_site_admin());

CREATE POLICY "chapters_delete_admin" ON course_chapters
  FOR DELETE USING (is_site_admin());


-- =============================================
-- 3) course_purchases（購入記録）
-- =============================================
CREATE TABLE course_purchases (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id                 UUID NOT NULL REFERENCES courses(id),

  amount                    INTEGER NOT NULL,   -- 購入時点の価格（円）

  stripe_session_id         TEXT UNIQUE,
  stripe_payment_intent_id  TEXT,

  status                    TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','refunded')),

  purchased_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, course_id)   -- 同じ講座を二重購入させない
);

CREATE INDEX idx_purchases_user   ON course_purchases(user_id);
CREATE INDEX idx_purchases_course ON course_purchases(course_id);
CREATE INDEX idx_purchases_stripe ON course_purchases(stripe_session_id);

ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

-- 本人の購入記録のみ閲覧可（視聴ページのアクセス制御に使う）。管理者は全件閲覧可
CREATE POLICY "purchases_select_own" ON course_purchases
  FOR SELECT USING (auth.uid() = user_id OR is_site_admin());

-- 挿入は認証済みユーザー本人のみ（実際は決済APIがservice_role経由で行うため、通常フロントからのINSERTは発生しない想定。念のため制限）
CREATE POLICY "purchases_insert_own" ON course_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 更新・削除は管理者のみ（webhookはservice_roleを使うためRLSをバイパスする）
CREATE POLICY "purchases_update_admin" ON course_purchases
  FOR UPDATE USING (is_site_admin());

CREATE POLICY "purchases_delete_admin" ON course_purchases
  FOR DELETE USING (is_site_admin());


-- =============================================
-- 4) シードデータ：耳抜き入門・基礎完全講座
--    （撮影がここから始まるため最初に投入。他3講座はdraftのまま後日追加）
-- =============================================
INSERT INTO courses (slug, title, category, level_label, instructor_name, instructor_title, target_level, price, description, status)
VALUES (
  'mimi-nuki-nyumon',
  '耳抜き入門・基礎完全講座',
  'beginner',
  '入門',
  'こうようさん',
  'AIDA インストラクター',
  '初心者〜水深20m',
  5000,
  '耳抜きの基礎から、つまずきやすいポイントまでを体系的に学べる入門講座です。',
  'published'   -- シラバス（骨組み）を先出しする方針。文言はこうようさんへの確認前の仮説なので、確定次第 description・チャプター名を更新すること
);

-- チャプターは仮の骨組み（全8レッスン）。実際のレッスン名はこうようさんとの構成打ち合わせ後に更新する
INSERT INTO course_chapters (course_id, chapter_num, title, description)
SELECT id, n, '第' || n || '回（仮）', NULL
FROM courses, generate_series(1, 8) AS n
WHERE slug = 'mimi-nuki-nyumon';
