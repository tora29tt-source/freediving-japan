// ============================================================
// Supabase 接続設定
// anon key はフロントエンドに含めてOK（公開前提のキー）
// service_role key は絶対にここに書かない
// ============================================================

const SUPABASE_URL      = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

// グローバルに _sb を公開（全ページで共有）
// 読み込み順：CDN (@supabase/supabase-js) → このファイル → ページ固有スクリプト
// flowType: 'implicit' → 静的サイト向け。トークンをURLハッシュで受け取りクライアントで即処理
const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'implicit' }
});
// window._sb にも公開する（2026-07-14追加）：
// classic <script> の const は window のプロパティにならないため、
// 他ファイル（js/location-data.js の getClient() など）が `window._sb` を見て
// 既存クライアントの有無を判定しても常に false になり、認証設定の異なる
// 2つ目のGoTrueClientを作ってしまっていた（Multiple GoTrueClient instances
// 警告の原因）。window._sb を明示的に立てて共有クライアントを検出可能にする。
window._sb = _sb;
