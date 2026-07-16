/** v1.0.1
 * js/lang-switcher.js — 全ページ共通の言語切替モジュール
 *
 * 機能:
 *   1. ブラウザ言語を自動検出（初回訪問時）
 *   2. 選択言語を localStorage に保存（以降の訪問で復元）
 *   3. .hdr-right にグローブアイコン＋ドロップダウンを注入
 *   4. LangSwitcher.init(onChangeFn) で初期化
 *
 * 依存: js/i18n.js（I18N オブジェクト）
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'fj_lang';
  const SUPPORTED   = ['ja', 'en', 'ko', 'zh'];
  const LABELS      = { ja: '日本語', en: 'EN', ko: '한국어', zh: '中文' };

  /* ── 言語取得 ── */
  function detectBrowserLang() {
    const bl = (navigator.language || 'ja').toLowerCase();
    if (bl.startsWith('ko')) return 'ko';
    if (bl.startsWith('zh')) return 'zh';
    if (bl.startsWith('ja')) return 'ja';
    return 'en'; // その他はEN
  }

  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored && SUPPORTED.includes(stored)) ? stored : detectBrowserLang();
  }

  function setLang(lang) {
    if (SUPPORTED.includes(lang)) localStorage.setItem(STORAGE_KEY, lang);
  }

  /* ── CSS注入 ── */
  function injectCSS() {
    if (document.getElementById('fj-lang-style')) return;
    const s = document.createElement('style');
    s.id = 'fj-lang-style';
    s.textContent = `
      .hdr-lang { position: relative; margin-right: 2px; }
      .hdr-lang-btn {
        display: flex; align-items: center; gap: 4px;
        padding: 5px 8px; border: none; background: transparent;
        cursor: pointer; font-size: 12px; font-weight: 600;
        color: var(--ink-mid, #666); border-radius: 6px;
        white-space: nowrap;
      }
      .hdr-lang-btn:hover { background: var(--bg-sub, #f0f0f0); }
      .hdr-lang-btn .ls-icon {
        width: 15px; height: 15px; flex-shrink: 0;
        stroke: currentColor; fill: none; stroke-width: 1.8;
        stroke-linecap: round;
      }
      .hdr-lang-menu {
        position: absolute; top: calc(100% + 6px); right: 0;
        background: #fff; border: 1px solid var(--line, #e0e0e0);
        border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12);
        padding: 4px; min-width: 108px; z-index: 9999;
      }
      .hdr-lang-opt {
        display: block; width: 100%; padding: 7px 14px;
        border: none; background: transparent; cursor: pointer;
        font-size: 13px; font-weight: 500; color: var(--ink, #111);
        border-radius: 5px; text-align: left;
      }
      .hdr-lang-opt:hover { background: var(--bg-sub, #f0f0f0); }
      .hdr-lang-opt.active { color: var(--accent, #0057d8); font-weight: 700; }
      /* ヘッダーが無いページ用のフローティング表示 */
      .fj-lang-float {
        position: fixed; top: 14px; right: 14px; z-index: 10000;
      }
      .fj-lang-float .hdr-lang-btn {
        background: #fff; border: 1px solid #e0e0e0; border-radius: 999px;
        padding: 7px 12px; box-shadow: 0 2px 10px rgba(0,0,0,.12);
        color: #333;
      }
      .fj-lang-float .hdr-lang-btn:hover { background: #f5f5f5; }
    `;
    document.head.appendChild(s);
  }

  /* ── ヘッダーUI注入 ── */
  function injectHeaderSwitcher(onChangeFn) {
    // .hdr-right / .header-icons / .hdr-in（いずれか最初に見つかったもの）に注入
    // どれも無いページ（auth.html等）では右上フローティング表示にフォールバック
    let hdrRight = document.querySelector('.hdr-right') || document.querySelector('.header-icons') || document.querySelector('.hdr-in');
    let floating = false;
    if (!hdrRight) {
      hdrRight = document.body;
      floating = true;
    }
    if (document.querySelector('.hdr-lang')) return;

    injectCSS();
    const current = getLang();

    const wrapper = document.createElement('div');
    wrapper.className = 'hdr-lang' + (floating ? ' fj-lang-float' : '');
    wrapper.innerHTML = `
      <button class="hdr-lang-btn" aria-label="言語切替 / Language">
        <svg class="ls-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"/>
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>
        </svg>
        <span class="hdr-lang-label">${LABELS[current]}</span>
      </button>
      <div class="hdr-lang-menu" hidden>
        ${SUPPORTED.map(l =>
          `<button class="hdr-lang-opt${l === current ? ' active' : ''}" data-lang="${l}">${LABELS[l]}</button>`
        ).join('')}
      </div>`;

    hdrRight.insertBefore(wrapper, hdrRight.firstChild);

    const btn   = wrapper.querySelector('.hdr-lang-btn');
    const menu  = wrapper.querySelector('.hdr-lang-menu');
    const label = wrapper.querySelector('.hdr-lang-label');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', () => { menu.hidden = true; });

    wrapper.querySelectorAll('.hdr-lang-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.dataset.lang;
        setLang(lang);
        label.textContent = LABELS[lang];
        wrapper.querySelectorAll('.hdr-lang-opt').forEach(o =>
          o.classList.toggle('active', o.dataset.lang === lang)
        );
        // in-page .lang-btn との同期
        document.querySelectorAll('.lang-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.lang === lang)
        );
        menu.hidden = true;
        if (typeof onChangeFn === 'function') onChangeFn(lang);
      });
    });
  }

  /* ── 公開API ── */
  function init(onChangeFn) {
    function setup() {
      injectHeaderSwitcher(onChangeFn);
      const lang = getLang();
      // 日本語以外 or 明示保存済みの場合は即時適用
      if (lang !== 'ja' && typeof onChangeFn === 'function') {
        onChangeFn(lang);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  window.LangSwitcher = { getLang, setLang, init };
})();
