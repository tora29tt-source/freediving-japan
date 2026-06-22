/**
 * STA Timer — Freediving Japan App
 * Webタイマー（sta-timer.html）と同等の機能を実装
 *
 * 機能:
 * - Stopwatch / Table / Preset の3モード
 * - AIDAカウントダウンアナウンス（expo-speech）
 * - Time Call（Hold中の経過アナウンス）
 * - 1st Contraction ボタン
 * - Surface Protocol（Hold後3秒カウント）
 * - Table設定（Sets / Hold / Rest / Decrement / Breath-up）
 * - プリセット（O2 Basic / CO2 Basic / Relaxation）
 * - セッション統計（Best / Avg / Sets）
 * - Supabase保存
 * - EN/JA アナウンス切り替え
 */

import React, { useEffect, useRef, useState } from 'react';
import { useBleSpO2 } from '../hooks/useBleSpO2';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// react-native-svg は RN 0.85 との C++ ABI 非互換のため使用しない

// ─── expo-speech (optional — needs EAS build with package) ───────────────────
let Speech: { speak: (t: string, o?: { language?: string }) => void; stop: () => void } | null = null;
try { Speech = require('expo-speech'); } catch {}

// ─── expo-haptics (optional) ─────────────────────────────────────────────────
let Haptics: { impactAsync: (s?: string) => void; notificationAsync: (t?: string) => void } | null = null;
try { Haptics = require('expo-haptics'); } catch {}

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:        '#060f17',
  surface:   '#0b2035',
  surface2:  '#0f2a44',
  teal:      '#2ec4b6',
  tealDim:   'rgba(46,196,182,0.12)',
  tealLight: '#a8ece8',
  warm:      '#f97316',
  danger:    '#ef4444',
  success:   '#22c55e',
  text:      '#e8f4f8',
  muted:     '#5a8ca8',
  border:    '#1a3f5c',
  yellow:    '#eab308',
} as const;

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Mode  = 'free' | 'table' | 'preset';
type Phase = 'idle' | 'breatheUp' | 'hold' | 'surface' | 'rest';
type Lang  = 'en' | 'ja';

interface Cfg {
  sets: number;
  holdMin: number; holdSec: number;
  restMin: number; restSec: number;
  decrementSec: number;   // rest change per set (negative = shorter)
  holdDeltaSec: number;   // hold change per set
  holdStop: 'manual' | 'auto';
  prepSec: number;        // breath-up before set 1
  timeCallEnabled: boolean;
  timeCallStartSec: number;
  timeCallIntervalSec: number;
  timeCallCountdownEnabled: boolean;
}

interface Dive {
  holdMs: number;
  fcMs?: number;
  minSpo2?: number;
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────
const DEFAULT_CFG: Cfg = {
  sets: 8,
  holdMin: 2, holdSec: 0,
  restMin: 2, restSec: 0,
  decrementSec: 0,
  holdDeltaSec: 0,
  holdStop: 'manual',
  prepSec: 120,
  timeCallEnabled: false,
  timeCallStartSec: 180,
  timeCallIntervalSec: 30,
  timeCallCountdownEnabled: true,
};

// ─── AIDA ANNOUNCEMENTS ──────────────────────────────────────────────────────
const AIDA = [
  { sb: 120, en: 'Two minutes',    ja: '2分前'            },
  { sb:  90, en: 'One thirty',     ja: '1分30秒'           },
  { sb:  60, en: 'One minute',     ja: '1分前'             },
  { sb:  30, en: 'Thirty seconds', ja: '30秒'              },
  { sb:  20, en: 'Twenty seconds', ja: '20秒'              },
  { sb:  10, en: 'Ten seconds',    ja: '10秒'              },
  { sb:   5, en: 'Five',           ja: '5'                },
  { sb:   4, en: 'Four',           ja: '4'                },
  { sb:   3, en: 'Three',          ja: '3'                },
  { sb:   2, en: 'Two',            ja: '2'                },
  { sb:   1, en: 'One',            ja: '1'                },
  { sb:   0, en: 'Official Top',   ja: 'オフィシャルトップ' },
];

// ─── PRESETS ─────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'o2', icon: '🫁', name: 'O2 Basic',
    desc: 'Hold Manual · Rest 2:00 固定 · 8セット\n酸素耐性の基礎トレーニング',
    tags: [{ l: 'O2', t: 'o2' as const }, { l: 'Manual Hold', t: 'info' as const }, { l: '8 sets', t: 'info' as const }],
    cfg: { holdStop: 'manual' as const, restMin: 2, restSec: 0, decrementSec: 0, sets: 8 },
  },
  {
    id: 'co2', icon: '💨', name: 'CO2 Basic',
    desc: 'Hold 2:00 · Rest 2:00 → −10s/set · 8セット\nCO2耐性の基礎トレーニング',
    tags: [{ l: 'CO2', t: 'co2' as const }, { l: '−10s/set', t: 'co2' as const }, { l: '8 sets', t: 'info' as const }],
    cfg: { holdStop: 'auto' as const, holdMin: 2, holdSec: 0, restMin: 2, restSec: 0, decrementSec: -10, sets: 8 },
  },
  {
    id: 'relax', icon: '🧘', name: 'Relaxation',
    desc: '1st Contraction を目標に\nRest 2:00 · 8セット',
    tags: [{ l: 'O2', t: 'o2' as const }, { l: 'FC Focus', t: 'info' as const }, { l: '8 sets', t: 'info' as const }],
    cfg: { holdStop: 'manual' as const, restMin: 2, restSec: 0, sets: 8 },
  },
];

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SB_URL = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

async function sbInsert(table: string, row: object): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
const fmtMs  = (ms: number) => `${pad2(ms / 1000 / 60)}:${pad2(ms / 1000 % 60)}.${pad2(ms % 1000 / 10)}`;
const fmtSec = (s:  number) => `${pad2(s / 60)}:${pad2(s % 60)}`;
const getAvgMs = (dives: Dive[]) =>
  dives.length ? dives.reduce((a, d) => a + d.holdMs, 0) / dives.length : 0;

// ─── PURE-RN PROGRESS RING ───────────────────────────────────────────────────
// react-native-svg を使わず、2つの半円クリップで時計回りの進捗リングを実現する。
// 右クリップ: p=0→0.5 の間に右弧を上から時計回りに描く (disc rotation: -180°→0°)
// 左クリップ: p=0.5→1.0 の間に左弧を下から時計回りに描く (disc rotation: 180°→0°)
const R_SIZE   = 260;
const R_STROKE = 5;

function TimerRing({
  progress,
  color,
  trackColor = C.surface2,
  children,
}: {
  progress: number;
  color: string;
  trackColor?: string;
  children: React.ReactNode;
}) {
  const p    = Math.min(Math.max(progress, 0), 1);
  const half = R_SIZE / 2;

  // 右クリップ内の disc 回転: p=0 → -180°, p=0.5 → 0°
  const rightRot = (2 * Math.min(p, 0.5) - 1) * 180;
  // 左クリップ内の disc 回転: p=0.5 → 180°, p=1 → 0°
  const leftRot  = 360 * (1 - Math.max(p, 0.5));

  const discBase: object = {
    position: 'absolute' as const,
    width: R_SIZE,
    height: R_SIZE,
    borderRadius: half,
    borderWidth: R_STROKE,
  };

  const inner = R_SIZE - R_STROKE * 2 - 16;

  return (
    <View style={{ width: R_SIZE, height: R_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* トラック（背景の円リング） */}
      <View style={[discBase, { borderColor: trackColor }]} />

      {/* 右クリップ: 右半分のみ表示, discを左 -half に配置してcenter=x:0 of clip */}
      <View style={{
        position: 'absolute', right: 0, top: 0,
        width: half, height: R_SIZE, overflow: 'hidden',
      }}>
        <View style={[discBase, {
          left: -half,
          borderColor: p > 0 ? color : 'transparent',
          transform: [{ rotate: `${rightRot}deg` }],
        }]} />
      </View>

      {/* 左クリップ: 左半分のみ表示, discはleft:0でcenter=x:half of clip */}
      <View style={{
        position: 'absolute', left: 0, top: 0,
        width: half, height: R_SIZE, overflow: 'hidden',
      }}>
        <View style={[discBase, {
          left: 0,
          borderColor: p > 0.5 ? color : 'transparent',
          transform: [{ rotate: `${leftRot}deg` }],
        }]} />
      </View>

      {/* 中央コンテンツ */}
      <View style={{
        width: inner, height: inner,
        borderRadius: inner / 2,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </View>
    </View>
  );
}

// ─── STEPPER ─────────────────────────────────────────────────────────────────
function Stepper({
  value, min, max, step, fmt: fmtFn, onChange,
}: {
  value: number; min: number; max: number; step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={ss.stepper}>
      <Pressable style={ss.stepBtn}
        onPress={() => onChange(Math.max(min, value - step))}>
        <Text style={ss.stepBtnTxt}>−</Text>
      </Pressable>
      <Text style={ss.stepVal}>{fmtFn ? fmtFn(value) : value}</Text>
      <Pressable style={ss.stepBtn}
        onPress={() => onChange(Math.min(max, value + step))}>
        <Text style={ss.stepBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

function TimeStepper({ totalSec, onChange }: { totalSec: number; onChange: (s: number) => void }) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Stepper value={m} min={0} max={10} step={1}
        fmt={v => `${v}m`} onChange={v => onChange(v * 60 + s)} />
      <Stepper value={s} min={0} max={55} step={5}
        fmt={v => `${pad2(v)}s`} onChange={v => onChange(m * 60 + v)} />
    </View>
  );
}

// ─── TABLE CONFIG ─────────────────────────────────────────────────────────────
function TableConfig({ cfg, onChange }: { cfg: Cfg; onChange: (c: Cfg) => void }) {
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => onChange({ ...cfg, [k]: v });

  return (
    <View style={ss.cfgBox}>
      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Hold Stop</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['manual', 'auto'] as const).map(v => (
            <Pressable key={v} style={[ss.toggleBtn, cfg.holdStop === v && ss.toggleBtnOn]}
              onPress={() => set('holdStop', v)}>
              <Text style={[ss.toggleBtnTxt, cfg.holdStop === v && { color: C.tealLight }]}>
                {v === 'manual' ? 'Manual' : 'Auto'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Sets</Text>
        <Stepper value={cfg.sets} min={1} max={20} step={1} onChange={v => set('sets', v)} />
      </View>

      {cfg.holdStop === 'auto' && <>
        <View style={ss.cfgRow}>
          <Text style={ss.cfgLbl}>Hold Time</Text>
          <TimeStepper totalSec={cfg.holdMin * 60 + cfg.holdSec}
            onChange={s => onChange({ ...cfg, holdMin: Math.floor(s / 60), holdSec: s % 60 })} />
        </View>
        <View style={ss.cfgRow}>
          <Text style={ss.cfgLbl}>Hold ±/set</Text>
          <Stepper value={cfg.holdDeltaSec} min={-30} max={30} step={5}
            fmt={v => v >= 0 ? `+${v}s` : `${v}s`}
            onChange={v => set('holdDeltaSec', v)} />
        </View>
      </>}

      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Rest Time</Text>
        <TimeStepper totalSec={cfg.restMin * 60 + cfg.restSec}
          onChange={s => onChange({ ...cfg, restMin: Math.floor(s / 60), restSec: s % 60 })} />
      </View>

      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Rest ±/set</Text>
        <Stepper value={cfg.decrementSec} min={-60} max={60} step={5}
          fmt={v => v >= 0 ? `+${v}s` : `${v}s`}
          onChange={v => set('decrementSec', v)} />
      </View>

      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Breath Up</Text>
        <TimeStepper totalSec={cfg.prepSec} onChange={s => set('prepSec', s)} />
      </View>

      <View style={ss.cfgRow}>
        <Text style={ss.cfgLbl}>Time Call</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([false, true] as const).map(v => (
            <Pressable key={String(v)} style={[ss.toggleBtn, cfg.timeCallEnabled === v && ss.toggleBtnOn]}
              onPress={() => set('timeCallEnabled', v)}>
              <Text style={[ss.toggleBtnTxt, cfg.timeCallEnabled === v && { color: C.tealLight }]}>
                {v ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {cfg.timeCallEnabled && <>
        <View style={ss.cfgRow}>
          <Text style={ss.cfgLbl}>TC Start</Text>
          <TimeStepper totalSec={cfg.timeCallStartSec}
            onChange={s => set('timeCallStartSec', s)} />
        </View>
        <View style={ss.cfgRow}>
          <Text style={ss.cfgLbl}>TC Interval</Text>
          <Stepper value={cfg.timeCallIntervalSec} min={10} max={60} step={10}
            fmt={v => `${v}s`} onChange={v => set('timeCallIntervalSec', v)} />
        </View>
      </>}
    </View>
  );
}

// ─── SAVE MODAL ───────────────────────────────────────────────────────────────
function SaveModal({
  visible, dives, onClose, onSave,
}: {
  visible: boolean; dives: Dive[];
  onClose: () => void; onSave: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const best = dives.length ? Math.max(...dives.map(d => d.holdMs)) : 0;
  const avg_ = getAvgMs(dives);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose}>
        <Pressable style={ss.sheet} onPress={e => e.stopPropagation()}>
          <Text style={ss.sheetTitle}>セッション確認</Text>
          <View style={ss.modalSummary}>
            {[['Best', fmtMs(best)], ['Avg', fmtMs(avg_)], ['Sets', dives.length]].map(([l, v]) => (
              <View key={l as string} style={ss.modalStat}>
                <Text style={ss.modalStatLbl}>{l}</Text>
                <Text style={ss.modalStatVal}>{v}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ maxHeight: 180, marginBottom: 10 }}>
            {dives.map((d, i) => (
              <View key={i} style={ss.logRow}>
                <Text style={ss.logN}>#{i + 1}</Text>
                <Text style={[ss.logTag, { color: C.teal, backgroundColor: C.tealDim }]}>HOLD</Text>
                <Text style={ss.logTime}>{fmtMs(d.holdMs)}</Text>
                {d.fcMs != null && (
                  <Text style={[ss.logTag, { color: C.warm, backgroundColor: 'rgba(249,115,22,0.12)', marginLeft: 4 }]}>
                    FC {fmtMs(d.fcMs)}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
          <TextInput style={ss.input} placeholder="メモ（任意）" placeholderTextColor={C.muted}
            value={note} onChangeText={setNote} maxLength={100} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[ss.sheetBtn, { backgroundColor: C.surface2 }]} onPress={onClose}>
              <Text style={[ss.sheetBtnTxt, { color: C.muted }]}>キャンセル</Text>
            </Pressable>
            <Pressable style={[ss.sheetBtn, { backgroundColor: C.teal }]}
              onPress={() => { onSave(note); setNote(''); }}>
              <Text style={[ss.sheetBtnTxt, { color: C.surface }]}>登録</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function TimerScreen() {
  // UI state
  const [mode,     setMode]     = useState<Mode>('free');
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [lang,     setLang]     = useState<Lang>('en');
  const [cfg,      setCfg]      = useState<Cfg>(DEFAULT_CFG);
  const [showCfg,  setShowCfg]  = useState(false);
  const [showSave, setShowSave] = useState(false);

  // Timer display state
  const [holdMs,    setHoldMs]    = useState(0);
  const [countdown, setCountdown] = useState(0); // rest / breatheUp remaining sec
  const [surface,   setSurface]   = useState(3);

  // Session state
  const [currentSet, setCurrentSet] = useState(1);
  const [dives,      setDives]      = useState<Dive[]>([]);
  const [fcMarked,   setFcMarked]   = useState(false);
  const [fcMs,       setFcMs]       = useState<number | undefined>();

  // BLE SpO2
  const { status: bleStatus, spo2: liveSpo2, devName: bleDevName, toggle: toggleBle } = useBleSpO2();
  const liveSpo2Ref = useRef<number | null>(null);
  const minSpo2Ref  = useRef<number | null>(null);

  // Mutable refs (used inside setInterval to avoid stale closures)
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef          = useRef<Phase>('idle');
  const holdStartRef      = useRef(0);
  const holdMsRef         = useRef(0);
  const cdStartRef        = useRef(0);  // countdown start timestamp
  const lastSecRef        = useRef(-1);
  const currentSetRef     = useRef(1);
  const cfgRef            = useRef(cfg);
  const modeRef           = useRef<Mode>('free');
  const langRef           = useRef<Lang>('en');
  const fcMsRef           = useRef<number | undefined>();
  const aidasFired        = useRef(new Set<number>());
  const tcFired           = useRef(new Set<string>());
  const transGuard        = useRef(false);

  // Keep refs in sync
  useEffect(() => { cfgRef.current     = cfg;      }, [cfg]);
  useEffect(() => { langRef.current    = lang;     }, [lang]);
  useEffect(() => { fcMsRef.current    = fcMs;     }, [fcMs]);
  useEffect(() => { liveSpo2Ref.current = liveSpo2; }, [liveSpo2]);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const stopInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const holdTargetSec = (set: number, c: Cfg) =>
    c.holdMin * 60 + c.holdSec + (set - 1) * c.holdDeltaSec;

  const restTargetSec = (set: number, c: Cfg) =>
    Math.max(30, c.restMin * 60 + c.restSec + (set - 1) * c.decrementSec);

  const haptic = (type: 'light' | 'heavy' | 'success') => {
    if (Haptics) {
      if (type === 'success') Haptics.notificationAsync('success');
      else Haptics.impactAsync(type === 'heavy' ? 'heavy' : 'light');
    } else {
      Vibration.vibrate(type === 'heavy' ? [0, 100, 100, 100] : 100);
    }
  };

  const fireAida = (remaining: number, cap: number, l: Lang) => {
    for (const a of AIDA) {
      if (a.sb > cap) continue;
      if (remaining <= a.sb && !aidasFired.current.has(a.sb)) {
        aidasFired.current.add(a.sb);
        Speech?.speak(l === 'ja' ? a.ja : a.en, { language: l === 'ja' ? 'ja-JP' : 'en-US' });
        break;
      }
    }
  };

  const fireTimeCall = (elapsedSec: number, c: Cfg, l: Lang) => {
    if (!c.timeCallEnabled) return;
    const target = c.holdStop === 'auto'
      ? holdTargetSec(currentSetRef.current, c) : null;

    if (target && c.timeCallCountdownEnabled) {
      const rem = target - elapsedSec;
      const tryFire = (key: string, text: string) => {
        if (!tcFired.current.has(key)) {
          tcFired.current.add(key);
          Speech?.speak(text, { language: l === 'ja' ? 'ja-JP' : 'en-US' });
        }
      };
      if (rem === 15) { tryFire('w15', l === 'ja' ? '残り15秒' : '15 seconds'); return; }
      if (rem === 10) { tryFire('w10', l === 'ja' ? '残り10秒' : '10 seconds'); return; }
      if (rem >= 1 && rem <= 5) { tryFire(`c${rem}`, String(rem)); return; }
      if (rem <= 15) return;
    }

    if (elapsedSec < c.timeCallStartSec) return;
    const iv = c.timeCallIntervalSec || 30;
    if ((elapsedSec - c.timeCallStartSec) % iv !== 0) return;
    const key = `i${elapsedSec}`;
    if (tcFired.current.has(key)) return;
    tcFired.current.add(key);
    const mm = Math.floor(elapsedSec / 60), ss_ = elapsedSec % 60;
    const text = l === 'ja'
      ? (ss_ === 0 ? `${mm}分` : ss_ === 30 ? `${mm}分半` : `${mm}分${ss_}秒`)
      : (ss_ === 0 ? `${mm} minute${mm === 1 ? '' : 's'}` : ss_ === 30 ? `${mm} minutes thirty` : `${mm} minutes ${ss_} seconds`);
    Speech?.speak(text, { language: l === 'ja' ? 'ja-JP' : 'en-US' });
  };

  // ── TRANSITIONS ───────────────────────────────────────────────────────────
  const withGuard = (fn: () => void) => {
    if (transGuard.current) return;
    transGuard.current = true;
    fn();
    setTimeout(() => { transGuard.current = false; }, 300);
  };

  const goHold = () => withGuard(() => {
    Speech?.stop();
    aidasFired.current.clear();
    tcFired.current.clear();
    holdMsRef.current = 0;
    holdStartRef.current = Date.now();
    phaseRef.current = 'hold';
    setPhase('hold');
    setHoldMs(0);
    setFcMarked(false);
    setFcMs(undefined);
    haptic('heavy');
  });

  const goSurface = () => withGuard(() => {
    const ms   = holdMsRef.current;
    const fc   = fcMsRef.current;
    const minS = minSpo2Ref.current ?? undefined;
    minSpo2Ref.current = null;
    setDives(prev => [...prev, { holdMs: ms, fcMs: fc, minSpo2: minS }]);
    phaseRef.current = 'surface';
    cdStartRef.current = Date.now();
    lastSecRef.current = 4; // force first update
    setPhase('surface');
    setSurface(3);
    haptic('success');
  });

  const goRest = () => {
    const c = cfgRef.current;
    const target = restTargetSec(currentSetRef.current, c);
    aidasFired.current.clear();
    cdStartRef.current = Date.now();
    lastSecRef.current = target + 1; // force first update
    phaseRef.current = 'rest';
    setPhase('rest');
    setCountdown(target);
  };

  const goBreatheUp = (set: number) => {
    const c = cfgRef.current;
    const target = set === 1
      ? c.prepSec
      : restTargetSec(set - 1, c);
    aidasFired.current.clear();
    cdStartRef.current = Date.now();
    lastSecRef.current = target + 1; // force first update
    phaseRef.current = 'breatheUp';
    setPhase('breatheUp');
    setCountdown(target);
  };

  const goIdle = () => {
    phaseRef.current = 'idle';
    setPhase('idle');
  };

  // ── TICK (50ms interval) ──────────────────────────────────────────────────
  const tick = () => {
    const now   = Date.now();
    const phase = phaseRef.current;
    const c     = cfgRef.current;
    const l     = langRef.current;
    const set   = currentSetRef.current;

    if (phase === 'hold') {
      const elapsed = now - holdStartRef.current;
      holdMsRef.current = elapsed;
      setHoldMs(elapsed);

      const elapsedSec = Math.floor(elapsed / 1000);
      fireTimeCall(elapsedSec, c, l);

      // SpO2トラッキング
      const sv = liveSpo2Ref.current;
      if (sv !== null) {
        if (minSpo2Ref.current === null || sv < minSpo2Ref.current) minSpo2Ref.current = sv;
      }

      // Auto stop
      if (c.holdStop === 'auto' && modeRef.current === 'table') {
        if (elapsed >= holdTargetSec(set, c) * 1000) goSurface();
      }

    } else if (phase === 'breatheUp' || phase === 'rest') {
      const target = phase === 'breatheUp'
        ? (set === 1 ? c.prepSec : restTargetSec(set - 1, c))
        : restTargetSec(set, c);

      const elapsed   = Math.floor((now - cdStartRef.current) / 1000);
      const remaining = Math.max(0, target - elapsed);

      if (remaining !== lastSecRef.current) {
        lastSecRef.current = remaining;
        setCountdown(remaining);
        fireAida(remaining, target, l);

        if (remaining <= 0) {
          if (phase === 'breatheUp') {
            goHold();
          } else {
            const next = set + 1;
            if (next > c.sets) {
              goIdle();
              setShowSave(true);
            } else {
              currentSetRef.current = next;
              setCurrentSet(next);
              goHold();
            }
          }
        }
      }

    } else if (phase === 'surface') {
      const elapsed   = Math.floor((now - cdStartRef.current) / 1000);
      const remaining = Math.max(0, 3 - elapsed);

      if (remaining !== lastSecRef.current) {
        lastSecRef.current = remaining;
        setSurface(remaining);
        if (remaining > 0) haptic('light');
        if (remaining <= 0) goRest();
      }
    }
  };

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const startSession = () => {
    currentSetRef.current = 1;
    modeRef.current = mode;
    setCurrentSet(1);
    setDives([]);
    stopInterval();
    if (mode === 'table') goBreatheUp(1);
    else goHold();
    intervalRef.current = setInterval(tick, 50);
  };

  const stopHold = () => {
    if (modeRef.current === 'free') {
      const ms = holdMsRef.current;
      const fc = fcMsRef.current;
      setDives(prev => [...prev, { holdMs: ms, fcMs: fc }]);
      stopInterval();
      goIdle();
    } else {
      goSurface();
    }
  };

  const skipBreatheUp = () => {
    if (phaseRef.current === 'breatheUp') goHold();
  };

  const markFC = () => {
    if (fcMarked) return;
    const ms = Date.now() - holdStartRef.current;
    setFcMarked(true);
    setFcMs(ms);
    haptic('light');
  };

  const reset = () => {
    stopInterval();
    Speech?.stop();
    phaseRef.current = 'idle';
    holdMsRef.current = 0;
    currentSetRef.current = 1;
    aidasFired.current.clear();
    tcFired.current.clear();
    setPhase('idle');
    setHoldMs(0);
    setCountdown(0);
    setSurface(3);
    setCurrentSet(1);
    setDives([]);
    setFcMarked(false);
    setFcMs(undefined);
    minSpo2Ref.current = null;
  };

  const handleSave = async (note: string) => {
    setShowSave(false);
    const best = dives.length ? Math.max(...dives.map(d => d.holdMs)) : 0;
    const avg_ = getAvgMs(dives);
    const ok = await sbInsert('training_sessions', {
      type: 'STA',
      environment: 'dry',
      duration_sec:  Math.round(dives.reduce((s, d) => s + d.holdMs, 0) / 1000),
      best_hold_sec: Math.round(best / 1000),
      avg_hold_sec:  Math.round(avg_ / 1000),
      set_count:     dives.length,
      min_spo2:      dives.some(d => d.minSpo2 != null) ? Math.min(...dives.filter(d => d.minSpo2 != null).map(d => d.minSpo2!)) : null,
      notes:         note || null,
      app_source:    'ios',
      dives_json: JSON.stringify(dives.map(d => ({
        hold_sec: Math.round(d.holdMs / 1000),
        fc_sec: d.fcMs != null ? Math.round(d.fcMs / 1000) : null,
      }))),
      created_at: new Date().toISOString(),
    });
    Alert.alert(
      ok ? '✓ 保存しました' : 'エラー',
      ok ? '' : 'オフラインの可能性があります。後で再試行してください。',
    );
  };

  useEffect(() => () => stopInterval(), []);

  // ── COMPUTED ──────────────────────────────────────────────────────────────
  const bestMs = dives.length ? Math.max(...dives.map(d => d.holdMs)) : 0;
  const avgMsV = getAvgMs(dives);

  const PHASE_COLOR: Record<Phase, string> = {
    idle: C.teal, breatheUp: C.yellow, hold: C.danger, surface: C.yellow, rest: C.success,
  };
  const PHASE_LABEL: Record<Phase, string> = {
    idle:      'STA — Static Apnea',
    breatheUp: lang === 'ja' ? '準備呼吸' : 'Breath Up',
    hold:      lang === 'ja' ? '息止め中' : 'Hold',
    surface:   'Surface Protocol',
    rest:      lang === 'ja' ? 'レスト' : 'Rest',
  };

  const mainDisplay = () => {
    if (phase === 'breatheUp' || phase === 'rest') return fmtSec(countdown);
    if (phase === 'surface') return String(surface);
    return fmtMs(holdMs);
  };

  const ringProgress = () => {
    if (phase === 'hold') {
      if (cfg.holdStop === 'auto' && mode === 'table') {
        const target = holdTargetSec(currentSet, cfg) * 1000;
        return target > 0 ? holdMs / target : 0;
      }
      return Math.min(holdMs / 600000, 1); // free mode: 0–10min
    }
    if (phase === 'breatheUp') {
      const target = currentSet === 1 ? cfg.prepSec : restTargetSec(currentSet - 1, cfg);
      return target > 0 ? 1 - countdown / target : 1;
    }
    if (phase === 'rest') {
      const target = restTargetSec(currentSet, cfg);
      return target > 0 ? 1 - countdown / target : 1;
    }
    if (phase === 'surface') return 1 - surface / 3;
    return 0;
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={ss.container}>
      <ScrollView
        contentContainerStyle={ss.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={ss.header}>
          <Text style={ss.title}>STA Timer</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* SpO2 / BLE ボタン */}
            <Pressable
              style={[
                ss.bleBtn,
                bleStatus === 'connected'  && ss.bleBtnOn,
                (bleStatus === 'scanning' || bleStatus === 'connecting') && ss.bleBtnBusy,
                bleStatus === 'error'      && ss.bleBtnErr,
              ]}
              onPress={toggleBle}
            >
              <View style={[
                ss.bleDot,
                bleStatus === 'connected'  && { backgroundColor: C.teal },
                (bleStatus === 'scanning' || bleStatus === 'connecting') && { backgroundColor: C.warm },
                bleStatus === 'error'      && { backgroundColor: C.danger },
              ]} />
              <Text style={[ss.bleBtnTxt, bleStatus === 'connected' && { color: C.teal }]}>
                {bleStatus === 'connected'
                  ? (liveSpo2 != null ? `${liveSpo2}%` : 'SpO2')
                  : bleStatus === 'scanning'   ? 'スキャン中…'
                  : bleStatus === 'connecting' ? '接続中…'
                  : bleStatus === 'error'      ? 'SpO2 ✕'
                  : 'SpO2'}
              </Text>
            </Pressable>
            <Pressable style={ss.langBtn} onPress={() => setLang(l => l === 'en' ? 'ja' : 'en')}>
              <Text style={ss.langBtnTxt}>{lang.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>

        {/* Mode tabs */}
        <View style={ss.tabs}>
          {(['free', 'table', 'preset'] as Mode[]).map(m => (
            <Pressable key={m} style={[ss.tab, mode === m && ss.tabOn]}
              onPress={() => { if (phase === 'idle') { setMode(m); setDives([]); } }}>
              <Text style={[ss.tabTxt, mode === m && ss.tabTxtOn]}>
                {m === 'free' ? 'Stopwatch' : m === 'table' ? 'Table' : 'Preset'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Phase label */}
        <Text style={[ss.phaseLabel, { color: PHASE_COLOR[phase] }]}>
          {PHASE_LABEL[phase]}
        </Text>

        {/* Ring */}
        <View style={ss.ringWrap}>
          <TimerRing progress={ringProgress()} color={PHASE_COLOR[phase]}>
            {phase === 'surface' ? (
              <>
                <Text style={{ fontSize: 10, letterSpacing: 2, color: C.yellow, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 }}>
                  Surface
                </Text>
                <Text style={{ fontSize: 72, fontWeight: '100', color: C.yellow, fontVariant: ['tabular-nums'] }}>
                  {surface}
                </Text>
              </>
            ) : (
              <>
                <Text style={[ss.timeMain, phase === 'hold' && { color: C.danger }]}>
                  {mainDisplay()}
                </Text>
                {phase !== 'idle' && mode === 'table' && (
                  <Text style={ss.setLabel}>Set {currentSet} / {cfg.sets}</Text>
                )}
                {phase === 'idle' && dives.length > 0 && (
                  <Text style={ss.setLabel}>{dives.length} dives</Text>
                )}
                {/* SpO2 リアルタイム表示 */}
                {bleStatus === 'connected' && liveSpo2 != null && (
                  <Text style={[
                    ss.spo2Ring,
                    liveSpo2 >= 95 ? { color: C.tealLight }
                    : liveSpo2 >= 90 ? { color: C.warm }
                    : { color: C.danger },
                  ]}>
                    {liveSpo2}%
                  </Text>
                )}
              </>
            )}
          </TimerRing>
        </View>

        {/* 1st Contraction */}
        {phase === 'hold' && (
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Pressable style={[ss.fcBtn, fcMarked && ss.fcBtnDone]} onPress={markFC} disabled={fcMarked}>
              <Text style={[ss.fcBtnTxt, fcMarked && { opacity: 0.5 }]}>
                {fcMarked ? `FC ✓  ${fmtMs(fcMs ?? 0)}` : '1st Contraction'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Stats */}
        {(dives.length > 0 || phase !== 'idle') && (
          <View style={ss.stats}>
            {([['Best', fmtMs(bestMs)], ['Avg', fmtMs(avgMsV)], ['Sets', `${dives.length}${mode === 'table' ? `/${cfg.sets}` : ''}`]] as [string, string][]).map(([l, v]) => (
              <View key={l} style={ss.stat}>
                <Text style={ss.statLbl}>{l}</Text>
                <Text style={ss.statVal}>{bestMs > 0 || l === 'Sets' ? v : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={ss.controls}>
          {phase === 'idle' && (
            <Pressable style={ss.btnMain} onPress={startSession}>
              <Text style={ss.btnMainTxt}>START</Text>
            </Pressable>
          )}
          {phase === 'breatheUp' && (
            <Pressable style={ss.btnMain} onPress={skipBreatheUp}>
              <Text style={ss.btnMainTxt}>{lang === 'ja' ? '息止め開始' : 'Start Hold'}</Text>
            </Pressable>
          )}
          {phase === 'hold' && (
            <Pressable style={[ss.btnMain, ss.btnStop]} onPress={stopHold}>
              <Text style={[ss.btnMainTxt, { color: C.text }]}>STOP</Text>
            </Pressable>
          )}
          {(phase === 'rest' || phase === 'surface') && (
            <View style={[ss.btnMain, ss.btnResting]}>
              <Text style={[ss.btnMainTxt, { color: C.muted }]}>
                {phase === 'surface' ? 'Surface Protocol' : lang === 'ja' ? 'レスト中…' : 'Resting…'}
              </Text>
            </View>
          )}

          <View style={ss.btnRow}>
            <Pressable style={ss.btnSub} onPress={reset}>
              <Text style={ss.btnSubTxt}>Reset</Text>
            </Pressable>
            {phase === 'idle' && dives.length > 0 && (
              <Pressable style={[ss.btnSub, { borderColor: C.teal }]} onPress={() => setShowSave(true)}>
                <Text style={[ss.btnSubTxt, { color: C.tealLight }]}>ログ登録</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Table config */}
        {mode === 'table' && phase === 'idle' && (
          <View style={{ marginTop: 12 }}>
            <Pressable onPress={() => setShowCfg(s => !s)} style={ss.cfgToggle}>
              <Text style={ss.cfgToggleTxt}>設定 {showCfg ? '▲' : '▼'}</Text>
            </Pressable>
            {showCfg && <TableConfig cfg={cfg} onChange={setCfg} />}
          </View>
        )}

        {/* Presets */}
        {mode === 'preset' && phase === 'idle' && (
          <View style={{ marginTop: 12 }}>
            {PRESETS.map(p => (
              <Pressable key={p.id} style={ss.presetCard}
                onPress={() => { setCfg(c => ({ ...c, ...p.cfg })); setMode('table'); setShowCfg(false); }}>
                <Text style={ss.presetIcon}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={ss.presetName}>{p.name}</Text>
                  <Text style={ss.presetDesc}>{p.desc}</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {p.tags.map(t => (
                      <Text key={t.l} style={[ss.presetTag,
                        t.t === 'o2'  ? { color: C.tealLight, backgroundColor: C.tealDim } :
                        t.t === 'co2' ? { color: C.danger, backgroundColor: 'rgba(239,68,68,0.1)' } :
                                        { color: C.muted, backgroundColor: C.surface2 },
                      ]}>{t.l}</Text>
                    ))}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Dive log */}
        {dives.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={ss.logTitle}>ログ</Text>
            {[...dives].reverse().map((d, i) => (
              <View key={i} style={ss.logRow}>
                <Text style={ss.logN}>#{dives.length - i}</Text>
                <Text style={[ss.logTag, { color: C.teal, backgroundColor: C.tealDim }]}>HOLD</Text>
                <Text style={ss.logTime}>{fmtMs(d.holdMs)}</Text>
                {d.fcMs != null && (
                  <Text style={[ss.logTag, { color: C.warm, backgroundColor: 'rgba(249,115,22,0.12)', marginLeft: 4 }]}>
                    FC {fmtMs(d.fcMs)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      <SaveModal visible={showSave} dives={dives} onClose={() => setShowSave(false)} onSave={handleSave} />
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { paddingHorizontal: 16, paddingBottom: 48 },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  title:      { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.teal, fontWeight: '700' },
  langBtn:    { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  langBtnTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: C.muted },

  tabs:       { flexDirection: 'row', gap: 6, marginVertical: 6 },
  tab:        { flex: 1, height: 32, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  tabOn:      { backgroundColor: C.tealDim, borderColor: C.teal },
  tabTxt:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted },
  tabTxtOn:   { color: C.tealLight },

  phaseLabel: { textAlign: 'center', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700', height: 18, marginBottom: 2 },

  ringWrap:  { alignItems: 'center', marginVertical: 6 },
  timeMain:  { fontSize: 48, fontWeight: '200', color: C.text, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  setLabel:  { fontSize: 10, color: C.teal, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },

  fcBtn:     { borderWidth: 1.5, borderColor: C.warm, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(249,115,22,0.1)' },
  fcBtnDone: { borderColor: C.muted, backgroundColor: 'transparent' },
  fcBtnTxt:  { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: C.warm, textTransform: 'uppercase' },

  stats:    { flexDirection: 'row', justifyContent: 'center', gap: 24, marginVertical: 6 },
  stat:     { alignItems: 'center' },
  statLbl:  { fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, fontWeight: '600' },
  statVal:  { fontSize: 13, fontVariant: ['tabular-nums'], color: C.tealLight, fontWeight: '300' },

  controls:   { alignItems: 'center', gap: 7, marginVertical: 6 },
  btnMain:    { width: '100%', maxWidth: 300, height: 42, borderRadius: 12, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  btnStop:    { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.teal },
  btnResting: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  btnMainTxt: { fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: C.surface },
  btnRow:     { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 300 },
  btnSub:     { flex: 1, height: 34, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  btnSubTxt:  { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.muted },

  cfgToggle:    { paddingVertical: 6 },
  cfgToggleTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: C.muted },
  cfgBox:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 12 },
  cfgRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cfgLbl:       { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  toggleBtn:    { height: 30, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  toggleBtnOn:  { borderColor: C.teal, backgroundColor: C.tealDim },
  toggleBtnTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: C.muted },
  stepper:      { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: C.border, borderRadius: 8, overflow: 'hidden', height: 36 },
  stepBtn:      { width: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
  stepBtnTxt:   { fontSize: 18, color: C.text, lineHeight: 22 },
  stepVal:      { minWidth: 50, paddingHorizontal: 4, textAlign: 'center', textAlignVertical: 'center', backgroundColor: C.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border, color: C.text, fontSize: 13, fontVariant: ['tabular-nums'], lineHeight: 36 },

  presetCard: { flexDirection: 'row', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  presetIcon: { fontSize: 22 },
  presetName: { fontSize: 14, fontWeight: '700', color: C.text },
  presetDesc: { fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 16 },
  presetTag:  { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  logTitle:   { fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: C.muted, fontWeight: '700', marginBottom: 6 },
  logRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8, marginBottom: 3 },
  logN:       { fontSize: 9, color: C.muted, width: 20, textAlign: 'center' },
  logTag:     { fontSize: 9, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  logTime:    { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '300', color: C.text, flex: 1 },

  overlay:      { flex: 1, backgroundColor: 'rgba(6,15,23,0.9)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, paddingBottom: 36 },
  sheetTitle:   { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.teal, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  modalSummary: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.surface2, borderRadius: 10, padding: 12, marginBottom: 12 },
  modalStat:    { alignItems: 'center', gap: 2 },
  modalStatLbl: { fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, fontWeight: '600' },
  modalStatVal: { fontSize: 17, fontVariant: ['tabular-nums'], color: C.tealLight, fontWeight: '300' },
  input:        { height: 40, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, color: C.text, paddingHorizontal: 12, fontSize: 13, marginBottom: 12, marginTop: 8 },
  sheetBtn:     { flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sheetBtnTxt:  { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  // BLE SpO2 button
  bleBtn:     { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#1a3f5c', backgroundColor: '#0f2a44' },
  bleBtnOn:   { borderColor: '#2ec4b6', backgroundColor: 'rgba(46,196,182,0.12)' },
  bleBtnBusy: { borderColor: '#f97316' },
  bleBtnErr:  { borderColor: '#ef4444' },
  bleDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: '#5a8ca8' },
  bleBtnTxt:  { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5, color: '#5a8ca8' },

  // SpO2 in ring
  spo2Ring:   { fontSize: 20, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as const, marginTop: 2 },
});
