// ============================================================
// Supabase 接続設定
// anon key はフロントエンドに含めてOK（公開前提のキー）
// service_role key は絶対にここに書かない
// ============================================================

const SUPABASE_URL      = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

// グローバルに _sb を公開（全ページで共有）
// 読み込み順：CDN (@supabase/supabase-js) → このファイル → ページ固有スクリプト
const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
