/* MALI — Colors experiment v1. Labels come ONLY from users.
   This file contains no answer key and no pre-programmed color recognizer. */
(function () {
  'use strict';
  var STORAGE = 'mali-color-lessons-v1';
  var LABELS = ['crvena','plava','zelena','žuta'];
  function activeLabels(){return window.MaliConfig?window.MaliConfig.activeColors().map(c=>c.name.toLocaleLowerCase('hr')):LABELS;}
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  var MAX_LESSONS = 1800;
  var brain = null;
  var brainInfo = 'Mozak još nije istreniran.';
  var lessons = [];
  var sample = null;
  var recorded = false;
  var currentGuess = null;
  var currentMode = 'home';
  var context = null;
  var ui = function (id) { return document.getElementById(id); };

  try {
    var stored = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (Array.isArray(stored)) lessons = stored.filter(validLesson).slice(-MAX_LESSONS);
  } catch (err) { lessons = []; }
  if (window.MaliCloud) window.MaliCloud.enqueueMany(lessons);

  fetch('./brain/active.json', { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('No model'); return response.json(); })
    .then(function (data) {
      if (data && data.trained === true && data.model && Array.isArray(data.classes) &&
          data.model.w1 && data.model.w1.length === 3 && Array.isArray(data.model.b1) && Array.isArray(data.model.b2) && data.model.w2 && data.model.w2.length === data.model.b1.length && data.model.b2.length === data.classes.length && data.classes.length > 0) {
        brain = data;
        brainInfo = 'Mozak ' + String(data.version || '1') + ' — naučen iz ljudskih lekcija.';
      }
      if (currentMode === 'home' && context && !ui('overlay').hidden) showHome();
    })
    .catch(function () { brainInfo = 'Naučeni model zasad nije objavljen.'; });

  function validLesson(l) {
    return l && Array.isArray(l.rgb) && l.rgb.length === 3 &&
      l.rgb.every(function (x) { return Number.isInteger(x) && x >= 0 && x <= 255; }) &&
      typeof l.label === 'string' && l.label.length >= 2 && l.label.length <= 40;
  }
  function rgbCss(rgb) { return 'rgb(' + rgb.join(',') + ')'; }
  function randomRgb(){return window.MaliConfig?window.MaliConfig.randomRgb():[238,24,24];}
  function newSample() {
    sample = randomRgb();
    recorded = false;
    var ball = document.querySelector('#ball circle');
    if (ball) ball.setAttribute('fill', rgbCss(sample));
  }
  function labelButtons() {
    return '<div class="school-grid">' + activeLabels().map(function (label) {
      return '<button type="button" class="action" data-color-label="' + esc(label) + '">' + esc(label.charAt(0).toUpperCase() + label.slice(1)) + '</button>';
    }).join('') + '</div>';
  }
  function note() {
    return '<p class="muted">' + lessons.length + ' lekcija na ovom uređaju. Kada je Firebase dostupan, lekcije se šalju u zajedničku bazu.</p>';
  }
  function openModal(screen, title, body) {
    currentMode = screen;
    context.open('colors-' + screen, title, body);
  }
  function showHome() {
    openModal('home', 'Malijeva škola boja 🧠',
      '<p>Mali tek treba naučiti koje su boje loptice. Odgovore dobiva od ljudi — nema skrivenog popisa točnih odgovora.</p>' +
      '<div class="school-grid"><button class="action" data-school="teach">📖 Uči me</button>' +
      '<button class="action" data-school="test">🧠 Pokaži što znaš</button></div>' +
      '<p class="school-status">' + brainInfo + '</p>' + note() +
      '<p class="muted">' + (window.MaliCloud ? window.MaliCloud.message() : 'Lekcije su samo na ovom uređaju.') + '</p>' +
      '<button class="action school-export" data-school="export">⬇ Izvezi moje lekcije (.json)</button>');
  }
  function chooseMode(mode) {
    if (mode !== 'teach' && mode !== 'test') return;
    newSample();
    showSample(mode);
  }
  function predict(rgb) {
    if (!brain || !brain.model) return null;
    try {
      var m = brain.model;
      if (m.w1.length !== 3 || m.b2.length !== brain.classes.length) return null;
      var input = rgb.map(function (v) { return v / 127.5 - 1; });
      var hidden = m.b1.map(function (b, j) {
        return Math.tanh(b + input.reduce(function (sum, x, i) { return sum + x * m.w1[i][j]; }, 0));
      });
      var scores = m.b2.map(function (b, j) {
        return b + hidden.reduce(function (sum, x, i) { return sum + x * m.w2[i][j]; }, 0);
      });
      var choice = scores.indexOf(Math.max.apply(null, scores));
      return brain.classes[choice] || null;
    } catch (err) { return null; }
  }
  function showSample(mode, correcting) {
    currentMode = mode;
    currentGuess = mode === 'test' ? predict(sample) : null;
    var correction = !!correcting && !!currentGuess;
    var intro = mode === 'teach' ? 'Pogledaj lopticu i reci Malom koju boju vidiš.' :
      !currentGuess ? 'Još nemam objavljeni naučeni mozak. Možeš me naučiti koju boju vidiš?' :
      correction ? 'Hvala što me ispravljaš! Koja je prava boja loptice?' :
      '🐶 Mislim da je ovo <strong>' + currentGuess + '</strong>. Jesam li pogodio?';
    var controls = mode === 'test' && currentGuess && !correction
      ? '<div class="school-actions"><button class="action" type="button" data-school="agree">✓ Bravo!</button>' +
        '<button class="action" type="button" data-school="correct">✎ Nije, nego…</button></div>'
      : labelButtons();
    var hint = correction ? 'Odaberi pravu boju. Zabilježit ću tvoj ispravak.' :
      '„Ne znam” i „Druga loptica” preskaču bez spremanja lekcije.';
    openModal(mode, mode === 'teach' ? 'Uči me bojama 🎨' : 'Pokaži što znaš 🐶',
      '<p>' + intro + '</p><div class="ball-preview school-preview" style="background:' + rgbCss(sample) + '"></div>' +
      '<p class="muted">' + hint + '</p>' + controls +
      '<div class="school-actions"><button class="action" type="button" data-school="skip">↻ Druga loptica</button>' +
      ((mode === 'teach' || !currentGuess || correction) &&
        (!window.MaliConfig || window.MaliConfig.get().colors.allow_unlisted_feedback) ?
        '<button class="action" type="button" data-school="unlisted">✕ Nijedna od ponuđenih</button>' : '') +
      (!window.MaliConfig || window.MaliConfig.get().colors.allow_dont_know ?
        '<button class="action" type="button" data-school="skip">🤷 Ne znam</button>' : '') +
      (correction ? '<button class="action" type="button" data-school="back-to-guess">← Ipak natrag</button>' : '') +
      '<button class="action" type="button" data-school="home">← Natrag</button></div>' +
      '<p id="lessonStatus" class="muted">' + lessons.length + ' spremljenih lekcija na ovom uređaju.</p>');
  }
  function save(label) {
    if (recorded || !sample || activeLabels().indexOf(label) < 0) return;
    if (lessons.length >= MAX_LESSONS) {
      ui('lessonStatus').textContent = 'Memorija je puna. Najprije izvezi lekcije.';
      return;
    }
    var entry = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      rgb: sample.slice(), label: label, source: currentMode === 'test' && currentGuess ? 'verification' : 'teaching',
      created_at: new Date().toISOString()
    };
    lessons.push(entry);
    try { localStorage.setItem(STORAGE, JSON.stringify(lessons)); }
    catch (err) {
      lessons.pop();
      ui('lessonStatus').textContent = 'Nije moguće spremiti lekciju. Provjeri memoriju preglednika.';
      return;
    }
    recorded = true;
    var buttons = document.querySelectorAll('[data-color-label],[data-school="agree"],[data-school="correct"]');
    buttons.forEach(function (b) { b.disabled = true; });
    if (context) {
      context.s.lessons = (context.s.lessons || 0) + 1;
      context.s.xp = (context.s.xp || 0) + 1;
      context.persist();
      context.render();
      context.speak('Hvala! 🐾', 'Lekcija spremljena lokalno; Firebase sinkronizira kad je dostupan.');
    }
    ui('lessonStatus').textContent = 'Spremljeno: ' + label + '! Ukupno ' + lessons.length + ' lekcija. Stiže nova loptica…';
    // The same lesson remains safely in localStorage even when the database is offline.
    if (window.MaliCloud) window.MaliCloud.enqueueMany([entry]);
    var finishedSample = sample;
    var finishedMode = currentMode;
    window.setTimeout(function () {
      if (!ui('overlay').hidden && currentMode === finishedMode &&
          sample === finishedSample) chooseMode(finishedMode);
    }, 650);
  }
  function saveUnlisted() {
    if(recorded || !sample)return;
    const KEY='mali-unlisted-color-feedback-v1';
    let rows=[];
    try{const old=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(old))rows=old;}catch(_){}
    const entry={
      id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
      rgb:sample.slice(),source:currentMode==='test'?'verification':'teaching',
      created_at:new Date().toISOString()
    };
    rows.push(entry);rows=rows.slice(-300);
    try{localStorage.setItem(KEY,JSON.stringify(rows));}
    catch(err){if(ui('lessonStatus'))ui('lessonStatus').textContent='Ne mogu spremiti povratnu informaciju.';return;}
    if(window.MaliCloud)window.MaliCloud.enqueueFeedbackMany([entry]);
    // Not a teaching label and no XP. Never train the model on an unlisted RGB.
    chooseMode(currentMode);
  }
  function download() {
    if (!lessons.length) {
      ui('modalContent').insertAdjacentHTML('beforeend', '<p class="muted">Najprije nauči Malog barem jednu boju.</p>');
      return;
    }
    var payload = { format: 'mali-color-lessons-v1', exported_at: new Date().toISOString(), lessons: lessons };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mali-lekcije-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  window.MaliColors = {
    randomRgb: randomRgb,
    open: function (ctx) { context = ctx; if(window.MaliConfig)void window.MaliConfig.refresh(false);showHome(); },
    handleClick: function (event) {
      var labelButton = event.target.closest('[data-color-label]');
      if (labelButton) { save(labelButton.getAttribute('data-color-label')); return; }
      var control = event.target.closest('[data-school]');
      if (!control) return;
      var action = control.getAttribute('data-school');
      if (action === 'teach' || action === 'test') chooseMode(action);
      else if (action === 'agree' && currentMode === 'test' && currentGuess) save(currentGuess);
      else if (action === 'correct' && currentMode === 'test' && currentGuess && !recorded) showSample('test', true);
      else if (action === 'back-to-guess' && currentMode === 'test' && currentGuess) showSample('test', false);
      else if (action === 'unlisted') saveUnlisted();
      else if (action === 'skip') chooseMode(currentMode);
      else if (action === 'home') showHome();
      else if (action === 'export') download();
    }
  };
}());