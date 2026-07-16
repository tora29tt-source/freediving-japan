/**
 * freediving-utils.js
 * 共通ユーティリティ関数
 * パソコン復帰後：EVENT_CONFIG.maxDepthをSupabaseから取得する処理に差し替える
 */

// =============================================
// 大会設定（Supabase接続後はDBから取得）
// =============================================
var EVENT_CONFIG = {
  maxDepth: 150,      // 大会の最高深度（m）。大会作成時にスタッフが設定
  eventName: 'Volcano Cup 2026',
  eventDate: '2026-06-15',
};

// =============================================
// 深度プルダウン生成
// maxDepthから1m刻みで降順
// =============================================
function buildDepthSelect(selectEl, options) {
  options = options || {};
  var placeholder = options.placeholder || 'Select depth';
  var selected = options.selected || null;
  var max = options.max || EVENT_CONFIG.maxDepth;

  selectEl.innerHTML = '<option value="">' + placeholder + '</option>';
  for (var d = max; d >= 1; d--) {
    var opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = d + 'm';
    if (selected && parseInt(selected) === d) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// =============================================
// ペナルティプルダウン生成（1点刻み・小数点1桁）
// =============================================
function buildPenaltySelect(selectEl, options) {
  options = options || {};
  var max = options.max || 10;
  var selected = options.selected || null;

  selectEl.innerHTML = '<option value="0">0</option>';
  for (var p = 1; p <= max; p++) {
    var opt = document.createElement('option');
    opt.value = String(p) + '.0';
    opt.textContent = p + '.0';
    if (selected && parseFloat(selected) === p) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// =============================================
// 時間プルダウン生成（分:秒）
// =============================================
function buildTimeSelect(mEl, sEl, options) {
  options = options || {};
  var maxMin = options.maxMin || 29;
  // 0（"00"）はfalsyのため「|| null」だと潰れる。null/undefined/空文字のみnull扱いにする
  var selectedM = (options.selectedM != null && options.selectedM !== '') ? options.selectedM : null;
  var selectedS = (options.selectedS != null && options.selectedS !== '') ? options.selectedS : null;

  mEl.innerHTML = '<option value="">mm</option>';
  for (var m = 0; m <= maxMin; m++) {
    var opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    if (selectedM !== null && parseInt(selectedM) === m) opt.selected = true;
    mEl.appendChild(opt);
  }

  sEl.innerHTML = '<option value="">ss</option>';
  for (var s = 0; s <= 59; s++) {
    var opt2 = document.createElement('option');
    opt2.value = String(s).padStart(2, '0');
    opt2.textContent = String(s).padStart(2, '0');
    if (selectedS !== null && parseInt(selectedS) === s) opt2.selected = true;
    sEl.appendChild(opt2);
  }
}

// =============================================
// OT時刻プルダウン生成（時:分）
// =============================================
function buildOTSelect(hEl, mEl, options) {
  options = options || {};
  // 0時・0分（"00"）を有効値として通すため「|| null」を使わない
  var selectedH = (options.selectedH != null && options.selectedH !== '') ? options.selectedH : null;
  var selectedM = (options.selectedM != null && options.selectedM !== '') ? options.selectedM : null;

  hEl.innerHTML = '<option value="">hh</option>';
  for (var h = 0; h <= 23; h++) {
    var opt = document.createElement('option');
    opt.value = String(h).padStart(2, '0');
    opt.textContent = String(h).padStart(2, '0');
    if (selectedH !== null && parseInt(selectedH) === h) opt.selected = true;
    hEl.appendChild(opt);
  }

  mEl.innerHTML = '<option value="">mm</option>';
  for (var m = 0; m <= 59; m++) {
    var opt2 = document.createElement('option');
    opt2.value = String(m).padStart(2, '0');
    opt2.textContent = String(m).padStart(2, '0');
    if (selectedM !== null && parseInt(selectedM) === m) opt2.selected = true;
    mEl.appendChild(opt2);
  }
}

// =============================================
// Supabase接続後の差し替え用（パソコン復帰後に実装）
// =============================================
// async function loadEventConfig(eventId) {
//   const { data } = await supabase
//     .from('events')
//     .select('max_depth, name, date')
//     .eq('id', eventId)
//     .single();
//   if (data) {
//     EVENT_CONFIG.maxDepth = data.max_depth;
//     EVENT_CONFIG.eventName = data.name;
//     EVENT_CONFIG.eventDate = data.date;
//   }
// }
