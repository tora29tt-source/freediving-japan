-- ステータス: 実行済み（日付不明・テストデータ）
-- ============================================================
-- Freediving Japan — 予約管理テストデータ
-- 対象: Supabase SQL Editor で実行（service_role権限）
-- ============================================================

-- ── 1. テスト用インストラクター ──────────────────────────────

INSERT INTO instructors (id, name, name_en, bio, areas, certifications, specialties, languages, is_public, created_at, updated_at)
VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    '山田 太郎',
    'Taro Yamada',
    '東京・神奈川を拠点に活動するフリーダイビングインストラクター。AIDA3★取得。初心者からコンペティターまで幅広く指導。',
    ARRAY['東京', '神奈川'],
    ARRAY['AIDA3★', 'SSI Level2'],
    ARRAY['耳抜き', 'STA', '深度トレーニング'],
    ARRAY['ja', 'en'],
    true,
    NOW(), NOW()
  ),
  (
    'aaaaaaaa-0002-0002-0002-000000000002',
    '鈴木 花子',
    'Hanako Suzuki',
    '沖縄を拠点に体験ダイビング・スキンダイビングを専門とするインストラクター。初心者・ファミリー歓迎。',
    ARRAY['沖縄'],
    ARRAY['PADI フリーダイバー', 'SSI スキンダイビング'],
    ARRAY['体験ダイビング', 'スキンダイビング', 'ファミリー'],
    ARRAY['ja'],
    true,
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- ── 2. テスト用リスティング ──────────────────────────────────

INSERT INTO listings (id, instructor_id, title, description, price, duration_minutes, max_participants, is_public, sort_order, created_at, updated_at)
VALUES
  (
    'bbbbbbbb-0001-0001-0001-000000000001',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'フリーダイビング体験コース（東京）',
    'プールで安全に体験。耳抜き・息止め基礎を丁寧に指導します。',
    8000, 120, 4,
    true, 1, NOW(), NOW()
  ),
  (
    'bbbbbbbb-0002-0002-0002-000000000002',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'フリーダイビング初級コース（AIDA2★）',
    'AIDA国際資格取得コース。2日間で20mを目指します。',
    35000, 480, 2,
    true, 2, NOW(), NOW()
  ),
  (
    'bbbbbbbb-0003-0003-0003-000000000003',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'スキンダイビング体験（沖縄・海洋）',
    '透明度抜群の沖縄の海で楽しむシュノーケル＆スキンダイビング体験。',
    6000, 90, 6,
    true, 1, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- ── 3. テスト用空き枠 ────────────────────────────────────────

INSERT INTO availability_slots (id, instructor_id, listing_id, slot_date, start_time, end_time, max_participants, booked_count, is_active, created_at, updated_at)
VALUES
  -- 過去の枠（予約が入っているもの）
  ('cccccccc-0001-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000001', '2026-06-10', '10:00', '12:00', 4, 2, false, NOW(), NOW()),
  ('cccccccc-0002-0002-0002-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000001', '2026-06-12', '14:00', '16:00', 4, 1, false, NOW(), NOW()),
  ('cccccccc-0003-0003-0003-000000000003', 'aaaaaaaa-0001-0001-0001-000000000001', 'bbbbbbbb-0002-0002-0002-000000000002', '2026-06-07', '09:00', '17:00', 2, 1, false, NOW(), NOW()),
  ('cccccccc-0004-0004-0004-000000000004', 'aaaaaaaa-0002-0002-0002-000000000002', 'bbbbbbbb-0003-0003-0003-000000000003', '2026-06-14', '10:00', '11:30', 6, 2, false, NOW(), NOW()),
  -- 未来の枠
  ('cccccccc-0005-0005-0005-000000000005', 'aaaaaaaa-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000001', '2026-06-25', '10:00', '12:00', 4, 1, true, NOW(), NOW()),
  ('cccccccc-0006-0006-0006-000000000006', 'aaaaaaaa-0002-0002-0002-000000000002', 'bbbbbbbb-0003-0003-0003-000000000003', '2026-06-28', '13:00', '14:30', 6, 0, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


-- ── 4. テスト用予約（全ステータス網羅）──────────────────────

INSERT INTO bookings (
  id, slot_id, instructor_id, listing_id,
  client_name, client_email, client_phone, notes,
  participant_count, unit_price, total_amount, platform_fee, instructor_payout,
  status, stripe_session_id, created_at, updated_at
)
VALUES
  -- ① confirmed（確定済み・最多ケース）
  (
    'dddddddd-0001-0001-0001-000000000001',
    'cccccccc-0001-0001-0001-000000000001',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0001-0001-0001-000000000001',
    '田中 健太', 'kenta.tanaka@example.com', '090-1234-5678',
    'フィン持参します。耳抜きが苦手で心配です。',
    2, 8000, 16000, 4800, 11200,
    'confirmed', 'cs_test_confirmed_001',
    '2026-06-08 10:00:00+09', '2026-06-08 10:05:00+09'
  ),
  -- ② confirmed（別の枠）
  (
    'dddddddd-0002-0002-0002-000000000002',
    'cccccccc-0004-0004-0004-000000000004',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'bbbbbbbb-0003-0003-0003-000000000003',
    '佐藤 美咲', 'misaki.sato@example.com', '080-9876-5432',
    '子供（8歳）も一緒です。',
    2, 6000, 12000, 3600, 8400,
    'confirmed', 'cs_test_confirmed_002',
    '2026-06-12 14:30:00+09', '2026-06-12 14:35:00+09'
  ),
  -- ③ paid（支払い完了・確定前）
  (
    'dddddddd-0003-0003-0003-000000000003',
    'cccccccc-0002-0002-0002-000000000002',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0001-0001-0001-000000000001',
    '伊藤 龍之介', 'ryunosuke.ito@example.com', '070-1111-2222',
    NULL,
    1, 8000, 8000, 2400, 5600,
    'paid', 'cs_test_paid_001',
    '2026-06-11 18:00:00+09', '2026-06-11 18:01:00+09'
  ),
  -- ④ pending（決済未完了）
  (
    'dddddddd-0004-0004-0004-000000000004',
    'cccccccc-0005-0005-0005-000000000005',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0001-0001-0001-000000000001',
    '渡辺 綾', 'aya.watanabe@example.com', NULL,
    '初めてで不安なので丁寧に教えてほしいです。',
    1, 8000, 8000, 2400, 5600,
    'pending', NULL,
    '2026-06-17 09:00:00+09', '2026-06-17 09:00:00+09'
  ),
  -- ⑤ cancelled（キャンセル）
  (
    'dddddddd-0005-0005-0005-000000000005',
    'cccccccc-0003-0003-0003-000000000003',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'bbbbbbbb-0002-0002-0002-000000000002',
    '中村 翔', 'sho.nakamura@example.com', '090-5555-6666',
    NULL,
    1, 35000, 35000, 10500, 24500,
    'cancelled', 'cs_test_cancelled_001',
    '2026-06-04 11:00:00+09', '2026-06-05 10:00:00+09'
  ),
  -- ⑥ refunded（返金済み）
  (
    'dddddddd-0006-0006-0006-000000000006',
    'cccccccc-0004-0004-0004-000000000004',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'bbbbbbbb-0003-0003-0003-000000000003',
    '小林 実', 'minoru.kobayashi@example.com', '080-3333-4444',
    '台風で来沖できなくなりました。',
    2, 6000, 12000, 3600, 8400,
    'refunded', 'cs_test_refunded_001',
    '2026-06-10 16:00:00+09', '2026-06-13 09:00:00+09'
  )
ON CONFLICT (id) DO NOTHING;


-- ── 確認クエリ ────────────────────────────────────────────────

SELECT
  b.id,
  i.name AS instructor,
  l.title AS listing,
  b.client_name,
  b.total_amount,
  b.status,
  b.created_at::date AS booked_date
FROM bookings b
JOIN instructors i ON i.id = b.instructor_id
JOIN listings l ON l.id = b.listing_id
WHERE b.id LIKE 'dddddddd%'
ORDER BY b.created_at DESC;
