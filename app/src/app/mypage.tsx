/**
 * マイページ — Freediving Japan App
 * ログイン（メール/パスワード）・ログアウト・プロフィール等はWeb版へのブリッジ
 *
 * Googleログイン・プロフィール編集・予約履歴・CRMはWeb版のみ対応（Phase 2でネイティブ移植予定）。
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { useAuth } from '@/hooks/use-auth';

const C = {
  oceanDeep: '#0b2d45',
  oceanMid:  '#0e3d5c',
  teal:      '#2ec4b6',
  tealLight: '#a8ece8',
  sand:      '#fdf8f2',
  muted:     '#8fb8cc',
  border:    'rgba(168,236,232,0.14)',
  danger:    '#f97362',
} as const;

function LoginForm() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } =
      mode === 'signin'
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setNotice('登録しました。確認メールが届いている場合はリンクを開いてください。');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={ss.formWrap}>
        <Text style={ss.icon}>👤</Text>
        <Text style={ss.msg}>{mode === 'signin' ? 'ログイン' : '新規登録'}</Text>
        <Text style={ss.sub}>Web版と共通のアカウントでログインできます</Text>

        <View style={{ width: '100%', gap: 10, marginTop: 16 }}>
          <TextInput
            style={ss.input}
            placeholder="メールアドレス"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={ss.input}
            placeholder="パスワード"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {error && <Text style={ss.errorTxt}>{error}</Text>}
        {notice && <Text style={ss.noticeTxt}>{notice}</Text>}

        <Pressable style={[ss.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={C.oceanDeep} />
          ) : (
            <Text style={ss.btnTxt}>{mode === 'signin' ? 'ログイン' : '登録する'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}>
          <Text style={ss.switchTxt}>
            {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方はこちら'}
          </Text>
        </Pressable>

        <View style={ss.divider} />

        <Text style={ss.hint}>Googleログインや詳細設定はWeb版マイページからご利用いただけます</Text>
        <ExternalLink href="https://freediving-japan.vercel.app/auth.html" asChild>
          <Pressable style={ss.webBtn}>
            <Text style={ss.webBtnTxt}>Web版でログイン</Text>
          </Pressable>
        </ExternalLink>
      </View>
    </KeyboardAvoidingView>
  );
}

function ProfilePanel() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <View style={ss.formWrap}>
      <Text style={ss.icon}>✅</Text>
      <Text style={ss.msg}>ログイン中</Text>
      <Text style={ss.sub}>{user?.email}</Text>

      <ExternalLink href="https://freediving-japan.vercel.app/mypage.html" asChild>
        <Pressable style={[ss.btn, { marginTop: 20 }]}>
          <Text style={ss.btnTxt}>Web版マイページを開く</Text>
        </Pressable>
      </ExternalLink>

      <Pressable
        style={[ss.logoutBtn, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={async () => { setBusy(true); await signOut(); setBusy(false); }}
      >
        <Text style={ss.logoutBtnTxt}>ログアウト</Text>
      </Pressable>
    </View>
  );
}

export default function MyPageScreen() {
  const { session, loading } = useAuth();

  return (
    <SafeAreaView style={ss.container}>
      <View style={ss.header}>
        <Text style={ss.eyebrow}>ACCOUNT</Text>
        <Text style={ss.title}>マイページ</Text>
      </View>

      {loading ? (
        <View style={ss.centerFill}><ActivityIndicator color={C.teal} /></View>
      ) : session ? (
        <ProfilePanel />
      ) : (
        <LoginForm />
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.oceanDeep },
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 4 },
  eyebrow:   { fontSize: 11, letterSpacing: 3, fontWeight: '700', color: C.teal, textTransform: 'uppercase' },
  title:     { fontSize: 22, fontWeight: '700', color: C.sand },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  formWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  icon: { fontSize: 32, marginBottom: 6 },
  msg:  { fontSize: 16, fontWeight: '700', color: C.sand, textAlign: 'center' },
  sub:  { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 17, marginTop: 2 },

  input: {
    width: '100%', height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.oceanMid, color: C.sand, paddingHorizontal: 14, fontSize: 13,
  },

  errorTxt:  { fontSize: 11, color: C.danger, textAlign: 'center', marginTop: 10 },
  noticeTxt: { fontSize: 11, color: C.tealLight, textAlign: 'center', marginTop: 10, lineHeight: 16 },

  btn:  { width: '100%', marginTop: 16, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '700', color: C.oceanDeep, letterSpacing: 0.5 },

  switchTxt: { fontSize: 11, color: C.tealLight, textAlign: 'center', marginTop: 14 },

  divider: { width: '100%', height: 1, backgroundColor: C.border, marginTop: 24, marginBottom: 16 },
  hint: { fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 15, marginBottom: 10 },
  webBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  webBtnTxt: { fontSize: 11, fontWeight: '700', color: C.tealLight },

  logoutBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 18 },
  logoutBtnTxt: { fontSize: 11, fontWeight: '700', color: C.danger },
});
