/**
 * video-worker.js — Cloudflare Worker
 *
 * R2 バケット "learn-videos" の前段に置く認証プロキシ。
 * 購入者だけが動画を視聴できるよう、Vercel の /api/video-token が発行した
 * JWT トークンを検証してから R2 のコンテンツを返す。
 *
 * .m3u8 プレイリストは、セグメント URL に ?token= を付けて書き換えてから返す。
 * これにより hls.js が各 .ts セグメントをフェッチするときも認証が通る。
 *
 * 環境変数（Cloudflare シークレット）:
 *   VIDEO_JWT_SECRET   — Vercel の VIDEO_JWT_SECRET と同じ値を設定
 *
 * R2 バインディング:
 *   VIDEOS             — wrangler.toml で learn-videos バケットにバインド済み
 */

// ─── JWT ────────────────────────────────────────────────────────────────────
function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const data      = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = b64urlDecode(sigB64);
    const valid     = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));

    // 有効期限チェック
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── CORS ───────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',  // Vercel プレビュー URL も通すため *
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'private, no-store',
};

function corsResponse(body, status, extra = {}) {
  return new Response(body, { status, headers: { ...CORS_HEADERS, ...extra } });
}

// ─── メインハンドラ ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return corsResponse('Method Not Allowed', 405);
    }

    const url   = new URL(request.url);
    const token = url.searchParams.get('token');

    // トークン未指定
    if (!token) return corsResponse('Unauthorized', 401);

    // JWT 検証
    const payload = await verifyJWT(token, env.VIDEO_JWT_SECRET);
    if (!payload) return corsResponse('Unauthorized', 401);

    // パス取得（先頭の / を除去）
    const path = url.pathname.replace(/^\/+/, '');
    if (!path) return corsResponse('Not Found', 404);

    // R2 からオブジェクト取得
    const object = await env.VIDEOS.get(path);
    if (!object) return corsResponse('Not Found', 404);

    // ─── .m3u8 プレイリスト ───────────────────────────────────────────────
    if (path.endsWith('.m3u8')) {
      const text   = await object.text();
      const dirArr = path.split('/');
      dirArr.pop();                          // ファイル名を除いてディレクトリを取得
      const dir    = dirArr.join('/');
      const origin = url.origin;

      // セグメントの相対パス → 絶対 URL + ?token= に書き換え
      const rewritten = text
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;

          // 既に絶対 URL の場合はそのまま（他のストリームへの参照など）
          if (trimmed.startsWith('http')) {
            return trimmed.includes('?token=')
              ? trimmed
              : `${trimmed}?token=${token}`;
          }

          // 相対パス → 絶対パスに変換
          const segPath = trimmed.startsWith('/')
            ? trimmed.slice(1)
            : (dir ? `${dir}/${trimmed}` : trimmed);

          return `${origin}/${segPath}?token=${token}`;
        })
        .join('\n');

      return corsResponse(rewritten, 200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
      });
    }

    // ─── .ts セグメント / その他 ──────────────────────────────────────────
    const contentType = path.endsWith('.ts')
      ? 'video/mp2t'
      : (object.httpMetadata?.contentType || 'application/octet-stream');

    return new Response(object.body, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': contentType },
    });
  },
};
