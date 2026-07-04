-- ステータス: 実行済み（2026-07-04）
-- SECURITY_AUDIT.md（2026-07-04自動生成）対応
-- S1 / S3 / S6 / S7 / S8 + 調査中に発見した関連の追加修正
-- ============================================================

-- ------------------------------------------------------------
-- S1: bookings 匿名INSERTが無制限（WITH CHECK TRUE）
--     予約作成は api/create-checkout-session.js（service_role・下記RPC経由）に一本化。
--     匿名/認証済みからの直接INSERTポリシーは削除する。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "bookings_insert_anon" ON bookings;

-- ------------------------------------------------------------
-- S3: articles INSERTが「認証済みなら誰でも公開可能」
--
-- 【追加調査で判明した点】
-- Supabase Studio上で作成されたと見られる重複ポリシー
--   "auth insert"（INSERT, check=true）
--   "auth update"（UPDATE, qual=true, check=NULL）
--   "auth delete"（DELETE, qual=auth.uid()=created_by のみ）
--   "auth read all"（SELECT, qual=true）
-- が articles テーブルに存在しており、articles_insert_auth /
-- articles_update_role / articles_delete_role による制限を
-- 実質無効化していた（RLSのpermissiveポリシーはOR結合されるため、
-- 最も緩いポリシーが有効になる）。
-- 特に "auth update"（check=NULL）は認証済みユーザーなら誰でも
-- 任意の記事を任意の内容・is_published=trueへ書き換え可能な状態で、
-- S3の説明より深刻（新規投稿だけでなく既存公開記事の改ざんも可能）だった。
-- これらは削除し、articles_insert_auth を承認フローに沿った内容へ置換する。
-- "articles_select_auth_all" は articles_select_auth と全く同一の重複ポリシーなので整理のため削除。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "auth insert"   ON articles;
DROP POLICY IF EXISTS "auth update"   ON articles;
DROP POLICY IF EXISTS "auth delete"   ON articles;
DROP POLICY IF EXISTS "auth read all" ON articles;
DROP POLICY IF EXISTS "articles_select_auth_all" ON articles;

DROP POLICY IF EXISTS "articles_insert_auth" ON articles;
CREATE POLICY "articles_insert_role" ON articles
  FOR INSERT WITH CHECK (
    is_admin_or_staff()
    OR (
      auth.uid() = created_by
      AND is_published = FALSE
      AND status IN ('draft', 'review')
    )
  );

-- ------------------------------------------------------------
-- S6: 予約確定の競合（オーバーブッキング）
--     残席チェック→INSERTを単一トランザクション・行ロックで原子化するRPCを新設。
--     S9: listingId はクライアント指定値を使わず slot.listing_id を正とする
--         （API側で呼び出し時に slot.listing_id を渡すよう変更）。
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_pending_booking(
  p_slot_id           UUID,
  p_instructor_id     UUID,
  p_listing_id        UUID,
  p_client_name       TEXT,
  p_client_email      TEXT,
  p_client_phone      TEXT,
  p_notes             TEXT,
  p_rental_requests   JSONB,
  p_participant_count SMALLINT,
  p_unit_price        INTEGER,
  p_total_amount      INTEGER,
  p_platform_fee      INTEGER,
  p_instructor_payout INTEGER
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot      availability_slots%ROWTYPE;
  v_pending   INTEGER;
  v_remaining INTEGER;
  v_booking   bookings%ROWTYPE;
BEGIN
  -- 対象枠を行ロック。同時リクエストはここで直列化されるためTOCTOUが発生しない
  SELECT * INTO v_slot FROM availability_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  IF NOT v_slot.is_active THEN
    RAISE EXCEPTION 'SLOT_INACTIVE';
  END IF;

  SELECT COALESCE(SUM(participant_count), 0) INTO v_pending
  FROM bookings
  WHERE slot_id = p_slot_id AND status = 'pending';

  v_remaining := v_slot.max_participants - v_slot.booked_count - v_pending;

  IF p_participant_count > v_remaining THEN
    RAISE EXCEPTION 'SLOT_FULL:%', v_remaining;
  END IF;

  INSERT INTO bookings (
    slot_id, instructor_id, listing_id,
    client_name, client_email, client_phone,
    notes, rental_requests, participant_count,
    unit_price, total_amount, platform_fee, instructor_payout,
    status
  ) VALUES (
    p_slot_id, p_instructor_id, p_listing_id,
    p_client_name, p_client_email, p_client_phone,
    p_notes, p_rental_requests, p_participant_count,
    p_unit_price, p_total_amount, p_platform_fee, p_instructor_payout,
    'pending'
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- サーバーAPI（service_role）のみ実行可。anon/authenticatedからの直接呼び出しは禁止
REVOKE ALL ON FUNCTION create_pending_booking(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, SMALLINT, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_pending_booking(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, SMALLINT, INTEGER, INTEGER, INTEGER, INTEGER
) TO service_role;

-- ------------------------------------------------------------
-- S7: SECURITY DEFINER 関数の search_path 未固定
-- ------------------------------------------------------------
ALTER FUNCTION public.is_site_admin() SET search_path = public;
ALTER FUNCTION public.increment_booked_count(UUID, SMALLINT) SET search_path = public;

-- ------------------------------------------------------------
-- S8: event_results UPDATE に WITH CHECK が無い
--     judgeが自分の行のjudge_idを他人へ付け替え可能な問題を修正
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "results_judge_update" ON event_results;
CREATE POLICY "results_judge_update" ON event_results
  FOR UPDATE
  USING (auth.uid() = judge_id)
  WITH CHECK (auth.uid() = judge_id);

-- ------------------------------------------------------------
-- 追加修正（SECURITY_AUDIT.md対象外・本対応中に発見）:
-- event_safety_assignments / event_shift_roles / event_staff_shifts の
-- 書き込み系ポリシーが roles=public のままで、未ログインでも
-- INSERT/UPDATE/DELETEできる状態だった。
-- DEV.md記載の設計（event-staff.htmlは未ログイン=readonly）に反するため
-- 書き込み系ポリシーの対象ロールを authenticated に限定する。
-- 読み取り系（_read）は未ログイン閲覧を許可する設計のため変更しない。
-- ------------------------------------------------------------
ALTER POLICY "safety_assign_all"  ON event_safety_assignments TO authenticated;
ALTER POLICY "shift_roles_write"  ON event_shift_roles        TO authenticated;
ALTER POLICY "staff_shifts_write" ON event_staff_shifts       TO authenticated;
