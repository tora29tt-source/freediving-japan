---
tags: [design-doc, index]
---

# 設計書インデックス — Freediving Japan

> 機能と設計書のマッピング。機能追加・仕様変更時はこのファイルも更新すること。  
> 最終更新：2026-06-29

---

## ルール

| やること | タイミング |
|---|---|
| 対応する設計書を更新する | 仕様変更・バグ修正・機能追加のたびに |
| 新しい設計書を作成する | 設計書が存在しない機能を実装するとき（コーディング前） |
| このファイル（INDEX.md）を更新する | 設計書を追加・変更したとき |

設計書のファイル名規則：`docs/{機能名}_DESIGN.md`

---

## 設計書マッピング

### ✅ 設計書あり

| 機能 | 主要ファイル | 設計書 | 最終更新 |
|---|---|---|---|
| 認証（ログイン・新規登録・OAuth） | `auth.html`<br>`js/supabase-config.js`<br>`mypage.html` | [AUTH_DESIGN.md](./AUTH_DESIGN.md) | 2026-06-28 |
| 権限管理（RBAC・ロール・RLS） | `admin/index.html`<br>`sql/rls_update_20260625.sql` | [RBAC_DESIGN.md](./RBAC_DESIGN.md) | 2026-06-28 |
| 予約・決済フロー | `explore/listing.html`<br>`api/create-checkout-session.js`<br>`api/stripe-webhook.js`<br>`booking/success.html` | [BOOKING_DESIGN.md](./BOOKING_DESIGN.md) | 2026-06-28 |
| トレーニングログ | `tools/training-log.html` | [TRAINING_LOG_DESIGN.md](./TRAINING_LOG_DESIGN.md) | 2026-06-28 |
| 大会・イベント機能 | `events/event-athlete.html`<br>`events/event-staff.html`<br>`events/2026_competitions.html` | [EVENTS_DESIGN.md](./EVENTS_DESIGN.md) | 2026-06-28 |
| プロダッシュボード | `pro/index.html` | [PRO_DASHBOARD_DESIGN.md](./PRO_DASHBOARD_DESIGN.md) | 2026-06-28 |
| 管理画面 | `admin/index.html` | [ADMIN_DESIGN.md](./ADMIN_DESIGN.md) | 2026-06-28 |
| マッチング（探す） | `explore/index.html`<br>`explore/listing.html` | [EXPLORE_DESIGN.md](./EXPLORE_DESIGN.md) | 2026-06-28 |
| DB スキーマ設計 | `sql/` | [DB_SCHEMA_DESIGN.md](./DB_SCHEMA_DESIGN.md) | 2026-06-28 |
| Supabase Storage（アバター） | `mypage.html`<br>`pro/index.html` | [STORAGE_DESIGN.md](./STORAGE_DESIGN.md) | 2026-06-28 |
| メディア（記事管理・CMS・公開フロー・SEO・SNS・技術仕様） | `media/index.html`<br>`media/article.html`<br>`media/article-editor.html` | [MEDIA_OPS.md](../MEDIA_OPS.md) | 2026-06-29 |

---

### 📝 設計書なし（実装済み・要作成）

なし — すべての実装済み機能の設計書が揃っています。

---

### ⏳ 未実装（Phase 2 以降）

| 機能 | 予定ファイル | 備考 |
|---|---|---|
| パスワードリセット | `auth.html` | 未実装 |
| Magic Link ログイン | `auth.html` | オプション |
| Apple ログイン | `auth.html` | Apple Developer 設定後に有効化 |

---

### 📱 アプリ設計書

| ドキュメント | 内容 |
|---|---|
| [APP.md](../APP.md) | iOS アプリの方針・機能スコープ・画面設計・ロードマップ |

---

## 設計書作成ガイドライン

新しい設計書（`docs/XXXX_DESIGN.md`）に含めるべきセクション：

1. **概要** — 機能の目的・スコープ
2. **ファイル構成** — 関連するファイル一覧
3. **処理フロー** — 主要なユーザーフローをフローチャートで
4. **データ構造** — 関連する DB テーブル・カラム
5. **Supabase / API 設定** — 必要なダッシュボード設定
6. **セキュリティ** — RLS・権限設計
7. **既知の制限・将来対応** — バグ・未実装事項
