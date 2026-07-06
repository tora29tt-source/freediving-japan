---
tags: [ops, core-doc]
---

# ops/ — 運用・自動化ツール

> 2026-07-06 の業務改善セッションで導入。背景と全体計画は `ops/IMPROVEMENT_PLAN_20260706.md`。

## 中身

| ファイル | 役割 | 実行方法 |
|---|---|---|
| `scan_followups.mjs` | 未実施SQL・「実機確認未」等の積み残しをMD/sqlから自動検出 | `node ops/scan_followups.mjs`（`--write`で FOLLOWUPS.md 更新） |
| `qa/smoke_test.mjs` | 本番ページ疎通・Supabase公開データ・**RLS負の検証**・データ整合を読み取り専用でチェック | `node ops/qa/smoke_test.mjs`（Macのターミナルで） |
| `qa/RELEASE_CHECKLIST.md` | 領域別の人間確認チェックリスト | 実装した領域のセクションだけ見る |
| `FOLLOWUPS.md` | スキャナの最新出力（自動生成・手編集しない） | — |
| `skills/` | Cowork Skill のソース（qa-runner / media-writer） | Coworkにインストールして使用 |

## 毎日の運用（3ステップ）

1. **作業開始時**：Claudeに「PM呼んで」→ pmスキルが今日のタスクを提示（pmは `ops/FOLLOWUPS.md` も参照）
2. **実装完了時**：Claudeに「QAして」→ qa-runnerスキルがスキャナ実行＋smoke_testコマンド提示＋該当チェックリスト提示
3. **commit前**：ターミナルで

```bash
cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
node ops/qa/smoke_test.mjs && node ops/scan_followups.mjs --write
```

## 運用ルール

- **SQLファイルは必ず先頭にステータスヘッダを付ける**（`-- ステータス: 実行済み（YYYY-MM-DD） / 未実行`）。ヘッダ無しはスキャナが検出する
- smoke_test は**書き込みを一切しない**（anon keyのみ・SELECTのみ）。いつ実行しても安全
- RLS負の検証で FAIL が出たら**最優先で対応**（個人情報が匿名で読める状態）
- FOLLOWUPS.md は自動生成なので直接編集しない。元のMD側を直す
