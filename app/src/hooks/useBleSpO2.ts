/**
 * useBleSpO2 — Bluetooth Low Energy SpO2 hook
 *
 * 対応デバイス:
 *   - Wellue / Viatom O2Ring (YX110) — service 0xFFB0 / char 0xFFB2
 *   - PLX standard (Contec, Nonin 等) — service 0x1822 / char 0x2A5F
 *
 * 事前準備:
 *   cd app
 *   npm install react-native-ble-plx
 *   cd ios && pod install
 *   # app.json の plugins に "react-native-ble-plx" を追加して prebuild
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// react-native-ble-plx がネイティブビルドされていない場合も graceful に動作
let BleManager: any = null;
try {
  ({ BleManager } = require('react-native-ble-plx'));
} catch {}

// ── SpO2 プロファイル ──────────────────────────────────────────────────────
const PROFILES = [
  {
    label: 'Wellue O2Ring (YX110)',
    svcUUID:  '0000ffb0-0000-1000-8000-00805f9b34fb',
    charUUID: '0000ffb2-0000-1000-8000-00805f9b34fb',
    parse: (b64: string): number | null => {
      try {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        if (bytes.length < 2) return null;
        const v = bytes[1];
        // 0x7F = invalid reading in Wellue protocol
        return (v > 0 && v <= 100 && v !== 0x7f) ? v : null;
      } catch { return null; }
    },
  },
  {
    label: 'PLX Standard (0x1822)',
    svcUUID:  '00001822-0000-1000-8000-00805f9b34fb',
    charUUID: '00002a5f-0000-1000-8000-00805f9b34fb',
    parse: (b64: string): number | null => {
      try {
        // PLX Continuous Measurement: SFLOAT (0.01 resolution) at offset 1
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        if (bytes.length < 3) return null;
        const raw = bytes[1] | (bytes[2] << 8);
        const v = raw * 0.01;
        return (v > 0 && v <= 100) ? Math.round(v) : null;
      } catch { return null; }
    },
  },
];

// スキャン対象のデバイス名キーワード（小文字）
const NAME_KEYWORDS = ['o2', 'ring', 'wellue', 'viatom', 'contec', 'cms', 'oxim', 'spo2', 'pulse'];

export type BleSpO2Status = 'off' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface UseBleSpO2Return {
  status:  BleSpO2Status;
  spo2:    number | null;   // 現在のSpO2値（%）
  devName: string;           // 接続中のデバイス名
  toggle:  () => void;       // 接続/切断トグル
}

export function useBleSpO2(): UseBleSpO2Return {
  const managerRef = useRef<any>(null);
  const deviceRef  = useRef<any>(null);
  const scanTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status,  setStatus]  = useState<BleSpO2Status>('off');
  const [spo2,    setSpo2]    = useState<number | null>(null);
  const [devName, setDevName] = useState('');

  const getMgr = useCallback(() => {
    if (!BleManager) return null;
    if (!managerRef.current) managerRef.current = new BleManager();
    return managerRef.current as any;
  }, []);

  // ── 切断 ──────────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (scanTimer.current) { clearTimeout(scanTimer.current); scanTimer.current = null; }
    try { getMgr()?.stopDeviceScan(); } catch {}
    if (deviceRef.current) {
      try { await deviceRef.current.cancelConnection(); } catch {}
      deviceRef.current = null;
    }
    setStatus('off');
    setSpo2(null);
    setDevName('');
  }, [getMgr]);

  // ── スキャン & 接続 ────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const mgr = getMgr();
    if (!mgr) {
      // ライブラリ未インストール: エラー表示
      setStatus('error');
      return;
    }

    setStatus('scanning');

    // 15秒でタイムアウト
    scanTimer.current = setTimeout(() => {
      mgr.stopDeviceScan();
      setStatus(s => s === 'scanning' ? 'error' : s);
    }, 15000);

    mgr.startDeviceScan(null, { allowDuplicates: false }, async (err: any, dev: any) => {
      if (err || !dev) return;
      const name = (dev.name || dev.localName || '').toLowerCase();
      if (!NAME_KEYWORDS.some(k => name.includes(k))) return;

      // 対象デバイス発見 → スキャン停止
      mgr.stopDeviceScan();
      if (scanTimer.current) { clearTimeout(scanTimer.current); scanTimer.current = null; }
      setStatus('connecting');

      try {
        const conn = await dev.connect({ autoConnect: false });
        await conn.discoverAllServicesAndCharacteristics();
        deviceRef.current = conn;
        setDevName(dev.name || dev.localName || 'SpO2 Device');

        // プロファイルを順番に試す
        let found = false;
        for (const profile of PROFILES) {
          try {
            conn.monitorCharacteristicForService(
              profile.svcUUID,
              profile.charUUID,
              (_err: any, char: any) => {
                if (_err || !char?.value) return;
                const v = profile.parse(char.value);
                if (v !== null) setSpo2(v);
              },
            );
            found = true;
            break;
          } catch {}
        }

        conn.onDisconnected(() => {
          setStatus('off');
          setSpo2(null);
          setDevName('');
          deviceRef.current = null;
        });

        setStatus(found ? 'connected' : 'error');
      } catch {
        setStatus('error');
      }
    });
  }, [getMgr]);

  // ── トグル ────────────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (status === 'off' || status === 'error') connect();
    else disconnect();
  }, [status, connect, disconnect]);

  // ── クリーンアップ ─────────────────────────────────────────────────────────
  useEffect(() => () => {
    disconnect();
    managerRef.current?.destroy();
    managerRef.current = null;
  }, [disconnect]);

  return { status, spo2, devName, toggle };
}
