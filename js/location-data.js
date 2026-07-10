/* ============================================================
   location-data.js — 都道府県リスト＋スポット名サジェストの共通データ
   （2026-07-10・secretary相談で確定「エリア設計の刷新」の実装）

   背景：固定14タクソノミーの「エリア」概念を廃止し、都道府県を検索・
   絞り込みの主軸にする。事業者はスポット名を自由入力できるが、
   登録時・検索時ともに「よくあるスポット名」をサジェストして
   入力のばらつき（表記ゆれ・入れ忘れ）を減らす。

   サジェストの中身：
   - SEED_SPOTS：旧14タクソノミーの名称を「呼び水」として残す
   - loadKnownSpots()：上記に加えて実際のlistings.areaの値をDBから
     取得してマージする（出品が増えるほど候補が育つ設計）

   使い方：
     FJLocations.PREFECTURES        // 47都道府県＋海外
     FJLocations.SEED_SPOTS         // 初期スポット名の種
     await FJLocations.loadKnownSpots()  // 種＋DB実データをマージした配列（キャッシュ済み）
   ============================================================ */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

  const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県', '海外'
  ];

  // ダイビング需要が特に多い都道府県（検索UIの「人気の都道府県」ショートカット用）
  const POPULAR_PREFECTURES = ['沖縄県', '静岡県', '鹿児島県', '和歌山県', '東京都', '高知県', '北海道'];

  // 旧14タクソノミーの名称。サジェストの呼び水として残す（実データが増えるまでの初期候補）
  const SEED_SPOTS = [
    '沖縄', '石垣島', '宮古島', '西表島', '与那国島', '久米島', '慶良間諸島',
    '奄美大島', '鹿児島', '伊豆', '東京', '紀伊半島', '瀬戸内', '北海道'
  ];

  let cachedSpots = null;
  let cachedPromise = null;

  function getClient() {
    if (window._sb) return window._sb;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    if (!window.__fjLocClient) {
      window.__fjLocClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__fjLocClient;
  }

  // 種データ＋DB実データ（listings.area の重複しない値）をマージして返す。
  // ネットワーク不可・未接続時は種データのみで解決する（呼び出し側は必ず失敗しない）。
  function loadKnownSpots() {
    if (cachedSpots) return Promise.resolve(cachedSpots);
    if (cachedPromise) return cachedPromise;

    cachedPromise = (async () => {
      const set = new Set(SEED_SPOTS);
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb
            .from('listings')
            .select('area')
            .eq('is_public', true)
            .not('area', 'is', null)
            .limit(500);
          if (!error && data) {
            data.forEach(row => {
              const v = (row.area || '').trim();
              if (v) set.add(v);
            });
          }
        }
      } catch (e) {
        // オフライン・ネットワーク制限時は種データのみで続行
      }
      cachedSpots = Array.from(set);
      return cachedSpots;
    })();

    return cachedPromise;
  }

  window.FJLocations = { PREFECTURES, POPULAR_PREFECTURES, SEED_SPOTS, loadKnownSpots, getClient };
})();
