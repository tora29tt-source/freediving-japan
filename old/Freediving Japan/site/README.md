# AIDA Japan ランキング — 静的サイト

公式AIDAデータから生成した日本記録・ランキング・選手写真を表示する静的サイトです。
サイトは `data/` 内のJSONを読み込むだけで、データ更新は週次スクリプトが行います。

## 構成

```
site/
├── index.html              # サイト本体（data/のJSONをfetchで読み込む）
├── fetch_all.py            # 週次データ取得スクリプト（AIDAから取得→data/に書き出し）
└── data/
    ├── jp_official_records.json   # 種目×男女の現在の日本記録（+写真URL）
    ├── rankings.json              # 年別×種目×男女のランキング + 総合(OVERALL)
    └── athlete_photos.json        # 選手名 → 顔写真URL
```

## ローカルで確認する

`index.html` は `fetch()` でJSONを読むため、ファイルを直接開くと
ブラウザのCORS制限で読み込めません。簡易サーバ経由で開いてください。

```bash
cd site
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

## 本番デプロイ

`site/` 配下をそのままWebサーバ（Nginx / Apache / S3静的ホスティング / Netlify 等）の
公開ディレクトリに置くだけです。サーバ側の処理は不要です。

## データの自動更新（週1回）

`fetch_all.py` がAIDA公式ランキングから最新データを取得し `data/*.json` を上書きします。
サーバ上にPython（`requests`）を用意して cron で回してください。

```bash
pip install requests

# 毎週月曜 06:00 に更新
0 6 * * 1  cd /path/to/site && /usr/bin/python3 fetch_all.py >> fetch.log 2>&1
```

取得内容:
- **日本記録**: 国=日本・年=全期間 で各種目の1位を抽出（2026年以降の更新も自動反映）
- **年別ランキング**: 年×種目×男女で全ページを巡回（既定取得範囲は `YEAR_FROM`〜今年）
- **写真**: 各選手のAIDAプロフィールページの顔写真URL（未登録/既定シルエットは除外）

### 設定（環境変数）

| 変数 | 既定 | 説明 |
|------|------|------|
| `OUTPUT_DIR` | `data` | JSONの出力先 |
| `YEAR_FROM` | `2015` | 年別ランキングの取得開始年（古い年も欲しければ下げる） |

## 注意点

- 取得はAIDAサイトのHTML構造に依存します。サイト改修時は `fetch_all.py` の
  パラメータ（種目IDなど）やパース部分の調整が必要になる場合があります。
- 顔写真がAIDA側に未登録の選手は、サイト上で自動的にイニシャルのアバター表示になります。
- 写真の取得元は各選手のAIDA公式プロフィールです。公開利用の可否は運用方針に合わせて確認してください。

## 種目の分類

- **プール種目**: STA / DYN / DYNB / DNF（距離・時間）
- **海（深度）種目**: CWT / CWTB / CNF / FIM（到達深度）
