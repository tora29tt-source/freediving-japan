// Vercel Serverless Function
// POST /api/stripe-webhook
//
// Stripe ダッシュボード > Webhooks > Add endpoint
//   URL: https://freediving-japan.vercel.app/api/stripe-webhook
//   Events: checkout.session.completed, checkout.session.expired
//
// 必要な環境変数:
//   STRIPE_SECRET_KEY         — Stripe秘密鍵
//   STRIPE_WEBHOOK_SECRET     — Webhook署名シークレット（whsec_xxx）
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel はデフォルトでボディをパースするので rawBody を使うため bodyParser を無効化
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      // ── 決済完了 ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        const slotId    = session.metadata?.slot_id;

        if (!bookingId) break;

        // 予約ステータスを paid に更新
        await supabase
          .from('bookings')
          .update({
            status:                    'paid',
            stripe_payment_intent_id:  session.payment_intent,
            updated_at:                new Date().toISOString(),
          })
          .eq('id', bookingId);

        // 空き枠の booked_count をインクリメント
        if (slotId) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('participant_count')
            .eq('id', bookingId)
            .single();

          if (booking) {
            await supabase.rpc('increment_booked_count', {
              p_slot_id: slotId,
              p_count:   booking.participant_count,
            });
          }
        }

        console.log(`✅ Booking paid: ${bookingId}`);
        break;
      }

      // ── セッション期限切れ（キャンセル扱い）──
      case 'checkout.session.expired': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        await supabase
          .from('bookings')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('status', 'pending'); // pending のものだけキャンセル

        console.log(`⚠️ Booking expired: ${bookingId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
