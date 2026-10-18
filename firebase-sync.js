/* MALI — optional Firebase Realtime Database lesson sync.
   Disabled until firebase-config.js contains a real public web configuration.
   Local lessons remain primary; cloud upload never affects learning/XP. */
(function () {
  'use strict';
  var cfg = window.MALI_FIREBASE_CONFIG;
  var KEY = 'mali-uploaded-color-lessons-v1';
  var uploaded = [];
  try { uploaded = JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch (_) { uploaded = []; }
  if (!Array.isArray(uploaded)) uploaded = [];
  var synced = new Set(uploaded.filter(function (x) { return typeof x === 'string'; }));
  var pending = new Map(), feedbackPending = new Map();
  var FB_STORE = 'mali-unlisted-color-feedback-v1', FB_SENT = 'mali-uploaded-unlisted-feedback-v1';
  var feedbackSent = new Set();
  try { const v=JSON.parse(localStorage.getItem(FB_SENT)||'[]');if(Array.isArray(v))feedbackSent=new Set(v); }
  catch (_) {}
  var database = null, userId = null, sdk = null;
  var working = false, ready = false, error = '';
  var sentThisPage = 0;
  var configured = !!(cfg && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId && cfg.databaseURL);
  function safeLesson(l) {
    return l && /^[a-z0-9-]{8,55}$/.test(l.id || '') &&
      Array.isArray(l.rgb) && l.rgb.length === 3 &&
      l.rgb.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= 255; }) &&
      typeof l.label === 'string' && l.label.length >= 2 && l.label.length <= 40 &&
      ['teaching','verification'].indexOf(l.source) !== -1 &&
      typeof l.created_at === 'string';
  }
  function safeFeedback(l) {
    return l && /^[a-z0-9-]{8,55}$/.test(l.id||'') &&
      Array.isArray(l.rgb) && l.rgb.length === 3 &&
      l.rgb.every(function(v){return Number.isInteger(v)&&v>=0&&v<=255;}) &&
      ['teaching','verification'].indexOf(l.source)!==-1 &&
      typeof l.created_at==='string' && l.created_at.length>10 && l.created_at.length<=40;
  }
  function enqueueFeedbackMany(items) {
    if(!configured || !Array.isArray(items))return;
    items.forEach(function(f){if(safeFeedback(f)&&!feedbackSent.has(f.id))feedbackPending.set(f.id,f);});
    void drain();
  }
  function message() {
    if (!configured) return 'Zajednička baza još nije povezana. Lekcije su sigurno spremljene na ovom uređaju.';
    if (error) return 'Lekcije su lokalno spremljene. Slanje čeka: ' + error;
    if (!ready) return 'Povezujem zajedničku bazu… Lekcije se zasad čuvaju lokalno.';
    return pending.size || feedbackPending.size ? 'Zajednička baza: ' + (pending.size+feedbackPending.size) + ' zapisa čeka slanje.' :
      'Zajednička baza povezana. Tvoje poslane lekcije spremljene su i na serveru.';
  }
  function enqueueMany(items) {
    if (!configured || !Array.isArray(items)) return;
    items.forEach(function (lesson) {
      if (safeLesson(lesson) && !synced.has(lesson.id)) pending.set(lesson.id, lesson);
    });
    void drain();
  }
  async function drain() {
    if (!ready || working || (!pending.size && !feedbackPending.size) || sentThisPage >= 150) return;
    working = true;
    try {
      while ((pending.size || feedbackPending.size) && sentThisPage < 150) {
        var isFeedback=!pending.size;
        var lesson = (isFeedback?feedbackPending:pending).values().next().value;
        try {
          await sdk.set(sdk.ref(database, (isFeedback?'colorFeedback/v1/':'colorLessons/v1/') + userId + '/' + lesson.id),
            isFeedback ? {rgb:lesson.rgb,source:lesson.source,created_at:lesson.created_at,
              server_at:sdk.serverTimestamp()} :
              {rgb:lesson.rgb,label:lesson.label,source:lesson.source,created_at:lesson.created_at,
              server_at:sdk.serverTimestamp()});
          if(isFeedback){
            feedbackSent.add(lesson.id);feedbackPending.delete(lesson.id);
            try{localStorage.setItem(FB_SENT,JSON.stringify(Array.from(feedbackSent).slice(-1000)));}catch(_){}
          }else{
            synced.add(lesson.id);pending.delete(lesson.id);
            try{localStorage.setItem(KEY,JSON.stringify(Array.from(synced).slice(-1800)));}catch(_){}
          }
          sentThisPage++;
          error = '';
        } catch (err) {
          error = 'povezivanje ili sigurnosna pravila';
          console.warn('Mali: cloud upload nije uspio, lekcija je ostala lokalno.', err);
          break;
        }
      }
    } finally { working = false; }
  }
  window.MaliCloud = { enqueueMany: enqueueMany, enqueueFeedbackMany: enqueueFeedbackMany, message: message };
  try {
    const already=JSON.parse(localStorage.getItem(FB_STORE)||'[]');
    if(Array.isArray(already))enqueueFeedbackMany(already);
  }catch(_){} 
  if (!configured) return;
  (async function () {
    try {
      // CDN modules load ONLY when the user explicitly connects a Firebase project.
      var base = 'https://www.gstatic.com/firebasejs/12.19.0/';
      var modules = await Promise.all([
        import(base + 'firebase-app.js'),
        import(base + 'firebase-auth.js'),
        import(base + 'firebase-database.js')
      ]);
      var app = modules[0].initializeApp(cfg);
      var auth = modules[1].getAuth(app);
      var signedIn = await modules[1].signInAnonymously(auth);
      userId = signedIn.user.uid;
      database = modules[2].getDatabase(app);
      sdk = modules[2];
      ready = true;
      await drain();
    } catch (err) {
      error = 'provjeri Firebase konfiguraciju i Anonymous Authentication';
      console.warn('Mali: zajednička baza nije dostupna. Lekcije ostaju lokalno.', err);
    }
  }());
}());
