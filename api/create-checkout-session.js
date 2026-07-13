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
    // instructorId / shopId はフロントから届くが、予約の帰属決定には使わない
    // （下記 ownerInstructorId / ownerShopId の通り、常に slot のDB値を正とする）
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
    // 1. 空き枠とリスティング情報を取得（表示・価格算出用）
    const { data: slot, error: slotError } = await supabase
      .from('availability_slots')
      .select('*, listings(*)')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: '指定された空き枠が見つかりません' });
    }

    const listing = slot.listings;
    if (!listing) {
      return res.status(404).json({ error: 'リスティング情報が見つかりません' });
    }

    // listingId はクライアント指定値を信用せず slot.listing_id と一致するか検証する（S9）
    if (listingId && listingId !== slot.listing_id) {
      return res.status(400).json({ error: 'リスティング情報が一致しません' });
    }

    const unitPrice   = listing.price || 0;
    const totalAmount = unitPrice * participantCount;

    // 手数料計算（運営 10%、インストラクター 90%・2026-07-12変更）
    const platformFee      = Math.round(totalAmount * 0.10);
    const instructorPayout = totalAmount - platformFee;

    // 予約の帰属（instructor_id / shop_id）は必ずDB由来の slot の値を正とする。
    // クライアントが送ってくる instructorId / shopId は信用しない（S9のlistingIdと同じ理由）。
    // 以前は `instructorId || slot.instructor_id` としてクライアント指定値を優先していたため、
    // ショップ名義の枠に対して任意の instructorId を送りつけると、その予約が
    // 実在確認なしにそのインストラクターの予約として保存できてしまっていた（2026-07-11 E2Eで指摘）。
    const ownerInstructorId = slot.instructor_id || null;
    const ownerShopId       = slot.shop_id || null;

    if (!ownerInstructorId && !ownerShopId) {
      console.error('create-checkout-session: slot has neither instructor_id nor shop_id', slotId);
      return res.status(500).json({ error: 'この商品の担当情報が設定されていません' });
    }

    // 2. 残席チェック＋仮予約作成を単一トランザクション・行ロックで原子化（S6: TOCTOU対策）
    //    is_active チェック（Bug #8）・pending込みの残席チェック（Bug #5）は
    //    すべて create_pending_booking() 内で行ロックを取った上で行われる。
    //    listing_id は slot.listing_id（DB由来の値）を渡す（S9）。
    const { data: booking, error: rpcErr } = await supabase
      .rpc('create_pending_booking', {
        p_slot_id:           slotId,
        p_instructor_id:     ownerInstructorId,
        p_listing_id:        slot.listing_id,
        p_client_name:       guestName,
        p_client_email:      guestEmail,
        p_client_phone:      guestPhone || null,
        p_notes:             notes || null,
        p_rental_requests:   rentalRequests || null,
        p_participant_count: participantCount,
        p_unit_price:        unitPrice,
        p_total_amount:      totalAmount,
        p_platform_fee:      platformFee,
        p_instructor_payout: instructorPayout,
        // ショップ名義（担当者未定）の枠向け
        p_shop_id:           ownerShopId,
      });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      if (msg.startsWith('SLOT_NOT_FOUND')) {
        return res.status(404).json({ error: '指定された空き枠が見つかりません' });
      }
      if (msg.startsWith('SLOT_INACTIVE')) {
        return res.status(409).json({ error: 'この枠は現在受け付けていません' });
      }
      if (msg.startsWith('SLOT_FULL')) {
        const remaining = msg.split(':')[1] ?? '0';
        return res.status(409).json({ error: `残り${remaining}名分しか予約できません` });
      }
      console.error('create_pending_booking rpc error:', msg);
      return res.status(500).json({ error: '予約状況の確認に失敗しました' });
    }

    // 4. Stripe Checkout セッション作成
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://freediving-japan.vercel.app';
    const dateLabel = slot.slot_date;
    const timeLabel = `${slot.start_time.slice(0,5)}〜${slot.end_time.slice(0,5)}`;

    // 担当インストラクター未定（ショップ名義）の枠の場合、キャンセル後の戻り先はショップID経由で指定する
    const ownerQuery = ownerInstructorId
      ? `id=${ownerInstructorId}`
      : `shop=${ownerShopId || ''}`;

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
      cancel_url:  `${siteUrl}/explore/listing.html?${ownerQuery}&listing=${slot.listing_id}`,
      metadata: {
        booking_id:    booking.id,
        slot_id:       slotId,
        instructor_id: ownerInstructorId || '',
        shop_id:       ownerShopId || '',
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
