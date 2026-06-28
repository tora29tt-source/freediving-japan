// Vercel Serverless Function
// GET /api/booking-result?booking_id=xxx&session_id=xxx
//
// 未ログインゲストが予約完了ページで予約情報を取得するためのエンドポイント。
// booking_id と stripe_session_id の両方が一致する場合のみ返す（認証代わり）。

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { booking_id, session_id } = req.query;

  if (!booking_id || !session_id) {
    return res.status(400).json({ error: 'booking_id と session_id が必要です' });
  }

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, client_email, participant_count, total_amount, status,
        availability_slots ( slot_date, start_time, end_time ),
        listings ( title )
      `)
      .eq('id', booking_id)
      .eq('stripe_session_id', session_id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: '予約情報が見つかりません' });
    }

    return res.status(200).json({ booking });

  } catch (err) {
    console.error('booking-result error:', err);
    return res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
  }
}
