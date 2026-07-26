/* ===== 왜냐면 과학실 — core: util / save / input / audio ===== */
(function (W) {
'use strict';

/* ---------- util ---------- */
var U = {
  clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  approach: function (v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return target;
  },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randi: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  /* Fisher-Yates on a COPY. Quiz options and specimen queues are authored with the
     answer first for readability, so anything that shuffles must never write back
     into the source array — the next attempt has to start from the same order. */
  shuffled: function (arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  },
  aabb: function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  $: function (s) { return document.querySelector(s); },
  $$: function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); },
  // deterministic pseudo-random (stable decoration across frames)
  hash: function (x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
};

/* ---------- save ---------- */
/* Own storage keys, NOT the microbe game's. Both games can be served from the same
   origin, and their stage ids and card ids do not overlap — sharing a key meant a
   child with old 슈퍼 마이크로 progress saw "이어서 탐험" here and got resumed into
   균류 숲, because that stage is still registered for backwards compatibility. */
var KEY_PROG = 'wenyam_science_1_progress';
var KEY_SET = 'wenyam_science_1_settings';

function defProgress() {
  return {
    stagesDone: [],      // stage ids completed
    cores: [],           // world core ids
    cards: [],           // observation card ids
    orbs: 0,
    score: 0,
    endingDone: false,
    checkpoint: null,    // {stage, index}
    lastStage: null,
    badges: []
  };
}
function defSettings() {
  /* `character` is a setting, not progress: it survives Save.reset() so a child who
     restarts the book keeps the friend they chose, and 이어서 탐험 never has to ask
     again. An unknown id is repaired by the character screen on the way in. */
  return { music: 0.35, sfx: 0.60, musicOn: true, sfxOn: true, character: 'yeminhye' };
}

var Save = {
  progress: defProgress(),
  settings: defSettings(),
  load: function () {
    // Always start from defaults: previously, loading with empty storage left
    // whatever was already in memory, so a cleared save could still look "has run".
    this.progress = defProgress();
    this.settings = defSettings();
    try {
      var p = JSON.parse(localStorage.getItem(KEY_PROG) || 'null');
      if (p && typeof p === 'object') {
        var d = defProgress();
        for (var k in d) if (!(k in p)) p[k] = d[k];
        // sanity: arrays must be arrays
        ['stagesDone', 'cores', 'cards', 'badges'].forEach(function (k) {
          if (!Array.isArray(p[k])) p[k] = [];
        });
        this.progress = p;
      }
    } catch (e) { this.progress = defProgress(); }
    try {
      var s = JSON.parse(localStorage.getItem(KEY_SET) || 'null');
      if (s && typeof s === 'object') {
        var ds = defSettings();
        for (var k2 in ds) if (!(k2 in s)) s[k2] = ds[k2];
        this.settings = s;
      }
    } catch (e2) { this.settings = defSettings(); }
    return this;
  },
  saveProgress: function () {
    try { localStorage.setItem(KEY_PROG, JSON.stringify(this.progress)); } catch (e) {}
  },
  saveSettings: function () {
    try { localStorage.setItem(KEY_SET, JSON.stringify(this.settings)); } catch (e) {}
  },
  reset: function () { this.progress = defProgress(); this.saveProgress(); },
  hasRun: function () {
    var p = this.progress;
    return !!(p.lastStage || p.stagesDone.length || p.checkpoint);
  },
  add: function (list, id) {
    if (this.progress[list].indexOf(id) < 0) { this.progress[list].push(id); return true; }
    return false;
  },
  has: function (list, id) { return this.progress[list].indexOf(id) >= 0; }
};

/* ---------- input ---------- */
var Input = {
  held: {},          // action -> bool
  pressed: {},       // action -> consumed-once
  _map: {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', Space: 'jump', KeyZ: 'jump', KeyW: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
    Enter: 'confirm', NumpadEnter: 'confirm',
    Escape: 'pause', KeyP: 'pause'
  },
  anyKeyThisFrame: false,
  init: function () {
    var self = this;
    W.addEventListener('keydown', function (e) {
      var a = self._map[e.code];
      if (!a) return;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(e.code) >= 0) e.preventDefault();
      if (!self.held[a]) self.pressed[a] = true;
      self.held[a] = true;
    });
    W.addEventListener('keyup', function (e) {
      var a = self._map[e.code];
      if (!a) return;
      self.held[a] = false;
    });
    W.addEventListener('blur', function () { self.held = {}; });

    // ----- touch: multi-touch capable, move + jump simultaneously -----
    function bind(el, action) {
      if (!el) return;
      var down = function (e) {
        e.preventDefault();
        if (!self.held[action]) self.pressed[action] = true;
        self.held[action] = true;
        el.classList.add('down');
        if (el.setPointerCapture && e.pointerId != null) {
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
        }
      };
      var up = function (e) {
        e.preventDefault();
        self.held[action] = false;
        el.classList.remove('down');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    bind(U.$('#t-left'), 'left');
    bind(U.$('#t-right'), 'right');
    bind(U.$('#t-jump'), 'jump');
    bind(U.$('#t-act'), 'down');
    return this;
  },
  // call at end of each frame
  flush: function () { this.pressed = {}; },
  clear: function () { this.held = {}; this.pressed = {}; U.$$('.tbtn').forEach(function (b) { b.classList.remove('down'); }); },
  down: function (a) { return !!this.held[a]; },
  hit: function (a) { if (this.pressed[a]) { this.pressed[a] = false; return true; } return false; }
};

/* ---------- audio ---------- */
var Audio_ = {
  ctx: null,
  masterSfx: null,
  ready: false,
  cur: null,        // current music id
  tracks: {},       // id -> HTMLAudioElement
  _amb: null,
  init: function () {
    if (this.ready) return this;
    try {
      var AC = W.AudioContext || W.webkitAudioContext;
      this.ctx = new AC();
      this.masterSfx = this.ctx.createGain();
      this.masterSfx.gain.value = Save.settings.sfxOn ? Save.settings.sfx : 0;
      this.masterSfx.connect(this.ctx.destination);
      this.ready = true;
    } catch (e) { this.ready = false; }
    return this;
  },
  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  addTrack: function (id, el) { this.tracks[id] = el; el.loop = true; el.volume = 0; },
  applySettings: function () {
    if (this.masterSfx) this.masterSfx.gain.value = Save.settings.sfxOn ? Save.settings.sfx : 0;
    var v = Save.settings.musicOn ? Save.settings.music : 0;
    for (var id in this.tracks) this.tracks[id].volume = (id === this.cur) ? v : 0;
    if (!Save.settings.musicOn) this.stopMusic(true);
    else if (this.cur) this.music(this.cur);
  },
  // play track id; never double-plays, cross-fades others out
  music: function (id) {
    if (!Save.settings.musicOn) { this.cur = id; return; }
    var target = Save.settings.music;
    for (var k in this.tracks) {
      var el = this.tracks[k];
      if (k === id) {
        if (el.paused) { el.currentTime = el.currentTime || 0; var pr = el.play(); if (pr && pr.catch) pr.catch(function () {}); }
        this._fade(el, target, 400);
      } else if (!el.paused) {
        this._fadeStop(el, 300);
      }
    }
    this.cur = id;
  },
  stopMusic: function (immediate) {
    for (var k in this.tracks) {
      var el = this.tracks[k];
      if (immediate) { el.pause(); el.volume = 0; }
      else if (!el.paused) this._fadeStop(el, 250);
    }
    if (immediate) this.cur = null;
  },
  _fade: function (el, to, ms) {
    if (el._fadeT) clearInterval(el._fadeT);
    var from = el.volume, t0 = performance.now();
    el._fadeT = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      el.volume = U.clamp(from + (to - from) * k, 0, 1);
      if (k >= 1) { clearInterval(el._fadeT); el._fadeT = null; }
    }, 25);
  },
  _fadeStop: function (el, ms) {
    var self = this;
    if (el._fadeT) clearInterval(el._fadeT);
    var from = el.volume, t0 = performance.now();
    el._fadeT = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      el.volume = from * (1 - k);
      if (k >= 1) { clearInterval(el._fadeT); el._fadeT = null; el.pause(); }
    }, 25);
  },
  duck: function (on) {
    var el = this.tracks[this.cur];
    if (!el || !Save.settings.musicOn) return;
    this._fade(el, on ? Save.settings.music * 0.35 : Save.settings.music, 250);
  },

  /* ----- synthesized SFX (no external files) ----- */
  _env: function (type, f0, f1, dur, gain, dest) {
    if (!this.ready || !Save.settings.sfxOn) return null;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.masterSfx);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  },
  _noise: function (dur, gain, freq, q) {
    if (!this.ready || !Save.settings.sfxOn) return;
    var c = this.ctx, t = c.currentTime;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    var g = c.createGain(); g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.masterSfx);
    src.start(t);
  },
  _seq: function (notes, type, gain, step) {
    if (!this.ready || !Save.settings.sfxOn) return;
    var c = this.ctx, t0 = c.currentTime;
    var self = this;
    notes.forEach(function (f, i) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.value = f;
      var t = t0 + i * step;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + step * 0.95);
      o.connect(g); g.connect(self.masterSfx);
      o.start(t); o.stop(t + step);
    });
  },

  sfx: function (name) {
    if (!this.ready || !Save.settings.sfxOn) return;
    this.resume();
    switch (name) {
      case 'jump':    this._env('square', 330, 700, 0.13, 0.22); break;
      case 'land':    this._noise(0.06, 0.14, 420, 1.2); break;
      case 'orb':     this._seq([988, 1319], 'triangle', 0.20, 0.055); break;
      case 'orb_big': this._seq([784, 988, 1319, 1568], 'triangle', 0.20, 0.05); break;
      case 'bump':    this._env('square', 180, 90, 0.09, 0.20); this._noise(0.05, 0.10, 300, 1); break;
      case 'break':   this._noise(0.20, 0.22, 900, 0.7); this._env('square', 260, 60, 0.16, 0.12); break;
      case 'stomp':   this._env('square', 520, 130, 0.10, 0.22); this._noise(0.07, 0.12, 700, 1); break;
      case 'bounce':  this._env('sine', 420, 900, 0.14, 0.22); break;
      case 'hurt':    this._env('sawtooth', 400, 90, 0.32, 0.22); break;
      case 'die':     this._seq([523, 392, 330, 196], 'square', 0.2, 0.13); break;
      case 'pipe':    this._env('sine', 700, 120, 0.36, 0.20); break;
      case 'checkpoint': this._seq([659, 880, 1175], 'triangle', 0.22, 0.09); break;
      case 'door':    this._seq([392, 523, 659], 'sine', 0.20, 0.10); break;
      case 'mission': this._seq([523, 659, 784, 1047], 'triangle', 0.22, 0.085); break;
      case 'fail':    this._seq([330, 262], 'square', 0.16, 0.11); break;
      case 'select':  this._env('square', 880, 880, 0.05, 0.12); break;
      case 'clear':   this._seq([523, 659, 784, 1047, 784, 1047, 1319], 'triangle', 0.22, 0.13); break;
      case 'final':   this._seq([392, 523, 659, 784, 1047, 1319, 1568, 2093], 'triangle', 0.22, 0.16); break;
      case 'core':    this._seq([440, 554, 659, 880], 'sine', 0.22, 0.1); break;
      case 'grow':    this._env('sine', 200, 800, 0.5, 0.16); break;
      case 'splash':  this._noise(0.22, 0.14, 700, 0.6); break;
    }
  },

  /* ----- light ambience layer per world (Web Audio) ----- */
  ambience: function (kind) {
    this.stopAmb();
    if (!this.ready || !Save.settings.musicOn) return;
    var c = this.ctx;
    var g = c.createGain(); g.gain.value = 0; g.connect(c.destination);
    var nodes = [];
    if (kind === 'fungi') {           // soft airy drone + occasional drips
      var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 110;
      var lfo = c.createOscillator(); lfo.frequency.value = 0.12;
      var lg = c.createGain(); lg.gain.value = 6;
      lfo.connect(lg); lg.connect(o.frequency);
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      o.connect(f); f.connect(g); o.start(); lfo.start();
      nodes.push(o, lfo);
    } else if (kind === 'protist') {  // underwater rumble
      var n = c.createBufferSource();
      var len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      n.buffer = b; n.loop = true;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190;
      n.connect(lp); lp.connect(g); n.start();
      nodes.push(n);
    } else if (kind === 'bacteria') { // faint data hum
      var o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 74;
      var f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 260;
      o2.connect(f2); f2.connect(g); o2.start();
      nodes.push(o2);
    } else if (kind === 'core') {     // tense shimmer
      var o3 = c.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 55;
      var o4 = c.createOscillator(); o4.type = 'sine'; o4.frequency.value = 82.5;
      var f3 = c.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = 400;
      o3.connect(f3); o4.connect(f3); f3.connect(g); o3.start(); o4.start();
      nodes.push(o3, o4);
    } else return;
    g.gain.linearRampToValueAtTime(0.05 * (Save.settings.music / 0.35), c.currentTime + 2);
    this._amb = { gain: g, nodes: nodes };
  },
  stopAmb: function () {
    if (!this._amb) return;
    var a = this._amb; this._amb = null;
    try {
      a.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
      setTimeout(function () {
        a.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
        try { a.gain.disconnect(); } catch (e) {}
      }, 500);
    } catch (e) {}
  }
};

/* ---------- analytics (GA4) ----------
   Completely optional. If gtag is missing, blocked by an ad blocker, offline, or
   running from file://, every call here is a no-op. Nothing in the game awaits it,
   and it is never part of asset loading. Only fixed game strings and numbers are
   sent — never anything that could identify a student. */
var sentAnalyticsEvents = {};

function trackGAEvent(eventName, parameters) {
  if (typeof W.gtag !== 'function') return;
  try {
    W.gtag('event', eventName, parameters || {});
  } catch (error) {
    console.warn('[GA4 event skipped]', eventName, error);
  }
}

/* fires at most once per key for this page session — guards against a state
   transition being evaluated on several consecutive frames */
function trackOnce(key, eventName, parameters) {
  if (sentAnalyticsEvents[key]) return;
  sentAnalyticsEvents[key] = 1;
  trackGAEvent(eventName, parameters);
}

var GA = {
  event: trackGAEvent,
  once: trackOnce,
  reset: function (prefix) {           // allow re-entry events on a genuine restart
    if (!prefix) { sentAnalyticsEvents = {}; return; }
    Object.keys(sentAnalyticsEvents).forEach(function (k) {
      if (k.indexOf(prefix) === 0) delete sentAnalyticsEvents[k];
    });
  },
  sent: function (k) { return !!sentAnalyticsEvents[k]; },
  // fixed, non-identifying identifiers
  LEVEL: { s1: 'fungi_forest', s2: 'protist_pond', s3: 'bacteria_data_city',
           s4: 'balance_core', ending: 'biotechnology_finale',
           w1: 'old_lab_room', w2: 'school_backyard', w3: 'chat_maze',
           w4: 'truth_room' },
  LEVEL_NUM: { s1: 1, s2: 2, s3: 3, s4: 4, w1: 1, w2: 2, w3: 3, w4: 4 },
  WORLD: { s1: 'fungi', s2: 'protist', s3: 'bacteria', s4: 'balance',
           w1: 'labroom', w2: 'backyard', w3: 'chatspace', w4: 'truthroom' },
  BADGE: {
    badge_fungi_researcher: 'fungi_researcher',
    badge_protist_researcher: 'protist_researcher',
    badge_bacteria_researcher: 'bacteria_researcher',
    badge_balance_guardian: 'balance_guardian',
    badge_bio_innovator: 'bio_innovator',
    badge_labroom_guardian: 'labroom_guardian',
    badge_backyard_guardian: 'backyard_guardian',
    badge_chatspace_guardian: 'chatspace_guardian',
    badge_truthroom_guardian: 'truthroom_guardian'
  }
};

// merge, never replace: assigning a fresh object here would wipe anything another
// module already registered on SM (that silently erased the player atlas once)
W.SM = W.SM || {};
W.SM.U = U; W.SM.Save = Save; W.SM.Input = Input; W.SM.Audio = Audio_; W.SM.GA = GA;
})(window);
