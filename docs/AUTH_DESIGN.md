# 認証設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

Freediving Japan の認証基盤は **Supabase Auth** を使用する。  
フロントエンドはバニラ JS の静的サイト（Vercel にデプロイ）であり、  
サーバーサイドコードは持たないため、**Implicit Flow** を採用している。

| 項目 | 値 |
|---|---|
| 認証基盤 | Supabase Auth（Project: bbhqvbpsuccbdcnhnobm） |
| フロー種別 | Implicit Flow（`flowType: 'implicit'`） |
| トークン格納 | localStorage（Supabase JS が自動管理） |
| 本番 URL | https://freediving-japan.vercel.app |
| 認証ページ | `/auth.html` |
| ログイン後遷移先 | `/mypage.html` |

---

## 2. 対応ログイン方式

| 方式 | 状態 | 備考 |
|---|---|---|
| メール ＋ パスワード | ✅ 有効 | 新規登録・ログイン両対応 |
| Google OAuth | ✅ 有効 | in-app browser では警告を表示 |
| Apple OAuth | ⛔ 無効（コメントアウト） | Apple Developer 設定未完了のため保留 |

---

## 3. ファイル構成

```
/
├── auth.html              # 認証ページ（ログイン・新規登録フォーム）
├── mypage.html            # ログイン後のマイページ（認証ガード付き）
├── js/
│   └── supabase-config.js # Supabase クライアント初期化（全ページ共通）
├── pro/index.html         # インストラクター向けページ（認証ガード付き）
└── admin/index.html       # 管理画面（認証ガード付き）
```

---

## 4. 初期化（supabase-config.js）

```js
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'implicit' }
});
```

- グローバル変数 `_sb` として公開し、全ページで共有
- `flowType: 'implicit'` により、OAuth コールバックのトークンを **URL ハッシュ**（`#access_token=...`）で受け取る
- PKCE フロー（デフォルト）は静的サイトとの相性の問題で不採用

**読み込み順序の厳守（各 HTML ページ）：**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
<!-- ↑ この2行が先に完了してから、ページ固有スクリプトが動く -->
```

---

## 5. auth.html の処理フロー

### 5-1. ページロード時

```
auth.html ロード
  └─ onAuthStateChange 登録
       └─ INITIAL_SESSION イベント発火
            ├─ session あり → mypage.html へ replace（ログイン済みユーザーを自動転送）
            └─ session なし → 何もしない（フォームを表示）
```

### 5-2. Google ログイン

```
ユーザーが「Googleでログイン」クリック
  ├─ in-app browser 検出（LINE, Instagram, Facebook 等）
  │    └─ YES → エラーメッセージ表示して中断
  └─ NO → signInWithOAuth({ provider: 'google', redirectTo: origin + '/auth.html' })
              └─ Google 認証画面へ遷移
                   └─ 認証成功 → auth.html#access_token=TOKEN へリダイレクト
                        └─ Supabase JS がハッシュを処理しセッション確立
                             └─ onAuthStateChange(SIGNED_IN) → mypage.html へ replace
```

**in-app browser 判定条件：**

```js
/FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\//.test(ua)
|| (ua.includes('Safari') === false && ua.includes('Chrome') === false && /iPhone|iPad/.test(ua))
```

### 5-3. メール／パスワード ログイン

```
ユーザーが「ログイン」クリック
  └─ signInWithPassword({ email, password })
       ├─ 失敗 → エラーメッセージ表示、ボタン復元
       └─ 成功 → onAuthStateChange(SIGNED_IN) → mypage.html へ replace
```

### 5-4. 新規登録（メール）

```
ユーザーが「アカウント作成」クリック
  └─ signUp({ email, password, options: { data: { name }, emailRedirectTo: '/auth.html' } })
       ├─ エラー → エラーメッセージ表示
       ├─ session あり（メール確認不要設定）
       │    └─ onAuthStateChange(SIGNED_IN) → mypage.html へ replace
       └─ session なし（メール確認必要設定）
            └─ 「確認メールを送信しました」メッセージ表示
                 └─ ユーザーがメール内リンクをクリック
                      └─ auth.html#access_token=TOKEN へリダイレクト
                           └─ Supabase JS がハッシュを処理
                                └─ onAuthStateChange(SIGNED_IN) → mypage.html へ replace
```

> **⚠️ 重要設計ポイント**  
> `emailRedirectTo` を必ず `/auth.html` に設定する。  
> 未設定だと Supabase が `SITE_URL`（= index.html）にリダイレクトするが、  
> index.html には Supabase が読み込まれていないためトークンが処理されず、  
> メール確認後にログイン状態にならないバグが発生する。

### 5-5. onAuthStateChange のイベントフィルタ

```js
_sb.auth.onAuthStateChange((event, session) => {
  if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
    window.location.replace('mypage.html');
  }
});
```

| イベント | session | 動作 |
|---|---|---|
| `INITIAL_SESSION` | あり | mypage.html へリダイレクト（ログイン済みでauth.htmlを開いた場合） |
| `INITIAL_SESSION` | なし | 何もしない（未ログイン） |
| `SIGNED_IN` | あり | mypage.html へリダイレクト（ログイン成功） |
| `SIGNED_OUT` | なし | 何もしない |
| `TOKEN_REFRESHED` | あり | 何もしない（フィルタにより無視） |
| `USER_UPDATED` | あり | 何もしない（フィルタにより無視） |

---

## 6. mypage.html の認証ガード

### 6-1. 認証チェック

```js
(async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window.location.replace('auth.html');
    return;
  }
  // セッションあり → ユーザー情報を表示
})();
```

### 6-2. ログアウト検知

```js
_sb.auth.onAuthStateChange((_event, s) => {
  if (!s) window.location.replace('auth.html');
});
```

セッションが切れた瞬間に auth.html へ自動遷移する。

### 6-3. ユーザー名の解決優先順位

```
meta.name（メール登録時に入力した名前）
  → meta.full_name（Google 提供の氏名）
  → email のローカル部（@ 以前）
```

### 6-4. 権限（ロール）チェック

```js
const { data: roles } = await _sb
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const ADMIN_ROLES = ['admin', 'staff', 'editor'];
const hasAdminRole = roles?.some(r => ADMIN_ROLES.includes(r.role));
```

`admin` / `staff` / `editor` ロールを持つユーザーにのみ管理画面ボタンを表示。

---

## 7. ログアウト

```js
async function handleLogout() {
  if (!confirm('ログアウトしますか？')) return;
  await _sb.auth.signOut();
  window.location.href = 'auth.html';
}
```

`signOut()` → Supabase がローカルのトークンを削除 → `onAuthStateChange(SIGNED_OUT)` 発火 → auth.html へ遷移。

---

## 8. Supabase ダッシュボード側の必須設定

### 8-1. Redirect URLs（要登録）

| URL | 用途 |
|---|---|
| `https://freediving-japan.vercel.app/auth.html` | 本番環境の OAuth・メール確認リダイレクト先 |
| `https://freediving-japan.vercel.app/**` | ワイルドカード（念のため） |
| `http://localhost:*/auth.html` | ローカル開発時 |

### 8-2. Google OAuth プロバイダー設定

- Google Cloud Console に Supabase のコールバック URL を登録  
  （`https://bbhqvbpsuccbdcnhnobm.supabase.co/auth/v1/callback`）
- Supabase ダッシュボード → Authentication → Providers → Google で Client ID / Secret を設定

### 8-3. Apple OAuth

- 現在ボタンはコメントアウト済み
- 有効化するには Apple Developer Program の設定が必要

### 8-4. DB トリガー（handle_new_user）

新規ユーザー登録時に `public.profiles` テーブルへレコードを自動作成するトリガー関数。

```sql
-- 必須設定
SET search_path = public;
-- profiles への INSERT は public.profiles と明示
-- user_metadata から full_name / name をフォールバックで取得
```

---

## 9. セキュリティ

| 項目 | 対応 |
|---|---|
| anon key の公開 | ✅ 問題なし（RLS で保護） |
| service_role key | ❌ フロントに書かない |
| RLS（Row Level Security） | ✅ 全テーブルで有効 |
| HTTPS 強制 | ✅ Vercel が自動対応 |
| in-app browser でのOAuth | ✅ UA チェックで警告表示 |

---

## 10. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| Apple ログイン | Apple Developer 設定完了後に有効化予定 |
| パスワードリセット | 未実装（`/auth.html` にリセットフォーム追加予定） |
| Magic Link ログイン | 未実装（オプション） |
| セッション有効期限 | Supabase デフォルト（1時間 + リフレッシュトークン） |
| iOS Safari プライベートモード | localStorage が制限される場合あり（現時点で未対応） |
