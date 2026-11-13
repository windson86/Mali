/* MALI private country statistics. Anonymous ID and nickname are already in Firebase.
   Country is an approximate IP-derived value from Netlify; no full IP is stored. */
(function () {
  'use strict';
  const KEY = 'mali-country-sync-v1';
  const NICK_KEY = 'mali-teacher-nickname-v1';
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  let working = false;

  function nickname() {
    const candidate = String(window.MaliTeachers?.nickname?.() || localStorage.getItem(NICK_KEY) || '').trim();
    return /^[A-Za-z0-9_čćđšžČĆĐŠŽ-]{3,20}$/.test(candidate) ? candidate : '';
  }
  function lastSync() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  async function sync() {
    if (working || !nickname() || !window.MaliCloud?.whenReady) return;
    working = true;
    try {
      const user = await window.MaliCloud.whenReady();
      if (!user?.userId || !user?.database || !user?.sdk) return;
      const nick = nickname();
      if (!nick) return;
      const previous = lastSync();
      if (previous.uid === user.userId && previous.nickname === nick &&
          Date.now() - previous.at < SIX_HOURS) return;

      const response = await fetch('/.netlify/functions/player-country', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) return;
      const { country } = await response.json();
      if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return;

      await user.sdk.set(user.sdk.ref(user.database, 'playerCountries/v1/' + user.userId), {
        nickname: nick, country, updated_at: user.sdk.serverTimestamp()
      });
      try {
        localStorage.setItem(KEY, JSON.stringify({
          uid: user.userId, nickname: nick, at: Date.now()
        }));
      } catch (_) {}
    } catch (error) {
      // Optional analytics must never affect gameplay.
      console.debug('Mali: country statistics unavailable.', error);
    } finally {
      working = false;
    }
  }
  window.addEventListener('mali:nickname-changed', () => { void sync(); });
  window.setInterval(() => { void sync(); }, 15 * 60 * 1000);
  void sync();
}());
