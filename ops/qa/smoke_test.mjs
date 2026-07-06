#!/usr/bin/env node
// ============================================================
// smoke_test.mjs — 本番スモークテスト（完全読み取り専用）
//
// やること:
//   A. 本番の主要ページが 200 で返るか（Vercel）
//   B. Supabase 匿名アクセスの正常系（公開データが読める）
//   C. Supabase RLS の負の検証（読めてはいけないものが読めない）
//   D. データ整合の警告（公開記事のサムネ欠落・公開listingの都道府県欠落等）
//
// 書き込みは一切しない。anon key（公開前提）のみ使用。
//
// 使い方（Macのターミナルで）:
//   cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
//   node ops/qa/smoke_test.mjs
//
// 終了コード: FAILが1件でもあれば 1
// ============================================================
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://freediving-japan.vercel.app';

// anon key を js/supabase-config.js から取得（コード重複を避ける）
const cfg = readFileSync(join(ROOT, 'js', 'supabase-config.js'), 'utf8');
const SB_URL = cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const SB_KEY = cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
if (!SB_URL || !SB_KEY) { console.error('supabase-config.js から接続情報を取得できません'); process.exit(1); }

const results = { pass: 0, fail: 0, warn: 0, skip: 0 };
const log = (mark, label, extra = '') => console.log(`  ${mark} ${label}${extra ? ' — ' + extra : ''}`);
const PASS = l => { results.pass++; log('✅', l); };
const FAIL = (l, e) => { results.fail++; log('❌', l, e); };
const WARN = (l, e) => { results.warn++; log('⚠️ ', l, e); };
const SKIP = (l, e) => { results.skip++; log('⏭️ ', l, e); };

const t = (ms = 15000) => AbortSignal.timeout(ms);

// ---------- A. ページ疎通 ----------
const PAGES = [
  '/', '/snorkeling.html', '/skindiving.html', '/freediving.html',
  '/auth.html', '/mypage.html', '/instructor-welcome.html',
  '/explore/', '/explore/shops.html', '/explore/listing.html', '/explore/profile.html',
  '/media/', '/media/article.html',
  '/learn/', '/pro/index.html', '/admin/',
  '/tools/training-log.html', '/tools/sta-timer.html', '/tools/mouthfill-calculator.html',
  '/events/2026_competitions.html', '/rankings/AIDA_ranking.html', '/booking/success.html',
];

console.log('\n== A. 本番ページ疎通 ==');
let netOk = true;
try { await fetch(SITE + '/', { signal: t(8000) }); } catch { netOk = false; }
if (!netOk) {
  SKIP('ページ疎通 全' + PAGES.length + '件', 'ネットワーク到達不可（Macのターミナルで実行してください）');
} else {
  for (const p of PAGES) {
    try {
      const r = await fetch(SITE + p, { signal: t() });
      const body = await r.text();
      if (r.status === 200 && body.length > 500) PASS(p);
      else FAIL(p, `status=${r.status} len=${body.length}`);
    } catch (e) { FAIL(p, e.message); }
  }
}

// ---------- Supabase REST ヘルパ ----------
const sb = async (path) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'count=exact' },
    signal: t(),
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data, count: r.headers.get('content-range') };
};

let sbOk = true;
try { await fetch(SB_URL + '/rest/v1/', { headers: { apikey: SB_KEY }, signal: t(8000) }); } catch { sbOk = false; }

// ---------- B. 公開データの正常系 ----------
console.log('\n== B. Supabase 公開データ（匿名で読めるべき） ==');
const PUBLIC_CHECKS = [
  ['articles?select=id&is_published=eq.true&limit=1', '公開記事が1件以上'],
  ['listings?select=id&is_public=eq.true&limit=1', '公開リスティングが1件以上'],
  ['instructors?select=id&status=eq.approved&limit=1', '承認済みインストラクターが1件以上'],
  ['events?select=id&limit=1', '大会イベントが読める'],
  ['shops?select=id&limit=1', 'ショップが読める'],
];
if (!sbOk) SKIP('公開データ 全' + PUBLIC_CHECKS.length + '件', 'Supabase到達不可');
else for (const [q, label] of PUBLIC_CHECKS) {
  try {
    const { status, data } = await sb(q);
    if (status === 200 && Array.isArray(data) && data.length >= 1) PASS(label);
    else if (status === 200) WARN(label, '0件（データ未投入の可能性）');
    else FAIL(label, `status=${status}`);
  } catch (e) { FAIL(label, e.message); }
}

// ---------- C. RLS 負の検証 ----------
console.log('\n== C. RLS負の検証（匿名で読めてはいけない） ==');
const RLS_CHECKS = [
  ['bookings?select=id&limit=1', 'bookings（予約・個人情報）'],
  ['inquiries?select=id&limit=1', 'inquiries（問い合わせ）'],
  ['user_roles?select=user_id&limit=1', 'user_roles（権限）'],
  ['clients?select=id&limit=1', 'clients（顧客）'],
  ['articles?select=id&is_published=eq.false&limit=1', 'articles（未公開下書き）'],
  ['articles?select=id&deleted_at=not.is.null&limit=1', 'articles（ソフト削除済み）'],
  ['listings?select=id&deleted_at=not.is.null&limit=1', 'listings（ソフト削除済み）'],
];
if (!sbOk) SKIP('RLS検証 全' + RLS_CHECKS.length + '件', 'Supabase到達不可');
else for (const [q, label] of RLS_CHECKS) {
  try {
    const { status, data } = await sb(q);
    if (status === 200 && Array.isArray(data) && data.length === 0) PASS(label + ' → 0件');
    else if (status === 401 || status === 403 || status === 404) PASS(label + ` → ${status}拒否`);
    else if (status === 200 && data.length > 0) FAIL(label, `匿名で${data.length}件読めてしまう！RLS要確認`);
    else WARN(label, `status=${status}`);
  } catch (e) { FAIL(label, e.message); }
}

// ---------- D. データ整合の警告 ----------
console.log('\n== D. データ整合（警告のみ） ==');
if (!sbOk) SKIP('データ整合チェック', 'Supabase到達不可');
else {
  try {
    const { data: noThumb } = await sb('articles?select=slug&is_published=eq.true&thumbnail_url=is.null');
    noThumb?.length ? WARN('サムネ無しの公開記事', noThumb.map(a => a.slug).join(', ')) : PASS('公開記事は全てサムネあり');
    const { data: noLead } = await sb('articles?select=slug&is_published=eq.true&lead_text=is.null');
    noLead?.length ? WARN('リード文無しの公開記事', noLead.map(a => a.slug).join(', ')) : PASS('公開記事は全てリード文あり');
    const { data: noPref } = await sb('listings?select=id,title&is_public=eq.true&prefecture=is.null');
    noPref?.length ? WARN('都道府県未設定の公開listing', `${noPref.length}件（検索に出ない）`) : PASS('公開listingは全て都道府県設定済み');
  } catch (e) { WARN('データ整合チェック', e.message); }
}

// ---------- 結果 ----------
console.log(`\n========================================`);
console.log(`結果: ✅${results.pass}  ❌${results.fail}  ⚠️${results.warn}  ⏭️${results.skip}`);
if (results.fail > 0) { console.log('→ FAILあり。上記を確認してください。'); process.exit(1); }
console.log(results.skip > 0 ? '→ SKIPあり（Macのターミナルから再実行推奨）' : '→ スモークテスト合格');
