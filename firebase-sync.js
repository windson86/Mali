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
  var pending = new Map(), feedbackPending = new Map(), navigationPending = new Map();
  var NAV_KEY = 'mali-uploaded-navigation-lessons-v1';
  var NAV_STORE = 'mali-navigation-lessons-v1';
  var navigationSent = new Set();
  try {
    var prevNav = JSON.parse(localStorage.getItem(NAV_KEY) || '[]');
    if (Array.isArray(prevNav)) navigationSent = new Set(prevNav.filter(v => typeof v === 'string'));
  } catch (_) {}
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
  function validPoint(p, n) {
    return Array.isArray(p) && p.length === 2 &&
      p.every(x => Number.isInteger(x) && x >= 0 && x < n);
  }
  function validWall(k, n) {
    if (typeof k !== 'string' || !/^(0|[1-9][0-9]?),([0-9]|1[0-5])$/.test(k)) return false;
    var p=k.split(',').map(Number);
    return p.length === 2 && p[0] < n && p[1] < n;
  }
  function prepareNavigation(route) {
    if(!route || typeof route !== 'object' ||
       !/^maze-[a-z0-9-]{12,60}$/.test(route.id||'') ||
       ![8,12,16].includes(route.size) ||
       typeof route.created_at !== 'string' || route.created_at.length < 11 ||
       route.created_at.length > 40 || !Array.isArray(route.actions) ||
       route.actions.length < 1 || route.actions.length > 800) return null;
    var n=route.size, goals=Array.isArray(route.goals)?route.goals:
      validPoint(route.goal,n)?[route.goal]:null;
    if(!validPoint(route.start,n) || !goals || goals.length<1 || goals.length>3 ||
       !goals.every(p=>validPoint(p,n)) || !Array.isArray(route.walls) ||
       route.walls.length > Math.ceil(n*n*0.35) ||
       !route.walls.every(k=>validWall(k,n)) ||
       !Number.isInteger(route.moves) || route.moves<1 || route.moves>800 ||
       !Number.isInteger(route.hits) || route.hits<0 || route.hits>800 ||
       !Number.isInteger(route.optimal_steps) || route.optimal_steps<1 ||
       !Number.isInteger(route.config_revision||0) || (route.config_revision||0)<0) return null;
    var actions=[];
    for(var i=0;i<route.actions.length;i++) {
      var a=route.actions[i];
      if(!a || !validPoint(a.from,n) || !validPoint(a.to,n) ||
         !['up','down','left','right'].includes(a.action) ||
         typeof a.blocked !== 'boolean' ||
         !Number.isInteger(a.target_index) || a.target_index<0 || a.target_index>=goals.length ||
         !validPoint(a.target,n) ||
         !Array.isArray(a.known_walls) || a.known_walls.length>Math.ceil(n*n*0.35) ||
         !a.known_walls.every(k=>validWall(k,n))) return null;
      actions.push({
        from:a.from.slice(),to:a.to.slice(),action:a.action,blocked:a.blocked,
        known_walls:a.known_walls.slice(),target_index:a.target_index,target:a.target.slice()
      });
    }
    var compact={
      size:n,start:route.start.slice(),goals:goals.map(p=>p.slice()),
      walls:route.walls.slice(),actions:actions,
      moves:route.moves,hits:route.hits,optimal_steps:route.optimal_steps,
      config_revision:route.config_revision||0,created_at:route.created_at
    };
    // Protect the user's free RTDB quota from huge, wandering routes.
    if (JSON.stringify(compact).length > 185000) return null;
    return compact;
  }
  function enqueueNavigationMany(items) {
    if (!configured || !Array.isArray(items)) return;
    items.forEach(function(route) {
      if (!navigationSent.has(route && route.id)) {
        var payload=prepareNavigation(route);
        if(payload) navigationPending.set(route.id,payload);
      }
    });
    void drain();
  }
  function navigationMessage() {
    if(!configured)return 'Rute su spremljene lokalno; Firebase nije konfiguriran.';
    if(navigationPending.size) return navigationPending.size+' ruta čeka Firebase ('+
      (error ? 'provjeri pravila ili vezu' : ready?'sinkronizacija u tijeku':'povezujem se')+').';
    return ready?'Uspješno poslane rute: '+navigationSent.size+' (ovaj preglednik).' :
      'Rute su lokalno spremljene; čekam Firebase vezu.';
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
    return pending.size || feedbackPending.size || navigationPending.size ? 'Zajednička baza: ' + (pending.size+feedbackPending.size+navigationPending.size) + ' zapisa čeka slanje.' :
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
    if (!ready || working || (!pending.size && !feedbackPending.size && !navigationPending.size) || sentThisPage >= 150) return;
    working = true;
    try {
      while ((navigationPending.size || pending.size || feedbackPending.size) && sentThisPage < 150) {
        var isNavigation=!!navigationPending.size;
        var isFeedback=!isNavigation && !pending.size;
        var lesson=isNavigation?navigationPending.values().next().value:
          (isFeedback?feedbackPending:pending).values().next().value;
        var routeId=isNavigation?navigationPending.keys().next().value:null;
        try {
          await sdk.set(sdk.ref(database,
            (isNavigation?'navigationLessons/v1/':isFeedback?'colorFeedback/v1/':'colorLessons/v1/') +
            userId + '/' + (isNavigation?routeId:lesson.id)),
            isNavigation ? {...lesson,server_at:sdk.serverTimestamp()} :
              isFeedback ? {rgb:lesson.rgb,source:lesson.source,created_at:lesson.created_at,
                server_at:sdk.serverTimestamp()} :
                {rgb:lesson.rgb,label:lesson.label,source:lesson.source,created_at:lesson.created_at,
                server_at:sdk.serverTimestamp()});
          if(isNavigation) {
            navigationSent.add(routeId);navigationPending.delete(routeId);
            try{localStorage.setItem(NAV_KEY,JSON.stringify(Array.from(navigationSent).slice(-200)));}catch(_){}
          }else if(isFeedback){
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
  window.MaliCloud = {
    enqueueMany:enqueueMany,
    enqueueFeedbackMany:enqueueFeedbackMany,
    enqueueNavigationMany:enqueueNavigationMany,
    navigationMessage:navigationMessage,
    message:message
  };
  // Queue pre-existing successful routes when this version is first opened.
  try{
    var oldRoutes=JSON.parse(localStorage.getItem(NAV_STORE)||'[]');
    if(Array.isArray(oldRoutes))enqueueNavigationMany(oldRoutes);
  }catch(_){} 
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
