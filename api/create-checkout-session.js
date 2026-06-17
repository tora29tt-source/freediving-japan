// Vercel Serverless Function
// POST /api/create-checkout-session
//
// 必要な環境変数（Vercel Dashboard > Settings > Environment Variables）:
//   STRIPE_SECRET_KEY          — Stripeダッシュボードの秘密鍵
//   SUPABASE_URL               — SupabaseプロジェクトURL
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase service_role キー（絶対にフロントに出さない）
//   NEXT_PUBLIC_SITE_URL       — サイトURL（例: https://freediving-japan.vercel.app）

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    slotId,
    listingId,
    instructorId,
    guestName,
    guestEmail,
    guestPhone,
    notes,
    participantCount,
    rentalRequests,
  } = req.body;

  // バリデーション
  if (!slotId || !guestName || !guestEmail || !participantCount) {
    return res.status(400).json({ error: '必須パラメーターが不足しています' });
  }

  try {
    // 1. 空き枠とリスティング情報を取得
    const { data: slot, error: slotError } = await supabase
      .from('availability_slots')
      .select('*, listings(*)')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: '指定された空き枠が見つかりません' });
    }

    // 2. 満席チェック
    const remaining = slot.max_participants - slot.booked_count;
    if (participantCount > remaining) {
      return res.status(409).json({ error: `残り${remaining}名分しか予約できません` });
    }

    const listing = slot.listings;
    if (!listing) {
      return res.status(404).json({ error: 'リスティング情報が見つかりません' });
    }

    const unitPrice   = listing.price || 0;
    const totalAmount = unitPrice * participantCount;

    // 手数料計算（運営 30%、インストラクター 70%）
    const platformFee      = Math.round(totalAmount * 0.30);
    const instructorPayout = totalAmount - platformFee;

    // 3. 仮予約レコード作成（status: 'pending'）
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        slot_id:           slotId,
        instructor_id:     instructorId || slot.instructor_id,
        listing_id:        listingId || slot.listing_id,
        guest_name:        guestName,
        guest_email:       guestEmail,
        guest_phone:       guestPhone || null,
        notes:             notes || null,
        rental_requests:   rentalRequests || null,
        participant_count: participantCount,
        unit_price:        unitPrice,
        total_amount:      totalAmount,
        platform_fee:      platformFee,
        instructor_payout: instructorPayout,
        status:            'pending',
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // 4. Stripe Checkout セッション作成
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://freediving-japan.vercel.app';
    const dateLabel = slot.slot_date;
    const timeLabel = `${slot.start_time.slice(0,5)}〜${slot.end_time.slice(0,5)}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: listing.title,
              description: `${dateLabel} ${timeLabel} ／ ${participantCount}名`,
              ...(listing.image_url ? { images: [listing.image_url] } : {}),
            },
            unit_amount: unitPrice,
          },
          quantity: participantCount,
        },
      ],
      mode: 'payment',
      customer_email: guestEmail,
      success_url: `${siteUrl}/booking/success.html?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/explore/listing.html?id=${instructorId || slot.instructor_id}`,
      metadata: {
        booking_id:    booking.id,
        slot_id:       slotId,
        instructor_id: instructorId || slot.instructor_id,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30分で期限切れ
    });

    // 5. 予約レコードにStripeセッションIDを保存
    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
  }
}
