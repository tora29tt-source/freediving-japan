/**
 * ログ — Freediving Japan App
 * トレーニングログ一覧（公開セッションのプレビュー表示）
 *
 * 注意: 本人ログインでの非公開ログ閲覧・新規登録UIはSupabase Auth連携後に実装予定。
 * 現状は is_public=true のセッションのみ匿名キーで閲覧できる。
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  oceanDeep: '#0b2d45',
  oceanMid:  '#0e3d5c',
  teal:      '#2ec4b6',
  tealLight: '#a8ece8',
  tealDim:   'rgba(46,196,182,0.12)',
  sand:      '#fdf8f2',
  muted:     '#8fb8cc',
  border:    'rgba(168,236,232,0.14)',
} as const;

const SB_URL = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaHF2YnBzdWNjYmRjbmhub2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODQwMzksImV4cCI6MjA5NTg2MDAzOX0.MexR8_hY56m3XRff0EJOQM3uQShXr2L9kGyYXLSzKbs';

interface Dive {
  discipline: string;
  result_time: number | null;
  result_depth: number | null;
}

interface Session {
  id: string;
  date: string;
  env: 'sea' | 'pool' | 'dry';
  location: string | null;
  note: string | null;
  training_dives: Dive[];
}

const ENV_LABEL: Record<Session['env'], string> = { sea: '海', pool: 'プール', dry: '陸上' };

async function fetchPublicSessions(): Promise<Session[]> {
  const url = `${SB_URL}/rest/v1/training_sessions?select=id,date,env,location,note,training_dives(discipline,result_time,result_depth)&is_public=eq.true&order=date.desc&limit=30`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function fmtTime(sec: number | null) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SessionCard({ s }: { s: Session }) {
  return (
    <View style={ss.card}>
      <View style={ss.cardTop}>
        <Text style={ss.cardDate}>{s.date}</Text>
        <Text style={ss.cardEnv}>{ENV_LABEL[s.env]}{s.location ? ` · ${s.location}` : ''}</Text>
      </View>
      {s.training_dives?.length > 0 && (
        <View style={ss.diveRow}>
          {s.training_dives.slice(0, 6).map((d, i) => (
            <View key={i} style={ss.divePill}>
              <Text style={ss.divePillTxt}>
                {d.discipline}{d.result_time != null ? ` ${fmtTime(d.result_time)}` : ''}{d.result_depth != null ? ` ${d.result_depth}m` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
      {s.note ? <Text style={ss.cardNote} numberOfLines={2}>{s.note}</Text> : null}
    </View>
  );
}

export default function LogScreen() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPublicSessions();
      setSessions(data);
    } catch {
      setError('読み込みに失敗しました。オフラインの可能性があります。');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={ss.container}>
      <View style={ss.header}>
        <Text style={ss.eyebrow}>TRAINING LOG</Text>
        <Text style={ss.title}>ログ</Text>
      </View>

      {sessions === null && !error && (
        <View style={ss.centerFill}><ActivityIndicator color={C.teal} /></View>
      )}

      {error && (
        <View style={ss.centerFill}>
          <Text style={ss.emptyTxt}>{error}</Text>
          <Pressable style={ss.retryBtn} onPress={load}>
            <Text style={ss.retryBtnTxt}>再試行</Text>
          </Pressable>
        </View>
      )}

      {sessions !== null && !error && sessions.length === 0 && (
        <View style={ss.centerFill}>
          <Text style={ss.emptyIcon}>📋</Text>
          <Text style={ss.emptyTxt}>まだ公開されているログがありません</Text>
          <Text style={ss.emptySub}>タイマーでセッションを記録して、Web版マイページから公開設定にすると、ここに表示されます</Text>
          <Link href="/timer" asChild>
            <Pressable style={ss.retryBtn}>
              <Text style={ss.retryBtnTxt}>タイマーを開く</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ScrollView
          contentContainerStyle={ss.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        >
          {sessions.map(s => <SessionCard key={s.id} s={s} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.oceanDeep },
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 4 },
  eyebrow:   { fontSize: 11, letterSpacing: 3, fontWeight: '700', color: C.teal, textTransform: 'uppercase' },
  title:     { fontSize: 22, fontWeight: '700', color: C.sand },

  scroll: { padding: 20, paddingTop: 0, gap: 10 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyIcon:  { fontSize: 32, marginBottom: 4 },
  emptyTxt:   { fontSize: 13, color: C.sand, fontWeight: '600', textAlign: 'center' },
  emptySub:   { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16, marginTop: 2 },
  retryBtn:   { marginTop: 10, backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryBtnTxt:{ fontSize: 12, fontWeight: '700', color: C.oceanDeep },

  card:     { backgroundColor: C.oceanMid, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 8 },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 13, fontWeight: '700', color: C.sand },
  cardEnv:  { fontSize: 11, color: C.muted },
  diveRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  divePill: { backgroundColor: C.tealDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  divePillTxt: { fontSize: 10, fontWeight: '700', color: C.tealLight },
  cardNote: { fontSize: 11, color: C.muted, lineHeight: 15 },
});
