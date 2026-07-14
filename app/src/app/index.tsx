/**
 * ホーム — Freediving Japan App
 * ダッシュボード（クイックアクション + 概要）
 */

import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── THEME（APP.md 指定のカラートークンに準拠） ──────────────────────────────
const C = {
  oceanDeep:  '#0b2d45',
  oceanMid:   '#0e3d5c',
  oceanLight: '#1a5f82',
  teal:       '#2ec4b6',
  tealLight:  '#a8ece8',
  tealDim:    'rgba(46,196,182,0.12)',
  foam:       '#f0f9fb',
  warm:       '#f97316',
  sand:       '#fdf8f2',
  muted:      '#8fb8cc',
  border:     'rgba(168,236,232,0.14)',
} as const;

function QuickCard({
  href, icon, title, desc, accent = C.teal,
}: {
  href: '/timer' | '/log' | '/explore' | '/info' | '/mypage';
  icon: string; title: string; desc: string; accent?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={ss.card}>
        <View style={[ss.cardIconWrap, { backgroundColor: `${accent}22` }]}>
          <Text style={ss.cardIcon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.cardTitle}>{title}</Text>
          <Text style={ss.cardDesc}>{desc}</Text>
        </View>
        <Text style={[ss.cardArrow, { color: accent }]}>›</Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={ss.container}>
      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <View style={ss.header}>
          <Text style={ss.eyebrow}>FREEDIVING JAPAN</Text>
          <Text style={ss.title}>おかえりなさい</Text>
          <Text style={ss.subtitle}>今日も安全に、無理なく潜りましょう</Text>
        </View>

        <Pressable style={ss.heroCard}>
          <Link href="/timer" asChild>
            <Pressable style={ss.heroInner}>
              <View>
                <Text style={ss.heroLabel}>クイックスタート</Text>
                <Text style={ss.heroTitle}>STAタイマーを開く</Text>
              </View>
              <View style={ss.heroBtn}>
                <Text style={ss.heroBtnTxt}>開始</Text>
              </View>
            </Pressable>
          </Link>
        </Pressable>

        <Text style={ss.sectionLabel}>メニュー</Text>
        <View style={{ gap: 10 }}>
          <QuickCard href="/log" icon="📋" title="ログ" desc="トレーニング記録の一覧・登録" accent={C.teal} />
          <QuickCard href="/timer" icon="⏱️" title="タイマー" desc="STAタイマー・カウントダウン" accent={C.warm} />
          <QuickCard href="/explore" icon="🔍" title="探す" desc="インストラクター・スクールを探す" accent={C.oceanLight} />
          <QuickCard href="/info" icon="🏆" title="情報" desc="ランキング・大会・メディア記事" accent={C.tealLight} />
          <QuickCard href="/mypage" icon="👤" title="マイページ" desc="プロフィール・予約・設定" accent={C.muted} />
        </View>

        <View style={ss.footerNote}>
          <Text style={ss.footerNoteTxt}>
            一部の機能は現在準備中です。詳しい内容はWeb版でもご確認いただけます。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.oceanDeep },
  scroll:    { padding: 20, paddingBottom: 48, gap: 20 },

  header:   { gap: 4, marginTop: 8 },
  eyebrow:  { fontSize: 11, letterSpacing: 3, fontWeight: '700', color: C.teal, textTransform: 'uppercase' },
  title:    { fontSize: 26, fontWeight: '700', color: C.sand, marginTop: 2 },
  subtitle: { fontSize: 13, color: C.muted },

  heroCard:  { borderRadius: 18, overflow: 'hidden' },
  heroInner: {
    backgroundColor: C.oceanMid,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroLabel: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.tealLight, fontWeight: '700' },
  heroTitle: { fontSize: 17, fontWeight: '700', color: C.sand, marginTop: 4 },
  heroBtn:   { backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  heroBtnTxt:{ fontSize: 12, fontWeight: '700', color: C.oceanDeep, letterSpacing: 1 },

  sectionLabel: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, fontWeight: '700' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.oceanMid, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14,
  },
  cardIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardIcon:     { fontSize: 18 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.sand },
  cardDesc:     { fontSize: 11, color: C.muted, marginTop: 2 },
  cardArrow:    { fontSize: 20, fontWeight: '700' },

  footerNote:    { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  footerNoteTxt: { fontSize: 11, color: C.muted, lineHeight: 16, textAlign: 'center' },
});
