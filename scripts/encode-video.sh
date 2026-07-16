#!/bin/bash
# encode-video.sh — mp4 → HLS（720p / 480p）エンコードスクリプト
#
# 使い方:
#   chmod +x scripts/encode-video.sh
#   ./scripts/encode-video.sh <入力mp4> <出力ディレクトリ>
#
# 例:
#   ./scripts/encode-video.sh ~/Movies/chapter1-raw.mp4 mimi-nuki-nyumon/chapter-1
#
# 出力:
#   <出力ディレクトリ>/index.m3u8      ← マスタープレイリスト（hls.js に渡す URL）
#   <出力ディレクトリ>/stream_0.m3u8   ← 720p プレイリスト
#   <出力ディレクトリ>/stream_1.m3u8   ← 480p プレイリスト
#   <出力ディレクトリ>/seg*_0.ts       ← 720p セグメント
#   <出力ディレクトリ>/seg*_1.ts       ← 480p セグメント
#
# 事前準備:
#   brew install ffmpeg

set -e

INPUT="$1"
OUTPUT_DIR="$2"

if [ -z "$INPUT" ] || [ -z "$OUTPUT_DIR" ]; then
  echo "使い方: $0 <入力mp4> <出力ディレクトリ>"
  echo "例:     $0 ~/Movies/raw.mp4 mimi-nuki-nyumon/chapter-1"
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "エラー: ffmpeg が見つかりません。brew install ffmpeg でインストールしてください。"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "▶ エンコード開始: $INPUT → $OUTPUT_DIR/"
echo "  720p + 480p の2品質 HLS を生成します（6秒セグメント）"
echo ""

ffmpeg -y -i "$INPUT" \
  -filter_complex \
    "[0:v]split=2[v_raw720][v_raw480]; \
     [v_raw720]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720]; \
     [v_raw480]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480]" \
  \
  -map "[v720]" \
    -c:v libx264 -pix_fmt yuv420p -crf 22 -preset fast -profile:v high -level 4.1 \
    -x264-params "keyint=72:min-keyint=72:scenecut=0" \
  \
  -map "[v480]" \
    -c:v libx264 -pix_fmt yuv420p -crf 24 -preset fast -profile:v main -level 3.1 \
    -x264-params "keyint=72:min-keyint=72:scenecut=0" \
  \
  -map 0:a -map 0:a \
    -c:a aac -ar 44100 -b:a 128k \
  \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments+append_list \
  -hls_segment_type mpegts \
  -hls_segment_filename "${OUTPUT_DIR}/seg%04d_%v.ts" \
  -master_pl_name "index.m3u8" \
  -var_stream_map "v:0,a:0,name:720p v:1,a:1,name:480p" \
  "${OUTPUT_DIR}/stream_%v.m3u8"

echo ""
echo "✅ 完了！"
echo ""
echo "生成ファイル:"
ls -lh "$OUTPUT_DIR/"
echo ""
echo "次のステップ:"
echo "  ./scripts/upload-to-r2.sh $OUTPUT_DIR"
echo ""
echo "admin の「video_path」に登録する値:"
echo "  ${OUTPUT_DIR}/index.m3u8"
