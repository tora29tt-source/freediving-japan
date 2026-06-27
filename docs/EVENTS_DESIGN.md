# 大会・イベント機能設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

フリーダイビング大会の情報管理・選手登録・スタートリスト・リザルト表示を行う機能。  
選手向け閲覧ページと大会スタッフ向け管理ページの2系統で構成。

---

## 2. ファイル構成

```
/events/event-athlete.html        # 選手・観覧者向け（大会情報・AP登録・スタートリスト・リザルト）
/events/event-staff.html          # スタッフ向け管理（選手管理・スタートリスト編集・リザルト入力）
/events/2026_competitions.html    # 大会一覧カレンダー
/events/competition-countdown.html # カウントダウンタイマー（スタンドアロン・Supabase不要）
```

---

## 3. アクセス制御

| ページ | 未ログイン | ログイン済み | 大会スタッフ | 管理者 |
|---|:---:|:---:|:---:|:---:|
| `event-athlete.html` | ✅ 閲覧（URLシェア公開） | ✅ AP登録可 | ✅ | ✅ |
| `event-staff.html` | readonly | `event_staff` ロール依存 | ✅ ロール別 | ✅ 全権 |

### event-staff.html のロール別機能

| 機能 | organizer | staff | readonly |
|---|:---:|:---:|:---:|
| 大会情報編集 | ✅ | ❌ | ❌ |
| 選手追加・削除 | ✅ | ✅ | ❌ |
| スタートリスト編集 | ✅ | ✅ | ❌ |
| リザルト入力 | ✅ | ✅ | ❌ |
| 閲覧（全タブ）| ✅ | ✅ | ✅ |

---

## 4. DB テーブル

### events

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `name` | text | 大会名 |
| `date` | date | 開催日（開始） |
| `date_end` | date | 終了日（複数日の場合） |
| `location` | text | 場所 |
| `aida_id` | text | AIDA イベント ID（オプション） |
| `disciplines` | jsonb | 実施種目リスト |
| `is_published` | boolean | 公開フラグ |
| `created_by` | UUID | 作成者（ユーザー FK） |
| `created_at` | timestamptz | |

### event_entries（AP登録）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | 大会 FK |
| `user_id` | UUID | 選手 FK |
| `name` | text | 選手名 |
| `category` | text | カテゴリ（男性・女性等） |
| `registered_at` | timestamptz | |

### event_staff

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | 大会 FK |
| `user_id` | UUID | スタッフ FK |
| `role` | text | `organizer` / `staff` / `readonly` |

---

## 5. 処理フロー

### 選手の AP 登録

```
event-athlete.html にアクセス（?id={event_id}）
  └─ events テーブルから大会情報を取得
       └─ ログイン済みユーザーが「AP登録」クリック
            └─ event_entries に INSERT
                 └─ スタートリストに即反映
```

### AIDA 初期データ取得

```
mypage.html の「大会を作成」モーダル
  └─ AIDA イベント URL または ID を入力
       └─ fetchAidaEvent() → AIDA API から大会情報を取得
            └─ フォームに自動入力 → 確認後 events に INSERT
```

### マルチデイナビゲーション

```
event-staff.html
  └─ date / date_end を比較して Day 数を計算
       └─ Day 別タブを動的生成
            └─ 各 Day のスタートリスト・リザルトを切り替え表示
```

---

## 6. mypage.html からの大会管理

```js
// ログインユーザーが作成した大会一覧を取得
const { data: myEvents } = await _sb
  .from('events')
  .select('id, name, date, date_end, location, is_published')
  .eq('created_by', session.user.id)
  .order('date', { ascending: false })
  .limit(5);
```

---

## 7. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| AIDA 連携 | スクレイピング依存（公式 API 公開待ち） |
| 決済連携 | 参加費決済未実装 |
| 通知機能 | AP 登録完了メール未実装 |
| リザルト集計 | 順位自動計算未実装 |
