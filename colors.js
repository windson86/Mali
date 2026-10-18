/* MALI — Colors experiment v1. Labels come ONLY from users.
   This file contains no answer key and no pre-programmed color recognizer. */
(function () {
  'use strict';
  var STORAGE = 'mali-color-lessons-v1';
  var LABELS = ['crvena', 'plava', 'zelena', 'žuta'];
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
          LABELS.every(function (label, i) { return data.classes[i] === label; })) {
        brain = data;
        brainInfo = 'Mozak ' + String(data.version || '1') + ' — naučen iz ljudskih lekcija.';
      }
      if (currentMode === 'home' && context && !ui('overlay').hidden) showHome();
    })
    .catch(function () { brainInfo = 'Naučeni model zasad nije objavljen.'; });

  function validLesson(l) {
    return l && Array.isArray(l.rgb) && l.rgb.length === 3 &&
      l.rgb.every(function (x) { return Number.isInteger(x) && x >= 0 && x <= 255; }) &&
      LABELS.indexOf(l.label) >= 0;
  }
  function rgbCss(rgb) { return 'rgb(' + rgb.join(',') + ')'; }
  function randomRgb() {
    /* Sample four visually clear hue families equally often.
       These are generated teaching examples, NOT the model's answer key. */
    var families = [
      { center: 0, spread: 8 },
      { center: 60, spread: 6, yellow: true },
      { center: 127, spread: 12 },
      { center: 222, spread: 12 }
    ];
    var chosen = families[Math.floor(Math.random() * families.length)];
    var hue = (chosen.center + (Math.random() * 2 - 1) * chosen.spread + 360) % 360;
    var sat = 0.78 + Math.random() * 0.17;
    var light = chosen.yellow ? 0.52 + Math.random() * 0.09 : 0.45 + Math.random() * 0.13;
    var a = sat * Math.min(light, 1 - light);
    function channel(n) {
      var k = (n + hue / 30) % 12;
      return Math.round(255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return [channel(0), channel(8), channel(4)];
  }
  function newSample() {
    sample = randomRgb();
    recorded = false;
    var ball = document.querySelector('#ball circle');
    if (ball) ball.setAttribute('fill', rgbCss(sample));
  }
  function labelButtons() {
    return '<div class="school-grid">' + LABELS.map(function (label) {
      return '<button type="button" class="action" data-color-label="' + label + '">' + label.charAt(0).toUpperCase() + label.slice(1) + '</button>';
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
      if (m.w1.length !== 3 || m.b2.length !== 4) return null;
      var input = rgb.map(function (v) { return v / 127.5 - 1; });
      var hidden = m.b1.map(function (b, j) {
        return Math.tanh(b + input.reduce(function (sum, x, i) { return sum + x * m.w1[i][j]; }, 0));
      });
      var scores = m.b2.map(function (b, j) {
        return b + hidden.reduce(function (sum, x, i) { return sum + x * m.w2[i][j]; }, 0);
      });
      var choice = scores.indexOf(Math.max.apply(null, scores));
      return LABELS[choice] || null;
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
      '<button class="action" type="button" data-school="skip">🤷 Ne znam</button>' +
      (correction ? '<button class="action" type="button" data-school="back-to-guess">← Ipak natrag</button>' : '') +
      '<button class="action" type="button" data-school="home">← Natrag</button></div>' +
      '<p id="lessonStatus" class="muted">' + lessons.length + ' spremljenih lekcija na ovom uređaju.</p>');
  }
  function save(label) {
    if (recorded || !sample || LABELS.indexOf(label) < 0) return;
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
    open: function (ctx) { context = ctx; showHome(); },
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
      else if (action === 'skip') chooseMode(currentMode);
      else if (action === 'home') showHome();
      else if (action === 'export') download();
    }
  };
}());