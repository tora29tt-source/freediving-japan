# メディア機能 設計書 — Freediving Japan

> 対象ファイル：`media/` ディレクトリ全体  
> 最終更新：2026-06-29

---

## 1. 概要

メディアはFreediving Japanの**集客専任エンジン**。記事自体はマネタイズせず、マッチング（/explore/）・動画教材（/learn/）への送客を目的とする。

- ターゲット：未ログインの一般初心者〜フリーダイビングに興味を持った人
- 記事はSupabaseの `articles` テーブルで管理し、フロントエンドが動的に取得・表示する
- 制作フローはスマホ完結（録音 → Claude整形 → CMS投稿 → 自動反映）

---

## 2. ファイル構成

```
/media/
  index.html          — 記事一覧（Supabase動的取得）
  article.html        — 記事詳細（?slug= パラメータで動的表示）
  article-editor.html — 記事作成・編集CMS（editor以上ログイン必須）
  admin-mobile.html   — アイデアリスト専用（本番DB未接続・運用しない）
```

---

## 3. データベース設計

### articles テーブル

```sql
articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,          -- URL識別子（例: "my-record-story"）
  title           text NOT NULL,
  category        text NOT NULL,                 -- カテゴリコード（A〜T、後述）
  author_type     text NOT NULL,                 -- 'takuya' | 'editorial'
  author_name     text NOT NULL,                 -- 表示名
  lead_text       text,                          -- リード文（一覧カードに表示）
  content         text,                          -- 本文HTML
  tags            text[],                        -- タグ配列
  read_time_min   int,                           -- 読了時間（分）
  status          text DEFAULT 'draft',          -- 'draft' | 'review' | 'published'
  is_published    boolean DEFAULT false,
  published_at    timestamptz,
  thumbnail_url   text,
  created_by      uuid REFERENCES auth.users(id),
  review_comment  text                           -- レビューコメント（editor → staff）
)
```

### カテゴリ定義（9区分）

| コード | 内容 | 優先度 |
|---|---|---|
| A | 入門・体験（検索流入） | SEO土台 |
| B | 身体・科学（CO2・潜水反射等） | 信頼蓄積 |
| C | 海・スポット | マッチング送客 |
| D | 競技・大会 | 競技者向け |
| E | インタビュー | ◎ 看板 |
| P | 人物メディア（Takuya or ゲスト主語） | ◎ 看板 |
| Q | 業界×期待感 | ◎ 初期優先 |
| S | シリーズ連載 | 回遊・継続訪問 |
| T | エンタメ | 拡散・一般層 |

### 署名ルール（author_type × author_name）

| 記事タイプ | author_type | author_name |
|---|---|---|
| インタビュー記事 | takuya | 取材・文：寺島拓哉 |
| 日本記録・競技体験談 | takuya | 寺島拓哉 |
| 一般情報・入門記事 | editorial | Freediving Japan 編集部 |
| 大会レポート（映像込み） | takuya | 取材・撮影：寺島拓哉 |
| ニュース翻訳 | editorial | Freediving Japan 編集部 |

---

## 4. データフロー（記事が公開されるまで）

```
【制作】
Takuya が現場取材・音声録音
    ↓
Claude に素材を渡す（音声 / テキスト）
    ↓
Claude が記事整形（構成・文章化・SNS切り出し）
    ↓
【入稿】
Takuya が article-editor.html を開く（要ログイン・admin/staff/editor）
    ↓
タイトル・カテゴリ・本文HTML・サムネ・タグを入力
    ↓
status = 'draft' で保存 → Supabase の articles テーブルに INSERT
    ↓
【レビュー（任意）】
status = 'review' に変更 → review_comment を付けて staff に渡す
    ↓
staff が内容確認
    ↓
【公開】
status = 'published' + is_published = true + published_at = now() に更新
    ↓
【エンドユーザーへ配信】
media/index.html が Supabase から is_published=true の記事を取得して一覧表示
    ↓
ユーザーが記事カードをクリック
    ↓
media/article.html?slug={slug} で記事詳細を動的レンダリング
```

### Supabase クエリ（一覧取得）

```javascript
const { data } = await supabase
  .from('articles')
  .select('id, slug, title, category, author_name, lead_text, tags, read_time_min, published_at, thumbnail_url')
  .eq('is_published', true)
  .order('published_at', { ascending: false });
```

### Supabase クエリ（記事詳細取得）

```javascript
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('slug', slug)
  .eq('is_published', true)
  .single();
```

---

## 5. Supabase RLS 設計

| 操作 | 条件 |
|---|---|
| SELECT（公開記事） | is_published = true → 全員（未ログイン含む） |
| SELECT（全件） | 認証済みユーザー全員（一覧UI側でフィルタ） |
| SELECT（全件・管理用） | is_site_admin() = true（admin/staff/editor） |
| INSERT | is_site_admin() = true |
| UPDATE（全件） | admin / staff |
| UPDATE（自分の記事・下書きのみ） | editor かつ created_by = auth.uid() かつ status ≠ 'published' |
| DELETE（全件） | admin / staff |
| DELETE（自分の下書きのみ） | editor かつ created_by = auth.uid() かつ status = 'draft' |

ポリシーファイル：`sql/articles_review_flow_20260629.sql`（実行済み）

---

## 6. CMS（article-editor.html）の仕様

- **アクセス要件**：ログイン済み + is_site_admin()（admin/staff/editor）
- **機能**：新規作成・既存記事の編集・ステータス変更
- **本文フォーマット**：HTML入力（`<p>`, `<h2>`, `<blockquote>` 等）
- **サムネイル**：URL直接入力（Supabase Storage or 外部URL）
- **未保存警告**：`beforeunload` イベントで離脱前に確認ダイアログ表示

---

## 7. フロントエンド表示設計

### media/index.html（記事一覧）

- Supabase から `is_published=true` の記事を全件取得
- カテゴリタブで絞り込み（A〜T + 「すべて」）
- カードUI：サムネ / カテゴリバッジ / タイトル / リード文 / 著者 / 読了時間 / 日付
- クリックで `article.html?slug={slug}` に遷移

### media/article.html（記事詳細）

- `?slug=` パラメータからSlugを取得
- Supabase から該当記事を1件取得
- ヒーロー画像（サムネ） / カテゴリバッジ / タイトル / 著者 / 本文HTML をレンダリング
- 本文HTMLは `innerHTML` でそのまま挿入（XSS対策：投稿時にサニタイズ済み）
- 記事下部にシリーズ連載リンク・マッチング送客CTA

---

## 8. 記事制作ワークフロー（スマホ完結）

```
① iPhone で取材・音声録音 / 動画撮影
② Claude に素材渡し → 記事整形（構成・文章・SNS切り出し）
③ スマホブラウザで article-editor.html を開く
④ 本文貼り付け・メタ情報入力 → 保存（draft）
⑤ 確認後 → status を published に変更
⑥ media/index.html に自動反映（Vercel 再デプロイ不要）
```

Supabaseはリアルタイムにデータを返すため、**公開操作だけでエンドユーザーに即時配信される**。Vercelのデプロイは不要。

---

## 9. SNS展開・送客設計

- 公開後、記事URLをXとFreediving Japan公式アカウントで拡散
- 個人X（@terajima_takuya）でスレッドとして先行FB → 公式アカウントで記事リンクをシェア
- 記事末尾のCTA：「習ってみる → /explore/」「教材を見る → /learn/」

---

## 10. 関連ファイル

| ファイル | 役割 |
|---|---|
| `js/supabase-config.js` | Supabase接続設定（anon key） |
| `sql/articles_review_flow_20260629.sql` | articlesテーブルのRLSポリシー（実行済み） |
| `docs/RBAC_DESIGN.md` | ロール設計・is_site_admin()関数 |
| `docs/AUTH_DESIGN.md` | 認証フロー |

---

## 11. 既知の制限・将来対応

| 項目 | 現状 | 将来対応 |
|---|---|---|
| 画像アップロード | URL直接入力のみ | Supabase Storageへのアップロード機能（Phase 2） |
| OGP/SEOメタタグ | 静的ページのみ | 記事詳細のdynamic OGP（SSR or Vercel Edge Function） |
| 英語対応 | 未対応 | Phase 2でi18n導入（テキストハードコード禁止） |
| media/admin-mobile.html | LocalStorageのみ・本番DB未接続 | Phase 2本番化時に要対応 or 廃止 |
| コメント機能 | 未実装 | Phase 3以降 |
| 全文検索 | 未実装 | Supabase pg_trgm or Algolia（Phase 3） |
