# トレーニングログ設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

フリーダイバーのトレーニングセッションとダイブデータを記録・管理・共有する機能。  
グラフ表示・URLシェア・複数ダイブ一括記録に対応。

---

## 2. ファイル構成

```
/tools/training-log.html   # メイン画面（ログ記録・履歴・グラフ）
```

**依存ライブラリ（CDN）：**
- `@supabase/supabase-js@2`
- `Chart.js 4.4.1`
- `chartjs-plugin-datalabels 2.2.0`

---

## 3. 画面構成（タブ）

| タブ | 内容 |
|---|---|
| ログ記録 | 新規セッション入力フォーム |
| 履歴 | 過去のセッション一覧・グラフ |
| 詳細 | 選択したセッションのダイブ一覧 |

---

## 4. データモデル

### training_sessions

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | ユーザー FK |
| `date` | date | セッション日 |
| `env` | text | `sea` / `pool` / `dry` |
| `location` | text | 場所 |
| `notes` | text | メモ |
| `rhr` | int | 安静時心拍数 |
| `is_public` | boolean | URLシェア公開フラグ |
| `share_token` | text | 公開共有用トークン（UUID） |
| `created_at` | timestamptz | |

### training_dives

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | UUID | セッション FK |
| `dive_number` | int | ダイブ番号 |
| `discipline` | text | CWT / FIM / STA / DNF 等 |
| `target_depth` | numeric | 目標深度（m） |
| `actual_depth` | numeric | 実際の深度（m） |
| `dive_time` | int | 潜水時間（秒） |
| `surface_interval` | int | インターバル（秒） |
| `result` | text | `ok` / `bo` / `lmc` / `dq` |
| `notes` | text | メモ |
| `waypoints` | jsonb | ダイブプロファイル（配列） |

---

## 5. 処理フロー

### セッション保存

```
ユーザーがフォーム入力 → 「保存」クリック
  └─ initAuth() でセッション確認
       ├─ 未ログイン → auth.html へリダイレクト
       └─ ログイン済み
            ↓
          training_sessions に INSERT（share_token は gen_random_uuid()）
            ↓
          ダイブデータ（複数）を training_dives に INSERT
            ↓
          保存完了トースト表示
```

### セッション読み込み

```
loadSessionsFromDB()
  └─ training_sessions を SELECT（ログインユーザーの直近90日）
       ├─ JOIN training_dives（ネストクエリ）
       └─ UI に反映（カレンダー + リスト + グラフ）
```

### URLシェア

```
share_token が付与されたセッションは公開 URL でアクセス可能
  URL: /tools/training-log.html?share={share_token}
  → RLS: is_public=true のセッションは未ログインでも SELECT 可
```

---

## 6. 認証ガード

```js
async function initAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    // URLシェアの場合は ?share= パラメーターで公開セッションを表示
    const shareToken = new URLSearchParams(location.search).get('share');
    if (shareToken) { loadPublicSession(shareToken); return; }
    window.location.replace('../auth.html');
    return;
  }
  currentUser = session.user;
  loadSessionsFromDB();
}
```

---

## 7. RLS ポリシー

```sql
-- training_sessions
-- SELECT: 本人 or is_public=true
CREATE POLICY "ts_select" ON training_sessions FOR SELECT USING (
  user_id = auth.uid() OR is_public = true
);
-- INSERT/UPDATE/DELETE: 本人のみ
CREATE POLICY "ts_write" ON training_sessions FOR ALL USING (user_id = auth.uid());

-- training_dives
-- SELECT: 本人 or 公開セッション紐づき
CREATE POLICY "td_select" ON training_dives FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM training_sessions s
    WHERE s.id = session_id
    AND (s.user_id = auth.uid() OR s.is_public = true)
  )
);
```

---

## 8. グラフ機能

- **Chart.js** でダイブプロファイル（深度 vs 時間）を描画
- `chartjs-plugin-datalabels` で深度ラベルを表示
- セッション選択時にミニチャート・詳細チャートを更新

---

## 9. 既知の制限

| 項目 | 内容 |
|---|---|
| 動作確認 | Supabase 接続は実装済みだが動作確認要 |
| オフライン対応 | 未実装（PWA 化予定）|
| エクスポート | CSV/PDF エクスポート未実装 |
