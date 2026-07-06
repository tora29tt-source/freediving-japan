---
name: media-writer
description: >
  Freediving Japan メディアの記事制作ラインを一気通貫で回すスキル。
  「記事を書きたい」「記事にして」「素材を渡す」「SNS文を作って」「次の記事どれにする？」などのフレーズで積極的にトリガーする。
  素材から記事MD・タイトル案・スラッグ・リード・タグ・SNS投稿文までワンセットで生成し、公開前チェックまで担う。
---

# media-writer — 記事制作ライン

リポジトリ：`/Users/takuyaterajima/Desktop/10.Freediving/30.Freediving Japan/freediving-japan/`

## 開始時に必ずやること

1. `MEDIA_OPS.md` を Read する（思想・カテゴリ・署名ルール・SNSフローの正データ）
2. 素材が渡されていなければ、以下を確認する（不足しても推測で進め、確認点として明示する）：
   - 素材（文字起こし／メモ／元記事URL）
   - カテゴリ（A〜T）※判断フローはMEDIA_OPS.md §2
   - 署名（named / editorial）※ルールはMEDIA_OPS.md §3
   - 想定読者（ペルソナ1〜5）

素材がない状態で「次の記事どれにする？」と聞かれたら、MEDIA_OPS.md §17 の記事アイデアリスト（86本）から
★優先・ローンチ4本・公開済み記事とのバランスを考慮して3本提案する。

## 生成物（必ずワンセットで出す）

1. **記事本文**（Markdown）— 人物中心・一次情報重視。競技者にしか刺さらない内容になっていないか毎回チェック（MEDIA_OPS.md §14）
2. **タイトル案 3つ** — 感情・一次情報・具体数字のいずれかを含む
3. **スラッグ** — `{カテゴリ英語}-{内容キーワード}`（英数ハイフンのみ）
4. **リード文** — 2〜3文。「誰が」「何を」「なぜ読むべきか」
5. **タグ候補 5個**
6. **X個人用スレッド**（3〜5ツイート・感情/裏側ベース・最後に記事リンク）
7. **X公式用投稿文**（タイトル＋リード・140字以内）
8. **Instagramキャプション**（ハッシュタグ含む）
9. 関連する learn/ 講座があれば **記事末尾CTA**（MEDIA_OPS.md §16。無ければ入れない）

## 入稿フロー

1. 画像があれば Supabase Storage（article-images バケット）へのアップ手順を案内
2. DB INSERT は `scripts/insert_article.mjs` で **is_published=false の下書き**として投入（書式: `ops/templates/article_template.md`、実行コマンドは MEDIA_OPS.md §4 STEP3-2 参照。service_role key は環境変数でTakuyaが渡す）
3. 公開前チェックリスト（MEDIA_OPS.md §4 STEP4）を提示
4. **公開は必ずTakuyaが admin 画面で行う。SkillはINSERTまで（下書き）**
5. SNS投稿文を渡し、**投稿自体はTakuyaが行う**（誤投稿防止のため自動投稿しない）

## 制約（CLAUDE.md より・遵守必須）

- git コマンドは一切実行しない（commit促しは cd + gcp の2行セット）
- computer-use ツールは一切使用しない
- 新規ファイルは Write ツールでなくターミナルの cat コマンドで作成する
- 記事の公開状態変更・SNS投稿は絶対に自動で行わない（人間承認必須）
