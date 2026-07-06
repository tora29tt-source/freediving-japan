#!/usr/bin/env node
// ============================================================
// scan_followups.mjs — 積み残しタスクの自動検出（読み取り専用）
//
// 検出対象:
//   1. ルート直下・docs/ のMDファイル:「未実施」「未着手」「実機確認未」
//      「動作確認未」「要対応」を含む行
//   2. sql/*.sql: 先頭3行に「未実行」がある / ステータスヘッダ自体が無い
//
// 使い方:
//   node ops/scan_followups.mjs           # レポートを標準出力
//   node ops/scan_followups.mjs --write   # ops/FOLLOWUPS.md にも書き出し
// ============================================================
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MD_PATTERNS = /未実施|未着手|実機確認未|動作確認未|実機での動作確認|要対応/;
const EXCLUDE_LINES = /^\s*\|?\s*~~|対応済み|完了|✅/; // 打ち消し済み・完了行は除外

const mdFiles = [];
for (const f of readdirSync(ROOT)) if (f.endsWith('.md')) mdFiles.push(f);
const docsDir = join(ROOT, 'docs');
if (existsSync(docsDir)) for (const f of readdirSync(docsDir)) if (f.endsWith('.md')) mdFiles.push(join('docs', f));

const findings = [];
for (const rel of mdFiles) {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (MD_PATTERNS.test(line) && !EXCLUDE_LINES.test(line)) {
      findings.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
    }
  });
}

const sqlPending = [];
const sqlNoHeader = [];
const sqlDir = join(ROOT, 'sql');
if (existsSync(sqlDir)) {
  for (const f of readdirSync(sqlDir)) {
    if (!f.endsWith('.sql')) continue;
    const head = readFileSync(join(sqlDir, f), 'utf8').split('\n').slice(0, 3).join('\n');
    if (/ステータス:\s*未実行/.test(head)) sqlPending.push(f);
    else if (!/ステータス:/.test(head)) sqlNoHeader.push(f);
  }
}

let out = `# フォローアップ一覧（自動生成）\n\n生成: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} / \`node ops/scan_followups.mjs\`\n`;
out += `\n## 🔴 未実行のSQL（${sqlPending.length}件）\n\n`;
out += sqlPending.length ? sqlPending.map(f => `- \`sql/${f}\``).join('\n') + '\n' : 'なし\n';
out += `\n## 📋 MD内の積み残し（${findings.length}件）\n\n`;
out += findings.length
  ? findings.map(x => `- **${x.file}:${x.line}** — ${x.text}`).join('\n') + '\n'
  : 'なし\n';
out += `\n## ⚪ ステータスヘッダが無いSQL（${sqlNoHeader.length}件）\n\n`;
out += `> 先頭に \`-- ステータス: 実行済み（YYYY-MM-DD） / 未実行\` を追記すること（DEV.mdルール）\n\n`;
out += sqlNoHeader.length ? sqlNoHeader.map(f => `- \`sql/${f}\``).join('\n') + '\n' : 'なし\n';

console.log(out);
if (process.argv.includes('--write')) {
  writeFileSync(join(ROOT, 'ops', 'FOLLOWUPS.md'), out);
  console.log('\n→ ops/FOLLOWUPS.md に書き出しました');
}
