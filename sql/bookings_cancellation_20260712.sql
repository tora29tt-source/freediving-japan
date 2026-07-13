-- ステータス: 実行済み（2026-07-13）
-- =============================================
-- キャンセル・返金ポリシー対応（2026-07-12・secretary相談で確定）
-- =============================================
-- 背景：bookings.status は pending/paid/confirmed/cancelled/refunded を
-- 定義済みだが、実際に返金を実行する処理（Stripe返金〜DB更新）が無かった。
-- api/cancel-booking.js から呼ばれる想定で、返金額・理由・日時を記録する
-- カラムと、キャンセル時に空き枠の booked_count を戻す RPC を追加する。

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_amount       INTEGER,       -- 実際に返金した金額（円）。0円キャンセルの場合は0
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,   -- キャンセル・返金処理を実行した日時
  ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT           -- 'guest'（通常キャンセル）/ 'weather'（天候等ショップ都合）
                            CHECK (cancellation_reason IS NULL OR cancellation_reason IN ('guest', 'weather'));

-- =============================================
-- RPC: booked_count を減算（キャンセル・返金時に空き枠を戻す）
-- increment_booked_count（sql/bookings_schema.sql）の対）
-- =============================================
CREATE OR REPLACE FUNCTION decrement_booked_count(p_slot_id UUID, p_count SMALLINT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE availability_slots
  SET booked_count = GREATEST(booked_count - p_count, 0),
      updated_at   = NOW()
  WHERE id = p_slot_id;
$$;
