// Supabase 設定
const SUPABASE_URL = 'https://bbhqvbpsuccbdcnhnobm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs'

if (typeof window._supabaseClient === 'undefined') {
  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
const supabase = window._supabaseClient
