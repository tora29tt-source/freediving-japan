# 予約・決済フロー設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

Stripe Checkout を使ったマーケットプレイス型の予約・決済フロー。  
フロントエンド（静的サイト）→ Vercel Serverless Function → Stripe → Webhook → Supabase の順で処理する。

| 項目 | 内容 |
|---|---|
| 決済プロバイダー | Stripe（サンドボックスモード） |
| ビジネスモデル | マーケットプレイス（プラットフォーム集金 → インストラクター送金） |
| 手数料分配 | プラットフォーム 30% / インストラクター 70% |
| 通貨 | JPY |
| 決済方式 | Stripe Checkout（カード決済） |

---

## 2. ファイル構成

```
/explore/listing.html          # リスティング詳細・予約フォーム（フロントエンド）
/booking/success.html          # 予約完了ページ
/api/create-checkout-session.js  # Stripe セッション作成（Vercel Serverless）
/api/stripe-webhook.js           # Stripe Webhook 処理（Vercel Serverless）
```

---

## 3. 予約フロー全体

```
ユーザーが explore/listing.html で日程・人数を選択
  ↓
「予約する」ボタン → POST /api/create-checkout-session
  ↓
[Serverless] 空き枠チェック → 仮予約作成（status: 'pending'）→ Stripe Checkout セッション作成
  ↓
Stripe 決済画面へリダイレクト
  ↓
  ├─ 決済成功 → success_url（booking/success.html?booking_id=...&session_id=...）
  └─ キャンセル → cancel_url（explore/listing.html?id=...）
        ↓（30分で期限切れ）
        checkout.session.expired Webhook → booking.status = 'cancelled'

決済成功後
  Stripe → checkout.session.completed Webhook
    ↓
  [Serverless] booking.status = 'paid' に更新 + booked_count をインクリメント
```

---

## 4. API 詳細

### POST /api/create-checkout-session

**リクエスト（JSON）：**

| フィールド | 型 | 必須 | 説明 |
|---|---|:---:|---|
| `slotId` | UUID | ✅ | 予約する空き枠 ID |
| `listingId` | UUID | | リスティング ID |
| `instructorId` | UUID | | インストラクター ID |
| `guestName` | string | ✅ | 予約者氏名 |
| `guestEmail` | string | ✅ | 予約者メール |
| `guestPhone` | string | | 予約者電話番号 |
| `participantCount` | number | ✅ | 参加人数 |
| `notes` | string | | 備考 |
| `rentalRequests` | string | | レンタル希望 |

**処理フロー：**

```
1. availability_slots と listings を JOIN して取得
2. 満席チェック（max_participants - booked_count >= participantCount）
3. 手数料計算
   totalAmount      = unitPrice × participantCount
   platformFee      = totalAmount × 0.30（切り捨て）
   instructorPayout = totalAmount - platformFee
4. bookings テーブルに status:'pending' でレコード作成
5. Stripe Checkout セッション作成（有効期限30分）
6. bookings に stripe_session_id を保存
7. セッション URL を返す → フロントがリダイレクト
```

**レスポンス：**

```json
{ "url": "https://checkout.stripe.com/..." }
```

**エラーレスポンス：**

| HTTP | 状況 |
|---|---|
| 400 | 必須パラメーター不足 |
| 404 | 空き枠・リスティングが見つからない |
| 409 | 満席 |
| 500 | 予期しないエラー |

---

### POST /api/stripe-webhook

**登録イベント：**

| イベント | 処理 |
|---|---|
| `checkout.session.completed` | `booking.status = 'paid'` + `booked_count` インクリメント |
| `checkout.session.expired` | `booking.status = 'cancelled'`（pending のみ） |

**署名検証：**

```js
// Raw body を使って署名検証（bodyParser 無効化必須）
event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
```

**`increment_booked_count` RPC：**

```sql
CREATE OR REPLACE FUNCTION increment_booked_count(p_slot_id UUID, p_count INT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE availability_slots
  SET booked_count = booked_count + p_count
  WHERE id = p_slot_id;
$$;
```

---

## 5. DB テーブル

### bookings

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `slot_id` | UUID | 空き枠 FK |
| `instructor_id` | UUID | インストラクター FK |
| `listing_id` | UUID | リスティング FK |
| `client_name` | text | 予約者氏名 |
| `client_email` | text | 予約者メール |
| `client_phone` | text | 予約者電話 |
| `notes` | text | 備考 |
| `rental_requests` | text | レンタル希望 |
| `participant_count` | int | 参加人数 |
| `unit_price` | int | 単価（円） |
| `total_amount` | int | 合計（円） |
| `platform_fee` | int | プラットフォーム手数料（円） |
| `instructor_payout` | int | インストラクター取り分（円） |
| `status` | text | `pending` / `paid` / `confirmed` / `cancelled` / `refunded` |
| `stripe_session_id` | text | Stripe Checkout セッション ID |
| `stripe_payment_intent_id` | text | Stripe Payment Intent ID |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### availability_slots

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | PK |
| `instructor_id` | UUID | インストラクター FK |
| `listing_id` | UUID | リスティング FK |
| `slot_date` | date | 日程 |
| `start_time` | time | 開始時刻 |
| `end_time` | time | 終了時刻 |
| `max_participants` | int | 定員 |
| `booked_count` | int | 予約済み人数 |
| `is_active` | boolean | 枠が有効か |

---

## 6. 予約ステータス遷移

```
pending（仮予約）
  ↓ 決済成功（Webhook）
paid（支払い完了）
  ↓ インストラクターが確定
confirmed（確定済み）

pending → cancelled（Stripe 期限切れ30分 or 手動キャンセル）
paid / confirmed → refunded（返金処理後）
```

---

## 7. Vercel 環境変数

| 変数名 | 説明 |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe 秘密鍵 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名シークレット（`whsec_xxx`） |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role キー（フロントに出さない） |
| `NEXT_PUBLIC_SITE_URL` | サイト URL（例：`https://freediving-japan.vercel.app`） |

---

## 8. 既知のバグ・改善点

| 重要度 | 内容 | 対応状況 |
|---|---|---|
| 高 | 満席超過：`pending` 予約が定員計算に含まれず同時予約で超過しうる | 未対応 |
| 高 | Webhook 二重処理：Stripe 再送で `booked_count` が二重加算される可能性 | 未対応 |
| 高 | Webhook DB エラー時に 200 を返してしまい Stripe 再送が起きない | 未対応 |
| 高 | 非アクティブ枠（`is_active=false`）も予約可能 | 未対応 |
| 低 | `cancel_url` に listing パラメーターがなくリスティング情報が消える | 未対応 |
| 低 | `client_email` 等が `innerHTML` にエスケープなし（XSS リスク） | 未対応 |

### 優先修正（冪等性チェック例）

```js
// stripe-webhook.js での冪等性チェック
const { data: existing } = await supabase
  .from('bookings')
  .select('status')
  .eq('id', bookingId)
  .single();

if (existing?.status === 'paid') break; // 既に処理済み → スキップ
```
