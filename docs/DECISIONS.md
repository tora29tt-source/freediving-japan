---
tags: [dev, decisions-log]
---

# 決定ログ・実装経緯

DEV.mdの「現状スキーマ・仕様」を読むだけでは分からない、**なぜその設計になったか**の経緯を日付順（新しい順）に記録する。
DEV.mdの各セクションから該当箇所へのポインタが張られている。新しい仕様変更はここに追記し、DEV.mdには要約と本ファイルへのリンクのみを残す。

-----

## 2026-07-14：`explore/shops.html`のエリア軸を都道府県に統一（旧SVG地図を撤去）

**背景**：2026-07-10のエリア設計刷新で`explore/index.html`は都道府県チップに統一したが、`explore/shops.html`（ショップ・インストラクターディレクトリ）は`shops.prefecture`/`instructors.prefecture`列が全レコードNULLのためスコープ外とし、旧SVG地図（`js/area-map.js`）＋14種固定エリアチップのまま残していた（[2026-07-10のエントリ](#2026-07-10listingscategory-タクソノミー変更エリア設計刷新learn実装方針)参照）。今回、残っていた「都道府県フィールド化」を実施しスコープを解消した。

**対応**：
- `pro/index.html`：インストラクター/ショップの新規作成・編集フォーム（`cp-`/`csp-`/`p-`/`sp-`プレフィックスの4フォーム）に「拠点の都道府県」`<select>`を追加。`instructors.prefecture`/`shops.prefecture`（既存列・未使用のまま放置されていた）に保存する
- `explore/shops.html`：`js/area-map.js`依存を撤去し`js/location-data.js`を読み込み。エリアチップは`explore/index.html`の`renderPrefChips()`と同方式で都道府県ベースに動的生成（人気都道府県は0件でも表示、それ以外は該当者がいる都道府県のみ追加表示）。データ取得も`shops.areas`/`instructors.areas`（自由入力・季節ラベル付き配列）から`prefecture`列に切替
- 既存データのバックフィル：`areas`列の値（旧14タクソノミー由来の地名）から都道府県をベストエフォートで推定するSQLをチャットで提示・ユーザーがSupabase SQL Editorで実行（本ルールに従いファイル化せず）。マッチしない場合は`prefecture`はNULLのまま（プロフィール編集画面で手動設定可能）

**2026-07-14 バックフィルSQL本番実行・Chrome MCPで実機QA完了**：`shops.html`の都道府県チップ絞り込み（ショップ/インストラクター両タブ）・チップの動的件数表示・旧地図UIの完全撤去を確認。`pro/index.html`のプロフィール編集画面で「拠点の都道府県」欄にバックフィル結果（例：鹿児島市/奄美大島の活動エリア→「鹿児島県」）が正しく初期表示されることを確認。コンソールエラーなし。

-----

## 2026-07-14：STAタイマー（sta-timer.html）不具合3件の調査・修正

**背景**：ユーザー報告により3件の不具合を確認。(1)(2)は再現手順から原因を特定して修正、(3)は「録画が保存されない/消える」「1秒程度しか録れていない」という報告を受けてコードレビューで原因候補を特定し修正した。**いずれも実機（iPhone Safari）での動作確認は未実施**。次回実機使用時の検証が必要。

### (1) プリセット名保存時にスペースが入力できない

**原因**：`document.addEventListener('keydown', ...)`がページ全体でスペースキーを「スタート/ストップ」ショートカットとして横取りし`preventDefault()`していたため、プリセット名入力欄・メモ欄（`#saveNote`）にフォーカスがあってもスペース入力が無効化されていた。

**対策**：`keydown`ハンドラの先頭で`e.target`がinput/textarea/contentEditableの場合は即returnし、ショートカットを無効化。テキスト入力欄はこの2箇所のみと確認済み。

### (2) 1st Contraction（FC）記録が小さいカードしか反応しない

**原因**：「画面のどこをタップしてもFC記録」というロジック自体は既にあったが、画面の大部分を占めるメインリング（`#timerWrap`）だけが対象から除外され、Stop操作専用になっていた。結果としてユーザーは大きなリングではなく下部の小さい「1st Contraction」カードしか実用上押せなかった。

**対策**：リングタップ時、Hold中かつFC未記録なら先にFC記録（`onFC()`）を行い、記録済みなら従来通りStopとして扱うよう変更（`tryRecordFC()`関数を新設）。

### (3) 録画が保存されない／消える／1秒程度で途切れる（カメラ録画機能）

**原因（コードレビューによる仮説）**：`camRecorder`/`isRecording`という2つの状態変数を、録画停止のトリガー箇所（`_finalizeRecordingThen`・Surface後30秒の自動停止タイマー・`stopAllCameraActivity`）がそれぞれ個別に直接操作しており、更新に漏れがあった。特にSurface後30秒の自動停止タイマーは`camRecorder.stop(); isRecording=false;`のみを行い、`camRecorder`変数自体はnullにしていなかった。

`MediaRecorder.stop()`は仕様上、呼び出した瞬間に同期的に`state`を`'inactive'`にする（実際のチャンク確定・`onstop`発火は非同期）。そのため「stopは呼んだが後片付け中」の古い録画インスタンスが残っている状態で、直後に次のHoldが始まり`_finalizeRecordingThen()`が`camRecorder.state !== 'inactive'`を見て「待つ必要なし」と誤判定 → 古い録画がまだ終わっていないのに新しい`MediaRecorder`を同じcanvas・同じマイクトラックに対して起動してしまい、2つの録画インスタンスが一瞬重複する状態が発生し得た。Rest（休憩）時間がSurface後の固定録画時間（30秒）より短いフリーモードの通常運用では起きやすい条件だった。

**対策**：録画停止を`_stopRecording(discard)`関数に一元化し、`stop()`を呼ぶのと同時に`camRecorder`/`isRecording`を同期的にリセット、`onstop`完了をPromiseで待てるようにした。`_finalizeRecordingThen`・Surface後30秒タイマー・`stopAllCameraActivity`の3箇所すべてをこの関数経由に変更。

**検証状況**：構文チェック（Node.jsで埋め込みJSをパース）のみ実施し、エラーなし。**MediaRecorder/カメラの実際の録画時間・保存挙動は実機でのみ確認可能なため未検証**。次回、Rest 30秒未満の設定で連続ホールドし、各クリップが最後まで録れているか要確認。

**実装**：`tools/sta-timer.html`（コミット: "fix: STAタイマー プリセット名にスペース入力不可を修正、1stコントラクション記録をリングタップでも可能に" / "fix: STAタイマー録画のcamRecorder状態不整合を修正"）

-----

## 2026-07-12：多言語対応（i18n）方式

**背景**：`instructors`/`shops`テーブルには先行して`name_en`/`bio_en`カラム（本人手入力想定）が用意されていたが、実際の表示側（explore・profile.html等）では未接続のままだった。インバウンド需要への対応を早めたいという相談から、対応言語・翻訳方式を再検討し直した。

**対応言語**：英語・韓国語・中国語（日本のインバウンド需要は英語圏に限らないため、当初の英語のみ想定から拡大）

**方式はコンテンツの性質でハイブリッドに分ける**：
- **固定UI**（ナビ・ボタンラベル・フォーム項目名など運営が書く文章）＝ JSON翻訳ファイルによるi18n。量が少なく更新頻度も低いため人力で用意する
- **UGC**（インストラクター・ショップの自己紹介文、コース説明、ゲストレビューなど利用者が書く文章）＝ **Google Cloud Translation API**による自動翻訳。運営が翻訳を追いかけられる量ではないため機械翻訳一択
  - API選定理由：DeepLと比較検討した結果、日→英はDeepL・Google拮抗だが、日→韓・日→中はGoogleが優勢という評価が多く、3言語同時対応かつAPI一本化のシンプルさを優先してGoogle Cloud Translation APIに決定

**翻訳のタイミング＝保存時キャッシュ方式（閲覧時にAPIは呼ばない）**：
- インストラクター/ショップがプロフィール・コース説明を保存した瞬間、またはゲストがレビューを投稿した瞬間に、サーバーレス関数がGoogle Cloud Translation APIを呼び、英・韓・中3言語分をまとめて生成・保存する
- 閲覧者は保存済みの翻訳を読むだけで、閲覧のたびにAPIを叩かない（速度・コスト両面で有利）
- 翻訳が無い・失敗した場合は日本語原文にフォールバックする（空欄にはしない）

**保存先：専用`translations`テーブルに集約**（`_en`/`_ko`/`_zh`のようにカラムを言語×フィールドの数だけ増やす方式は対象が増えるたびに破綻するため不採用）

```
translations(
  table_name       TEXT,   -- 'instructors' / 'shops' / 'listings' / 'reviews' 等
  row_id           UUID,
  field_name       TEXT,   -- 'bio' / 'name' / 'description' 等
  lang             TEXT,   -- 'en' / 'ko' / 'zh'
  translated_text  TEXT,
  source_hash      TEXT,   -- 元の日本語テキストのハッシュ（再翻訳要否の判定用）
  is_manually_edited BOOLEAN DEFAULT FALSE,  -- 本人が手直しした場合はTRUE
  translated_at    TIMESTAMPTZ
)
```

- `source_hash`で元テキストが前回翻訳時から変わっていないか判定し、変わっていなければ再翻訳（＝API課金）をスキップする
- `is_manually_edited`がTRUEの行は、日本語側が更新されても自動上書きしない。既存の`name_en`/`bio_en`手入力欄はこの「手動修正」の入り口として位置づけを変えて流用する想定
- レビューは投稿後に編集されない前提のため、投稿時に1回翻訳して終わり（`source_hash`判定は不要）

**対象範囲**：探す系（探すページ・インストラクター/ショッププロフィール・コース詳細）から着手。メディア記事は後続フェーズ（翻訳運用コストが継続的に発生するため）

**進捗**：
- `sql/translations_20260712.sql`（2026-07-13本番適用済み）
- `api/translate-content.js`（実装済み。`{tableName, rowId, fields}`を受け取り`source_hash`で変更検知・`is_manually_edited`行はスキップしつつ英・韓・中を翻訳し`translations`テーブルにupsert）
- Google Cloud Translation APIの有効化・APIキー取得・Vercel環境変数`GOOGLE_TRANSLATE_API_KEY`設定（2026-07-13完了・Production/Preview/Development全環境）
- 未着手：`pro/index.html`からの呼び出し配線／表示側の言語切替UI／`name_en`等の位置づけ変更／レビュー投稿フローへの接続

-----

## 2026-07-12：マッチング手数料率変更・キャンセル返金ポリシー

**背景**：`bookings.status`は`pending → paid → confirmed → cancelled / refunded`の5状態を定義済みだが、実際に返金を実行する処理（Stripe返金〜DB更新）は未実装だった。キャンセル料率も統一ルールが無く、`listings.cancellation_policy`（自由入力欄）に事業者が個別に書くのみ。競合Dibee（同業態・Stripe決済代行モデル、手数料12%）の規約を調査し、これを参考にプラットフォーム共通のキャンセルポリシーと手数料率を再設計した。

**マッチング手数料率**：プラットフォーム30% / インストラクター70% → **プラットフォーム10% / インストラクター90%** に変更。ショップ名義予約も同一の分配式を適用。実装済み：`api/create-checkout-session.js`の`platformFee`計算を`0.30`→`0.10`に修正。

**キャンセル料率（3段階）**：
- 開催7日以上前：全額返金（100%）
- 開催3〜6日前：50%返金
- 開催2日前〜当日・無連絡：返金なし（0%）
- ショップ側都合の中止（天候不良・海況不良等）：無条件で全額返金

優先関係：各リスティングの`cancellation_policy`（自由入力）が常に優先。共通ルールは事業者が未設定の場合のみのフォールバック。
キャンセル料の帰属：返金時に手元に残る分は通常の予約と同じ10/90分配とする。

**実装済み**：
- `sql/bookings_cancellation_20260712.sql`（**2026-07-13本番適用済み**）：`bookings.refund_amount`/`cancelled_at`/`cancellation_reason`カラム追加、`decrement_booked_count()` RPC新設
- `api/cancel-booking.js`（新規）：認可はRLS `bookings_select_owner_or_admin`で判定→実データ取得・Stripe返金・DB更新はservice_roleで実行。返金%は暦日ベースの日数差で自動計算、`overrideAmount`で手動上書き可能
- `admin/index.html`：予約一覧に「キャンセル/返金」ボタン→理由選択・提案額の自動表示・手動編集・実行
- `legal/terms.html`・`legal/tokushoho.html`：3段階の共通ルール表を明記
- `explore/listing.html`：`cancellation_policy`が空の場合に共通ルールの3段階表示

**バグ：ログイン予約者が自分の予約履歴を見られない（2026-07-12発見・2026-07-13修正適用）**：`mypage.html`の`loadBookingHistory()`は`client_email`で検索する設計だが、RLS`bookings_select_owner_or_admin`は本人インストラクター／本人ショップ／管理者のみ許可で、予約者本人が閲覧できる条件が無かった。`OR client_email = auth.email()`を追加して修正（SQLはチャット提示のみ・CLAUDE.mdルールによりファイル化せず、2026-07-13にChrome経由でSupabaseへ直接適用・`pg_policies`で条件追加を確認済み）。

**ログイン予約者向けセルフキャンセル（2026-07-12実装）**：上記RLS修正でゲスト自身が`/api/cancel-booking`を叩けてしまう状態になったため、`api/cancel-booking.js`の認可を「①インストラクター本人②ショップ本人③管理者④予約者本人（`client_email`一致）」の4パターンをservice_roleで厳密判定する方式に変更。①〜③のみ`overrideAmount`での提案額上書きが可能、④（ゲスト本人）は自動計算値のみ適用。`mypage.html`の予約履歴に「キャンセル」ボタンを追加。

**2026-07-13 Stripeサンドボックス返金E2E実施**：adminパスは完了・成功（ゲスト予約作成→Stripeテスト決済→admin画面の「キャンセル/返金」実行→3段階ルール通りの全額返金自動計算→`status=refunded`・`refund_amount`・`decrement_booked_count`まで確認済み）。mypageパスはブロック——本番`mypage.html`に`bookingHistorySection`要素が存在せず、セルフキャンセルUIが本番未デプロイと判明（ローカルにはコードあり・push待ちの可能性）。RLS修正（`OR client_email = auth.email()`）は2026-07-13適用済み

-----

## 2026-07-11：1アカウントで個人インストラクター＋自分のショップを両方登録できるようにする

**背景**：`pro/index.html`の`boot()`は`instructors`・`shops`を`user_id`で両方チェックしていたが`else if`で排他扱いになっており、一度どちらかを作ると同一アカウントでもう一方を追加登録する導線が無かった。

**決定した運用モデル**：
- 個人アカウント：インストラクター登録が基本。自分の店を持つ場合は同じアカウントでショップも追加登録できる
- ショップアカウント：ショップ登録のみ。所属インストラクターは既存の承認済みインストラクターを検索して`instructor_shops`で紐付ける（変更なし）
- ショップ登録の承認フロー：`shops`にstatusカラムは追加しない。インストラクターが追加でショップ登録する場合も審査不要（即公開）

**実装済み**：
- `pro/index.html`の`boot()`のelse-ifを廃止。`myInstructor`/`myShop`を個別に保持し、両方あれば個人インストラクター優先をデフォルト表示（`myRole`）
- ヘッダーに`role-switch`（両方持つユーザーにのみ表示）を追加。クリックで`setActiveRole()`が`myRole`を差し替え
- `status-pending`/`status-rejected`のbody classは`applyStatusClasses()`に切り出し、instructorロール表示時のみ付与
- プロフィールタブに`add-role-banner`を追加。片方のプロフィールしか無いユーザーには追加登録の導線を表示

**未実施**：実機QA未着手（個人のみ／ショップのみ／両方持つテストアカウントの3パターンで切替・バナー表示・承認待ちロックの挙動を確認する必要あり）

-----

## 2026-07-10：`listings.category` タクソノミー変更・エリア設計刷新・/learn/実装方針

### categoryタクソノミー変更

**背景**：旧6値（フリーダイビング体験／スキンダイビング体験／スクール・資格取得／トレーニング・アスリート向け／ツアー・ガイド／その他）は「ダイビング種別」と「目的」が混在しており、ホームの3ピラー（シュノーケル／スキン／フリー）に対応するcategory値が存在しなかった。

- `category`を「ダイビング種別」専用の4値（**シュノーケリング／スキンダイビング／フリーダイビング／その他**）に統一。ダイビング種別軸(category) × 目的軸(intent) の組み合わせで表現
- `intent`の`dive`→`fundive`/`training`/`coaching`分割も同時に本番適用（`sql/intent_taxonomy_update_20260708.sql`）
- **DB移行**：`sql/category_taxonomy_update_20260710.sql`・`sql/intent_taxonomy_update_20260708.sql`ともに本番実行済み。categoryの既存リスティング再分類（推測移行）はChrome MCPで目視確認完了（本番listings全2件とも問題なし）
- 実装：`pro/index.html`・`admin/index.html`・`index.html`・`snorkeling.html`・`skindiving.html`・`freediving.html`

**ダイビング種別ごとの目的（intent）制限**：UI側（`pro/index.html`の`INTENT_BY_CATEGORY`マップ）で選択肢を制限。シュノーケリング＝try のみ／スキンダイビング＝try・learn・fundive／フリーダイビング＝全5種／その他＝全5種。DB側のCHECK制約は未追加（admin側の自由入力欄との整合のため）。

**ピラーページの人気タグチップ**：固定チップではなく、実際のリスティングに付いた自由タグを集計し使用頻度順に表示する形に変更（`loadPopularTags()`）。チップクリックは`explore/index.html?tag=<タグ名>`に遷移。

### エリア設計の刷新

**背景**：`listings`の`prefecture`（47都道府県＋海外）と`area`（14項目の固定タクソノミー、地図・チップ絞り込み用）の2フィールドがあり、出品者が`prefecture`だけ設定して`area`未選択のまま保存すると探すページの地図・チップから見えなくなる落とし穴があった（鹿児島県ショップの出品が地図上0件に見える不具合として発覚）。

- 「エリア」固定14タクソノミーを廃止し、**都道府県を検索・絞り込みの主軸**に変更
- 事業者は都道府県配下の具体的なスポット名を**自由入力**で登録（例：沖縄県の恩納村）
- 登録時・検索時の両方で同じサジェスト仕組みを使用（種データ14件＋実データをマージ）
- 探すページのSVG日本地図（`js/area-map.js`）は`explore/index.html`からは廃止（都道府県チップ＋自由入力サジェストに一本化）。`explore/shops.html`は今回スコープ外で旧方式のまま残存（`shops`/`instructors`の`prefecture`列が全レコードNULLのため、移行にはデータバックフィルが先に必要）
- 実装：`js/location-data.js`（新規）／`js/area-picker.js`（検索ドロップダウン刷新）／`explore/index.html`（SVG地図削除・都道府県チップ動的生成）／`pro/index.html`・`admin/index.html`（datalist付きテキスト入力）
- 2026-07-10 Chrome MCPで実機QA完了（都道府県チップ絞り込み・サジェスト・旧地図の完全撤去を確認）。admin側で`loadListings()`のselectに`prefecture`欠落バグを発見・修正（一覧の都道府県列が常に「—」だった）

### /learn/ 有料講座：詳細ページ・視聴の実装方針

**背景**：`learn/index.html`のコースカードは骨組みのみで購入ボタンは全て`disabled`。詳細ページが存在しなかった。

- 講座詳細ページは`courses`テーブル（`listings`と同様の設計思想）から動的生成
- 購入導線：`/api/create-course-checkout-session.js`（新規。既存の予約用checkout-sessionは流用せず新規作成）でStripe Checkout
- 購入記録：`course_purchases`テーブル（`bookings`と同パターン）
- 視聴：mypage新設タブから購入済み講座のみVimeo Player APIで再生（購入履歴で認証、動画自体は限定公開設定）
- 着手順：耳抜き入門・基礎完全講座から先行実装
- **2026-07-10 本番E2Eテスト完了**（Chrome MCP）：ダミーvimeo_id設定→購入ボタン有効化→Stripeテストカード決済→webhook更新→購入完了表示→mypage反映→watch.htmlでの本人確認・動画再生・他チャプターロックまで一通り成功。テスト後は本番データをクリーンな状態に復元済み
- **未着手**：実際の動画アップロード・vimeo_id登録（これが入って初めて購入ボタンが実際に有効化される）

-----

## 2026-07-08：サイト動線整備・検索UI刷新（SVG地図、後に一部廃止）

**サイト動線整備**：`sitemap.xml`/`robots.txt`/`404.html`新設。行き止まりページに戻る導線追加、死にリンク修正、`tools/session-planner.html`削除。**孤立ページ方針**：`events/event-athlete.html`（大会主催者が選手ごとに発行する個別URL専用、`event-staff.html`から`copyAthleteLink()`で生成）／`learn/freediving-learn.html`（Takuya向け内製コンテンツ管理画面、公開ページではない）／`pro/instructor-welcome.html`（扱い保留）はいずれも公開ナビ掲載不要と判断。

**検索UI刷新・SVG地図検索**：`explore/index.html`の検索バー「タイプ」select削除（intentタブに一本化）、都道府県selectを廃止しフリーテキスト検索に統合、条件・価格帯は「こだわり条件」折りたたみに集約。Google Maps依存を全廃し`js/area-map.js`（自前SVG日本地図）を新設、explore・shops.html双方に導入。**2026-07-10のエリア設計刷新でexplore/index.htmlからは廃止**（`shops.html`のみ残存、上記「エリア設計の刷新」参照）。2026-07-10 Chrome MCPで実機確認完了。

-----

## 2026-07-04〜07-11：ショップ／インストラクター 出品モデル

**背景**：以前はlistings/bookings等がinstructor_id必須で、必ず個人インストラクター単位の商品という前提だった。実態はショップが担当者未定のまま商品を出すこともあり、インストラクターは複数ショップに同時に所属する（例：夏はVolcano Cup、冬は流氷フリーダイビング）。

- **ショップは単体で商品を出品できる**（`listings.shop_id`）。担当インストラクター未定でもショップ名義で完結してよい
- **インストラクターは複数ショップに同時所属できる**：`instructor_shops`（N:M中間テーブル）で管理
- `listings`/`availability_slots`/`bookings`/`inquiries`/`reviews`は`instructor_id`をnullable化し`shop_id`を追加。`CHECK (instructor_id IS NOT NULL OR shop_id IS NOT NULL)`でどちらか必須を担保
- 実装（DB）：`sql/shop_direct_listings_20260704.sql`（本番適用済み）。実装（UI）：`pro/index.html`・`admin/index.html`・`explore/index.html`・`explore/listing.html`・`api/create-checkout-session.js`

**2026-07-05追記**：`pro/index.html`の`applyShopOwnerFilter()`が当初`instructor_shops`（在籍インストラクター）のIDも管理対象に含めており、在籍インストラクターの個人商品・予約までショップ管理画面に出てしまう不具合を修正。`instructor_shops`は「プロフィール表示用のロースター」であり管理権限を拡張するものではないと方針明確化。同日、ショップのカバー画像表示位置調整機能を追加（`shops.cover_position`、2026-07-06本番適用済み）。

**2026-07-11追記**：instructor向けプロフィールページにバナー表示枠があるのに`instructors`側に登録UIが無かった不具合を修正。`shops`と同方式で`instructors.cover_url`/`cover_position`を追加（`sql/instructors_cover_20260711.sql`本番適用済み・実機確認済み）。

**2026-07-11 フルE2Eテスト（Chrome MCP・Stripeサンドボックス）で発見・修正した不具合**：
- 🔴**ブロッカー**：ショップ名義（instructor_id IS NULL）の予約が`create-checkout-session`で500エラー。真因は`sync_client_from_booking()`トリガーが`clients.instructor_id NOT NULL`前提のままだったこと。`NEW.instructor_id IS NULL`ならclients同期をスキップするよう修正済み（要Supabase本番再適用）
- 🔴**セキュリティ**：anonキーでbookingsが全件SELECT可能と報告→本番にStudio経由の重複ポリシーが残っている可能性。要本番pg_policies確認・再適用
- ⚠️`create-checkout-session.js`：クライアント指定のinstructorIdをそのまま保存していた→slot由来の値のみ信頼するよう修正
- ⚠️`booking/success.html`：ショップ名義予約でも「インストラクターから連絡」固定表示だった→担当名＋呼称出し分けに修正
- ⚠️`explore/listing.html`：owner指定なしの`?listing=`だと「見つかりませんでした」→listingsからownerを引いてリダイレクトするフォールバック追加
- **2026-07-12解決**：ショップ名義予約もインストラクターと同一の分配式を採用（別設計は不要と決着）。手数料率変更もこのタイミングで実施（上記参照）

-----

## 2026-07-05：shop_type廃止／プロフィール-商品ページ分離／記事著者紹介文DBカラム化

**`shops.shop_type`廃止**：`shops.shop_type`（individual/school/operator）はどこの検索・フィルタ・バッジ表示にも使われていなかった。`pro/index.html`のショップ作成・編集フォームから選択欄を削除。DB側カラム・CHECK制約は既存データ保護のため未変更（今後どのコードからも参照されない想定）。

**ショップ/インストラクタープロフィールページと商品ページの分離**：`explore/listing.html`が「プロフィール表示」と「商品詳細＋予約」の2役を1ファイルで兼務し、コース未選択でも内部的に1件目を仮のアクティブコースとして扱っていたため混乱が生じていた。新規ファイル`explore/profile.html`（プロフィール専用）を追加、`listing.html`は商品詳細専用に縮小し`listing=`が無ければ`profile.html`にフォールバック。2026-07-07 Chrome MCPで一連の遷移を確認済み。

**記事の著者紹介文をDBカラム化**：著者紹介文が`admin/index.html`と`media/article.html`双方のJS内にハードコードされ、特定個人名を含む文言が編集不可のまま埋め込まれていた。`admin/index.html`の記事エディタに「著者紹介文（任意）」欄を追加。`articles.author_bio`カラム（2026-07-06本番適用済み）。既存記事の`author_bio`は未設定のためデフォルト文表示のまま。

-----

## 2026-07-03：論理削除（ソフトデリート）方針

**ユーザー操作による「削除」はデータを物理削除せず`deleted_at`を立てて非表示化する。** `sql/soft_delete_20260703.sql`で導入済み。

- **対象テーブル**：`events`/`articles`/`listings`/`instructors`/`event_staff`/`event_shift_roles`/`athlete_entries`/`availability_slots`
- **非表示の仕組み**：各テーブルに`RESTRICTIVE`な SELECTポリシー`<table>_hide_deleted`（`USING (deleted_at IS NULL)`）を付与
- **コード側**：削除は`.delete()`ではなく`.update({ deleted_at: new Date().toISOString() })`を使う
- **連鎖**：親を消したら子も連鎖ソフト削除（instructor→listings・slots、listing→slots）
- **ユニーク制約**：`articles.slug`/`events.aida_id`は部分ユニークインデックス（`WHERE deleted_at IS NULL`）に置換済み
- **物理削除のまま残すもの**：内部の「全消し→入れ直し」系と`user_roles`（権限剥奪）
- **復元UI**：未実装（当面はSupabaseから直接`deleted_at`をNULLに戻す）

**バグ：管理者がソフトデリートできない（2026-07-07発見・修正済み）**：`<table>_hide_deleted`ポリシーが更新後の行（deleted_atセット済み）を弾いていたため、管理者の書き込みそのものが失敗していた。対象8テーブル全ポリシーに`OR is_site_admin()`を追加して解消。

**副作用バグ：admin一覧に削除済み行が残り続ける（2026-07-07発見・修正済み）**：上記修正で管理者のSELECTがRLSで絞り込まれなくなったため、admin/index.htmlの一覧クエリ側で明示的に`.is('deleted_at', null)`を追加（該当6箇所）。**要フォローアップ**：`events`/`event_staff`/`event_shift_roles`/`athlete_entries`を読む他画面（mypage.html等）も同じ問題を抱えている可能性あり。

-----

## 2026-06-26／2026-06-28：既知のバグ・セキュリティ課題（コードベース全体レビュー）→ 全件対応済み

Bugbot（ブランチ差分）：指摘なし。手動レビュー：予約・RLS・決済まわりに11件 → 全件2026-06-28対応済み。

| # | 内容 | 対応内容 |
|---|------|----------|
| 1 | 予約データがログインユーザー全員に読める | `sql/rls_fix_20260628.sql` 実行済み |
| 2 | 予約の更新もログインユーザー全員に許可 | `sql/rls_fix_20260628.sql` 実行済み |
| 3 | 予約完了ページが未ログインだと失敗 | `api/booking-result.js` 追加・API経由に変更・E2Eテスト済み |
| 4 | 空き枠の書き込み権限が広すぎる | `sql/rls_fix_20260628.sql` 実行済み |
| 5 | 同時予約で満席超過 | `pending`の`participant_count`合計を残席計算に含める |
| 6 | Webhookの二重処理 | 冪等性チェック（`status === 'paid'`ならスキップ）実装済み |
| 7 | Webhookの DBエラーを無視 | `updateErr`/`rpcErr`時に500を返す実装済み |
| 8 | 非アクティブ枠も予約可能 | `is_active`チェック追加、falseなら409を返す |
| 9 | 存在しない確認メール表示 | 「インストラクターからご連絡をお送りします」に文言修正 |
| 10 | Stripeキャンセル URLでリスティング情報が消える | `cancel_url`に`&listing=<listing_id>`を付与 |
| 11 | XSSの余地 | `escHtml()`で対応済み |

問題なし・軽微：`guest_*`vs`client_*`カラム名（`sql/rename_guest_to_client.sql`適用済み）／`admin/admin-mobile.html`認証なし（localStorageのみで本番DBに触れないため実害なし、Phase 2本番化時に要対応）

-----

## 2026-07-04：セキュリティ監査 → 全件対応済み

| # | 内容 | 対応内容 |
|---|------|----------|
| S1 | bookings匿名INSERTが無制限 | ポリシー削除、予約作成は新設RPC `create_pending_booking()`（service_role限定）経由に一本化 |
| S2 | 記事本文のサニタイズが実質無効 | DOMPurify導入 |
| S3 | articles INSERTが認証済みなら誰でも公開可能 | 承認フロー準拠のポリシーに置換。調査中にStudio上の重複ポリシーも発見・削除（UPDATE経由で公開記事の改ざんも可能な状態だった） |
| S4 | `esc()`が属性用エスケープ非対応 | `"`` `'`` も含む`esc()`を追加・適用 |
| S5 | `href`にURLスキーム検証なし | `safeUrl()`追加、http/https以外を拒否 |
| S6 | 予約確定のTOCTOU競合 | `create_pending_booking()` RPCで行ロック・原子化 |
| S7 | SECURITY DEFINER関数のsearch_path未固定 | `is_site_admin()`/`increment_booked_count()`に`SET search_path = public`追加 |
| S8 | `event_results` UPDATEにWITH CHECKなし | `WITH CHECK (auth.uid() = judge_id)`追加 |
| S9 | `listingId`未検証 | API側で`slot.listing_id`との一致を検証 |
| S10 | CORSワイルドカード | トークン照合方式のため実害なしと判断（対応不要） |
| 追加 | `event_safety_assignments`等の書き込み系が未ログインでも可能 | 対象ロールを`authenticated`に限定 |

SQL：`sql/security_fix_20260704.sql`（本番実行済み・Chrome MCPで動作確認済み）
