/**
 * GET /api/aida-event?id=5127
 *
 * AIDA EventDetails ページをサーバー側でフェッチ→パースしてJSONで返す。
 * ブラウザからの直接フェッチは CORS でブロックされるため、このプロキシを使用。
 *
 * レスポンス例:
 * {
 *   "aida_id": 5127,
 *   "name": "World Apnea 6월 좌충우돌 대회(Rush & Crush)",
 *   "date_start": "2026-06-28",
 *   "date_end": "2026-06-28",
 *   "location": "Hanyang Sports Center Swimming Pool, Anyang si, Gyounggi do, Republic of Korea",
 *   "event_type": "Pool Competition",
 *   "disciplines": ["DYNB", "DYN", "DNF", "STA"],
 *   "url": "https://www.aidainternational.org/Events/EventDetails-5127"
 * }
 */

export default async function handler(req, res) {
  // CORS ヘッダー（同一オリジン＋Vercel Preview から呼ばれる場合用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawId = req.query.id;
  if (!rawId) return res.status(400).json({ error: 'Missing required query param: id' });

  // id は数字のみ受け付ける（セキュリティ: SSRF 緩和）
  const aida_id = parseInt(rawId, 10);
  if (isNaN(aida_id) || aida_id <= 0) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  const aidaUrl = `https://www.aidainternational.org/Events/EventDetails-${aida_id}`;

  let html;
  try {
    const response = await fetch(aidaUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreedivingJapan/1.0)' },
    });
    if (!response.ok) {
      return res.status(502).json({ error: `AIDA returned HTTP ${response.status}` });
    }
    html = await response.text();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch AIDA page', detail: err.message });
  }

  // ── HTML パース（正規表現）────────────────────────────────────────────────
  // タグを除去してプレーンテキスト化
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ');

  /**
   * "Label: value" を抽出。HTMLタグ除去後はすべて1行になるため、
   * stopBefore に次のフィールド名を渡して早期終了させる。
   */
  function extract(label, stopBefore) {
    const escLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern;
    if (stopBefore && stopBefore.length) {
      const stops = stopBefore
        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':')
        .join('|');
      pattern = escLabel + ':\\s*(.+?)\\s*(?:' + stops + ')';
    } else {
      pattern = escLabel + ':\\s*([^\\n\\r<|]+)';
    }
    const re = new RegExp(pattern, 'i');
    const m = text.match(re);
    return m ? m[1].trim().replace(/\s+/g, ' ') : null;
  }

  // イベント名は og:title から（最も確実）
  const ogTitleMatch =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  let name = ogTitleMatch
    ? ogTitleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    : extract('Event Details');

  // 各フィールドは「次のラベル」の直前で止める
  const date_start    = extract('Start date',  ['End date', 'Location', 'Event Type', 'Organizer']);
  const date_end      = extract('End date',     ['Location', 'Event Type', 'Organizer', 'Additional']);
  const location      = extract('Location',     ['Event Type', 'Organizer', 'Additional', 'Disciplines']);
  const event_type    = extract('Event Type',   ['Organizer', 'Additional', 'Disciplines', 'Safety']);
  const disciplinesRaw = extract('Disciplines', ['Safety', 'Pool size', 'Minimum', 'Maximum', 'Main Judge', 'Performance']);
  const disciplines   = disciplinesRaw
    ? disciplinesRaw.split(/\s+/).filter(d => /^[A-Z]{2,5}B?$/.test(d))
    : [];

  // 最低限必要なフィールドが取れなかった場合はエラー
  if (!name || !date_start) {
    return res.status(404).json({
      error: 'Could not parse AIDA event data. The event may not exist or the page structure has changed.',
      aida_url: aidaUrl,
    });
  }

  return res.status(200).json({
    aida_id,
    name,
    date_start,
    date_end:    date_end    || date_start,
    location:    location    || null,
    event_type:  event_type  || null,
    disciplines,
    url: aidaUrl,
  });
}
