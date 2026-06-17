#!/bin/bash
cd "/Users/takuyaterajima/Desktop/10.Freediving/30.Freediving Japan/freediving-japan"
rm -f .git/index.lock .git/objects/maintenance.lock
git add PROJECT.md
git commit -m "docs: PROJECT.md に shops/reviews/explore 実装状況を反映"
git push origin main
echo "---"
echo "完了。このウィンドウを閉じてOKです。"
read -p "Enterキーで閉じる..."
