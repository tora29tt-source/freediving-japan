# 設計書インデックス — Freediving Japan

> 機能と設計書のマッピング。機能追加・仕様変更時はこのファイルも更新すること。  
> 最終更新：2026-06-28

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

---

### 📝 設計書なし（実装済み・要作成）

| 機能 | 主要ファイル | 備考 |
|---|---|---|
| 権限管理（RBAC・ロール・RLS） | `admin/index.html`<br>`sql/rls_update_20260625.sql` | DEV.md の「権限管理設計」セクションに概要あり。専用設計書に昇格推奨 |
| 予約・決済フロー | `explore/listing.html`<br>`api/create-checkout-session.js`<br>`api/stripe-webhook.js`<br>`booking/success.html` | Stripe + Supabase 連携。バグ一覧は DEV.md に記載 |
| トレーニングログ | `tools/training-log.html` | Supabase 接続・保存・編集・URLシェア実装済み |
| 大会・イベント機能 | `events/event-athlete.html`<br>`events/event-staff.html`<br>`events/2026_competitions.html` | マルチデイナビ・Day別タブ・スタートリスト・リザルト実装済み |
| プロダッシュボード | `pro/index.html` | 予約管理・クライアント管理・売上管理・リスティング管理タブ |
| 管理画面 | `admin/index.html` | 空き枠管理・予約一覧・インストラクター承認・メディア管理 |
| マッチング（探す） | `explore/index.html`<br>`explore/listing.html` | Phase 2 本格公開予定。検索・フィルタ・ソート実装済み |
| DB スキーマ設計 | `sql/` | DEV.md の「DBテーブル一覧」に概要。詳細 SQL は `sql/` 以下 |
| Supabase Storage（アバター） | `mypage.html`<br>`pro/index.html` | DEV.md の「Supabase Storage」セクションに概要あり |

---

### ⏳ 未実装（Phase 2 以降）

| 機能 | 予定ファイル | 備考 |
|---|---|---|
| メディア（記事管理・投稿） | `media/index.html`<br>`media/admin-mobile.html` | Phase 2 |
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
