#!/bin/bash
set -e
cd "$(dirname "$0")"

# フォルダ作成
mkdir -p events rankings learn media tools

# --- git mv ---
git mv article-what-is-freediving.html articles/
git mv article.html old/article-root.html
git mv media-index.html media/index.html
git mv media-admin-mobile.html media/admin-mobile.html
git mv mouthfill-calculator.html tools/
git mv session-planner.html tools/
git mv sta-timer.html tools/
git mv training-log.html tools/
git mv competition-countdown.html events/
git mv 2026_competitions.html events/
git mv event-athlete.html events/
git mv event-staff.html events/
git mv AIDA_ranking.html rankings/
git mv instructor-welcome.html pro/
git mv freediving-learn.html learn/

# --- パス修正 ---
# tools/training-log.html: js/ → ../js/
sed -i 's|src="js/|src="../js/|g' tools/training-log.html

# tools/session-planner.html: mypage.html → ../mypage.html
sed -i 's|href="mypage.html"|href="../mypage.html"|g' tools/session-planner.html

# tools/sta-timer.html: training-log.html → training-log.html (同フォルダなのでそのまま)
# events/competition-countdown.html: index.html → ../index.html
sed -i 's|href="index.html"|href="../index.html"|g' events/competition-countdown.html
sed -i 's|href="index.html"|href="../index.html"|g' events/event-staff.html

# articles/article.html (既存): index.html → ../index.html
sed -i 's|href="index.html"|href="../index.html"|g' articles/article.html

# media/index.html: article.html → ../articles/article.html
sed -i 's|href="article.html"|href="../articles/article.html"|g' media/index.html

echo "✅ 完了"
