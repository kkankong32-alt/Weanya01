/* ===== 왜냐면 과학실 — boot, assets, state machine, main loop ===== */
(function (W) {
'use strict';
var U = W.SM.U, Save = W.SM.Save, Input = W.SM.Input, Audio_ = W.SM.Audio;
var Art = W.SM.Art, Level = W.SM.Level, Play = W.SM.Play, UI = W.SM.UI, GA = W.SM.GA;
var $ = U.$;
var VW = Play.VW, VH = Play.VH, RS = 3;

/* ================= ASSETS =================
   Rules that keep the game startable no matter what the network does:
   - every image settles (load / error / timeout) — nothing can stay pending
   - a missing OPTIONAL file only warns; it never blocks or errors the start
   - only world-1 files are awaited; the rest stream in behind the title
   - tilesets bake lazily per world, so a late texture still gets used
*/
var TITLE_IMG = 'image/title_wenyamscience.png';

/* ---------- the asset manifest ----------
   ONE table, and every path here is a real file in image/. Extensions are stated
   explicitly and are NOT derived from the key, because they genuinely differ: the
   three floor textures and the glass-safety photo were exported as .jpeg while
   everything else is .png. Deriving the extension is what silently 404s.

   The logical KEY is what the rest of the game asks for (def.bg, def.clearImg,
   Art.TILESETS[..].tex, the DEVICE_ART / HAZARD_ART tables); the value is where
   that art actually lives. So renaming a file only ever touches this table. */
var ART = {
  /* world floor textures */
  tex_labroom_floor:        'image/tex_labroom_floor.jpeg',
  tex_backyard_ground:      'image/tex_backyard_ground.jpeg',
  tex_chatspace_surface:    'image/tex_chatspace_surface.jpeg',
  /* world backdrops */
  world_labroom_bg:         'image/world_labroom_bg.png',
  world_backyard_bg:        'image/world_backyard_bg.png',
  world_chatspace_bg:       'image/world_chatspace_bg.png',
  world_truthroom_bg:       'image/world_truthroom_bg.png',
  /* zone cards (world select + stage intro) */
  loading_labroom_zone:     'image/loading_labroom_zone.png',
  loading_backyard_zone:    'image/loading_backyard_zone.png',
  loading_chatspace_zone:   'image/loading_chatspace_zone.png',
  loading_truthroom_zone:   'image/loading_truthroom_zone.png',
  /* 기억 조각 — the collectible. st_orb is the engine's internal name for it (see
     Orb.draw in play.js); if this file is missing the code-drawn orb in art.js is
     used instead, so the pickup never disappears. */
  st_orb: 'image/pickup_memory_gear.png',
  /* hazards — art.js bakes code-drawn twins under these same keys, so a missing
     file costs polish, not the hazard */
  hazard_glassshard_styled: 'image/hazard_glassshard_styled.png',
  hazard_ember_styled:      'image/hazard_ember_styled.png',
  hazard_fallingjar_styled: 'image/hazard_fallingjar_styled.png',
  hazard_rumor_styled:      'image/hazard_rumor_styled.png',
  /* styled props. The st_* keys are the engine's internal names (see DEVICE_ART in
     play.js); the files use the artwork's own names. */
  st_checkpoint:            'image/checkpoint_beacon_styled.png',
  st_pipe:                  'image/pipe_micro_green_styled.png',
  st_portal_base:           'image/portal_base_styled.png',
  st_portal_ring:           'image/portal_effect_ring_styled.png',
  st_console:               'image/device_evidence_board_styled.png',
  st_switch:                'image/science_switch_pillar_styled.png',
  st_terminal:              'image/science_terminal_cylinder_styled.png',
  /* 확인 카드 */
  card_broken_glass:        'image/card_broken_glass.png',
  card_glove_rule:          'image/card_glove_rule.png',
  card_confirmed_source:    'image/card_confirmed_source.png',
  card_firstaid_wash:       'image/card_firstaid_wash.png',
  /* stage-clear photos */
  impact_glass_safety:      'image/impact_glass_safety.jpeg',
  impact_outdoor_safety:    'image/impact_outdoor_safety.png',
  impact_rumor_truth:       'image/impact_rumor_truth.png',
  card_true_ending:         'image/card_true_ending.png',
  /* badges */
  badge_labroom_guardian:   'image/badge_labroom_guardian.png',
  badge_backyard_guardian:  'image/badge_backyard_guardian.png',
  badge_chatspace_guardian: 'image/badge_chatspace_guardian.png',
  badge_truthroom_guardian: 'image/badge_truthroom_guardian.png',
  /* ending */
  intro_ending_reveal:      'image/intro_ending_reveal.png',
  /* Present in image/ but not wired to any mechanic yet. Loaded so they are ready
     the moment the 소화기 content is written, and so a missing one is noticed now
     rather than then. */
  device_extinguisher_styled: 'image/device_extinguisher_styled.png',
  impact_fire_safety:       'image/impact_fire_safety.png',
  card_extinguisher_use:    'image/card_extinguisher_use.png',
  pickup_spark:             'image/pickup_spark.png',
  portal_effect:            'image/portal_effect.png'
};
function artPath(key) { return ART[key] || null; }

/* Needed before 낡은 과학실 can run: world 1's floor, its backdrop, the props that
   stand next to the player, and its two hazards. Everything here still only WARNS
   when missing (loadSet resolves on error), so a bad path costs a console line and
   a flat-coloured tile — never a failed start. */
var CRITICAL = [
  'tex_labroom_floor', 'world_labroom_bg',
  /* the 기억 조각 is on screen within seconds of starting and appears constantly,
     so it is awaited rather than streamed — otherwise the first pickups render as
     the code-drawn orb and then visibly swap once the real art arrives */
  'st_orb',
  'st_checkpoint', 'st_console', 'st_switch', 'st_terminal',
  'st_pipe', 'st_portal_base', 'st_portal_ring',
  'hazard_glassshard_styled', 'hazard_fallingjar_styled'
].map(function (k) { return [k, ART[k]]; });

/* Everything else streams in behind the title. */
var CRIT_SET = {};
CRITICAL.forEach(function (e) { CRIT_SET[e[0]] = 1; });
var OPTIONAL = Object.keys(ART)
  .filter(function (k) { return !CRIT_SET[k]; })
  .map(function (k) { return [k, ART[k]]; });

/* The cast's portraits stream in with everything else; each character's three
   animation sheets are loaded on demand instead (see Assets.loadCharacter), so
   picking 예민혜 never downloads 용감희's artwork. */
if (W.SM.PlayerAtlas && W.SM.PlayerAtlas.portraitList) {
  W.SM.PlayerAtlas.portraitList().forEach(function (e) { OPTIONAL.push(e); });
}

/* Never-pending image load: resolves on load, error, OR timeout. */
function loadImageSafe(src, timeoutMs) {
  return new Promise(function (resolve) {
    var image = new Image();
    var settled = false, timer = null;
    var finish = function (res) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(res);
    };
    image.onload = function () { finish({ ok: true, image: image, src: src }); };
    image.onerror = function () {
      console.warn('[왜냐면 과학실] asset missing:', src);
      finish({ ok: false, image: null, src: src });
    };
    timer = setTimeout(function () {
      console.warn('[왜냐면 과학실] asset timeout:', src);
      finish({ ok: false, image: null, src: src, timeout: true });
    }, timeoutMs || 8000);
    image.src = src;
  });
}

var Assets = {
  map: {}, urls: {}, _ts: {}, ready: false, optionalDone: false,
  img: function (n) { return this.map[n] || null; },
  url: function (n) { return this.urls[n] || ''; },

  loadOne: function (name, src, timeoutMs) {
    var self = this;
    return loadImageSafe(src, timeoutMs).then(function (r) {
      if (r.ok) { self.map[name] = r.image; self.urls[name] = src; }
      return r;
    });
  },

  /* allSettled semantics: resolves once every entry settles, whatever happened */
  loadSet: function (list, onProg, timeoutMs) {
    var self = this, done = 0, total = list.length;
    if (!total) return Promise.resolve({ ok: 0, failed: [] });
    var failed = [];
    return Promise.all(list.map(function (it) {
      return self.loadOne(it[0], it[1], timeoutMs).then(function (r) {
        if (!r.ok) failed.push(it[1]);
        done++;
        if (onProg) onProg(done / total);
      });
    })).then(function () { return { ok: done - failed.length, failed: failed }; });
  },

  loadCritical: function (onProg) { return this.loadSet(CRITICAL, onProg, 8000); },

  /* The chosen character's three sheets. Awaited during the start sequence so the
     player is never drawn with a placeholder for the first second — but still only
     warns on failure, in which case the code-drawn explorer stands in. */
  loadCharacter: function (id, onProg) {
    var PA = W.SM.PlayerAtlas;
    if (!PA || !PA.sheetList) return Promise.resolve({ ok: 0, failed: [] });
    return this.loadSet(PA.sheetList(id), onProg, 10000);
  },

  /* fire-and-forget; the title/game never waits on this */
  loadOptional: function () {
    var self = this;
    if (this._optStarted) return this._optP;
    this._optStarted = true;
    this._optP = this.loadSet(OPTIONAL, null, 12000).then(function (r) {
      self.optionalDone = true;
      self._ts = {};   // rebake tilesets so late textures are picked up
      if (r.failed.length) console.warn('[왜냐면 과학실] optional assets missing:', r.failed.length, r.failed);
      return r;
    });
    return this._optP;
  },

  /* code-drawn sprites — no network, safe to build once assets/criticals are in */
  buildArt: function () {
    if (this.ready) return;
    this.player = Art.buildPlayer();
    this.orb = Art.buildOrb();
    this.blocks = Art.buildBlocks();
    this.enemies = Art.buildEnemies();
    this.props = Art.buildProps();
    this._ts = {};
    this.ready = true;
  },

  /* lazy per-world tileset: built on first use, so worlds 2-4 pick up textures
     that were still streaming in when the game started */
  tileset: function (name) {
    if (!this._ts[name]) {
      this._ts[name] = Art.buildTileset(name, this.img(Art.TILESETS[name].tex));
    }
    return this._ts[name];
  }
};
W.SM.Assets = Assets;

/* There is no biotech_fungi_medicine artwork in the project, and using mouldy
   bread or the biopesticide photo for "medicine" would teach the wrong thing.
   Draw an honest card instead: fungus -> arrow -> medicine. */
function medicineCardHTML() {
  return '<div class="med-card" role="img" aria-label="균류를 연구해 질병을 치료하는 약을 만들어요">' +
    '<svg viewBox="0 0 120 64">' +
      '<g stroke="#20404f" stroke-width="2.2" stroke-linejoin="round">' +
        '<ellipse cx="24" cy="26" rx="15" ry="10" fill="#e0574a"/>' +
        '<rect x="21" y="26" width="6" height="18" rx="3" fill="#f3e6cd"/>' +
        '<circle cx="18" cy="23" r="2.6" fill="#fff6ea" stroke="none"/>' +
        '<circle cx="29" cy="24" r="2" fill="#fff6ea" stroke="none"/>' +
        '<path d="M46 32 h20" stroke="#65f2d3" stroke-width="3"/>' +
        '<path d="M62 27 l6 5 -6 5" fill="none" stroke="#65f2d3" stroke-width="3"/>' +
        '<rect x="80" y="16" width="24" height="32" rx="5" fill="#cfe9f5"/>' +
        '<rect x="80" y="16" width="24" height="9" rx="4" fill="#4aa3c9"/>' +
        '<path d="M92 30 v12 M86 36 h12" stroke="#e0574a" stroke-width="3"/>' +
      '</g>' +
    '</svg></div>';
}

/* The four 확인 미션. Listed once so onMissionDone and the analytics table cannot
   drift apart, and so adding book 2's missions is a one-line change. */
var VERIFY_MISSIONS = {
  verify_glass: 1, verify_gloves: 1, verify_witness: 1, verify_firstaid_order: 1
};

/* ================= GAME ================= */
var Game = {
  state: 'loading',
  world: null,
  mainWorld: null,
  stageId: null,
  score: 0, orbs: 0,
  cards: [],
  cores: [],
  checkpoint: null,
  promptShown: false,
  labelShown: false,
  clearCtx: null,

  /* ---------- boot ---------- */
  boot: function () {
    var self = this;
    Save.load();
    Input.init();
    UI.game = this;
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) { this.fatal(new Error('Canvas 2D context unavailable')); return; }
    this.setupCanvas();

    // music elements — created, never played until a user gesture
    var lab = new Audio('audio/lab_loop.mp3');
    var exp = new Audio('audio/micro_exploration_loop.mp3');
    lab.preload = 'auto'; exp.preload = 'auto';
    // a missing/undecodable track must never break startup
    lab.addEventListener('error', function () { console.warn('[왜냐면 과학실] music unavailable: lab_loop.mp3'); });
    exp.addEventListener('error', function () { console.warn('[왜냐면 과학실] music unavailable: micro_exploration_loop.mp3'); });
    Audio_.addTrack('lab', lab); Audio_.addTrack('explore', exp);

    this.bindUI();
    this.resize();
    var rz = this.resize.bind(this);
    W.addEventListener('resize', rz);
    W.addEventListener('orientationchange', function () { rz(); setTimeout(rz, 250); });
    if (W.ResizeObserver) new W.ResizeObserver(rz).observe($('#stage'));

    this.setState('boot');
    this.startGameLoopOnce();
    this.bootToTitle();
  },

  /* boot only waits on the key art, so the menu appears fast. If the new key art
     is not there yet we fall back to the previous one rather than showing an empty
     frame — the start button lives on top of this image. */
  bootToTitle: function () {
    var self = this;
    this.loadStep(0.2, '관찰 도구를 확인하는 중…');
    Assets.loadOne('title', TITLE_IMG, 10000).then(function (r) {
      if (!r.ok) console.warn('[왜냐면 과학실] title art failed to load:', TITLE_IMG);
      self.titleReady = r.ok;
      self.loadStep(1, '출발 준비 완료!');
      Assets.loadOptional();          // stream the rest behind the title
      setTimeout(function () { self.toTitle(true); }, 180);
    });
  },

  loadStep: function (p, text) {
    var f = $('#load-fill'), t = $('#load-text');
    if (f) f.style.width = Math.round(U.clamp(p, 0, 1) * 100) + '%';
    if (t && text) t.textContent = text;
  },
  // yields to the browser so the loading bar actually paints between steps
  tick: function (p, text) {
    this.loadStep(p, text);
    return new Promise(function (res) { setTimeout(res, 16); });
  },

  setState: function (s) { this.state = s; },

  startGameLoopOnce: function () {
    if (this._loopStarted) return;
    this._loopStarted = true;
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this._raf = requestAnimationFrame(this.loop);
  },

  fatal: function (err, stage) {
    console.error('[왜냐면 과학실] start failed', {
      stage: stage || 'unknown', gameState: this.state,
      world: this.world ? this.world.def.id : null, error: err
    });
    if (err && err.stack) console.error(err.stack);
    this.setState('error');
    UI.show(null);
    $('#hud').classList.add('hidden');
    var d = $('#error-detail');
    if (d) d.textContent = (stage ? '단계: ' + stage + ' · ' : '') + (err && err.message ? err.message : String(err));
    UI.fade(false);
    UI.openOverlay('scr-error');
  },

  isTouch: ('ontouchstart' in W) || navigator.maxTouchPoints > 0 ||
           (W.matchMedia && W.matchMedia('(pointer: coarse)').matches),

  /* Canvas backing store sized to the REAL device pixels the stage occupies.
     It used to be a fixed 3x (1152x648); on a 1920-wide display the browser then
     upscaled 1152 -> 1920, which is what made the character look soft. Now the
     buffer matches the physical pixels, so sprites are drawn 1:1 where possible. */
  setupCanvas: function () {
    var st = $('#stage');
    var cssW = st.clientWidth || VW, cssH = st.clientHeight || VH;
    var dpr = W.devicePixelRatio || 1;
    // scale needed for one game px -> one device px, clamped so huge DPRs stay sane
    var scale = U.clamp((cssW * dpr) / VW, 1, 4);
    if (this._rs === scale) return;
    this._rs = scale;
    this.canvas.width = Math.round(VW * scale);
    this.canvas.height = Math.round(VH * scale);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in this.ctx) this.ctx.imageSmoothingQuality = 'high';
    void cssH;
  },

  resize: function () {
    var st = $('#stage');
    this.setupCanvas();
    var px = U.clamp(st.clientWidth / 27, 9, 30);
    // guard so the ResizeObserver can't feed back on itself
    if (this._ui !== px) { this._ui = px; st.style.setProperty('--ui', px + 'px'); }
    this.syncTouch();
  },
  // called every frame but only touches the DOM when the answer changes
  syncTouch: function () {
    var want = this.isTouch && this.state === 'playing';
    if (this._touchShown === want) return;
    this._touchShown = want;
    $('#touch').classList.toggle('hidden', !want);
    if (!want) U.$$('.tbtn').forEach(function (b) { b.classList.remove('down'); });
  },

  /* ---------- UI wiring ---------- */
  bindUI: function () {
    var self = this;

    // the real "탐험 시작" — a transparent hit area over the button drawn in the key
    // art. It now opens the character picker instead of starting a run directly.
    var start = $('#btn-start');
    start.addEventListener('click', function () {
      if (self._startLock) return;              // click-spam guard
      Audio_.sfx('select');
      self.toCharSelect();
    });
    // buttons already fire click on Enter/Space; just make the intent explicit
    start.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); start.click(); }
    });

    U.$$('#main-menu .tool').forEach(function (b) {
      b.addEventListener('click', function () { Audio_.sfx('select'); self.mainMenu(b.dataset.act); });
    });
    U.$$('[data-act="retry-start"]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.closeOverlay('scr-error');
        self.beginNewGame(self._lastStartMode || 'new');
      });
    });
    U.$$('[data-act="error-title"]').forEach(function (b) {
      b.addEventListener('click', function () { UI.closeOverlay('scr-error'); self.toTitle(); });
    });

    UI.bindMenu('#pause-menu', function (a) { self.pauseMenu(a); });
    U.$$('#scr-pause .toggles .btn').forEach(function (b) {
      b.addEventListener('click', function () { self.pauseMenu(b.dataset.act); });
    });
    $('#btn-pause').addEventListener('click', function () { self.pause(); });
    $('#mission-close').addEventListener('click', function () { self.closeMission(false); });
    U.$$('[data-act="close-controls"]').forEach(function (b) {
      b.addEventListener('click', function () { UI.closeOverlay('scr-controls'); Audio_.sfx('select'); });
    });
    U.$$('[data-act="close-sound"]').forEach(function (b) {
      b.addEventListener('click', function () { UI.closeOverlay('scr-sound'); Audio_.sfx('select'); });
    });
    U.$$('[data-act="back-title"]').forEach(function (b) {
      b.addEventListener('click', function () { self.toTitle(); });
    });
    U.$$('[data-act="char-back"]').forEach(function (b) {
      b.addEventListener('click', function () { Audio_.sfx('select'); self.toTitle(); });
    });
    var cgo = $('#char-go');
    if (cgo) cgo.addEventListener('click', function () {
      if (self._startLock) return;
      Audio_.sfx('select');
      self.beginNewGame('new');
    });
    // the objective panel folds itself away on short screens; the badge unfolds it
    var gbb = $('#gb-badge');
    if (gbb) gbb.addEventListener('click', function () { UI.goal.toggle(); });
    $('[data-act="clear-next"]').addEventListener('click', function () { self.afterClear(); });
    U.$$('[data-act="restart"]').forEach(function (b) {
      b.addEventListener('click', function () { Save.reset(); self.toTitle(); });
    });
    U.$$('[data-act="worlds"]').forEach(function (b) {
      b.addEventListener('click', function () { self.toWorlds(); });
    });

    var rm = $('#rng-music'), rs = $('#rng-sfx');
    rm.value = Math.round(Save.settings.music * 100);
    rs.value = Math.round(Save.settings.sfx * 100);
    $('#lbl-music').textContent = rm.value + '%';
    $('#lbl-sfx').textContent = rs.value + '%';
    rm.addEventListener('input', function () {
      Save.settings.music = rm.value / 100; Save.settings.musicOn = rm.value > 0;
      $('#lbl-music').textContent = rm.value + '%';
      Audio_.applySettings(); Save.saveSettings();
    });
    rs.addEventListener('input', function () {
      Save.settings.sfx = rs.value / 100; Save.settings.sfxOn = rs.value > 0;
      $('#lbl-sfx').textContent = rs.value + '%';
      Audio_.applySettings(); Save.saveSettings(); Audio_.sfx('select');
    });
  },

  mainMenu: function (a) {
    if (a === 'new') this.beginNewGame('new');
    else if (a === 'continue') this.beginNewGame('continue');
    else if (a === 'controls') UI.openOverlay('scr-controls');
    else if (a === 'sound') UI.openOverlay('scr-sound');
    else if (a === 'fullscreen') this.toggleFullscreen();
  },

  /* =============================================================
     THE START FLOW — one locked, ordered, awaited sequence.
     Audio is unlocked from the gesture but never awaited: music that is
     blocked, missing or slow must not hold the game hostage.
     ============================================================= */
  beginNewGame: function (mode) {
    var self = this;
    if (this._startLock) return Promise.resolve();
    this._startLock = true;
    this._lastStartMode = mode;
    var startBtn = $('#btn-start');
    if (startBtn) startBtn.disabled = true;

    var stage = 'init';
    // one send per start; the lock above already blocks click-spam
    GA.event('game_start', {
      game_name: 'wenyam_science_1',
      start_type: (mode === 'continue') ? 'resume' : 'new',
      character: W.SM.currentCharacter || 'unknown'
    });

    return Promise.resolve().then(function () {

      stage = 'state/loading';
      self.setState('loading');
      UI.overlays.slice().forEach(function (o) { UI.closeOverlay(o); });
      $('#hud').classList.add('hidden');
      UI.show('scr-loading');
      self.loadStep(0.05, '관찰 도구를 확인하는 중…');

      // unlock audio from the user gesture — fire and forget
      stage = 'audio/unlock';
      try { Audio_.init(); Audio_.resume(); } catch (e) { console.warn('[왜냐면 과학실] audio unlock skipped:', e); }

      // resolve which stage we are entering
      stage = 'resolve-target';
      // the selected friend must be live before the world is built, so the atlas
      // and the ability table are already correct on the very first frame
      if (W.SM.Char && Save.settings.character) W.SM.Char.set(Save.settings.character);

      if (mode === 'new') {
        Save.reset();
        self.score = 0; self.orbs = 0; self.cards = []; self.cores = []; self.checkpoint = null;
        self._targetStage = Level.START; self._fromCp = false;
      } else if (mode === 'continue') {
        var p = Save.progress;
        self.score = p.score || 0; self.orbs = p.orbs || 0;
        self.cards = p.cards.slice(); self.cores = p.cores.slice();
        var s = p.lastStage || Level.START;
        /* Belt and braces on top of the separate storage key: the legacy microbe
           stages are still registered, so a resume must be checked against ORDER —
           "exists in STAGES" is not the same as "is part of this book". */
        if (Level.ORDER.indexOf(s) < 0) s = Level.START;
        self.checkpoint = (p.checkpoint && p.checkpoint.stage === s) ? p.checkpoint : null;
        self._targetStage = s; self._fromCp = !!self.checkpoint;
      } else {
        self._targetStage = mode; self._fromCp = false; self.checkpoint = null;
      }
      if (!Level.STAGES[self._targetStage]) self._targetStage = Level.START;

      return self.tick(0.12, '관찰 도구를 확인하는 중…');
    }).then(function () {

      stage = 'assets/critical';
      var wname = (Level.STAGES[self._targetStage] || {}).name || '과학실';
      return Assets.loadCritical(function (p) {
        self.loadStep(0.12 + p * 0.23, wname + '을 불러오는 중…');
      });
    }).then(function (res) {
      if (res.failed.length) {
        // decoration can be missing; the tiles fall back to flat colour
        console.warn('[왜냐면 과학실] critical assets missing (continuing):', res.failed);
      }
      stage = 'assets/character';
      var who = (W.SM.Char ? W.SM.Char.cur().name : '친구');
      return Assets.loadCharacter(W.SM.currentCharacter, function (p) {
        self.loadStep(0.38 + p * 0.10, who + '을(를) 준비하는 중…');
      });
    }).then(function (cres) {
      if (cres.failed.length) {
        console.warn('[왜냐면 과학실] character art missing (using drawn stand-in):', cres.failed);
      }
      return self.tick(0.5, '발판과 통로를 준비하는 중…');
    }).then(function () {

      stage = 'art/build';
      Assets.buildArt();
      return self.tick(0.5, '발판과 통로를 준비하는 중…');
    }).then(function () {

      stage = 'level/build';
      var def = Level.STAGES[self._targetStage];
      var built = Level.build(def);
      self.validateLevel(built);          // throws on unplayable data
      self._built = built;
      return self.tick(0.7, '발판과 통로를 준비하는 중…');
    }).then(function () {

      stage = 'world/create';             // player + camera + collision + entities
      self.enterWorld(self._targetStage, self._fromCp, self._built);
      return self.tick(0.86, (W.SM.Char ? W.SM.Char.cur().name : '친구') + '을(를) 배치하는 중…');
    }).then(function () {

      stage = 'first-frame';
      self.renderOnce();                  // paint frame 0 before revealing
      return self.tick(1, '탐험 준비 완료!');
    }).then(function () {

      stage = 'state/playing';
      var lv = GA.LEVEL[self._targetStage];
      if (lv) GA.event('level_start', { level_name: lv });
      // world 1 doubles as the tutorial (it teaches move/jump/blocks by layout)
      if (self._targetStage === Level.START) GA.once('tut_begin', 'tutorial_begin', {});
      self.setState('playing');
      UI.show(null);                      // clears the loading screen for real
      $('#hud').classList.remove('hidden');
      self.resize();
      self.updateHUD();
      self.startGameLoopOnce();
      var def = Level.STAGES[self._targetStage];
      self.updateObsUI();
      self.showIntroCard(def);            // brief, skippable stage card
      if (def.startBanner) UI.banner(def.startBanner, 5000);
    }).catch(function (err) {
      self.fatal(err, stage);
    }).then(function () {
      self._startLock = false;
      if (startBtn) startBtn.disabled = false;
    });
  },

  /* fail loudly on data that would strand the player, before we show 'playing' */
  validateLevel: function (built) {
    if (!built || !built.grid || !built.grid.length) throw new Error('레벨 데이터가 비어 있습니다');
    var sp = built.spawn;
    if (!sp) throw new Error('시작 위치가 없습니다');
    var c = Math.floor(sp.x / 16), r = Math.floor(sp.y / 16);
    if (c < 0 || c >= built.w || r < 0 || r >= built.h) throw new Error('시작 위치가 레벨 밖입니다');
    // not embedded in a wall
    if (built.grid[r][c] === 1 || built.grid[r][c] === 3) throw new Error('시작 위치가 벽 안입니다');
    // ground exists below the spawn
    var floor = -1;
    for (var rr = r + 1; rr < built.h; rr++) {
      var t = built.grid[rr][c];
      if (t === 1 || t === 2 || t === 3) { floor = rr; break; }
    }
    if (floor < 0) throw new Error('시작 위치 아래에 바닥이 없습니다');
    // a goal must exist
    var hasGoal = built.ents.some(function (e) { return e.k === 'goal'; });
    if (!hasGoal) throw new Error('도착 지점이 없습니다');
    if (built.pxw < VW || built.pxh < VH) throw new Error('카메라 경계가 유효하지 않습니다');
    return true;
  },

  renderOnce: function () {
    if (!this.world || !this.ctx) return;
    this.ctx.setTransform(this._rs, 0, 0, this._rs, 0, 0);
    this.world.draw(this.ctx);
  },

  /* short stage card over the live game; auto-clears and is skippable */
  showIntroCard: function (def) {
    var self = this;
    if (!def.intro) return;
    var box = $('#intro-card');
    if (!box) return;
    $('#intro-eyebrow').textContent = def.intro.eyebrow || '';
    $('#intro-title').textContent = def.intro.title || def.name;
    $('#intro-note').textContent = def.intro.note || '';
    box.classList.remove('hidden');
    box.classList.add('show');
    var hide = function () {
      box.classList.remove('show');
      setTimeout(function () { box.classList.add('hidden'); }, 320);
      W.removeEventListener('pointerdown', hide);
      W.removeEventListener('keydown', hide);
      clearTimeout(self._introT);
    };
    W.addEventListener('pointerdown', hide);
    W.addEventListener('keydown', hide);
    this._introT = setTimeout(hide, 3600);
  },

  toggleFullscreen: function () {
    var d = document, e = d.documentElement;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    }
  },

  /* ---------- screens ---------- */
  toTitle: function (first) {
    UI.goal.hide();
    this.setState('menu');
    this.world = null; this.mainWorld = null; this.returnTo = null;
    UI.hideBanner();
    $('#hud').classList.add('hidden');
    $('#touch').classList.add('hidden');
    $('#prompt').classList.add('hidden');
    $('#status-label').classList.add('hidden');
    this.hideBackArrow();
    var card = $('#intro-card'); if (card) card.classList.add('hidden');
    UI.overlays.slice().forEach(function (o) { UI.closeOverlay(o); });
    UI.show('scr-title');

    // reveal the key art only once it has actually decoded, so a slow load shows
    // the soft gradient rather than a flash of empty box
    var img = $('#title-img'), blur = $('#title-blur');
    var reveal = function () { img.classList.add('on'); blur.classList.add('on'); };
    if (img.complete && img.naturalWidth) reveal();
    else img.addEventListener('load', reveal, { once: true });

    var cont = $('[data-act="continue"]');
    if (cont) { cont.disabled = !Save.hasRun(); cont.hidden = !Save.hasRun(); }
    var start = $('#btn-start'); if (start) start.disabled = false;

    Audio_.stopAmb();
    if (!first) Audio_.music('lab');   // never autoplay on the very first paint
  },

  /* ---------- character select ----------
     Sits between the title and the first stage. The roster comes from
     SM.PlayerAtlas.Characters so there is exactly one place to add a fourth
     friend. A portrait that has not shipped degrades to the character's initial on
     a coloured card, so the screen is always usable. */
  toCharSelect: function () {
    var self = this;
    var PA = W.SM.PlayerAtlas;
    if (!PA || !PA.ORDER || !PA.ORDER.length) {
      // no cast module: skip the screen entirely rather than showing an empty one
      return this.beginNewGame('new');
    }
    this.state = 'charselect';
    UI.goal.hide();
    UI.hideBanner();
    $('#hud').classList.add('hidden');
    $('#touch').classList.add('hidden');
    UI.overlays.slice().forEach(function (o) { UI.closeOverlay(o); });
    UI.show('scr-charselect');

    var grid = $('#char-grid');
    var note = $('#char-note');
    var go = $('#char-go');
    grid.innerHTML = '';

    // start on whatever was played last, so a repeat player just presses 시작
    var picked = PA.Characters[Save.settings.character] ? Save.settings.character : null;

    PA.ORDER.forEach(function (id) {
      var c = PA.Characters[id];
      var card = document.createElement('button');
      card.className = 'ccard';
      card.type = 'button';
      card.dataset.id = id;
      card.style.setProperty('--cc', c.color);

      var art = document.createElement('div');
      art.className = 'ccard-art';
      var im = document.createElement('img');
      im.alt = '';
      im.addEventListener('error', function () {
        console.warn('[왜냐면 과학실] 캐릭터 이미지를 불러오지 못했습니다: image/' + c.portrait + '.png');
        im.remove();
        art.classList.add('noart');
        art.textContent = c.name.charAt(0);
      });
      im.src = 'image/' + c.portrait + '.png';
      art.appendChild(im);

      var body = document.createElement('div');
      body.className = 'ccard-body';
      body.innerHTML =
        '<p class="cc-type">' + c.type + '</p>' +
        '<h3 class="cc-name">' + c.name + '</h3>' +
        '<p class="cc-perk">' + c.perk + '</p>';

      card.appendChild(art); card.appendChild(body);
      card.addEventListener('click', function () {
        Audio_.sfx('select');
        picked = id;
        U.$$('#char-grid .ccard').forEach(function (e) {
          e.classList.toggle('sel', e.dataset.id === id);
        });
        note.textContent = c.name + ' · ' + c.blurb;
        go.disabled = false;
        W.SM.Char.set(id);
        Save.settings.character = id;
        Save.saveSettings();
      });
      grid.appendChild(card);
    });

    if (picked) {
      // reflect the remembered pick without making the player click twice
      var pre = grid.querySelector('.ccard[data-id="' + picked + '"]');
      if (pre) pre.click();
    } else {
      go.disabled = true;
      note.textContent = '카드를 누르면 그 친구의 특기를 볼 수 있어요.';
    }
    void self;
  },

  /* Keyboard driver for the picker. Selection is read off the DOM rather than kept
     in a second variable, so mouse, touch and keys can never disagree. */
  charSelectNav: function () {
    var cards = U.$$('#char-grid .ccard');
    if (!cards.length) return;
    var i = cards.findIndex(function (c) { return c.classList.contains('sel'); });
    var d = 0;
    if (Input.hit('right')) d = 1;
    else if (Input.hit('left')) d = -1;
    if (d) {
      i = (i < 0) ? (d > 0 ? 0 : cards.length - 1) : (i + d + cards.length) % cards.length;
      cards[i].click();
      cards[i].focus();
    }
    if (Input.hit('confirm') || Input.hit('jump')) {
      var go = $('#char-go');
      if (i < 0) { cards[0].click(); return; }   // pick before you can start
      if (go && !go.disabled) go.click();
    }
  },

  toWorlds: function () {
    this.state = 'worlds';
    UI.show('scr-worlds');
    var grid = $('#world-grid'); grid.innerHTML = '';
    var self = this;
    /* Zone card art comes from each stage's own intro definition, resolved through
       the ART table — so it cannot drift from what the stage actually declares. A
       card with no art just shows the dark panel and its name, still selectable. */
    Level.ORDER.forEach(function (id, i) {
      var st = Level.STAGES[id];
      var done = Save.has('stagesDone', id);
      var prev = i === 0 ? true : Save.has('stagesDone', Level.ORDER[i - 1]);
      var d = document.createElement('div');
      d.className = 'wcard' + (done ? ' done' : '') + (prev ? '' : ' locked');
      var zone = st.intro && st.intro.art;
      var zoneSrc = zone && (Assets.url(zone) || artPath(zone));
      if (zoneSrc) d.style.backgroundImage = "url('" + zoneSrc + "')";
      d.innerHTML = '<span>' + st.name + '</span>';
      if (prev) d.addEventListener('click', function () {
        Audio_.sfx('select'); self.checkpoint = null; self.startStage(id, false);
      });
      grid.appendChild(d);
    });
  },

  /* ---------- stage lifecycle ----------
     Every entry point (world select, clear->next, retry) goes through the same
     locked+validated flow as "탐험 시작" — no second, unaudited start path. */
  startStage: function (id, fromCp) {
    this.checkpoint = fromCp ? this.checkpoint : null;
    return this.beginNewGame(id);
  },

  enterWorld: function (id, fromCp, prebuilt) {
    var def = Level.STAGES[id];
    var built = prebuilt || Level.build(def);
    this.stageId = id;
    Save.progress.lastStage = id;
    Save.saveProgress();
    var w = new Play.World(built, this);
    this.world = w;
    this.mainWorld = w;
    this.stageId = id;
    this.hp = 3;
    w.player.hp = 3;

    if (fromCp && this.checkpoint && this.checkpoint.stage === id) {
      w.player.x = this.checkpoint.x; w.player.y = this.checkpoint.y;
      var cp = this.checkpoint;
      w.ents.forEach(function (e) {
        if (e.on !== undefined && Math.abs(e.x - cp.x) < 4) e.on = true;   // already-lit beacon
      });
      w.snapCam();
    }

    // locate the late-stage dead-wood wall (stage 1 decomposition beat)
    this.wallX = null;
    for (var c = built.w - 1; c >= 0 && this.wallX == null; c--) {
      for (var r = 0; r < built.h; r++) {
        var m = built.meta[r][c];
        if (built.grid[r][c] === 3 && m && m.t === 'brick' && !m.obsgate &&
            c > built.w * 0.6) { this.wallX = c * 16; break; }
      }
    }
    this.valvesShut = 0;
    this.restores = 0;
    this.bossSpawned = false;
    /* Observation gate. Resolved from the built grid, so it is wherever the map
       says it is. Already-earned cards open it immediately and silently — a
       returning player must never be asked to redo the observation. */
    this.obsGateX = null;
    this.obsGateOpen = false;
    this._gateMsgT = 0;

    $('#hud-stage').textContent = def.name;
    UI.goal.hide();
    if (def.goal) UI.goal.show({
      id: def.id, title: def.goal.title, how: def.goal.how, next: def.goal.next,
      now: 0, total: def.goal.total || 0, hints: def.goal.hints || []
    });
    // music is best-effort and must never gate entering the world
    try {
      Audio_.music(def.music === 'lab' ? 'lab' : 'explore');
      Audio_.ambience(def.amb);
    } catch (e) { console.warn('[왜냐면 과학실] music start skipped:', e); }
  },

  /* ---------- warps ---------- */
  doWarp: function (pipe) {
    var self = this;
    var w = pipe.warp;
    if (!w) { this.world.player.state = 'play'; return; }
    UI.fade(true, function () {
      if (w.kind === 'bonus') {
        self.returnTo = { world: self.mainWorld, x: pipe.x + 16, y: pipe.y - 24 };
        var built = Level.build(Level.STAGES[w.to]);
        var bw = new Play.World(built, self);
        bw.player.hp = self.mainWorld.player.hp;
        self.world = bw;
        Audio_.music('lab'); Audio_.stopAmb();
        $('#hud-stage').textContent = Level.STAGES[w.to].name;
      } else if (w.kind === 'exit' && self.returnTo) {
        var m = self.returnTo.world;
        m.player.state = 'play';
        m.player.x = self.returnTo.x - m.player.w / 2;
        m.player.y = self.returnTo.y;
        m.player.vx = 0; m.player.vy = 0;
        m.player.hp = self.world.player.hp;
        m.snapCam();
        self.world = m;
        self.returnTo = null;
        var def = m.def;
        Audio_.music(def.music === 'lab' ? 'lab' : 'explore');
        Audio_.ambience(def.amb);
        $('#hud-stage').textContent = def.name;
      }
      Audio_.sfx('pipe');
      UI.fade(false);
    });
  },

  /* ---------- score / pickups ---------- */
  addOrb: function (orb, fromBlock) {
    this.orbs += orb.v;
    this.score += orb.v * 50;
    Audio_.sfx(orb.big ? 'orb_big' : 'orb');
    if (!fromBlock && this.world) {
      this.world.particles(orb.x, orb.y, orb.big ? 12 : 6,
        { c: '#c9ff7a', life: .45, up: 40, r: 1.4 });
    }
    this.updateHUD(true);
  },
  addScore: function (n, x, y) {
    this.score += n;
    this.updateHUD(true);
    if (this.world && x != null) {
      this.world.particles(x, y, 4, { c: '#ffe08a', life: .4, up: 60 });
    }
  },
  updateHUD: function (pop) {
    $('#hud-score').textContent = this.score;
    $('#hud-orbs').textContent = this.orbs;
    if (pop) {
      var b = $('#hud-orbs');
      b.classList.add('pop');
      clearTimeout(this._pt);
      this._pt = setTimeout(function () { b.classList.remove('pop'); }, 130);
    }
    var hp = this.world ? this.world.player.hp : 3;
    var hs = $('#hud-hearts');
    if (hs.children.length !== 3) {
      hs.innerHTML = '';
      for (var i = 0; i < 3; i++) { var d = document.createElement('i'); d.className = 'heart'; hs.appendChild(d); }
    }
    for (var j = 0; j < 3; j++) hs.children[j].classList.toggle('off', j >= hp);
  },
  toast: function (m) { UI.toast(m); },
  showPrompt: function (x, y, t) {
    if (!this.world) return;
    var st = $('#stage'), p = $('#prompt');
    var sx = st.clientWidth / VW, sy = st.clientHeight / VH;
    p.style.left = ((x - this.world.cam.x) * sx) + 'px';
    p.style.top = ((y - this.world.cam.y) * sy) + 'px';
    $('#prompt-text').textContent = t;
    p.classList.remove('hidden');
    this.promptShown = true;
    var ab = $('#t-act');
    if (ab) ab.classList.add('on');
  },

  /* Read-out for devices that cannot be operated. Same positioning as the
     prompt, but no key cap and no touch-button glow — nothing here is pressable. */
  showLabel: function (x, y, t, on) {
    if (!this.world) return;
    var st = $('#stage'), l = $('#status-label');
    var sx = st.clientWidth / VW, sy = st.clientHeight / VH;
    l.style.left = ((x - this.world.cam.x) * sx) + 'px';
    l.style.top = ((y - this.world.cam.y) * sy) + 'px';
    $('#status-label-text').textContent = t;
    l.classList.toggle('on', !!on);      // dot colour must match the real state
    l.classList.remove('hidden');
    this.labelShown = true;
  },

  setCheckpoint: function (x, y) {
    var lv = GA.LEVEL[this.stageId];
    if (lv) GA.once('cp:' + this.stageId + ':' + Math.round(x), 'checkpoint_reached', {
      level_name: lv, checkpoint_id: lv + '_cp_' + Math.round(x / 16)
    });
    this.checkpoint = { stage: this.stageId, x: x, y: y };
    Save.progress.checkpoint = this.checkpoint;
    Save.progress.score = this.score;
    Save.progress.orbs = this.orbs;
    Save.saveProgress();
  },

  grantCard: function (id) {
    if (this.cards.indexOf(id) < 0) {
      this.cards.push(id);
      Save.add('cards', id);
      Save.saveProgress();
      var c = Level.CARDS[id];
      UI.toast('확인 카드 획득 — ' + (c ? c.name : id));
    }
    this.updateObsUI();          // the goal panel must move the instant a card lands
  },

  /* ---------- observation gate ----------
     The source of truth is Save.progress.cards, NOT this.cards: the saved list is
     written the moment a card is granted and survives death, retry and reload, so
     an observation is never demanded twice. this.cards is only the current run. */
  requiredObs: function (stageId) {
    return (Level.REQUIRED_OBS && Level.REQUIRED_OBS[stageId]) || [];
  },
  missingObs: function (stageId) {
    var have = Save.progress.cards || [];
    return this.requiredObs(stageId).filter(function (id) { return have.indexOf(id) < 0; });
  },
  obsDone: function (stageId) { return this.missingObs(stageId).length === 0; },

  /* ---------- the final door ----------
     진실의 방's exit is the one gate that asks for the whole book: all four 확인
     cards, not just world 4's. Kept separate from requiredObs so world 4's own
     mid-stage K wall still opens on its own card — only the goal portal is stricter.
     Stages without `finalGate` behave exactly as before. */
  goalObs: function (stageId) {
    var def = Level.STAGES[stageId];
    if (def && def.finalGate && Level.FINAL_OBS) return Level.FINAL_OBS;
    return this.requiredObs(stageId);
  },
  missingGoalObs: function (stageId) {
    var have = Save.progress.cards || [];
    return this.goalObs(stageId).filter(function (id) { return have.indexOf(id) < 0; });
  },
  goalObsDone: function (stageId) { return this.missingGoalObs(stageId).length === 0; },
  obsNames: function (ids) {
    return ids.map(function (id) {
      var c = Level.CARDS[id];
      return c ? c.name : id;
    }).join(', ');
  },

  /* The pipe that holds this stage's observation room, so the player can be
     pointed back at it by name and position rather than a vague "go back". */
  obsPipe: function () {
    var w = this.world;
    if (!w) return null;
    var best = null;
    w.ents.forEach(function (e) {
      if (e.warp && e.warp.kind === 'bonus') { if (!best || e.x < best.x) best = e; }
    });
    return best;
  },

  /* Runs every frame while playing. Opens the gate the moment the cards are in
     (including on arrival, for a player who already did the room), and otherwise
     explains what is missing and where to go. */
  updateObsGate: function () {
    var w = this.world;
    if (!w || w.def.sub) return;                 // pipe rooms have no gate
    if (this.obsGateX == null) {
      this.obsGateX = w.obsGateX ? w.obsGateX() : null;
      if (this.obsGateX == null) { this.obsGateOpen = true; return; }
    }
    if (this.obsGateOpen) return;

    var p = w.player;
    if (p.state !== 'play' && p.state !== 'hurt') return;
    var dx = this.obsGateX - (p.x + p.w / 2);

    if (this.obsDone(this.stageId)) {
      // open a little before arrival so nobody walks into a wall that is about
      // to vanish; once open it stays open for the rest of the run
      if (dx < 150) {
        this.obsGateOpen = true;
        w.openObsGate();
        this.hideBackArrow();
        UI.banner('확인 완료!<br>다음 구역으로 이동할 수 있습니다.', 2600);
        Audio_.sfx('core');
        this.updateObsUI();
      }
      return;
    }

    // still missing cards: nudge, on a cooldown, only when actually near
    if (dx > 0 && dx < 78) {
      this.showBackArrow();
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (this._gateMsgT && now - this._gateMsgT < 4200) return;
      this._gateMsgT = now;
      var miss = this.missingObs(this.stageId);
      Audio_.sfx('fail');
      UI.banner('<b class="bn-title">아직 확인하지 않았어요!</b><br>' +
        '뒤쪽 파이프 아래의 확인실에서 미션을 완료하고<br>확인 카드를 얻으세요.<br>' +
        '<span class="bn-sub">현재 목표: 확인실 미션 완료 ' +
        (this.requiredObs(this.stageId).length - miss.length) + '/' +
        this.requiredObs(this.stageId).length + '</span>', 5200);
      var pipe = this.obsPipe();
      if (pipe && w.highlightPipe) w.highlightPipe(pipe, 5);
      this.updateObsUI();
    } else if (dx > 190 || dx < -8) {
      this.hideBackArrow();
    }
  },

  /* A left-pointing marker pinned to the stage edge. DOM rather than canvas so it
     is legible at every resolution and needs no art. */
  showBackArrow: function () {
    var a = $('#back-arrow');
    if (a) a.classList.remove('hidden');
  },
  hideBackArrow: function () {
    var a = $('#back-arrow');
    if (a) a.classList.add('hidden');
  },

  /* Shown when the player reaches a locked exit. Cooldown-guarded so walking into
     the goal every frame cannot spam it, and it never stops movement or hurts. */
  blockGoal: function () {
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._blockT && now - this._blockT < 2600) return;
    this._blockT = now;
    var miss = this.missingGoalObs(this.stageId);
    var def = Level.STAGES[this.stageId];
    Audio_.sfx('fail');
    /* On the final door the missing cards are in OTHER worlds, so "이 파이프로
       가세요" would be a lie. Say which cards, and where they come from. */
    if (def && def.finalGate) {
      UI.banner('<b class="bn-title">확인 카드가 모두 필요해요!</b><br>' +
        '네 가지를 모두 확인해야 진실의 방 문이 열려요.' +
        (miss.length ? '<br><b>남은 확인: ' + this.obsNames(miss) + '</b>' +
          '<br><span class="bn-sub">월드 선택에서 해당 월드로 다시 갈 수 있어요.</span>' : ''), 4200);
    } else {
      UI.banner('아직 확인하지 않은 자료가 있어요.<br>파이프 안을 탐색하고 확인 미션을 완료해 주세요.' +
        (miss.length ? '<br><b>남은 확인: ' + this.obsNames(miss) + '</b>' : ''), 3200);
    }
    this.updateObsUI();
  },

  /* Keeps the goal panel's observation line in step with the saved cards. */
  updateObsUI: function () {
    if (!UI.goal || !UI.goal.setObs) return;
    var id = this.stageId;
    var req = this.requiredObs(id);
    if (!req.length) { UI.goal.setObs(null); return; }
    var miss = this.missingObs(id);
    UI.goal.setObs({ now: req.length - miss.length, total: req.length, missing: this.obsNames(miss) });
  },

  onPlayerDead: function () {
    var self = this;
    var w = this.mainWorld && this.world === this.mainWorld ? this.world : this.world;
    UI.fade(true, function () {
      if (self.returnTo) {
        // died in a bonus room -> go back to the main level
        var m = self.returnTo.world;
        m.player.state = 'play'; m.player.hp = 3;
        m.player.x = self.returnTo.x - m.player.w / 2; m.player.y = self.returnTo.y;
        m.player.vx = m.player.vy = 0; m.snapCam();
        self.world = m; self.returnTo = null;
        Audio_.music('explore'); Audio_.ambience(m.def.amb);
        $('#hud-stage').textContent = m.def.name;
      } else if (self.checkpoint && self.checkpoint.stage === self.stageId) {
        var p = w.player;
        p.state = 'play'; p.hp = 3; p.vx = 0; p.vy = 0; p.invuln = 1;
        p.x = self.checkpoint.x; p.y = self.checkpoint.y;
        w.snapCam();
      } else {
        var p2 = w.player;
        p2.state = 'play'; p2.hp = 3; p2.vx = 0; p2.vy = 0; p2.invuln = 1;
        p2.x = w.L.spawn.x; p2.y = w.L.spawn.y;
        w.snapCam();
      }
      self.updateHUD();
      UI.fade(false);
    });
  },

  /* fixed analytics ids for each mission */
  GA_MISSION: {
    scope_fungi: ['fungi_microscope', 'fungi'],
    humidity: ['fungi_environment', 'fungi'],
    bread_mold: ['fungi_environment', 'fungi'],
    scope_protist: ['protist_observation', 'protist'],
    protist_match: ['protist_observation', 'protist'],
    valves: ['protist_pollution_recovery', 'protist'],
    scope_bacteria: ['bacteria_shape_research', 'bacteria'],
    classify: ['bacteria_shape_research', 'bacteria'],
    bacteria_roles: ['bacteria_life_roles', 'bacteria'],
    ferment: ['bacteria_life_roles', 'bacteria'],
    purify: ['bacteria_data_recovery', 'bacteria'],
    bacteria_habitat: ['bacteria_habitat_growth', 'bacteria'],
    data_recovery: ['bacteria_data_recovery', 'bacteria'],
    restore_fungi: ['final_classification', 'balance'],
    restore_ferment: ['final_classification', 'balance'],
    restore_sea: ['final_classification', 'balance'],
    restore_mold: ['final_classification', 'balance'],
    final_match: ['final_classification', 'balance'],
    bioscience: ['final_biotechnology', 'balance'],
    verify_glass: ['glass_safety_check', 'labroom'],
    verify_gloves: ['field_rule_check', 'backyard'],
    verify_witness: ['fact_vs_guess_check', 'chatspace'],
    verify_firstaid_order: ['firstaid_order_check', 'truthroom']
  },

  /* ---------- missions ---------- */
  INSTANT: { valves: 1, ferment: 1, purify: 1, restore_fungi: 1, restore_ferment: 1, restore_sea: 1 },

  openMission: function (id, device) {
    this.gaMissionStart(id);
    if (this.INSTANT[id]) return this.instantMission(id, device);
    var self = this;
    this.state = 'mission';
    this.missionCtx = { id: id, game: this, device: device };
    Input.clear();
    UI.openOverlay('scr-mission');
    Audio_.duck(true);
    var fn = UI.Missions[id];
    if (!fn) { this.closeMission(false); return; }
    fn(this.missionCtx, function (ok) { self.closeMission(ok); });
  },
  closeMission: function (ok) {
    var ctx = this.missionCtx;
    if (ctx && ctx.cleanup) ctx.cleanup();
    UI.closeOverlay('scr-mission');
    Audio_.duck(false);
    this.state = this.state === 'ending-mission' ? 'ending-mission' : 'playing';
    Input.clear();
    if (ok && ctx) this.onMissionDone(ctx.id, ctx.device);
    this.missionCtx = null;
  },

  gaMissionStart: function (id) {
    var m = this.GA_MISSION[id];
    if (m) GA.once('ms:' + m[0], 'mission_start', { mission_name: m[0], world_name: m[1] });
  },
  gaMissionDone: function (id) {
    var m = this.GA_MISSION[id];
    if (m) GA.once('mc:' + m[0], 'mission_complete', { mission_name: m[0], world_name: m[1], success: true });
  },

  onMissionDone: function (id, device) {
    this.gaMissionDone(id);
    var w = this.world;
    if (device) device.done = true;
    this.addScore(1000);
    if (id === 'humidity' && this.stageId === 's1') {
      w.flags.humidity = true;
      // both the regulator and the vent tower show as running
      w.ents.forEach(function (e) { if (e.kind === 'humidity' || e.kind === 'vent') e.done = true; });
      var dev = w.ents.filter(function (e) { return e.kind === 'humidity'; })[0];
      w.growBridge(dev ? dev.x : device.x);
      UI.goal.complete('완료! 균사 다리가 자랐어요');
      UI.banner('알맞은 환경이 되자 <b>균사</b>가 자라 길을 이었어요. 균류는 <b>따뜻하고 습한 곳</b>에서 잘 자라요.');
    } else if (id === 'bacteria_habitat') {
      w.openGateNear(device.x, { c: '#b8e6ff' });
      this.bumpStageGoal();
    } else if (id === 'bacteria_roles') {
      w.openGateNear(device.x, { c: '#ffb03d' });
      this.bumpStageGoal();
    } else if (id === 'classify') {
      w.openGateNear(device.x, { c: '#7fe8ff' });
      this.bumpStageGoal();
      UI.banner('세균에는 <b>공 모양, 막대 모양, 나선 모양</b> 등이 있어요.');
    } else if (id === 'restore_mold') {
      w.flags.mold = true;
      this.onRestore(device, '습도와 환기를 조절하자 곰팡이가 더 퍼지지 않아요. 균류는 <b>따뜻하고 습한 곳</b>에서 잘 자라요.');
    } else if (id === 'bioscience') {
      this.finishEnding();
      return;
    } else if (VERIFY_MISSIONS[id]) {
      /* 왜냐면 과학실 확인 미션. The card itself is granted inside the mission (it is
         the mission's own payoff), so all that is left here is to tick the stage
         objective over so the panel reads 1/1 and completes. The observation gate
         out in the main level opens on its own the next frame, driven by the saved
         card list — see updateObsGate. */
      this.bumpStageGoal();
    }
    if (this.bonusCardFor(id)) this.grantCard(this.bonusCardFor(id));
  },
  bonusCardFor: function () { return null; },

  instantMission: function (id, device) {
    var w = this.world;
    this.gaMissionDone(id);
    device.done = true;
    Audio_.sfx('mission');
    this.addScore(600, device.x + 8, device.y);
    w.particles(device.x + 8, device.y + 8, 14, { c: '#8ee63f', life: .7, up: 80 });

    if (id === 'valves') {
      this.valvesShut++;
      var need = w.def.valveCount || 3;
      UI.goal.set(this.valvesShut);
      if (this.valvesShut < need) {
        UI.toast('오염 밸브를 잠갔어요 (' + this.valvesShut + '/' + need + ')');
      } else {
        UI.goal.complete('완료! 물이 맑아졌어요');
        UI.banner('오염 물질이 줄어들자 붉은 물이 맑아지고, <b>일부 원생생물의 지나친 증가</b>가 잦아들었어요.', 5200);
        Audio_.sfx('core');
        w.flags.purified = true;
        // the protists are not removed — the bloom simply eases and disperses
        w.ents.forEach(function (e) {
          if (e.type === 'redtide') { e.squashT = 0.34; e.fading = true; }
        });
        this.grantCard('pondwater');
      }
    } else if (id === 'ferment') {
      w.openGateNear(device.x, { c: '#ffb03d' });
      this.bumpStageGoal();
      UI.banner('발효 장치가 움직여요. 세균은 <b>김치와 요구르트</b>를 만드는 데 이용돼요.');
    } else if (id === 'purify') {
      w.openGateNear(device.x, { c: '#b8e6ff' });
      this.bumpStageGoal();
      UI.banner('정화 시설이 되살아났어요. 세균은 <b>오염된 물을 정화</b>하는 데 이용될 수 있어요.');
    } else if (id === 'restore_fungi') {
      this.onRestore(device, '균류가 죽은 나무와 낙엽을 <b>분해</b>하기 시작했어요.');
    } else if (id === 'restore_ferment') {
      this.onRestore(device, '세균이 돌아오자 <b>김치와 요구르트</b>의 발효가 다시 시작됐어요.');
    } else if (id === 'restore_sea') {
      this.onRestore(device, '오염수 유입을 막았어요. 원생생물을 없애지 않고도 바다가 맑아져요.');
    }
  },

  onRestore: function (device, msg) {
    this.restores++;
    this.world.openGateNear(device.x, { c: '#b98aff' });
    UI.goal.set(this.restores);
    if (this.restores >= 4) UI.goal.complete('완료! 균형 오류 코어가 나타나요');
    UI.banner(msg + ' (' + this.restores + '/4)');
    Audio_.sfx('core');
  },

  /* generic +1 for stages whose goal counts device activations */
  bumpStageGoal: function () {
    if (!UI.goal.cur) return;
    UI.goal.step();
    if (UI.goal.cur && UI.goal.cur.total && UI.goal.cur.now >= UI.goal.cur.total) {
      UI.goal.complete('완료! 출구가 열렸어요');
    }
  },

  /* ---------- boss ---------- */
  onBossDown: function () {
    var w = this.world, def = w.def;
    var bc = (typeof def.boss === 'object') ? def.boss : {};
    w.shake = 10;
    Audio_.sfx('final');
    UI.banner(bc.down || '<b>생명의 균형이 회복되었습니다.</b>', 4600);
    w.particles(w.boss.x + 13, w.boss.y + 13, 40,
      { c: bc.art ? '#cdbdf5' : '#7ff0ff', life: 1.2, spMax: 200 });
    /* Everything it released disperses and the exit opens. Note this does NOT bypass
       the card gate: the goal still refuses until all four confirmations are in
       hand, so beating the boss opens the door but the book still has to be done. */
    w.ents.forEach(function (e) { if (e.type) e.dead = true; });
    w.ents.forEach(function (e) { if (e.active !== undefined && e.taken !== undefined) e.active = true; });
    this.cores.push(def.core || 'balance');
  },

  /* ---------- goal / clear ---------- */
  onGoal: function () {
    var self = this, w = this.world, def = w.def;
    /* Real gate, not just a caption: this is the function that writes stagesDone
       and hands out the next stage, so checking here means no route into the next
       stage can skip the observations. */
    if (!this.goalObsDone(def.id)) { this.blockGoal(); return; }
    w.player.state = 'clear';
    w.player.vx = 0; w.player.vy = 0;
    Audio_.sfx('clear');
    Audio_.stopMusic();
    Audio_.stopAmb();
    w.particles(w.player.x + 5, w.player.y, 30, { c: '#7ff0ff', life: 1, up: 120 });

    var lv = GA.LEVEL[def.id];
    if (lv) {
      GA.once('lvend:' + def.id, 'level_end', { level_name: lv, success: true });
      GA.once('score:' + def.id, 'post_score', {
        score: this.score, level: GA.LEVEL_NUM[def.id] || 1,
        character: W.SM.currentCharacter || 'unknown'
      });
    }
    if (def.id === Level.START) GA.once('tut_done', 'tutorial_complete', {});
    Save.add('stagesDone', def.id);
    if (def.core) Save.add('cores', def.core);
    if (def.badge) {
      var wasNew = !Save.has('badges', def.badge);
      Save.add('badges', def.badge);
      if (wasNew && GA.BADGE[def.badge]) {
        GA.once('badge:' + def.badge, 'unlock_achievement', { achievement_id: GA.BADGE[def.badge] });
      }
    }
    Save.progress.score = this.score;
    Save.progress.orbs = this.orbs;
    Save.progress.checkpoint = null;
    Save.saveProgress();
    this.checkpoint = null;

    setTimeout(function () {
      self.state = 'stageClear';
      self.showClear(def);
    }, 1400);
  },

  showClear: function (def) {
    UI.goal.hide();
    $('#hud').classList.add('hidden');
    $('#touch').classList.add('hidden');
    $('#prompt').classList.add('hidden');
    $('#status-label').classList.add('hidden');
    this.hideBackArrow();
    UI.hideBanner();
    $('#clear-title').textContent = def.name + ' 클리어!';
    /* Resolved through the ART table (the loader's own URL first), so a .jpeg vs
       .png difference is never guessed at. If there is genuinely no art, hide the
       frame rather than leaving a broken-image icon on the clear screen. */
    var im = $('#clear-img');
    var clearSrc = Assets.url(def.clearImg) || artPath(def.clearImg);
    im.onerror = function () {
      console.warn('[왜냐면 과학실] 클리어 이미지를 불러오지 못했습니다:', clearSrc || def.clearImg);
      im.onerror = null;
      im.style.display = 'none';
    };
    if (clearSrc) { im.style.display = ''; im.src = clearSrc; }
    else { im.removeAttribute('src'); im.style.display = 'none'; }
    $('#clear-facts').innerHTML = def.facts.map(function (f) { return '<p>' + f + '</p>'; }).join('');
    $('#clear-stats').innerHTML =
      '<span>점수 <b>' + this.score + '</b></span>' +
      '<span>기억 조각 <b>' + this.orbs + '</b></span>' +
      '<span>확인 카드 <b>' + this.cards.length + '</b></span>';
    UI.openOverlay('scr-clear');
    // always start at the top: a previous stage's scroll position would otherwise
    // carry over and open the next clear screen halfway down
    var sc = $('#clear-scroll');
    if (sc) sc.scrollTop = 0;
    // drop any keys/touches still held from gameplay so nothing leaks through
    Input.clear();
    this._clearLock = false;
    Audio_.music('lab');
    this.clearCtx = def;
  },

  afterClear: function () {
    var self = this;
    // a fast double-tap used to fire this twice and start two stage loads
    if (this._clearLock) return;
    this._clearLock = true;
    UI.closeOverlay('scr-clear');
    var def = this.clearCtx;
    var i = Level.ORDER.indexOf(def.id);
    if (def.id === Level.FINAL) { this.startEnding(); return; }
    var next = Level.ORDER[i + 1];
    if (next) this.startStage(next, false);
    else this.toTitle();
  },

  /* ---------- ending ---------- */
  startEnding: function () {
    var self = this;
    /* Belt and braces only. Each stage already refuses to end without its own
       observations, so this should be unreachable in normal play — it exists so a
       tampered save cannot reach the ending with an empty card set. */
    /* THIS BOOK's cards only. Iterating all of REQUIRED_OBS would also pull in the
       legacy microbe stages, which are still registered for old saves but are not
       in ORDER — so the ending warned about 표고버섯/균사/해캄 that a 왜냐면 과학실
       player has no way to earn, and flashed a banner saying so. */
    var allReq = (Level.FINAL_OBS || []).slice();
    Level.ORDER.forEach(function (id) {
      (Level.REQUIRED_OBS[id] || []).forEach(function (c) {
        if (allReq.indexOf(c) < 0) allReq.push(c);
      });
    });
    var have = Save.progress.cards || [];
    var missAll = allReq.filter(function (id) { return have.indexOf(id) < 0; });
    if (missAll.length) {
      console.warn('[왜냐면 과학실] ending reached without confirmations:', missAll);
      UI.banner('아직 확인하지 않은 자료가 있어요.<br><b>남은 확인: ' +
                this.obsNames(missAll) + '</b>', 4200);
    }
    this.state = 'ending-mission';
    /* The ending is the reveal, not another lesson: 왜냐 gets the memory of HOW to
       observe back, so the four cards the player earned are simply read out. The
       old bioscience popup belonged to the microbe book and is no longer opened. */
    UI.fade(true, function () {
      UI.show('scr-intro');
      var endArt = Assets.url('intro_ending_reveal') || artPath('intro_ending_reveal');
      $('#intro-art').style.backgroundImage = endArt ? "url('" + endArt + "')" : 'none';
      $('#intro-eyebrow2').textContent = 'ENDING';
      $('#intro-title2').textContent = '왜냐면 과학실의 진실';
      $('#intro-note2').textContent =
        '확인한 것만 모아 보니, 부풀려진 이야기는 하나도 남지 않았어요. ' +
        '왜냐는 “관찰하는 법”을 다시 기억해 냈습니다. 그날, 아무도 다치지 않았어요.';
      UI.fade(false);
      Audio_.music('lab');
      setTimeout(function () { self.finishEnding(); }, 4200);
    });
  },

  finishEnding: function () {
    var self = this;
    GA.once('ending', 'game_complete', {
      game_name: 'wenyam_science_1', completed_levels: Level.ORDER.length,
      character: W.SM.currentCharacter || 'unknown'
    });
    if (!Save.has('badges', 'badge_truthroom_guardian') && GA.BADGE.badge_truthroom_guardian) {
      GA.once('badge:badge_truthroom_guardian', 'unlock_achievement',
              { achievement_id: GA.BADGE.badge_truthroom_guardian });
    }
    Save.add('badges', 'badge_truthroom_guardian');
    Save.progress.endingDone = true;
    Save.progress.score = this.score;
    Save.progress.orbs = this.orbs;
    Save.saveProgress();
    UI.fade(true, function () {
      self.state = 'ending';
      UI.show('scr-ending');
      self.buildEnding();
      UI.fade(false);
      Audio_.music('lab');
      Audio_.sfx('final');
    });
  },

  buildEnding: function () {
    var BADGE = {
      badge_fungi_researcher: '균류 연구자',
      badge_protist_researcher: '원생생물 연구자',
      badge_bacteria_researcher: '세균 연구자',
      badge_balance_guardian: '균형의 수호자',
      badge_bio_innovator: '생명 과학 혁신가',
      badge_labroom_guardian: '과학실 지킴이',
      badge_backyard_guardian: '뒤뜰 관찰자',
      badge_chatspace_guardian: '사실 확인러',
      badge_truthroom_guardian: '진실의 목격자'
    };
    var br = $('#ending-badges'); br.innerHTML = '';
    Save.progress.badges.forEach(function (b) {
      var f = document.createElement('figure');
      var im = document.createElement('img');
      im.alt = '';
      var bsrc = Assets.url(b) || artPath(b);
      im.onerror = function () { im.onerror = null; im.style.display = 'none'; };
      if (bsrc) im.src = bsrc; else im.style.display = 'none';
      var fc = document.createElement('figcaption');
      fc.textContent = BADGE[b] || b;
      f.appendChild(im); f.appendChild(fc);
      br.appendChild(f);
    });

    /* The closing beat of book 1: the four things that were actually confirmed,
       stated plainly, against the rumours they replaced. This is the payoff for
       every pipe room the player went into. */
    $('#ending-cases').innerHTML = [
      { t: '<b>금 간 유리</b>는 만지지 않고 선생님께 알렸어요.' },
      { t: '<b>야외 활동</b>은 장갑을 끼고, 미리 알리고, 손을 씻었어요.' },
      { t: '<b>소문</b>은 확인해 보니 대부분 사실이 아니었어요.' },
      { t: '<b>다친 곳</b>은 씻고, 알리고, 안내에 따라 치료받았어요.' }
    ].map(function (c) {
      return '<div class="case case-text"><p>' + c.t + '</p></div>';
    }).join('');
    void medicineCardHTML;   // kept for the legacy microbe ending; unused here

    /* Only THIS book's cards are listed. Level.CARDS still holds the microbe cards
       so old saves resolve, but showing them here would present a child with eight
       locked cards from a game they never played. */
    var LIST = (Level.FINAL_OBS && Level.FINAL_OBS.length)
      ? Level.FINAL_OBS : Object.keys(Level.CARDS);
    var cr = $('#ending-cards'); cr.innerHTML = '';
    LIST.forEach(function (k) {
      var c = Level.CARDS[k];
      if (!c) return;
      if (Save.has('cards', k)) {
        var f = document.createElement('figure');
        var im = document.createElement('img');
        im.alt = '';
        var csrc = Assets.url(c.img) || artPath(c.img);
        im.onerror = function () {
          im.onerror = null;
          // no artwork: keep the caption, drop the frame
          im.style.display = 'none';
          f.classList.add('card-noart');
        };
        if (csrc) im.src = csrc;
        else { im.style.display = 'none'; f.classList.add('card-noart'); }
        var fc = document.createElement('figcaption');
        fc.textContent = c.name;
        f.appendChild(im); f.appendChild(fc);
        cr.appendChild(f);
      } else {
        // name + where to find it, instead of an anonymous '?'
        var f2 = document.createElement('figure');
        f2.className = 'card-locked';
        f2.innerHTML = '<div class="miss">🔒</div><figcaption><b>' + c.name +
                       '</b><span>' + (c.where || '') + '</span></figcaption>';
        cr.appendChild(f2);
      }
    });
    var totalCards = LIST.length;
    var got = LIST.filter(function (k) { return Save.has('cards', k); }).length;
    var note = $('#ending-cards-note');
    if (note) {
      note.textContent = (got >= totalCards)
        ? '네 가지를 모두 확인했습니다!'
        : '아직 남은 확인 카드는 월드 선택에서 다시 얻을 수 있어요.';
      note.className = 'cards-note' + (got >= totalCards ? ' all' : '');
    }
    $('#ending-stats').innerHTML = '최종 점수 <b>' + this.score + '</b> · 되찾은 기억 조각 <b>' + this.orbs +
      '</b> · 확인 카드 <b>' + got + '/' + totalCards + '</b>';
  },

  /* ---------- pause ---------- */
  pause: function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Input.clear();
    UI.openOverlay('scr-pause');
    Audio_.duck(true);
    this.syncToggles();
  },
  /* an explicit restart/quit is a real 'did not finish' signal */
  abandonLevel: function () {
    var lv = GA.LEVEL[this.stageId];
    if (lv && !GA.sent('lvend:' + this.stageId)) {
      GA.event('level_end', { level_name: lv, success: false });
    }
  },

  syncToggles: function () {
    U.$$('#scr-pause .toggles .btn').forEach(function (b) {
      if (b.dataset.act === 'music') b.textContent = '음악: ' + (Save.settings.musicOn ? '켜짐' : '꺼짐');
      if (b.dataset.act === 'sfx') b.textContent = '효과음: ' + (Save.settings.sfxOn ? '켜짐' : '꺼짐');
    });
  },
  pauseMenu: function (a) {
    var self = this;
    if (a === 'resume') { UI.closeOverlay('scr-pause'); this.state = 'playing'; Audio_.duck(false); Input.clear(); }
    else if (a === 'retry-cp') {
      UI.closeOverlay('scr-pause'); Audio_.duck(false);
      this.state = 'playing'; this.world.player.die();
    }
    else if (a === 'retry-stage') {
      UI.closeOverlay('scr-pause'); Audio_.duck(false);
      this.abandonLevel();
      this.checkpoint = null; this.returnTo = null;
      this.startStage(this.stageId, false);
    }
    else if (a === 'to-title') {
      UI.closeOverlay('scr-pause'); Audio_.duck(false);
      this.abandonLevel();
      this.toTitle();
    }
    else if (a === 'music') {
      Save.settings.musicOn = !Save.settings.musicOn; Save.saveSettings(); Audio_.applySettings(); this.syncToggles();
    }
    else if (a === 'sfx') {
      Save.settings.sfxOn = !Save.settings.sfxOn; Save.saveSettings(); Audio_.applySettings(); this.syncToggles();
    }
    void self;
  },

  /* ---------- per-stage scripted beats ---------- */
  tickStage: function (dt) {
    var w = this.world;
    if (!w) return;
    var p = w.player, def = w.def;

    // stage 1 — decomposition opens the dead-wood wall (only after the mission)
    if (def.id === 's1' && this.wallX != null && w.flags.humidity && !w.flags.decomposed) {
      if (p.x > this.wallX - 74) {
        w.flags.decomposed = true;
        w.openGateNear(this.wallX - 8, { c: '#c9d98a' });
        UI.banner('균사가 자라 <b>죽은 나무를 분해</b>했어요. 균류는 죽은 생물을 분해해요.', 4600);
      }
    }
    // stage 2 — the water reddens toward the polluted end, and clears once shut off
    if (def.id === 's2') {
      var k = U.clamp((p.x / w.pxw - 0.42) / 0.3, 0, 1);
      if (w.flags.purified) {
        this._clearK = U.approach(this._clearK == null ? k : this._clearK, 0, dt * 0.5);
        k = this._clearK;
      }
      w.tint = k > 0.02 ? { c: '#ff3a2a', a: 0.20 * k } : null;
    }
    // stage 4 — the imbalance error core guards the final core
    if (def.boss && !this.bossSpawned) {
      var goal = null;
      w.ents.forEach(function (e) { if (e.taken !== undefined && e.active !== undefined) goal = e; });
      if (goal && p.x > goal.x - 150) {
        this.bossSpawned = true;
        w.boss = new Play.Boss(goal.x + 40, goal.y - 54, w);   // was -96 (6 tiles up)
        goal.active = false;
        Audio_.sfx('hurt');
        w.shake = 8;
        /* Copy comes from the stage's own boss config, so 진실의 방 can talk about a
           rumour while the legacy 균형 코어 keeps its original wording. */
        var bc = (typeof def.boss === 'object') ? def.boss : {};
        UI.goal.show({
          id: 'boss',
          title: bc.title || '균형 오류 코어를 멈추세요.',
          how: bc.how || '발판에서 뛰어 위에서 밟으세요.',
          next: bc.next || '생명의 균형이 회복돼요.',
          now: 0, total: bc.hp || 3,
          hints: bc.hints || ['양쪽 발판 위로 올라가면 더 쉽게 밟을 수 있어요.',
                              '오류체는 잠시 뒤 사라져요. 무리하지 말고 기다려도 돼요.']
        });
        UI.banner(bc.intro ||
          '오염과 불균형으로 생긴 <b>균형 오류 코어</b>예요! 발판에서 뛰어 위에서 세 번 밟아 주세요.', 4800);
      }
    }
  },

  /* ---------- main loop ---------- */
  loop: function (now) {
    requestAnimationFrame(this.loop);
    var dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    var x = this.ctx;

    this.syncTouch();
    // Belt-and-braces UI scaling: resize events and ResizeObserver can both be
    // missed (or deferred) around rotation, which left the HUD scaled wrong and
    // clipped. Re-check ~3x/sec; resize() no-ops unless the value actually changed.
    if ((this._rzTick = (this._rzTick || 0) + 1) % 20 === 0) this.resize();

    // hide the interact prompt unless something asked for it this frame
    if (!this.promptShown) {
      $('#prompt').classList.add('hidden');
      var ab = $('#t-act'); if (ab) ab.classList.remove('on');
    }
    this.promptShown = false;

    if (!this.labelShown) $('#status-label').classList.add('hidden');
    this.labelShown = false;

    if (this.state === 'playing') this.updateObsGate();

    if (this.state === 'menu') {
      // the title screen is the key art + real DOM buttons; nothing to render here.
      // Enter/Space anywhere starts the game, matching the artwork's own button.
      if (Input.hit('confirm') || Input.hit('jump')) {
        var sb = $('#btn-start');
        if (sb && !sb.disabled && !UI.anyOverlay()) sb.click();
      }
    } else if (this.state === 'charselect') {
      // ← → walks the three cards, Enter/Space confirms. Same screen works by
      // mouse, touch and keyboard, so a classroom PC without a mouse still starts.
      if (!UI.anyOverlay()) this.charSelectNav();
    } else if (this.state === 'playing') {
      if (Input.hit('pause')) this.pause();
      this.world.update(dt);
      this.tickStage(dt);
      x.setTransform(this._rs, 0, 0, this._rs, 0, 0);
      this.world.draw(x);
      this.updateHUD();
    } else if (this.state === 'paused' || this.state === 'mission') {
      x.setTransform(this._rs, 0, 0, this._rs, 0, 0);
      if (this.world) this.world.draw(x);
      if (this.state === 'paused') {
        UI.menuNav('#pause-menu');
        if (Input.hit('pause')) this.pauseMenu('resume');
      } else if (this.missionCtx && this.missionCtx.key) this.missionCtx.key(Input);
    } else if (this.state === 'stageClear' || this.state === 'ending' || this.state === 'ending-mission') {
      x.setTransform(this._rs, 0, 0, this._rs, 0, 0);
      if (this.world && this.state === 'stageClear') this.world.draw(x);
      if (this.missionCtx && this.missionCtx.key) this.missionCtx.key(Input);
    }
    Input.flush();
  },

};

W.SM.Game = Game;
W.addEventListener('DOMContentLoaded', function () { Game.boot(); });
})(window);
