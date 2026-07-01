---
tags: [moc]
---

# Freediving Japan — Home

このリポジトリ全体が Obsidian の Vault です。コードと同じ場所にドキュメントがあるので、常に最新の状態を見られます。

## 作業前に読むもの（CLAUDE.md 指定）

- [[STRATEGY]] — プロジェクト概要・ターゲット・フェーズロードマップ・収益化設計
- [[DEV]] — 技術スタック・DB設計・ファイル構成・実装状況・スケジュール・セキュリティルール
- [[APP]] — iOSアプリの方針・機能スコープ・画面設計・ロードマップ
- [[MEDIA_OPS]] — メディアの思想・カテゴリ・制作フロー・SNS・SEO・技術仕様・ロール設計

## 設計書（docs/）

- [[docs/INDEX|設計書インデックス]] — 機能 ⇔ 設計書のマッピング表（最初にここを見る）
- [[docs/AUTH_DESIGN|認証]]
- [[docs/RBAC_DESIGN|権限管理（RBAC・RLS）]]
- [[docs/BOOKING_DESIGN|予約・決済]]
- [[docs/TRAINING_LOG_DESIGN|トレーニングログ]]
- [[docs/EVENTS_DESIGN|大会・イベント]]
- [[docs/PRO_DASHBOARD_DESIGN|プロダッシュボード]]
- [[docs/ADMIN_DESIGN|管理画面]]
- [[docs/EXPLORE_DESIGN|マッチング（探す）]]
- [[docs/DB_SCHEMA_DESIGN|DBスキーマ]]
- [[docs/STORAGE_DESIGN|Storage（アバター）]]
- [[docs/AIDA_ranking_design|ランキング設計]]
- [[docs/MEDIA_DESIGN|メディア機能設計]]

## 日々の記録

- [[Daily/2026-07-01|今日のノート]]
- 過去のログは `Daily/` フォルダを参照

## 記事・メディア企画

- [[MediaIdeas/_Index|記事ネタ帳インデックス]]

## その他メモ

- [[NOTES]]
- [[BATCH]]

---

### 使い方メモ
- 新しい設計判断や決定事項が出たら、該当ドキュメントに追記し、ここからリンクを張る
- 記事企画は `Templates/Media Idea Template` からノートを複製して `MediaIdeas/` に追加
- 日次ログは `Templates/Daily Note Template` を使い `Daily/` に追加（Obsidian の Daily Notes プラグイン設定済み）
