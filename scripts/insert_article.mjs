#!/usr/bin/env node
// ============================================================
// insert_article.mjs — 記事MD → Supabase 下書きINSERT / UPDATE
//
// MEDIA_OPS.md §4「Takuya専用フロー」STEP 3 の実装。
// フロントマター付きMDファイルを読み、HTML変換して articles に投入する。
// **必ず is_published=false（下書き）で入れる。公開は admin 画面から。**
//
// 使い方（Macのターミナルで）:
//   cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
//   npm install                     # 初回のみ（marked を取得）
//   SUPABASE_SERVICE_KEY=xxx node scripts/insert_article.mjs 記事.md
//   SUPABASE_SERVICE_KEY=xxx node scripts/insert_article.mjs 記事.md --update  # slug一致の既存記事を更新
//
// テンプレート: ops/templates/article_template.md
// service_role key はコードに書かない（環境変数のみ・DEV.mdセキュリティルール）
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';

const SUPABASE_URL = 'https://bbhqvbpsuccbdcnhnobm.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) {
  console.error('環境変数 SUPABASE_SERVICE_KEY が未設定です。');
  console.error('例: SUPABASE_SERVICE_KEY=eyJ... node scripts/insert_article.mjs 記事.md');
  process.exit(1);
}

const file = process.argv[2];
const isUpdate = process.argv.includes('--update');
if (!file) { console.error('使い方: node scripts/insert_article.mjs <記事.md> [--update]'); process.exit(1); }

// ---------- フロントマター解析 ----------
const raw = readFileSync(file, 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!m) { console.error('フロントマター（--- で囲むメタ情報）がありません。ops/templates/article_template.md 参照'); process.exit(1); }
const meta = {};
for (const line of m[1].split('\n')) {
  const i = line.indexOf(':');
  if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const body = m[2].trim();

// ---------- バリデーション ----------
const errs = [];
if (!/^[a-z0-9-]+$/.test(meta.slug || '')) errs.push('slug は英小文字・数字・ハイフンのみ');
if (!'ABCDEPQST'.includes(meta.category || '')) errs.push('category は A/B/C/D/E/P/Q/S/T のいずれか');
if (!['named', 'editorial'].includes(meta.author_type || '')) errs.push("author_type は 'named' か 'editorial'");
if (!meta.title) errs.push('title が空');
if (!meta.lead_text) errs.push('lead_text が空');
if (!body) errs.push('本文が空');
if (errs.length) { console.error('入力エラー:\n- ' + errs.join('\n- ')); process.exit(1); }
if (!meta.thumbnail_url) console.warn('⚠️  thumbnail_url が未設定（公開前に必ず設定すること）');

const row = {
  slug: meta.slug,
  title: meta.title,
  category: meta.category,
  author_type: meta.author_type,
  author_name: meta.author_name || 'Freediving Japan 編集部',
  lead_text: meta.lead_text,
  content: marked.parse(body),
  tags: meta.tags ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
  read_time_min: meta.read_time_min ? Number(meta.read_time_min) : null,
  thumbnail_url: meta.thumbnail_url || null,
  ...(meta.author_bio ? { author_bio: meta.author_bio } : {}),
};

// ---------- 実行 ----------
const sb = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
const { data: existing } = await sb.from('articles').select('id, is_published').eq('slug', row.slug).maybeSingle();

if (isUpdate) {
  if (!existing) { console.error(`slug "${row.slug}" の既存記事がありません（--update を外して新規作成）`); process.exit(1); }
  // 公開状態には一切触らない（content系フィールドのみ更新）
  const { error } = await sb.from('articles').update(row).eq('id', existing.id);
  if (error) { console.error('UPDATE失敗:', error.message); process.exit(1); }
  console.log(`✅ 更新完了: ${row.slug}（公開状態は変更していません）`);
} else {
  if (existing) { console.error(`slug "${row.slug}" は既に存在します（更新なら --update を付ける）`); process.exit(1); }
  const { error } = await sb.from('articles').insert({ ...row, status: 'draft', is_published: false });
  if (error) { console.error('INSERT失敗:', error.message); process.exit(1); }
  console.log(`✅ 下書きINSERT完了: ${row.slug}`);
}
console.log(`プレビュー: https://freediving-japan.vercel.app/media/article.html?slug=${row.slug}`);
console.log('公開は admin 画面（メディアタブ）から行ってください。');
