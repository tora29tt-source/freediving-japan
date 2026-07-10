// Vercel Serverless Function
// POST /api/create-course-checkout-session
//
// /learn/ 有料講座（courses）の購入用 Stripe Checkout セッションを作成する。
// bookings 用の /api/create-checkout-session.js と役割は同じだが、
// 空き枠（availability_slots）の概念が無く、ログイン必須（course_purchases.user_id）な点が異なるため別エンドポイントにした。
//
// 必要な環境変数（bookings用と共通）:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   NEXT_PUBLIC_SITE_URL

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

  const { courseId } = req.body;
  if (!courseId) {
    return res.status(400).json({ error: '必須パラメーターが不足しています' });
  }

  // 1. 認証チェック：クライアントが送ってきた userId は信用せず、
  //    Authorization ヘッダーの Supabase アクセストークンから本人を特定する
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'ログインの有効期限が切れています。再ログインしてください' });
  }
  const userId = userData.user.id;

  try {
    // 2. 講座情報を取得（価格はDB側の値を信用する。クライアント指定の価格は受け取らない）
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, slug, title, price, status')
      .eq('id', courseId)
      .single();

    if (courseErr || !course) {
      return res.status(404).json({ error: '講座が見つかりません' });
    }
    if (course.status !== 'published') {
      return res.status(409).json({ error: 'この講座はまだ購入できません' });
    }
    if (!course.price || course.price <= 0) {
      return res.status(409).json({ error: 'この講座は価格が設定されていません' });
    }

    // 3. 既に購入済みなら再課金しない
    const { data: existing } = await supabase
      .from('course_purchases')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle();

    if (existing?.status === 'paid') {
      return res.status(409).json({ error: 'この講座は購入済みです', alreadyPurchased: true });
    }

    // 4. pending の購入レコードを作成/更新（UNIQUE(user_id, course_id) で upsert）
    const { data: purchase, error: upsertErr } = await supabase
      .from('course_purchases')
      .upsert(
        {
          user_id:    userId,
          course_id:  course.id,
          amount:     course.price,
          status:     'pending',
        },
        { onConflict: 'user_id,course_id' }
      )
      .select('id')
      .single();

    if (upsertErr || !purchase) {
      console.error('course_purchases upsert error:', upsertErr?.message);
      return res.status(500).json({ error: '購入処理の準備に失敗しました' });
    }

    // 5. Stripe Checkout セッション作成
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://freediving-japan.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: { name: course.title },
            unit_amount: course.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: userData.user.email || undefined,
      success_url: `${siteUrl}/learn/purchase-success.html?slug=${course.slug}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/learn/course.html?slug=${course.slug}`,
      metadata: {
        purchase_id: purchase.id,
        course_id:   course.id,
        user_id:     userId,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30分で期限切れ
    });

    // 6. 購入レコードにStripeセッションIDを保存
    await supabase
      .from('course_purchases')
      .update({ stripe_session_id: session.id })
      .eq('id', purchase.id);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('create-course-checkout-session error:', err);
    return res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
  }
}
