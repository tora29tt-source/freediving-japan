#!/bin/bash
# upload-to-r2.sh — HLS ファイルを Cloudflare R2 にアップロード
#
# 使い方:
#   chmod +x scripts/upload-to-r2.sh
#   ./scripts/upload-to-r2.sh <ローカルディレクトリ>
#
# 例:
#   ./scripts/upload-to-r2.sh mimi-nuki-nyumon/chapter-1
#
# 事前準備:
#   1. brew install awscli
#   2. ~/.aws/credentials に R2 の認証情報を設定（下記参照）
#
# ~/.aws/credentials に追記する内容:
# -----------------------------------------------
# [r2]
# aws_access_key_id     = <R2 Access Key ID>
# aws_secret_access_key = <R2 Secret Access Key>
# -----------------------------------------------
# ※ Cloudflare ダッシュボード → R2 → Manage R2 API Tokens から発行
#
# ~/.aws/config に追記する内容:
# -----------------------------------------------
# [profile r2]
# region = auto
# output = json
# -----------------------------------------------

set -e

LOCAL_DIR="$1"
BUCKET="learn-videos"

# Cloudflare アカウント ID（ダッシュボード右上から確認）
# 環境変数 CF_ACCOUNT_ID が設定されていれば優先
ACCOUNT_ID="${CF_ACCOUNT_ID:-}"

if [ -z "$LOCAL_DIR" ]; then
  echo "使い方: $0 <ローカルディレクトリ>"
  echo "例:     $0 mimi-nuki-nyumon/chapter-1"
  exit 1
fi

if [ ! -d "$LOCAL_DIR" ]; then
  echo "エラー: ディレクトリが見つかりません: $LOCAL_DIR"
  exit 1
fi

if [ -z "$ACCOUNT_ID" ]; then
  echo "Cloudflare アカウント ID を入力してください（ダッシュボード右上に表示）:"
  read -r ACCOUNT_ID
fi

ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "▶ R2 にアップロード中..."
echo "  ローカル:  ./$LOCAL_DIR/"
echo "  R2 パス:   s3://${BUCKET}/${LOCAL_DIR}/"
echo "  エンドポイント: $ENDPOINT"
echo ""

# .m3u8 は正しい Content-Type で
aws s3 sync "./$LOCAL_DIR" "s3://${BUCKET}/${LOCAL_DIR}" \
  --endpoint-url "$ENDPOINT" \
  --profile r2 \
  --exclude "*" \
  --include "*.m3u8" \
  --content-type "application/vnd.apple.mpegurl" \
  --no-progress

# .ts セグメント
aws s3 sync "./$LOCAL_DIR" "s3://${BUCKET}/${LOCAL_DIR}" \
  --endpoint-url "$ENDPOINT" \
  --profile r2 \
  --exclude "*" \
  --include "*.ts" \
  --content-type "video/mp2t" \
  --no-progress

echo ""
echo "✅ アップロード完了！"
echo ""
echo "admin の「video_path」に登録する値:"
echo "  ${LOCAL_DIR}/index.m3u8"
