---
name: qa-runner
description: >
  Freediving Japan の実装後QA・リリース前チェックを実行するスキル。
  「QAして」「動作確認して」「リリース前チェック」「実機確認の準備」などのフレーズで積極的にトリガーする。
  積み残しスキャン・スモークテスト・領域別チェックリスト提示・DEV.md反映までを一連で行う。
---

# qa-runner — 実装後QA・リリース前チェック

リポジトリ：`/Users/takuyaterajima/Desktop/10.Freediving/30.Freediving Japan/freediving-japan/`

## 手順（この順で実行する）

### 1. 積み残しスキャン（Claudeが直接実行）

サンドボックスのbashで `node ops/scan_followups.mjs --write` を実行し、結果を要約して伝える。
特に「🔴 未実行のSQL」があれば最初に報告し、適用するSQLをコードブロックで提示する。

### 2. スモークテスト（Takuyaのターミナルで実行してもらう）

サンドボックスから本番へのネットワークは遮断されているため、以下をコードブロックで提示して実行を依頼する：

```bash
cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
node ops/qa/smoke_test.mjs
```

結果を貼ってもらい、FAILがあれば原因を調査して修正する。
**「C. RLS負の検証」のFAILは個人情報漏洩の可能性があるため最優先で扱う。**

### 3. 人間確認チェックリストの提示

今回のセッション（または直近のcommit）で触った領域を判断し、
`ops/qa/RELEASE_CHECKLIST.md` から**該当セクションだけ**を抜き出して提示する。
全セクションを貼らない。共通セクション（0）＋該当領域のみ。

### 4. 完了処理

Takuyaが確認を終えたら：
1. DEV.md の該当箇所から「実機確認未」「動作確認未」の記載を消し、確認日を追記する
2. コミットを促す。**必ず以下の2行セットで出力する**：

```bash
cd ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan
gcp "QA: ○○の動作確認完了"
```

## 制約（CLAUDE.md より・遵守必須）

- git コマンドは一切実行しない
- computer-use ツールは一切使用しない
- 新規ファイルは Write ツールでなくターミナルの cat コマンドで作成する
- smoke_test / scanner を「修正」する場合も書き込み系のチェックは追加しない（読み取り専用を維持）
