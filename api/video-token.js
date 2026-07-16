/**
 * api/video-token.js — Vercel Serverless Function
 *
 * 購入済みユーザーに Cloudflare Worker 向け JWT を発行する。
 *
 * GET /api/video-token?courseId={uuid}&chapterId={uuid}
 * Authorization: Bearer {supabase_access_token}
 *
 * レスポンス:
 *   { token, videoPath, workerUrl }
 *
 * 必要な Vercel 環境変数:
 *   SUPABASE_URL              — Supabase プロジェクト URL
 *   SUPABASE_SERVICE_ROLE_KEY — service_role キー（RLS バイパス用）
 *   VIDEO_JWT_SECRET          — Worker と共有するシークレット（32文字以上推奨）
 *   VIDEO_WORKER_URL          — 例: https://video-worker.xxxxx.workers.dev
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─── 最小 JWT 実装（外部ライブラリ不要）────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signJWT(payload, secret) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify(payload));
  const sig     = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

// ─── メインハンドラ ─────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // CORS（Vercel プレビュー URL からも呼べるよう * に）
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── パラメータ検証 ──────────────────────────────────────────────────────
  const { courseId, chapterId } = req.query;
  if (!courseId || !chapterId) {
    return res.status(400).json({ error: 'courseId and chapterId are required' });
  }

  // UUID 形式チェック（インジェクション対策）
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(courseId) || !UUID_RE.test(chapterId)) {
    return res.status(400).json({ error: 'Invalid id format' });
  }

  // ── Supabase Auth でユーザー確認 ────────────────────────────────────────
  const authHeader  = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userErr } = await sb.auth.getUser(accessToken);
  if (userErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  // ── admin ロール確認（adminはバイパス） ────────────────────────────────
  const { data: roleRow } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin = roleRow?.role === 'admin';

  // ── 購入確認（adminはスキップ） ─────────────────────────────────────────
  if (!isAdmin) {
    const { data: purchase, error: purchErr } = await sb
      .from('course_purchases')
      .select('status')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (purchErr) {
      console.error('video-token purchase check error:', purchErr.message);
      return res.status(500).json({ error: 'Internal error' });
    }
    if (purchase?.status !== 'paid') {
      return res.status(403).json({ error: 'Not purchased' });
    }
  }

  // ── チャプターの video_path を取得 ──────────────────────────────────────
  const { data: chapter, error: chapErr } = await sb
    .from('course_chapters')
    .select('video_path')
    .eq('id', chapterId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (chapErr) {
    console.error('video-token chapter fetch error:', chapErr.message);
    return res.status(500).json({ error: 'Internal error' });
  }
  if (!chapter?.video_path) {
    return res.status(404).json({ error: 'Video not yet available for this chapter' });
  }

  // ── JWT 発行（有効期限 2 時間）──────────────────────────────────────────
  const secret = process.env.VIDEO_JWT_SECRET;
  if (!secret) {
    console.error('VIDEO_JWT_SECRET is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = signJWT(
    {
      sub:        user.id,
      course_id:  courseId,
      chapter_id: chapterId,
      exp:        Math.floor(Date.now() / 1000) + 7200, // 2 時間
    },
    secret
  );

  return res.status(200).json({
    token,
    videoPath:  chapter.video_path,
    workerUrl:  process.env.VIDEO_WORKER_URL,
  });
}
