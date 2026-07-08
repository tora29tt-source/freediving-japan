/* ============================================================
   area-map.js — 自前SVG日本地図によるエリア選択コンポーネント
   Google Maps 不使用（APIキー・課金・外部読み込みゼロ）。
   explore/index.html と explore/shops.html で共用。
   使い方:
     const map = FJAreaMap.render(containerEl, { onSelect: area => {...} });
     map.setCounts({ '沖縄': 3, ... });  // ピルに件数表示
     map.setActive('沖縄');              // 選択状態の同期（'' で全解除）
   スタイルは css/home.css の .fj-* に定義。
   ============================================================ */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // 実績・問い合わせが多いエリア（アクセント色＋パルスで強調）
  const HOT = new Set(['沖縄', '宮古島', '石垣島']);

  // スポット定義（x,y は viewBox 0 0 700 460 内の座標。inset=南西諸島拡大枠内）
  // anchor: ピル（ラベル）をドットのどちら側に出すか
  const SPOTS = [
    { area: '北海道',     x: 415, y: 85,  anchor: 'right' },
    { area: '東京',       x: 366, y: 277, anchor: 'right' },
    { area: '伊豆',       x: 348, y: 298, anchor: 'below' },
    { area: '紀伊半島',   x: 248, y: 335, anchor: 'below' },
    { area: '瀬戸内',     x: 165, y: 312, anchor: 'above' },
    { area: '鹿児島',     x: 92,  y: 383, anchor: 'right' },
    { area: '奄美大島',   x: 202, y: 64,  anchor: 'left'  },
    { area: '沖縄',       x: 182, y: 108, anchor: 'right' },
    { area: '久米島',     x: 110, y: 96,  anchor: 'left'  },
    { area: '慶良間諸島', x: 152, y: 134, anchor: 'left'  },
    { area: '宮古島',     x: 134, y: 170, anchor: 'right' },
    { area: '西表島',     x: 60,  y: 164, anchor: 'right' },
    { area: '石垣島',     x: 96,  y: 194, anchor: 'right' },
    { area: '与那国島',   x: 48,  y: 220, anchor: 'right' }
  ];

  // 本土のデフォルメ地形（頂点列を Catmull-Rom で平滑化して描く）
  const LAND_POINTS = [
    // 北海道
    [[386,104],[390,74],[412,52],[438,46],[464,56],[470,76],[486,88],[474,104],[456,108],[444,120],[430,136],[414,134],[402,120],[390,114]],
    // 本州（青森→太平洋岸→房総→伊豆→紀伊→下関→日本海岸→能登→青森）
    [[384,142],[396,158],[400,190],[394,222],[384,250],[378,268],[382,284],[374,294],[360,296],[352,306],[346,314],[340,300],[326,302],[306,300],[288,304],[272,306],[262,318],[256,330],[252,338],[247,331],[242,324],[234,312],[216,310],[196,308],[174,310],[152,314],[130,318],[112,322],[100,326],[94,316],[106,304],[128,296],[152,292],[176,288],[200,286],[222,282],[242,274],[252,264],[258,252],[266,246],[272,258],[276,268],[292,258],[310,244],[328,222],[344,196],[356,170],[370,150],[378,140]],
    // 四国
    [[150,330],[168,324],[190,324],[208,330],[212,342],[200,354],[180,358],[160,352],[148,340]],
    // 九州
    [[98,320],[114,316],[126,326],[128,342],[122,360],[112,380],[104,392],[92,392],[88,378],[78,364],[76,346],[84,332]]
  ];

  // 閉じた Catmull-Rom スプライン → cubic bezier パス文字列
  function smoothPath(pts) {
    const n = pts.length;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d + 'Z';
  }
  const LAND = LAND_POINTS.map(smoothPath);

  // 南西諸島拡大枠
  const INSET = { x: 34, y: 38, w: 216, h: 200 };

  // 枠内の島シルエット（ドットの下に敷く）
  const INSET_ISLANDS = [
    { d: 'M196,54 C204,50 212,56 209,65 C206,74 198,77 193,71 C190,66 190,58 196,54 Z' },              // 奄美大島
    { d: 'M177,95 C185,91 191,98 187,107 C183,117 177,123 172,118 C168,113 170,101 177,95 Z' },        // 沖縄本島
    { cx: 110, cy: 96,  r: 5 },   // 久米島
    { cx: 148, cy: 132, r: 3 }, { cx: 155, cy: 137, r: 2.5 }, { cx: 150, cy: 140, r: 2 },             // 慶良間（群島）
    { cx: 134, cy: 170, r: 5.5 }, // 宮古島
    { cx: 60,  cy: 164, r: 6.5 }, // 西表島
    { cx: 96,  cy: 194, r: 5 },   // 石垣島
    { cx: 48,  cy: 220, r: 4 }    // 与那国島
  ];

  function make(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // CJK前提の決め打ち幅計算（getBBox は display:none で 0 になるため使わない）
  function pillWidth(name, count) {
    const countStr = count == null ? '' : String(count);
    return name.length * 11 + (countStr ? 6 + countStr.length * 6.5 : 0) + 16;
  }

  function layoutPill(g, spot, count) {
    const w = pillWidth(spot.area, count);
    const rect = g.querySelector('.fj-pill-bg');
    const text = g.querySelector('text');
    let px, py;
    switch (spot.anchor) {
      case 'left':  px = -9 - w; py = -10; break;
      case 'below': px = -w / 2; py = 12;  break;
      case 'above': px = -w / 2; py = -32; break;
      default:      px = 9;      py = -10; // right
    }
    rect.setAttribute('x', px); rect.setAttribute('y', py); rect.setAttribute('width', w);
    text.setAttribute('x', px + 8); text.setAttribute('y', py + 14);
  }

  function render(container, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const svg = make('svg', { viewBox: '0 0 700 460', class: 'fj-map-svg', role: 'group', 'aria-label': 'エリアを地図から選ぶ' });

    // ── 背景（海）：グラデーション＋ドットテクスチャ ──
    const defs = make('defs', {});
    defs.innerHTML =
      '<linearGradient id="fjSea" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#eff7f7"/><stop offset="1" stop-color="#ddecee"/></linearGradient>' +
      '<pattern id="fjDots" width="16" height="16" patternUnits="userSpaceOnUse">' +
      '<circle cx="2" cy="2" r="1" fill="rgba(31,111,120,0.08)"/></pattern>';
    svg.appendChild(defs);
    svg.appendChild(make('rect', { x: 0, y: 0, width: 700, height: 460, fill: 'url(#fjSea)' }));
    svg.appendChild(make('rect', { x: 0, y: 0, width: 700, height: 460, fill: 'url(#fjDots)' }));

    // ── 本土 ──
    const landG = make('g', { class: 'fj-land-g' });
    LAND.forEach(d => landG.appendChild(make('path', { class: 'fj-land', d })));
    svg.appendChild(landG);

    // ── 南西諸島 拡大枠 ──
    svg.appendChild(make('rect', { class: 'fj-inset-box', x: INSET.x, y: INSET.y, width: INSET.w, height: INSET.h, rx: 14 }));
    const insetLabel = make('text', { class: 'fj-inset-label', x: INSET.x + 12, y: INSET.y + 20 });
    insetLabel.textContent = '南西諸島';
    svg.appendChild(insetLabel);
    INSET_ISLANDS.forEach(i => {
      svg.appendChild(i.d
        ? make('path', { class: 'fj-island', d: i.d })
        : make('circle', { class: 'fj-island', cx: i.cx, cy: i.cy, r: i.r }));
    });

    // ── 飾り：方位とキャプション ──
    const compass = make('text', { class: 'fj-compass', x: 668, y: 34, 'text-anchor': 'middle' });
    compass.textContent = 'N';
    svg.appendChild(compass);
    svg.appendChild(make('path', { d: 'M668,40 l0,14 M664,46 l4,-6 4,6', stroke: 'rgba(91,91,96,0.7)', 'stroke-width': 1.2, fill: 'none' }));
    const caption = make('text', { class: 'fj-caption', x: 688, y: 448, 'text-anchor': 'end' });
    caption.textContent = 'FREEDIVING JAPAN — DIVE SPOTS';
    svg.appendChild(caption);

    // ── スポットピン（ドット＋件数ピル） ──
    const pins = {};
    SPOTS.forEach(spot => {
      const hot = HOT.has(spot.area);
      const g = make('g', {
        class: 'fj-pin' + (hot ? ' hot' : ''),
        'data-area': spot.area,
        transform: `translate(${spot.x},${spot.y})`,
        tabindex: 0, role: 'button', 'aria-label': spot.area + 'で絞り込む'
      });
      if (hot) g.appendChild(make('circle', { class: 'fj-halo', r: 10 }));
      g.appendChild(make('circle', { class: 'fj-pin-dot', r: hot ? 5.5 : 4.5 }));
      const rect = make('rect', { class: 'fj-pill-bg', rx: 10, height: 20 });
      g.appendChild(rect);
      const text = make('text', {});
      const nameSpan = make('tspan', { class: 'fj-pill-name' });
      nameSpan.textContent = spot.area;
      const countSpan = make('tspan', { class: 'fj-pill-count', dx: 5 });
      text.appendChild(nameSpan);
      text.appendChild(countSpan);
      g.appendChild(text);
      layoutPill(g, spot, null);
      const fire = () => opts.onSelect && opts.onSelect(spot.area);
      g.addEventListener('click', fire);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
      svg.appendChild(g);
      pins[spot.area] = { g, spot };
    });

    container.appendChild(svg);

    return {
      setCounts(counts) {
        SPOTS.forEach(spot => {
          const p = pins[spot.area];
          const c = counts && counts[spot.area] != null ? counts[spot.area] : null;
          p.g.querySelector('.fj-pill-count').textContent = c == null ? '' : c;
          p.g.classList.toggle('dim', c === 0);
          layoutPill(p.g, spot, c);
        });
      },
      setActive(area) {
        SPOTS.forEach(spot => pins[spot.area].g.classList.toggle('active', spot.area === area));
      }
    };
  }

  window.FJAreaMap = { render };
})();
