// Vercel Serverless Function
// POST /api/translate-content
//
// UGC（インストラクター/ショップの自己紹介、コース説明、レビュー等）を
// 保存時に自動翻訳してキャッシュする共通エンドポイント。
// DEV.md「多言語対応（i18n）方式（2026-07-12・secretary相談で確定）」参照。
//
// 呼び出し例（プロフィール保存後などに fire-and-forget で叩く想定）：
//   fetch('/api/translate-content', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       tableName: 'instructors',
//       rowId: instructor.id,
//       fields: { name: instructor.name, bio: instructor.bio },
//     }),
//   });
//
// 必要な環境変数（Vercel Dashboard > Settings > Environment Variables）:
//   GOOGLE_TRANSLATE_API_KEY   — Google Cloud Translation API のAPIキー
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  — translations テーブルへの書き込みはservice_role限定

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_LANGS = ['en', 'ko', 'zh'];
const SOURCE_LANG = 'ja';

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function callGoogleTranslate(text, targetLang) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
  }

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: SOURCE_LANG,
        target: targetLang,
        format: 'text',
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Google Translate API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText;
  if (!translated) {
    throw new Error('Google Translate API returned no translation');
  }
  return translated;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tableName, rowId, fields } = req.body || {};

  if (!tableName || !rowId || !fields || typeof fields !== 'object') {
    return res.status(400).json({ error: '必須パラメーターが不足しています（tableName / rowId / fields）' });
  }

  const fieldNames = Object.keys(fields).filter(
    (k) => typeof fields[k] === 'string' && fields[k].trim() !== ''
  );

  if (fieldNames.length === 0) {
    return res.status(200).json({ results: [], message: '翻訳対象のテキストがありません' });
  }

  const results = [];

  try {
    for (const fieldName of fieldNames) {
      const sourceText = fields[fieldName].trim();
      const newHash = hashText(sourceText);

      // 既存の翻訳行を4言語分まとめて取得
      const { data: existingRows, error: fetchErr } = await supabase
        .from('translations')
        .select('lang, source_hash, is_manually_edited')
        .eq('table_name', tableName)
        .eq('row_id', rowId)
        .eq('field_name', fieldName)
        .in('lang', TARGET_LANGS);

      if (fetchErr) {
        console.error('translate-content: fetch existing rows error', fetchErr);
      }

      const existingByLang = Object.fromEntries(
        (existingRows || []).map((r) => [r.lang, r])
      );

      for (const lang of TARGET_LANGS) {
        const existing = existingByLang[lang];

        // 本人が手直し済み → 自動翻訳では絶対に上書きしない
        if (existing?.is_manually_edited) {
          results.push({ fieldName, lang, status: 'skipped_manual_override' });
          continue;
        }

        // 原文が前回翻訳時から変わっていない → 再翻訳（＝API課金）をスキップ
        if (existing?.source_hash === newHash) {
          results.push({ fieldName, lang, status: 'skipped_unchanged' });
          continue;
        }

        try {
          const translatedText = await callGoogleTranslate(sourceText, lang);

          const { error: upsertErr } = await supabase
            .from('translations')
            .upsert(
              {
                table_name: tableName,
                row_id: rowId,
                field_name: fieldName,
                lang,
                translated_text: translatedText,
                source_hash: newHash,
                is_manually_edited: false,
                translated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'table_name,row_id,field_name,lang' }
            );

          if (upsertErr) {
            console.error('translate-content: upsert error', upsertErr);
            results.push({ fieldName, lang, status: 'error', error: upsertErr.message });
            continue;
          }

          results.push({ fieldName, lang, status: 'translated' });
        } catch (err) {
          console.error('translate-content: translation error', fieldName, lang, err);
          results.push({ fieldName, lang, status: 'error', error: err.message });
        }
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error('translate-content error:', err);
    return res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
  }
}
