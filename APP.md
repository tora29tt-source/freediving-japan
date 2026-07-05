---
tags: [app, core-doc]
---

# Freediving Japan — アプリ方針

## 基本思想

**WebでできることはAppでもできるようにする。ただし、文脈に合わせてUIと動線を最適化する。**

WebとAppは「同じ機能を持つ」が、ユーザーの状況・操作意図・デバイスが違うため、**UI・動線・優先順位は異なる**。同じゴールに向かって、それぞれの文脈に最適化する。

| | Web（ブラウザ） | App（iOS） |
|---|---|---|
| 主な状況 | 座って調べる・管理する | 移動中・練習前後・すぐ使いたい |
| 操作 | キーボードあり・大画面 | 片手・小画面・タップ |
| 強み | SEO・コンテンツ閲覧・複雑な管理作業 | プッシュ通知・オフライン・ホーム常駐 |

---

## アプリの位置づけ

Freediving Japan における App は「**Webと同じことができる、モバイル最適化版**」。

- 機能はWebと同等。ただしUIと動線をモバイル文脈に最適化する
- 両者はデータで繋がり、同じ Supabase を参照する
- App固有の強み（プッシュ通知・ホーム常駐・SNS即シェア）を活かす

---

## 機能スコープ（全体）

全機能をAppに含める。ただし、機能によって**実装の深さ・UIの形**をモバイル向けに最適化する。

| 機能 | App での実装方針 | 優先フェーズ |
|---|---|---|
| トレーニングログ登録・履歴 | フル実装（Appが主役） | Phase 1 |
| STAタイマー | フル実装（Appが主役） | Phase 1 |
| カウントダウン | フル実装（Appが主役） | Phase 1 |
| ログのURLシェア | フル実装 | Phase 1 |
| ログのSNSシェア（画像生成） | フル実装（Appならではの機能） | Phase 1 |
| CRM・顧客管理 | モバイル最適化版（予約確認・クライアント一覧・メモ程度。複雑な編集はWebへ） | Phase 2 |
| ランキング閲覧 | フル表示（フィルタ・ソートも対応） | Phase 2 |
| 大会情報 | 閲覧・出場確認はフル対応。登録・編集はWeb管理画面のみ | Phase 2 |
| メディア記事閲覧 | WebViewまたはネイティブ表示で閲覧可能に | Phase 2 |
| マッチング（探す・予約・決済） | 閲覧・予約・Stripe決済まで対応 | Phase 3 |
| Mouthfill Calculator | 移植 | Phase 3 |
| プッシュ通知 | 大会リマインダー・予約確認・練習リマインダー | Phase 2 |
| オフライン対応 | ログ記録のみ（電波なしでも書ける） | Phase 3 |

---

## 技術スタック

- **フレームワーク**：React Native（iOS・App Store配信）
- **バックエンド**：Supabase（Webと共通）
- **認証**：Supabase Auth（メール/パスワード・Google OAuth）
- **状態管理**：未定（React Context or Zustand）
- **デザイン**：Webのデザイントークン（カラーパレット）に準拠

### カラーパレット（Webと統一）

```
--ocean-deep:  #0b2d45
--ocean-mid:   #0e3d5c
--ocean-light: #1a5f82
--teal:        #2ec4b6
--teal-light:  #a8ece8
--foam:        #f0f9fb
--warm:        #f97316
--sand:        #fdf8f2
```

---

## App固有の強み（Webにはできないこと）

- **プッシュ通知**：大会リマインダー・予約確認・練習リマインダー（Phase 2以降）
- **ホーム画面常駐**：タイマーをワンタップで起動
- **オフライン動作**：電波のない水中施設・離島でもログ記録できる（Phase 2以降検討）

---

## 画面設計

```
タブバー構成
├── ホーム         — ダッシュボード（今月のログサマリー・大会カウントダウン）
├── ログ          — トレーニングログ一覧・新規登録・シェア
├── タイマー       — STAタイマー・カウントダウン・Mouthfill Calculator
├── 探す          — マッチング・インストラクター検索・予約・決済
├── 情報          — ランキング・大会情報・メディア記事
└── マイページ     — プロフィール・CRM（インストラクター向け）・設定
```

---

## Web との違い（UI・UXの最適化）

同じ機能でも、AppとWebでは**UIと動線を文脈に合わせて最適化**する。

| 機能 | Web | App |
|---|---|---|
| トレーニングログ | カレンダービュー・詳細編集 | すぐ記録できるフォーム・シェアボタン |
| CRM | テーブル・フィルタ・一括操作 | 予約確認・クライアントへの連絡が中心 |
| マッチング | 地図検索・詳細比較・フォーム入力 | 近くのインストラクターをサクッと探して予約 |
| ランキング | 種目・期間・国の複合フィルタ | よく見る種目をピン留めして即確認 |
| メディア記事 | SEO・回遊・じっくり読む | 通知から飛んで読む・シェアする |

---

## ロードマップ

| フェーズ | App の内容 |
|---|---|
| Phase 1 | タイマー・トレーニングログ・SNSシェア・Supabase連携 |
| Phase 2 | プッシュ通知・CRM（モバイル版）・ランキング・大会情報・メディア記事閲覧 |
| Phase 3 | マッチング・予約・Stripe決済・Mouthfill Calculator・オフライン対応 |

---

## Phase 1 実装状況（2026-06-21）

| タスク | 状態 |
|---|---|
| STAタイマー フル実装 | ✅ 完了・シミュレーター動作確認済み |
| タブバー（6タブ） | ❌ 未着手 |
| トレーニングログ画面 | ❌ 未着手 |
| Supabase 連携 | ✅ STAタイマー保存のみ実装済み |
| SNSシェア（画像生成） | ❌ 未着手 |

### STAタイマー：実装済み機能（2026-06-21）

- ✅ 3モード：ストップウォッチ / テーブル / プリセット
- ✅ AIDA アナウンス（EN/JA）— expo-speech
- ✅ タイムコール（経過時間の定期音声）
- ✅ サーフェスプロトコル カウントダウン（3秒）
- ✅ 第1収縮ボタン（FC）
- ✅ 進捗リング（pure RN実装 — react-native-svg非使用）
- ✅ セッション統計（ベスト・平均・セット数）
- ✅ Supabase ログ登録
- ✅ ハプティクス — expo-haptics
- ❌ SpO2 BLE モニター（未実装・機種決定後にBLE ServiceUUIDを調整して実機テストを行う予定）

### 技術メモ

- `react-native-svg` は RN 0.85 と C++ ABI 非互換のため削除。pure RN の半円クリップ手法でリングを実装。
- `expo-speech` / `expo-haptics` は try/catch で optional require（ビルドなしでも動く）。
- タイマーエンジンは 50ms `setInterval` 単発。stale closure 回避のため全状態を `useRef` で管理。

---

## 開発方針

- App Store 配信（iOS 優先、Android は Phase 2 以降に検討）
- Web のデザイン・UX と統一感を保つ（同じカラー・同じ用語）
- Web で先に機能を作り、App はその移植 or 軽量版という順序を守る
- Supabase を共通バックエンドにすることで重複実装をしない

---

## 開発環境セットアップ（2026-06-21 確立）

### 構成

| 項目 | 内容 |
|---|---|
| フレームワーク | Expo SDK 56 / React Native 0.85 |
| ビルド方式 | EAS Build（クラウドビルド）|
| 開発サーバー | Metro（`npx expo start --dev-client`）|
| アプリ配置 | `~/fj-app/`（スペースなしパス）|
| 元ソース | `~/Desktop/10.Freediving/30.Freediving Japan/freediving-japan/app/` |

### ハマったポイントと解決策

**① Expo Go では動かない**
- Expo SDK 56 は Expo Go 非対応。EAS Build（Development Build）が必要。

**② パスにスペースがあるとビルド失敗**
- `30.Freediving Japan` のスペースが CocoaPods・ExpoModulesJSI のビルドスクリプトを壊す
- 解決：`~/fj-app/` にコピーしてスペースなしパスで作業

**③ React Native 0.85 + Xcode 16 の C++ コンパイルエラー**
- `redefinition of 'MapBuffer'` 等の多数エラー
- ローカルビルドでは未解決 → EAS Build（クラウド）で回避

**④ EAS Build の `--simulator` フラグが存在しない**
- `eas.json` の development プロファイルに `"ios": { "simulator": true }` を追加して対応

### 毎回の起動手順

```bash
# 1. 開発サーバー起動
cd ~/fj-app
npx expo start --dev-client

# 2. シミュレーターでアプリを開く
# → ターミナルで i を押す、または
# → シミュレーターのアプリ画面でサーバーを選択してタップ
```

### パッケージ追加時の手順（2026-06-21 追加分）

STAタイマー実装で以下パッケージを `app/package.json` に追加した。
ネイティブモジュールを含むため **EAS ビルドが必要**。

| パッケージ | 用途 |
|---|---|
| `react-native-svg` | SVGリング進捗インジケーター |
| `expo-speech` | AIDAカウントダウン・Time Call 音声アナウンス |
| `expo-haptics` | フェーズ遷移時の触覚フィードバック |

```bash
# ~/fj-app/ にコピーしてビルド
cp -r ~/Desktop/10.Freediving/30.Freediving\ Japan/freediving-japan/app/ ~/fj-app/
cd ~/fj-app
npm install
eas build --profile development --platform ios
# ビルド完了後「Install and run on simulator?」→ Y
```

### 新しいビルドが必要なとき（ネイティブ変更時のみ）

```bash
cd ~/fj-app
eas build --profile development --platform ios
# ビルド完了後「Install and run on simulator?」→ Y
```

※ JS/TSファイルの変更はビルド不要。Metro のホットリロードで即反映。

### eas.json（現在の設定）

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    }
  }
}
```

---

*最終更新：2026-06-21*
