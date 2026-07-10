/* ============================================================
   area-picker.js — 検索バー「どこで潜る？」候補ドロップダウン
   （2026-07-10・secretary相談で確定「エリア設計の刷新」で全面書き換え）

   旧実装は固定14タクソノミー（沖縄・伊豆…）前提だったが、
   都道府県を検索の主軸にし、スポット名は自由入力＋サジェストへ移行した
   方針に合わせて作り直した。単一テキスト入力（name="area"）の
   仕様は維持し、候補は以下の2段構成：
   - 人気の都道府県（FJLocations.POPULAR_PREFECTURES）
   - よく検索されるスポット名（FJLocations.loadKnownSpots() = 種データ＋DB実データ）
   どちらを選んでも同じテキスト欄に入るだけなので、下流の検索（explore側の
   フリーテキスト一致）はそのまま機能する。

   js/location-data.js への依存あり（PREFECTURES/SEED_SPOTS/loadKnownSpots）。
   ============================================================ */
(function () {
  'use strict';

  const RECENT_KEY = 'fj_recent_areas';
  const RECENT_MAX = 4;

  const PREF_META = {
    '沖縄県':   { emoji: '🏝️', tag: '青の洞窟と抜群の透明度' },
    '静岡県':   { emoji: '🐠', tag: '伊豆など東京から日帰りできる定番エリア' },
    '鹿児島県': { emoji: '🌋', tag: '錦江湾・離島の素潜りスポット' },
    '和歌山県': { emoji: '🐟', tag: '黒潮が育てる豊かな魚影' },
    '東京都':   { emoji: '🏊', tag: 'プール講習・体験に通いやすい' },
    '高知県':   { emoji: '🐬', tag: '柏島など透明度の高い黒潮の海' },
    '北海道':   { emoji: '❄️', tag: '澄み切った冷たい海を楽しむ' }
  };

  const ICON_CLOCK = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
  const ICON_MAP = '<svg class="icon" viewBox="0 0 24 24"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>';

  // js/location-data.js 未読み込み時のフォールバック（都道府県サジェストが空にならないようにする保険）
  const FALLBACK_POPULAR = ['沖縄県', '静岡県', '鹿児島県', '和歌山県', '東京都', '高知県', '北海道'];
  const FALLBACK_SEED = ['沖縄', '石垣島', '宮古島', '西表島', '与那国島', '久米島', '慶良間諸島', '奄美大島', '鹿児島', '伊豆', '東京', '紀伊半島', '瀬戸内', '北海道'];

  const LOC = window.FJLocations || {};
  const POPULAR_PREFECTURES = LOC.POPULAR_PREFECTURES || FALLBACK_POPULAR;

  // よく検索されるスポット名。初期は種データのみ、DB実データが取得できたら差し替える。
  let knownSpots = (LOC.SEED_SPOTS || FALLBACK_SEED).slice();
  if (LOC.loadKnownSpots) {
    LOC.loadKnownSpots().then(spots => {
      knownSpots = spots;
      if (openState) refreshPanel(openState.input);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  }
  function pushRecent(area) {
    try {
      let list = getRecent().filter(a => a !== area);
      list.unshift(area);
      list = list.slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) { /* localStorage不可時は無視 */ }
  }

  function isMobile() { return window.matchMedia('(max-width:640px)').matches; }

  // ── モジュール全体で1つだけ開く ──
  let openState = null; // { input, panel, scrim }

  function closeOpen() {
    if (!openState) return;
    openState.panel.remove();
    if (openState.scrim) openState.scrim.remove();
    openState = null;
  }

  document.addEventListener('mousedown', (e) => {
    if (!openState) return;
    if (openState.panel.contains(e.target) || e.target === openState.input) return;
    closeOpen();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openState) { const inp = openState.input; closeOpen(); inp.blur(); }
  });
  window.addEventListener('resize', closeOpen);
  // ページ本体のスクロールでのみ閉じる。パネル内部（候補リスト）のスクロールでは閉じない。
  window.addEventListener('scroll', (e) => {
    if (!openState) return;
    if (openState.panel.contains(e.target)) return;
    closeOpen();
  }, true);

  function buildSectionHTML(input, query) {
    const q = (query || '').trim();
    const recent = getRecent().filter(a => !q || a.includes(q));
    const prefs = POPULAR_PREFECTURES.filter(p => {
      if (!q) return true;
      const meta = PREF_META[p];
      return p.includes(q) || (meta && meta.tag.includes(q));
    });
    const spots = knownSpots.filter(a => !q || a.includes(q));

    let html = '';

    if (recent.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">最近の検索</p><div class="area-dd-list">';
      recent.forEach(a => {
        html += `<button type="button" class="area-dd-recent-row" data-area="${esc(a)}">${ICON_CLOCK}<span>${esc(a)}</span></button>`;
      });
      html += '</div></div>';
    }

    if (prefs.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">人気の都道府県</p><div class="area-dd-list">';
      prefs.forEach(p => {
        const meta = PREF_META[p] || { emoji: '📍', tag: '' };
        html += `<button type="button" class="area-dd-row" data-area="${esc(p)}">` +
          `<span class="area-dd-emoji">${meta.emoji}</span>` +
          `<span class="area-dd-row-text"><span class="area-dd-row-name">${esc(p)}</span><span class="area-dd-row-tag">${esc(meta.tag)}</span></span>` +
          `</button>`;
      });
      html += '</div></div>';
    }

    if (spots.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">よく検索されるスポット名</p><div class="area-dd-chips">';
      spots.forEach(a => {
        html += `<button type="button" class="area-dd-chip" data-area="${esc(a)}">${esc(a)}</button>`;
      });
      html += '</div></div>';
    }

    if (!recent.length && !prefs.length && !spots.length) {
      html += `<div class="area-dd-empty">「${esc(q)}」で自由に検索できます</div>`;
    }

    html += '<div class="area-dd-foot"><a href="' + (input.dataset.exploreHref || 'explore/index.html') + '">' + ICON_MAP + '探すページで都道府県から選ぶ</a></div>';

    return html;
  }

  function selectArea(input, area) {
    input.value = area;
    pushRecent(area);
    closeOpen();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const form = input.closest('form.searchbar');
    const dateInput = form && form.querySelector('.sb-when .sb-input');
    if (dateInput) dateInput.focus(); else input.blur();
  }

  function openPanel(input) {
    if (openState && openState.input === input) return;
    closeOpen();

    const seg = input.closest('.sb-seg') || input.parentElement;
    const panel = document.createElement('div');
    panel.className = 'area-dd';
    panel.innerHTML = buildSectionHTML(input, input.value);
    seg.appendChild(panel);

    let scrim = null;
    if (isMobile()) {
      scrim = document.createElement('div');
      scrim.className = 'area-dd-scrim open';
      document.body.appendChild(scrim);
      scrim.addEventListener('mousedown', closeOpen);
    }

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-area]');
      if (btn) selectArea(input, btn.dataset.area);
    });

    // 画面右端をはみ出す場合は右寄せに切り替え（デスクトップのみ）
    if (!isMobile()) {
      requestAnimationFrame(() => {
        const r = panel.getBoundingClientRect();
        if (r.right > window.innerWidth - 8) {
          panel.style.left = 'auto';
          panel.style.right = '0';
        }
      });
    }

    openState = { input, panel, scrim };
  }

  function refreshPanel(input) {
    if (!openState || openState.input !== input) return;
    openState.panel.innerHTML = buildSectionHTML(input, input.value);
  }

  function attach(input) {
    if (input.dataset.areaPickerBound) return;
    input.dataset.areaPickerBound = '1';
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', () => openPanel(input));
    input.addEventListener('click', () => openPanel(input));
    input.addEventListener('input', () => refreshPanel(input));
  }

  function init() {
    document.querySelectorAll('form.searchbar input.sb-input[name="area"]').forEach(attach);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FJAreaPicker = { attach, init };
})();
