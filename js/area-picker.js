/* ============================================================
   area-picker.js — Airbnb風「どこで潜る？」候補ドロップダウン
   トップページ／ピラーページ（freediving/skindiving/snorkeling.html）の
   form.searchbar 内 input[name="area"] に自動アタッチする。
   ・最近の検索（localStorage）
   ・人気のエリア（本土側、アイコン＋一言説明）
   ・南西諸島の離島（沖縄など候補が多いエリアを個別に見えるようチップで併記）
   エリア名は js/area-map.js の SPOTS / explore/index.html の #areaChips と揃えている。
   explore/index.html は既存のSVG地図＋チップUIを持つため対象外。
   ============================================================ */
(function () {
  'use strict';

  const RECENT_KEY = 'fj_recent_areas';
  const RECENT_MAX = 4;

  // 本土側の主要エリア（アイコン＋一言説明つきでリスト表示）
  const MAIN_AREAS = [
    { area: '沖縄',     emoji: '🏝️', tag: '青の洞窟と抜群の透明度' },
    { area: '伊豆',     emoji: '🐠', tag: '東京から日帰りできる定番エリア' },
    { area: '紀伊半島', emoji: '🐟', tag: '黒潮が育てる豊かな魚影' },
    { area: '瀬戸内',   emoji: '⛵', tag: '穏やかな内海で安心して潜れる' },
    { area: '鹿児島',   emoji: '🌋', tag: '錦江湾と桜島を望むスポット' },
    { area: '東京',     emoji: '🏊', tag: 'プール講習・体験に通いやすい' },
    { area: '北海道',   emoji: '❄️', tag: '澄み切った冷たい海を楽しむ' }
  ];

  // 沖縄をはじめ候補が多い南西諸島の離島。チップで一覧性高く並べる。
  const REMOTE_ISLANDS = ['石垣島', '宮古島', '西表島', '与那国島', '久米島', '慶良間諸島', '奄美大島'];

  const ICON_CLOCK = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
  const ICON_MAP = '<svg class="icon" viewBox="0 0 24 24"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>';

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
  window.addEventListener('scroll', () => { if (openState) closeOpen(); }, true);

  function buildSectionHTML(input, query) {
    const q = (query || '').trim();
    const recent = getRecent().filter(a => !q || a.includes(q));
    const mains = MAIN_AREAS.filter(a => !q || a.area.includes(q) || a.tag.includes(q));
    const islands = REMOTE_ISLANDS.filter(a => !q || a.includes(q));

    let html = '';

    if (recent.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">最近の検索</p><div class="area-dd-list">';
      recent.forEach(a => {
        html += `<button type="button" class="area-dd-recent-row" data-area="${esc(a)}">${ICON_CLOCK}<span>${esc(a)}</span></button>`;
      });
      html += '</div></div>';
    }

    if (mains.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">人気のエリア</p><div class="area-dd-list">';
      mains.forEach(a => {
        html += `<button type="button" class="area-dd-row" data-area="${esc(a.area)}">` +
          `<span class="area-dd-emoji">${a.emoji}</span>` +
          `<span class="area-dd-row-text"><span class="area-dd-row-name">${esc(a.area)}</span><span class="area-dd-row-tag">${esc(a.tag)}</span></span>` +
          `</button>`;
      });
      html += '</div></div>';
    }

    if (islands.length) {
      html += '<div class="area-dd-sec"><p class="area-dd-sec-title">南西諸島の離島（沖縄周辺）</p><div class="area-dd-chips">';
      islands.forEach(a => {
        html += `<button type="button" class="area-dd-chip" data-area="${esc(a)}">${esc(a)}</button>`;
      });
      html += '</div></div>';
    }

    if (!recent.length && !mains.length && !islands.length) {
      html += `<div class="area-dd-empty">「${esc(q)}」で自由に検索できます</div>`;
    }

    html += '<div class="area-dd-foot"><a href="' + (input.dataset.exploreHref || 'explore/index.html') + '">' + ICON_MAP + '地図から全エリアを見る</a></div>';

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
