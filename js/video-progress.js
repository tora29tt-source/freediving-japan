/**
 * js/video-progress.js — 動画視聴進捗の保存・復元
 * 依存: supabase-config.js (_sb, currentSession, currentCourse)
 */

const VideoProgress = (function () {
  let _saveTimer = null;
  const SAVE_INTERVAL = 10; // 10秒ごとに保存

  // 進捗を upsert（throttle: 同一チャプターで10秒に1回）
  async function save(chapterId, positionSeconds) {
    if (!window.currentSession || !window.currentCourse) return;
    try {
      await _sb.from('course_progress').upsert({
        user_id:          window.currentSession.user.id,
        course_id:        window.currentCourse.id,
        chapter_id:       chapterId,
        position_seconds: Math.floor(positionSeconds),
        completed:        false,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id,chapter_id' });
    } catch (e) {
      console.warn('progress save error:', e);
    }
  }

  // 完了フラグ（残り5秒以内になったら）
  async function markCompleted(chapterId) {
    if (!window.currentSession || !window.currentCourse) return;
    try {
      await _sb.from('course_progress').upsert({
        user_id:   window.currentSession.user.id,
        course_id: window.currentCourse.id,
        chapter_id: chapterId,
        position_seconds: 0,
        completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,chapter_id' });
    } catch (e) {}
  }

  // 保存済み進捗を取得（秒数を返す。なければ0）
  async function restore(chapterId) {
    if (!window.currentSession || !window.currentCourse) return 0;
    try {
      const { data } = await _sb
        .from('course_progress')
        .select('position_seconds, completed')
        .eq('user_id', window.currentSession.user.id)
        .eq('chapter_id', chapterId)
        .maybeSingle();
      if (!data || data.completed) return 0;
      return data.position_seconds || 0;
    } catch (e) {
      return 0;
    }
  }

  // コース全体の進捗を取得（chapter_id → {position_seconds, completed} のマップ）
  async function restoreAll(courseId) {
    if (!window.currentSession) return {};
    try {
      const { data } = await _sb
        .from('course_progress')
        .select('chapter_id, position_seconds, completed')
        .eq('user_id', window.currentSession.user.id)
        .eq('course_id', courseId);
      const map = {};
      (data || []).forEach(function (r) { map[r.chapter_id] = r; });
      return map;
    } catch (e) {
      return {};
    }
  }

  // video要素にイベントをバインド
  function attach(videoEl, chapterId) {
    if (!videoEl || !chapterId) return;
    if (_saveTimer) clearInterval(_saveTimer);

    // 定期保存
    _saveTimer = setInterval(function () {
      if (!videoEl.paused && videoEl.currentTime > 0) {
        save(chapterId, videoEl.currentTime);
      }
    }, SAVE_INTERVAL * 1000);

    // 終了近づいたら完了フラグ
    videoEl.addEventListener('timeupdate', function () {
      if (videoEl.duration && (videoEl.duration - videoEl.currentTime) < 5) {
        markCompleted(chapterId);
      }
    });

    // ページ離脱時に保存
    window.addEventListener('beforeunload', function () {
      if (videoEl.currentTime > 0) save(chapterId, videoEl.currentTime);
    }, { once: false });
  }

  function detach() {
    if (_saveTimer) { clearInterval(_saveTimer); _saveTimer = null; }
  }

  return { save, restore, restoreAll, attach, detach, markCompleted };
})();
