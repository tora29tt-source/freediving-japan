/**
 * js/aida-rules.js
 *
 * AIDA 公式カウントダウン アナウンスモジュール
 * 出典: World Apnea Rules & Regulations 2025 V17.8 §4.2.9
 *
 * "The countdown shall consist of:
 *  2 minutes to official top, 1'30, 1 minute, 30 seconds, 20, 10,
 *  5, 4, 3, 2, 1, official top,
 *  plus 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 26, 27, 28, 29, 30, start cancelled."
 *
 * 使い方:
 *   aidaSpeak('Attention all athletes.')   // 文字列でも可
 *   aidaSpeak(AIDA_OT)                     // {en, ja} オブジェクトでも可
 *   aidaSetLang('ja')                      // 言語切り替え: 'en' | 'ja'
 *
 * 読み込み順: CDN supabase-js → supabase-config.js → aida-rules.js → ページ固有スクリプト
 */

// ── OT前アナウンス (seconds remaining before OT) ──────────────────────
// §4.2.9 の公式シーケンス（2分〜1秒）
var AIDA_BEFORE_OT = [
  { s: 120, key: '120', en: 'Two minutes to official top.', ja: '2分前。' },
  { s:  90, key:  '90', en: 'One thirty.',                   ja: '1分30秒。' },
  { s:  60, key:  '60', en: 'One minute.',                   ja: '1分前。' },
  { s:  30, key:  '30', en: 'Thirty seconds.',               ja: '30秒。' },
  { s:  20, key:  '20', en: 'Twenty.',                       ja: '20。' },
  { s:  10, key:  '10', en: 'Ten.',                          ja: '10。' },
  { s:   5, key:   '5', en: 'Five.',                         ja: '5。' },
  { s:   4, key:   '4', en: 'Four.',                         ja: '4。' },
  { s:   3, key:   '3', en: 'Three.',                        ja: '3。' },
  { s:   2, key:   '2', en: 'Two.',                          ja: '2。' },
  { s:   1, key:   '1', en: 'One.',                          ja: '1。' },
];

// ── オフィシャルトップ (secs === 0) ────────────────────────────────────
var AIDA_OT = { key: 'ot', en: 'Official top.', ja: 'オフィシャルトップ。' };

// ── OT後アナウンス (negative seconds = seconds after OT) ──────────────
// §4.2.9: plus 1, 2, ..., 10, 20, 25, 26, 27, 28, 29, 30, start cancelled
var AIDA_AFTER_OT = [
  { s:  -1, key:  'p1', en: 'Plus one.',        ja: 'プラス1。' },
  { s:  -2, key:  'p2', en: 'Two.',             ja: '2。' },
  { s:  -3, key:  'p3', en: 'Three.',           ja: '3。' },
  { s:  -4, key:  'p4', en: 'Four.',            ja: '4。' },
  { s:  -5, key:  'p5', en: 'Five.',            ja: '5。' },
  { s:  -6, key:  'p6', en: 'Six.',             ja: '6。' },
  { s:  -7, key:  'p7', en: 'Seven.',           ja: '7。' },
  { s:  -8, key:  'p8', en: 'Eight.',           ja: '8。' },
  { s:  -9, key:  'p9', en: 'Nine.',            ja: '9。' },
  { s: -10, key: 'p10', en: 'Ten.',             ja: '10。' },
  { s: -20, key: 'p20', en: 'Twenty.',          ja: '20。' },
  { s: -25, key: 'p25', en: 'Twenty five.',     ja: '25。' },
  { s: -26, key: 'p26', en: 'Twenty six.',      ja: '26。' },
  { s: -27, key: 'p27', en: 'Twenty seven.',    ja: '27。' },
  { s: -28, key: 'p28', en: 'Twenty eight.',    ja: '28。' },
  { s: -29, key: 'p29', en: 'Twenty nine.',     ja: '29。' },
  { s: -30, key: 'p30', en: 'Start cancelled.', ja: 'スタートキャンセル。' },
];

// ── 言語設定 ──────────────────────────────────────────────────────────
var _aidaLang = 'en';

function aidaSetLang(lang) {
  _aidaLang = (lang === 'ja') ? 'ja' : 'en';
}

function aidaGetLang() {
  return _aidaLang;
}

// ── 発話 ──────────────────────────────────────────────────────────────
/**
 * @param {string|{en:string,ja:string}} textOrObj
 * @param {number} [rateOverride]  デフォルト 0.9
 */
function aidaSpeak(textOrObj, rateOverride) {
  if (!window.speechSynthesis) return;
  var text = (typeof textOrObj === 'object')
    ? (textOrObj[_aidaLang] || textOrObj.en)
    : textOrObj;
  if (!text) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang   = _aidaLang === 'ja' ? 'ja-JP' : 'en-US';
  u.rate   = (rateOverride != null) ? rateOverride : 0.9;
  u.pitch  = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}
