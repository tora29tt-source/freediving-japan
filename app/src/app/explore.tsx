/**
 * 探す — Freediving Japan App
 * インストラクター・スクール検索（マッチング）
 *
 * ネイティブ実装はPhase 3予定。現状はWeb版の探すページをアプリ内ブラウザで開くブリッジ。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';

const C = {
  oceanDeep: '#0b2d45',
  oceanMid:  '#0e3d5c',
  oceanLight:'#1a5f82',
  teal:      '#2ec4b6',
  tealLight: '#a8ece8',
  sand:      '#fdf8f2',
  muted:     '#8fb8cc',
  border:    'rgba(168,236,232,0.14)',
} as const;

const LINKS = [
  { href: 'https://freediving-japan.vercel.app/explore/index.html' as const, icon: '🔍', title: 'インストラクター・スクールを探す', desc: 'エリア・種目で検索' },
  { href: 'https://freediving-japan.vercel.app/explore/shops.html'  as const, icon: '🏠', title: 'ショップ一覧', desc: 'ショップ単位で探す' },
];

export default function ExploreScreen() {
  return (
    <SafeAreaView style={ss.container}>
      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <View style={ss.header}>
          <Text style={ss.eyebrow}>MATCHING</Text>
          <Text style={ss.title}>探す</Text>
          <Text style={ss.subtitle}>
            インストラクター検索・予約は現在Web版で提供中です。アプリ内ネイティブ対応は準備中です。
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {LINKS.map(l => (
            <ExternalLink key={l.href} href={l.href} asChild>
              <Pressable style={ss.card}>
                <View style={ss.cardIconWrap}><Text style={ss.cardIcon}>{l.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.cardTitle}>{l.title}</Text>
                  <Text style={ss.cardDesc}>{l.desc}</Text>
                </View>
                <Text style={ss.cardArrow}>›</Text>
              </Pressable>
            </ExternalLink>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.oceanDeep },
  scroll:    { padding: 20, gap: 20 },

  header:   { gap: 6, marginTop: 8 },
  eyebrow:  { fontSize: 11, letterSpacing: 3, fontWeight: '700', color: C.teal, textTransform: 'uppercase' },
  title:    { fontSize: 26, fontWeight: '700', color: C.sand },
  subtitle: { fontSize: 12, color: C.muted, lineHeight: 17 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.oceanMid, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14,
  },
  cardIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(46,196,182,0.14)', alignItems: 'center', justifyContent: 'center' },
  cardIcon:     { fontSize: 18 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.sand },
  cardDesc:     { fontSize: 11, color: C.muted, marginTop: 2 },
  cardArrow:    { fontSize: 20, fontWeight: '700', color: C.tealLight },
});
