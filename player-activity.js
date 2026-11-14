/* MALI: privacy-conscious approximation of actively used time.
   Foreground + real click/touch/keyboard event, maximum 2 minutes after last action.
   Stored privately per Firebase anonymous UID/day. No IP address or GPS.
   Client-side activity can be manipulated; do not treat as proof for payment. */
(function () {
  'use strict';
  const STORAGE = 'mali-active-time-pending-v1';
  const IDLE_MS = 2 * 60 * 1000;
  const HEARTBEAT_MS = 30 * 1000;
  const MAX_DAY_MS = 86400000;
  let uid = '', sdk = null, database = null;
  let pending = Object.create(null), lastMeasured = performance.now();
  let lastAction = 0, foreground = document.visibilityState === 'visible';
  let uploading = false;

  function hasNickname() {
    const nick = String(window.MaliTeachers?.nickname?.() || '');
    return /^[A-Za-z0-9_čćđšžČĆĐŠŽ-]{3,20}$/.test(nick);
  }
  function dayKey() { return new Date().toISOString().slice(0, 10); }
  function savePending() {
    if (!uid) return;
    try { localStorage.setItem(STORAGE, JSON.stringify({ uid, days: pending })); }
    catch (_) {}
  }
  function restorePending() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      if (stored.uid !== uid || !stored.days || typeof stored.days !== 'object') return;
      for (const [key, milliseconds] of Object.entries(stored.days)) {
        if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key) && Number.isFinite(milliseconds) &&
            milliseconds >= 0 && milliseconds <= MAX_DAY_MS) pending[key] = milliseconds;
      }
    } catch (_) {}
  }
  function measure() {
    const now = performance.now();
    // 'foreground' is the page visibility since the last measurement.
    // Visibility changes account for active time BEFORE the page was hidden.
    // Do not depend on document.hasFocus(): iOS Safari can report false
    // even while a player is interacting with a visible page.
    if (uid && foreground && lastAction && hasNickname()) {
      const from = Math.max(lastMeasured, lastAction);
      const until = Math.min(now, lastAction + IDLE_MS);
      if (until > from) {
        const day = dayKey();
        pending[day] = Math.min(MAX_DAY_MS, (pending[day] || 0) + (until - from));
        savePending();
      }
    }
    lastMeasured = now;
    foreground = document.visibilityState === 'visible';
  }
  function onInteraction(event) {
    if (!uid || !event.isTrusted || (event.type === 'keydown' && event.repeat)) return;
    measure();
    lastAction = performance.now();
  }
  async function upload() {
    if (uploading || !uid || !sdk || !database || !hasNickname()) return;
    uploading = true;
    try {
      // One bounded transaction per day per attempt; rate limit enforced
      // additionally by RTDB rules using server-controlled timestamps.
      for (const day of Object.keys(pending).sort()) {
        const seconds = Math.min(30, Math.floor((pending[day] || 0) / 1000));
        if (seconds < 1) continue;
        const path = 'playerActivity/v1/' + uid + '/days/' + day;
        const result = await sdk.runTransaction(sdk.ref(database, path), current => {
          const before = current && Number.isInteger(current.seconds) ? current.seconds : 0;
          if (before + seconds > 86400) return;
          return { seconds: before + seconds, updated_at: sdk.serverTimestamp() };
        }, { applyLocally: false });
        if (!result.committed) break;
        pending[day] = Math.max(0, pending[day] - seconds * 1000);
        if (pending[day] < 1) delete pending[day];
        savePending();
      }
    } catch (error) {
      // Without published Firebase rules, save locally and try again later.
      console.debug('Mali: active time is waiting for Firebase.', error);
    } finally {
      uploading = false;
    }
  }
  (async () => {
    try {
      const user = await window.MaliCloud?.whenReady?.();
      if (!user?.userId || !user?.sdk || !user?.database) return;
      uid = user.userId; sdk = user.sdk; database = user.database;
      restorePending();
      lastMeasured = performance.now();
      document.addEventListener('pointerdown', onInteraction, {passive: true, capture: true});
      document.addEventListener('keydown', onInteraction, {capture: true});
      document.addEventListener('visibilitychange', () => { measure(); if (document.hidden) void upload(); });
      window.addEventListener('blur', () => { measure(); void upload(); });
      window.addEventListener('focus', () => { measure(); });
      window.addEventListener('pagehide', () => { measure(); savePending(); void upload(); });
      window.addEventListener('online', () => { void upload(); });
      window.addEventListener('mali:nickname-changed', () => { measure(); void upload(); });
      window.setInterval(() => { measure(); void upload(); }, HEARTBEAT_MS);
      void upload();
    } catch (error) {
      console.debug('Mali: activity meter cannot start.', error);
    }
  })();
}());
