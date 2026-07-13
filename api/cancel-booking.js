// Vercel Serverless Function
// POST /api/cancel-booking
//
// 予約のキャンセル・返金を実行する（2026-07-12・secretary相談で確定したポリシーの実装）。
//
// 認可：Authorization: Bearer <supabase access_token> を必須とし、その呼び出し元
// トークンで対象の bookings 行を SELECT できるか（RLS: bookings_select_owner_or_admin
// ＝本人インストラクター／本人ショップ／管理者のみ）を確認する。通過できなければ
// 権限なしとして 403 を返す。以降の実データ取得・Stripe返金・DB更新は
// service_role で行う（RLSの可視性に依存させない・クライアント指定値は信用しない＝S9踏襲）。
//
// キャンセル料率（プラットフォーム共通のフォールバックルール）：
//   開催7日以上前　　　　　→ 全額返金（100%）
//   開催3〜6日前　　　　　 → 50%返金
//   開催2日前〜当日・無連絡 → 返金なし（0%）
//   天候等ショップ都合の中止 → 無条件で全額返金
// 各リスティングの cancellation_policy（自由入力）が上記と異なる場合は、
// admin側で提案額を編集してから確定する運用とする（自動判定は行わない）。
//
// 必要な環境変数（api/create-checkout-session.js と共通）:
//   STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

// anon key はフロントエンド（js/supabase-config.js）と同一の公開前提キー。
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function computeSuggestedRefund(totalAmount, slotDate, startTime, reason) {
  if (reason === 'weather') {
    return { rate: 1, amount: totalAmount, label: '天候等ショップ都合（全額返金）' };
  }

  if (!slotDate) {
    // 開催日が不明な場合は安全側（返金なし＝admin側での手動判断）に倒す
    return { rate: 0, amount: 0, label: '開催日不明（要手動確認）' };
  }

  // 暦日ベースの差分で計算する（時刻は考慮しない。「7日前」は7開催"日"前という自然な解釈に合わせる）
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const slotDateOnly  = new Date(`${slotDate}T00:00:00`);
  const daysUntil = Math.round((slotDateOnly.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil >= 7) return { rate: 1,   amount: totalAmount,                    label: '開催7日以上前（全額返金）' };
  if (daysUntil >= 3) return { rate: 0.5, amount: Math.round(totalAmount * 0.5),  label: '開催3〜6日前（50%返金）' };
  return { rate: 0, amount: 0, label: '開催2日前〜当日・無連絡（返金なし）' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'] || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: '認証情報がありません' });
  }

  const { bookingId, reason, overrideAmount } = req.body || {};

  if (!bookingId || !['guest', 'weather'].includes(reason)) {
    return res.status(400).json({ error: '必須パラメーターが不足しています' });
  }

  try {
    // 1. 認可チェック：呼び出し元トークンでスコープしたクライアントで
    //    対象予約をSELECTできるか確認する（RLSがそのまま認可ゲートになる）。
    const callerClient = createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: authCheck, error: authErr } = await callerClient
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .single();

    if (authErr || !authCheck) {
      return res.status(403).json({ error: '予約が見つからないか、操作権限がありません' });
    }

    // 2. 実データはRLSの可視性に依存させず service_role で取得する
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('*, availability_slots(id, slot_date, start_time)')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: '予約情報の取得に失敗しました' });
    }

    if (!['paid', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: `現在のステータス（${booking.status}）ではキャンセル・返金処理はできません` });
    }

    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ error: '決済情報が見つからないため返金処理できません' });
    }

    const slot = booking.availability_slots;
    const suggestion = computeSuggestedRefund(
      booking.total_amount,
      slot?.slot_date,
      slot?.start_time,
      reason
    );

    let refundAmount = typeof overrideAmount === 'number'
      ? Math.round(overrideAmount)
      : suggestion.amount;

    // クランプ（0〜予約総額）。クライアント指定値をそのまま信用しない。
    refundAmount = Math.max(0, Math.min(refundAmount, booking.total_amount));

    if (refundAmount > 0) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmount,
      });
    }

    const newStatus = refundAmount > 0 ? 'refunded' : 'cancelled';

    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status:              newStatus,
        refund_amount:       refundAmount,
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: reason,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateErr) {
      console.error('cancel-booking: failed to update booking after refund:', updateErr.message);
      return res.status(500).json({
        error: 'Stripe側の返金は完了しましたが、予約情報の更新に失敗しました。Supabase側の状態を確認してください',
      });
    }

    // 空き枠を解放（枠が残っていれば booked_count を戻す）
    if (slot?.id && booking.participant_count) {
      const { error: rpcErr } = await supabaseAdmin.rpc('decrement_booked_count', {
        p_slot_id: slot.id,
        p_count:   booking.participant_count,
      });
      if (rpcErr) {
        console.error('cancel-booking: failed to decrement booked_count:', rpcErr.message);
      }
    }

    return res.status(200).json({
      status: newStatus,
      refundAmount,
      suggestionLabel: suggestion.label,
    });

  } catch (err) {
    console.error('cancel-booking error:', err);
    return res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
  }
}
