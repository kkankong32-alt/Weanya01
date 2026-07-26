/* ===== 왜냐면 과학실 — engine: physics, entities, camera, render =====
   Physics constants derive from the publicly documented SMB player-physics chart
   (jdaster64 / TASVideos / SDA), retuned to px-per-second for a 16px-tile,
   delta-time game: two-tier speed-dependent jump, 4-tile standing / 5-tile running.
*/
(function (W) {
'use strict';
var U = W.SM.U, Art = W.SM.Art, Audio_ = W.SM.Audio, Input = W.SM.Input, Save = W.SM.Save;

var TILE = 16, VW = 384, VH = 216;

/* Styled artwork sizes in GAME px (the PNGs are baked at 3x for crispness).
   Kept in one place so the drawn art and the collision boxes stay in step. */
/* Only the HEIGHT of each entry is used — fit() takes the width from the artwork's
   own trimmed ink, so nothing here can stretch a sprite. Heights are in game px
   against a 16px tile and a ~40px child.

   These were all inherited from the original game, where the explorer was 31px.
   Next to a 40px child the same numbers read as miniature furniture, so the props
   the player actually walks up to are scaled up to match: a beacon and a portal
   should be at least as tall as the child standing beside them.
   (`pipe` is listed for the no-artwork fallback only — the real tube is sized to
   its 2-tile mouth in Pipe.draw.) */
/* Prop heights are CHILD-RELATIVE, using the multipliers 슈퍼마이크로 shipped with
   (its explorer was 31px: beacon 42 = 1.35x, terminal 28 = 0.90x, and so on). Those
   proportions were visually settled in a finished game, so reusing them stops the
   sizes being re-guessed every time the character scale changes — and if IDLE_H is
   ever retuned, every prop follows automatically.
   Absolute values are derived below; the numbers written here are only the fallback
   used when the character atlas has not loaded. */
var PROP_MUL = {
  checkpoint: 1.355, terminal: 0.903, 'switch': 0.774, console: 0.839,
  portal_base: 0.881, portal_ring: 0.958, shroom: 1.161, orb: 0.558,
  pipe_w: 0.926          // the tube's WIDTH, not its height (see Pipe.draw)
};

/* ---------- deliberate widening ----------
   The styled props are drawn on tall narrow canvases: the beacon's ink is 440x990
   (ratio 0.44) and the tube's is 402x1007 (0.40), both slimmer than the child at
   0.36... which is to say they read as lampposts rather than as chunky machines.
   Nothing about the drawing code causes that — it is the artwork's own proportion.

   So this is an explicit horizontal stretch, applied to WIDTH only, to make the
   props read as solid objects. It is a distortion and it is meant to be: the
   alternative is redrawing the source art wider. Set to 1 for pixel-faithful
   proportions. Hazards and the player are never touched by it. */
var PROP_FAT = 1.28;
var PIPE_FAT = 1.34;

/* The tube's mouth is drawn in perspective, so the TOP of its artwork is the far
   edge of the rim ellipse and the near lip sits lower. Standing exactly on the
   artwork's top edge therefore looks like hovering over the hole. Lifting the art
   by a fraction of its height seats the player on the middle of the rim instead,
   where a real foot would be. Purely cosmetic — the collision top never moves. */
var PIPE_RIM_LIFT = 0.075;

var ST = {
  orb: [16, 17.3], shroom: [36, 36], pipe: [24, 60], checkpoint: [24, 54],
  console: [30, 34], terminal: [18, 36], 'switch': [18, 31],
  portal_base: [39, 35], portal_ring: [38, 38],
  spore: [18, 17.3], redtide: [18, 18.3], dataerr: [17, 16.7],
  /* 왜냐면 과학실 hazards. These art keys carry no 'st_' prefix, so they are looked
     up under their full name — see HAZARD_ART below.

     Only the HEIGHT is used (fit() takes the width from the art's trimmed ink), and
     these heights are chosen so the drawn sprite stays close to the hitbox in ETYPE.
     That matters most for the glass: its artwork is a wide low spread (ink 774x424),
     so a height picked for a tall sprite would paint glass across ground that is
     actually safe to stand on — the one hazard where a misleading silhouette would
     teach the wrong lesson. Erring slightly wide is deliberate and forgiving; the
     hitbox is always the smaller of the two. */
  hazard_glassshard_styled: [24, 13],   // ink 1.83:1 -> ~23.8 x 13  (hitbox 17x14)
  hazard_ember_styled:      [14, 12],   // ink 1.14:1 -> ~13.7 x 12  (hitbox 11x11)
  hazard_fallingjar_styled: [15, 15],   // ink 0.98:1 -> ~14.6 x 15  (hitbox 11x13)
  hazard_rumor_styled:      [26, 21]    // ink 1.26:1 -> ~26.5 x 21  (hitbox 22x18)
};

var K = {
  MIN_WALK: 5, MAX_WALK: 90, MAX_RUN: 150,
  ACCEL_WALK: 220, ACCEL_RUN: 320,
  FRICTION: 275, SKID: 700, SKID_FLIP: 34,
  ACCEL_AIR: 200, AIR_TURN: 300,

  JUMP_FAST_AT: 138,
  JUMP_V: 340, G_HELD: 900, G_REL: 2400, G_FALL: 1800,
  JUMP_V_F: 425, G_HELD_F: 1125, G_REL_F: 3000, G_FALL_F: 2250,
  TERMINAL: 460,
  SUBSTEP: 7,                       // px — max movement per collision substep

  COYOTE: 0.10, BUFFER: 0.12, CORNER: 4,
  STOMP_MIN_FALL: 60, STOMP_TOL: 4, STOMP_GROW: 2, DMG_SHRINK: 2,
  INVULN: 1.8,
  BOUNCE: 190, BOUNCE_HELD: 300,
  SHROOM_BOUNCE: 400, BUBBLE_BOUNCE: 330,

  CAM_DZ_W: 44, CAM_DZ_H: 38, CAM_LOOK: 46, CAM_LOOK_T: 0.35,
  CAM_K: 8, CAM_KV: 5,

  BUMP_H: 6, BUMP_T: 0.20,
  PIPE_SPEED: 60, PIPE_PAUSE: 0.45,

  PW: 11, PH: 20                     // player hitbox
};

/* water (stage 2) makes everything a touch floatier */
var WATER_MUL = { g: 0.72, term: 0.6, jump: 0.92 };

/* Drawn width of the transit tube. The opening is 2 tiles (32px); 36 lets the tube
   cover it with a little to spare so no background shows beside the mouth. Height
   follows the artwork's own ratio, so the tube is never stretched. */
var PIPE_W = 36;

/* How far a ground-resting hazard beds INTO the floor, in game px.
   Aligning its bounding box exactly with the tile top is not enough: a floor tile
   is drawn with a 1px dark outline along its top edge and the light surface only
   begins below that, so a sprite whose last row lands on the outline reads as
   hovering over the ground. Sinking it a couple of pixels puts the base inside the
   visible surface, which is what "resting on the floor" actually looks like.
   Collision is untouched — this is a drawing offset only. */
var SIT_SINK = 2.5;

/* Character abilities are read through here, never baked into K. If the cast
   module has not loaded, every lookup returns the neutral default, so the game
   plays exactly as it did before characters existed. */
function charStat(name, dflt) {
  var C = W.SM && W.SM.Char;
  return C ? C.stat(name, dflt) : dflt;
}

/* ================= STYLED SPRITE TRIMMING =================
   The ST table above states sizes for TIGHTLY CROPPED artwork — that is what the
   original prop sheets were. The 왜냐면 과학실 props are exported on big padded
   canvases instead: the transit tube's ink is about 395x955 inside an 896x1200
   file, and the hazards sit in the middle of 1024x1024. Drawing those files
   straight into an ST box would both squash them (wrong aspect) and shrink the
   visible prop (most of the box is empty).

   So every styled draw goes through fit(): the opaque bounding box is measured
   once per image and cached, and the sprite is then sized by ST's HEIGHT with the
   ink's own aspect ratio. That means export padding stops mattering, the existing
   composition numbers keep working, and no asset needs hand-tuned sizes.

   If the pixels cannot be read (a tainted canvas on file://) it degrades to using
   the whole image and the literal ST size — the old behaviour. */
var trimCache = {};
function trimBox(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  var key = img.src;
  if (key in trimCache) return trimCache[key];
  var box = null;
  try {
    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    var c2 = cv.getContext('2d');
    c2.drawImage(img, 0, 0);
    var d = c2.getImageData(0, 0, cv.width, cv.height).data;
    var minX = cv.width, maxX = -1, minY = cv.height, maxY = -1;
    for (var y = 0; y < cv.height; y++) {
      var row = y * cv.width * 4;
      for (var x = 0; x < cv.width; x++) {
        if (d[row + x * 4 + 3] > 12) {          // ignore antialiasing haze
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  } catch (e) {
    console.warn('[왜냐면 과학실] 스프라이트 여백을 측정할 수 없어 원본 크기로 그립니다:', e.message);
    box = null;
  }
  trimCache[key] = box;
  return box;
}

/* Height a prop should be drawn at: the child's on-screen height times this prop's
   multiplier, so the scene keeps one consistent sense of scale. Falls back to the
   literal ST height before the character art is available. */
function propHeight(key, sz) {
  var mul = PROP_MUL[key];
  var PA = W.SM.PlayerAtlas;
  if (mul && PA && PA.resolve) {
    var r = PA.resolve(W.SM.currentCharacter, 'idle');
    if (r && r.frames.length) return r.frames[0].gh * mul;
  }
  return sz[1];
}

/* -> { sx, sy, sw, sh, w, h } : source rect in the file, destination size in game px
   `key` is the ST name, used to look up the child-relative multiplier. */
function fit(img, sz, key) {
  var h = key ? propHeight(key, sz) : sz[1];
  var b = trimBox(img);
  var fat = key ? PROP_FAT : 1;
  if (!b) {
    return { sx: 0, sy: 0, sw: img.naturalWidth || sz[0], sh: img.naturalHeight || sz[1],
             w: sz[0] * (h / sz[1]) * fat, h: h };
  }
  return { sx: b.x, sy: b.y, sw: b.w, sh: b.h, w: h * (b.w / b.h) * fat, h: h };
}

/* ================= WORLD ================= */
function World(built, gameRef) {
  this.L = built;
  this.def = built.def;
  this.game = gameRef;
  this.grid = built.grid;
  this.meta = built.meta;
  this.w = built.w; this.h = built.h;
  this.pxw = built.pxw; this.pxh = built.pxh;
  this.water = !!built.def.water;

  this.ents = [];
  this.parts = [];
  this.bumps = [];        // {c,r,t}
  this.time = 0;
  this.flags = {};        // mission/gate state
  this.shake = 0;
  this.tint = null;

  this.mask = [];
  this.remask();

  var self = this;
  built.ents.forEach(function (e) { self.spawnEnt(e); });

  this.player = new Player(built.spawn.x, built.spawn.y, this);
  this.cam = { x: 0, y: 0, look: 0 };
  this.snapCam();
}

World.prototype.remask = function () {
  // neighbour-openness mask for tile art (1=up,2=right,4=down,8=left)
  for (var r = 0; r < this.h; r++) {
    if (!this.mask[r]) this.mask[r] = [];
    for (var c = 0; c < this.w; c++) {
      var s = this.grid[r][c] === 1 || this.grid[r][c] === 3;
      if (!s) { this.mask[r][c] = -1; continue; }
      var m = 0;
      if (!this.solidAt(c, r - 1)) m |= 1;
      if (!this.solidAt(c + 1, r)) m |= 2;
      if (!this.solidAt(c, r + 1)) m |= 4;
      if (!this.solidAt(c - 1, r)) m |= 8;
      this.mask[r][c] = m;
    }
  }
};
World.prototype.solidAt = function (c, r) {
  if (r < 0 || r >= this.h || c < 0 || c >= this.w) return false;
  var v = this.grid[r][c];
  return v === 1 || v === 3;
};
World.prototype.tile = function (c, r) {
  if (r < 0 || r >= this.h || c < 0 || c >= this.w) return 0;
  return this.grid[r][c];
};
World.prototype.setTile = function (c, r, v, m) {
  if (r < 0 || r >= this.h || c < 0 || c >= this.w) return;
  this.grid[r][c] = v; this.meta[r][c] = m || undefined;
  for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
    var rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= this.h || cc < 0 || cc >= this.w) continue;
    var s = this.grid[rr][cc] === 1 || this.grid[rr][cc] === 3;
    if (!s) { this.mask[rr][cc] = -1; continue; }
    var mk = 0;
    if (!this.solidAt(cc, rr - 1)) mk |= 1;
    if (!this.solidAt(cc + 1, rr)) mk |= 2;
    if (!this.solidAt(cc, rr + 1)) mk |= 4;
    if (!this.solidAt(cc - 1, rr)) mk |= 8;
    this.mask[rr][cc] = mk;
  }
};

World.prototype.spawnEnt = function (e) {
  var o = null;
  switch (e.k) {
    case 'orb': o = new Orb(e.x, e.y, e.v, e.big); break;
    case 'enemy': o = new Enemy(e.x, e.y, e.type, this, e.spMul); break;
    case 'shroom': o = new Shroom(e.x, e.y); break;
    case 'bubble': o = new Bubble(e.x, e.y); break;
    case 'mplat': o = new MPlat(e.x, e.y, e.axis, e.range); break;
    case 'fplat': o = new FPlat(e.x, e.y); break;
    case 'checkpoint': o = new Checkpoint(e.x, e.y); break;
    case 'goal': o = new Goal(e.x, e.y, this); break;
    case 'pipe': o = new Pipe(e.x, e.y, e.id, e.warp); break;
    case 'device': o = new Device(e, this); break;
  }
  if (o) { o.world = this; this.ents.push(o); }
  return o;
};

World.prototype.snapCam = function () {
  var p = this.player;
  this.cam.x = U.clamp(p.x + p.w / 2 - VW / 2, 0, Math.max(0, this.pxw - VW));
  this.cam.y = U.clamp(p.y + p.h / 2 - VH / 2, 0, Math.max(0, this.pxh - VH));
};

World.prototype.particles = function (x, y, n, opt) {
  opt = opt || {};
  for (var i = 0; i < n; i++) {
    var a = opt.dir != null ? opt.dir + U.rand(-0.6, 0.6) : U.rand(0, 6.283);
    var sp = U.rand(opt.spMin || 30, opt.spMax || 110);
    this.parts.push({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
      life: opt.life || U.rand(0.25, 0.6), t: 0,
      c: opt.c || '#fff', r: opt.r || U.rand(0.8, 2), g: opt.g == null ? 260 : opt.g
    });
  }
};

World.prototype.bump = function (c, r) { this.bumps.push({ c: c, r: r, t: 0 }); };
World.prototype.bumpAt = function (c, r) {
  for (var i = 0; i < this.bumps.length; i++) if (this.bumps[i].c === c && this.bumps[i].r === r) return this.bumps[i];
  return null;
};

/* ---------- gates: brick walls opened by missions ---------- */
World.prototype.openGateNear = function (x, opts) {
  // dissolve the nearest brick wall to the right of x
  var startC = Math.floor(x / TILE), found = null;
  for (var c = startC; c < Math.min(this.w, startC + 40) && !found; c++) {
    for (var r = 0; r < this.h; r++) {
      var m = this.meta[r][c];
      if (this.grid[r][c] === 3 && m && m.t === 'brick' && !m.obsgate) { found = c; break; }
    }
  }
  if (found == null) return false;
  var self = this, n = 0;
  for (var cc = found; cc < Math.min(this.w, found + 4); cc++) {
    var any = false;
    for (var rr = 0; rr < this.h; rr++) {
      var mm = this.meta[rr][cc];
      if (this.grid[rr][cc] === 3 && mm && mm.t === 'brick' && !mm.obsgate) {
        (function (cx, ry, d) {
          setTimeout(function () {
            self.setTile(cx, ry, 0);
            self.particles(cx * TILE + 8, ry * TILE + 8, 6,
              { c: opts && opts.c || '#c9d98a', life: 0.5, up: 40 });
          }, d);
        })(cc, rr, n * 45);
        n++; any = true;
      }
    }
    if (!any) break;
  }
  Audio_.sfx('grow');
  return true;
};

/* ---------- observation gate ----------
   Opens only when this stage's observation cards are in hand. Same dissolve
   language as the mission gates so it reads as "the wall you already know",
   just triggered by learning instead of by a switch. */
World.prototype.obsGateTiles = function () {
  var out = [];
  for (var c = 0; c < this.w; c++) {
    for (var r = 0; r < this.h; r++) {
      var m = this.meta[r][c];
      if (m && m.obsgate && this.grid[r][c] === 3) out.push({ c: c, r: r });
    }
  }
  return out;
};
World.prototype.obsGateX = function () {
  var t = this.obsGateTiles();
  if (!t.length) return null;
  var min = t[0].c;
  for (var i = 1; i < t.length; i++) if (t[i].c < min) min = t[i].c;
  return min * TILE;
};
World.prototype.highlightPipe = function (pipe, secs) {
  if (pipe) pipe.hi = secs || 4;
};
World.prototype.openObsGate = function () {
  var tiles = this.obsGateTiles();
  if (!tiles.length) return false;
  var self = this, i = 0;
  // bottom-up so it reads as the wall lifting rather than crumbling at random
  tiles.sort(function (a, b) { return (b.r - a.r) || (a.c - b.c); });
  tiles.forEach(function (t) {
    setTimeout(function () {
      self.setTile(t.c, t.r, 0);
      self.particles(t.c * TILE + 8, t.r * TILE + 8, 6,
        { c: '#7ff0ff', life: 0.55, up: 46 });
    }, i * 42);
    i++;
  });
  this.shake = 5;
  Audio_.sfx('grow');
  return true;
};

/* ---------- hyphae bridge (stage 1 required mission) ---------- */
World.prototype.growBridge = function (fromX) {
  var startC = Math.floor(fromX / TILE);
  var row = -1, c;
  // find the ground row just right of the device
  for (var r = 0; r < this.h; r++) if (this.solidAt(startC, r)) { row = r; break; }
  if (row < 0) row = 15;
  // walk right to find the gap, then fill until ground resumes
  var c0 = -1, c1 = -1;
  for (c = startC; c < this.w; c++) {
    if (!this.solidAt(c, row)) { c0 = c; break; }
  }
  if (c0 < 0) return false;
  for (c = c0; c < this.w; c++) { if (this.solidAt(c, row)) { c1 = c; break; } }
  if (c1 < 0) c1 = this.w;
  var self = this, i = 0;
  for (c = c0; c < c1; c++) {
    (function (cx, d) {
      setTimeout(function () {
        self.setTile(cx, row, 2);                     // semi-solid hyphae walkway
        self.particles(cx * TILE + 8, row * TILE + 6, 5,
          { c: '#fffbe9', life: 0.5, up: 30, r: 1.4 });
        if (Save.settings.sfxOn) Audio_.sfx('orb');
      }, d);
    })(c, i * 55);
    i++;
  }
  Audio_.sfx('grow');
  return true;
};

/* ================= PLAYER ================= */
function Player(x, y, world) {
  this.world = world;
  this.x = x; this.y = y; this.w = K.PW; this.h = K.PH;
  this.vx = 0; this.vy = 0;
  this.face = 1;
  this.grounded = false; this.wasGrounded = false;
  this.coyote = 0; this.buffer = 0; this.jumpHeld = false; this.jumping = false;
  this.anim = 'idle'; this.at = 0; this.frame = 0;
  this.skid = false;
  this.invuln = 0; this.hp = 3;
  this.state = 'play';          // play | pipe | hurt | dead | clear | frozen
  this.pipeT = 0; this.pipeRef = null;
  this.landT = 0;
  this.onRope = false;
  this.carry = null;
  this.prevBottom = y + this.h;
  this.clearT = 0;
}

Player.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };

Player.prototype.hurt = function (fatal) {
  if (this.invuln > 0 || this.state !== 'play') return;

  /* Hearts stay integers, but the COST of a hit is per-character. 용감희 pays 1.3
     per hit, and the cost charged is the change in the rounded running total —
     1.3 -> 1 heart, 2.6 -> 3 hearts — so two hits end a life instead of three.
     A full bar means a fresh life (respawn, checkpoint, new stage all just set
     hp = 3), which is why the accumulator resets itself here rather than at each
     of those call sites. */
  var mul = charStat('heartPenaltyMul', 1);
  if (this.hp >= 3) this._dmgAcc = 0;
  var before = Math.round(this._dmgAcc || 0);
  this._dmgAcc = (this._dmgAcc || 0) + mul;
  this.hp -= Math.max(1, Math.round(this._dmgAcc) - before);
  if (this.hp < 0) this.hp = 0;

  Audio_.sfx(this.hp <= 0 || fatal ? 'die' : 'hurt');
  if (this.hp <= 0) { this.die(); return; }
  this.invuln = K.INVULN;
  this.vy = -170; this.vx = -this.face * 90;
  this.state = 'hurt'; this.hurtT = 0.28;
  this.world.shake = 6;
};
Player.prototype.die = function () {
  if (this.state === 'dead') return;
  this.state = 'dead'; this.deadT = 0; this._deadFired = false;
  this.vy = -260; this.vx = 0;
  this.onRope = false; this.carry = null;
  Audio_.sfx('die');
};

Player.prototype.update = function (dt) {
  var w = this.world;
  this.wasGrounded = this.grounded;
  this.prevBottom = this.y + this.h;

  if (this.state === 'dead') {
    this.deadT += dt;
    this.vy += 1400 * dt;
    this.y += this.vy * dt;
    // latched: without this it re-fires every frame and stacks respawn callbacks
    if (this.deadT > 1.1 && !this._deadFired) { this._deadFired = true; w.game.onPlayerDead(); }
    return;
  }
  if (this.state === 'clear') { this.clearT += dt; this.anim = 'clear'; this.animate(dt); return; }
  if (this.state === 'pipe') { this.updatePipe(dt); return; }
  if (this.state === 'frozen') { this.vx = 0; this.animate(dt); return; }

  if (this.invuln > 0) this.invuln -= dt;
  if (this.state === 'hurt') {
    this.hurtT -= dt;
    if (this.hurtT <= 0) this.state = 'play';
  }

  var canControl = this.state === 'play';
  var left = canControl && Input.down('left');
  var right = canControl && Input.down('right');
  var run = canControl && Input.down('run');
  var dir = (right ? 1 : 0) - (left ? 1 : 0);

  /* ---- rope climbing (해캄 strands) ----
     On a strand: jump/up climbs, down descends, left/right steps off. */
  var cx = Math.floor((this.x + this.w / 2) / TILE);
  var cyT = Math.floor((this.y + this.h / 2) / TILE);
  var onRopeTile = w.tile(cx, cyT) === 4;
  if (!this.onRope && onRopeTile && canControl && !this.grounded &&
      (Input.down('jump') || Input.down('down') || this.vy > 40)) {
    this.onRope = true; this.vy = 0; this.vx = 0;
  }
  if (this.onRope) {
    if (!onRopeTile || !canControl) {
      this.onRope = false;
    } else if (dir !== 0) {
      // step off sideways
      this.onRope = false;
      this.vx = dir * 70; this.vy = -60; this.face = dir;
    } else {
      var climb = 0;
      if (Input.down('jump')) climb = -66;
      else if (Input.down('down')) climb = 84;
      this.vy = climb; this.vx = 0;
      this.y += this.vy * dt;
      this.x = U.lerp(this.x, cx * TILE + 8 - this.w / 2, 1 - Math.exp(-14 * dt));
      this.anim = 'crouch';
      this.at += dt;
      if (climb && Math.random() < 0.06) {
        w.particles(this.x + this.w / 2, this.y + this.h / 2, 1,
          { c: '#fffbe9', life: .4, spMin: 5, spMax: 18, g: 0, r: 1 });
      }
      // landing off the bottom of a strand
      if (this.y + this.h > (cyT + 1) * TILE + 8 && w.solidAt(cx, cyT + 2)) this.onRope = false;
      return;
    }
  }

  /* ---- horizontal ----
     speedMul raises the CAP only. Acceleration, friction and every jump constant
     are untouched, so 용감희 covers ground faster without the movement feeling
     like a different game. */
  var spMul = charStat('speedMul', 1);
  var maxSp = (run ? K.MAX_RUN : K.MAX_WALK) * spMul;
  this.skid = false;
  if (dir !== 0) {
    var opposing = (dir > 0 && this.vx < 0) || (dir < 0 && this.vx > 0);
    var a;
    if (this.grounded) {
      if (opposing) { a = K.SKID; this.skid = Math.abs(this.vx) > K.SKID_FLIP; }
      else a = run ? K.ACCEL_RUN : K.ACCEL_WALK;
    } else {
      a = opposing ? K.AIR_TURN : K.ACCEL_AIR;
    }
    this.vx = U.approach(this.vx, dir * maxSp, a * dt);
    if (!this.skid) this.face = dir;
  } else if (this.grounded) {
    this.vx = U.approach(this.vx, 0, K.FRICTION * dt);
    if (Math.abs(this.vx) < K.MIN_WALK) this.vx = 0;
  }
  // running lets you exceed walk cap; releasing run decays back down
  var walkCap = K.MAX_WALK * spMul;
  if (!run && Math.abs(this.vx) > walkCap && this.grounded) {
    this.vx = U.approach(this.vx, Math.sign(this.vx) * walkCap, K.FRICTION * dt);
  }

  /* ---- current zones ---- */
  var m = w.meta[U.clamp(cyT, 0, w.h - 1)][U.clamp(cx, 0, w.w - 1)];
  if (w.tile(cx, cyT) === 5 && m) {
    this.x += m.dir * 46 * dt;
    if (Math.random() < 0.10) w.particles(this.x + U.rand(0, this.w), this.y + U.rand(0, this.h), 1,
      { c: 'rgba(180,240,255,.85)', life: 0.5, spMin: 10, spMax: 30, g: 0, r: 1 });
  }

  /* ---- jump: buffer + coyote ---- */
  if (canControl && Input.hit('jump')) this.buffer = K.BUFFER;
  if (this.buffer > 0) this.buffer -= dt;
  if (this.grounded) this.coyote = K.COYOTE;
  else if (this.coyote > 0) this.coyote -= dt;

  if (this.buffer > 0 && this.coyote > 0 && canControl) {
    var fast = Math.abs(this.vx) >= K.JUMP_FAST_AT;
    var jv = fast ? K.JUMP_V_F : K.JUMP_V;
    if (w.water) jv *= WATER_MUL.jump;
    this.vy = -jv;
    this.jumping = true; this.jumpHeld = true;
    this.grounded = false; this.coyote = 0; this.buffer = 0;
    this.carry = null;
    Audio_.sfx('jump');
    w.particles(this.x + this.w / 2, this.y + this.h, 5,
      { c: 'rgba(255,255,255,.7)', dir: 1.57, life: 0.3, spMin: 20, spMax: 50, g: 40 });
  }
  if (!Input.down('jump')) this.jumpHeld = false;

  /* ---- gravity (two-tier, speed-dependent) ---- */
  var isFast = Math.abs(this.vx) >= K.JUMP_FAST_AT;
  var gr;
  if (this.vy < 0) gr = this.jumpHeld ? (isFast ? K.G_HELD_F : K.G_HELD) : (isFast ? K.G_REL_F : K.G_REL);
  else gr = isFast ? K.G_FALL_F : K.G_FALL;
  if (w.water) gr *= WATER_MUL.g;
  this.vy += gr * dt;
  var term = w.water ? K.TERMINAL * WATER_MUL.term : K.TERMINAL;
  if (this.vy > term) this.vy = term;

  /* ---- move + collide (substepped) ---- */
  this.moveAndCollide(dt);

  /* ---- fell out of the world ---- */
  if (this.y > w.pxh + 40) this.die();

  /* ---- anim ---- */
  if (this.landT > 0) this.landT -= dt;
  if (!this.wasGrounded && this.grounded) {
    this.landT = 0.12;
    Audio_.sfx('land');
    w.particles(this.x + this.w / 2, this.y + this.h, 6,
      { c: 'rgba(255,255,255,.55)', life: 0.28, spMin: 20, spMax: 70, g: 60 });
  }
  if (this.state === 'hurt') this.anim = 'hurt';
  else if (!this.grounded) {
    // rising / hanging at the top / falling each get their own artwork pose
    if (this.vy < -55) this.anim = 'jump';
    else if (this.vy > 70) this.anim = 'fall';
    else this.anim = 'apex';
  }
  else if (this.landT > 0) this.anim = 'land';
  else if (this.skid) this.anim = 'skid';
  else if (Math.abs(this.vx) > 8) this.anim = 'run';
  else if (canControl && Input.down('down')) this.anim = 'crouch';
  else this.anim = 'idle';
  this.animate(dt);
};

Player.prototype.animate = function (dt) {
  // run is the only true cycle; its length comes from whichever atlas is actually
  // being drawn — the selected character's own sheet, or the shared legacy one
  var PA = W.SM.PlayerAtlas, n = 6;
  if (PA && PA.resolve) {
    var own = PA.resolve(W.SM.currentCharacter, 'run');
    if (own) n = own.frames.length;
  }
  this.at += dt;
  if (this.anim !== 'run') { this.frame = 0; this.at = 0; return; }
  var rate = Math.max(0.052, 0.15 - Math.abs(this.vx) / 1900);   // faster feet at speed
  if (this.at >= rate) { this.at -= rate; this.frame = (this.frame + 1) % n; }
  if (this.frame >= n) this.frame = 0;
};

Player.prototype.moveAndCollide = function (dt) {
  var w = this.world;
  var dx = this.vx * dt, dy = this.vy * dt;
  // carry with moving platform
  if (this.carry && this.carry.dead !== true) dx += this.carry.dx || 0;
  var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / K.SUBSTEP));
  var sx = dx / steps, sy = dy / steps;
  this.grounded = false;
  for (var i = 0; i < steps; i++) {
    this.stepX(sx);
    this.stepY(sy);
  }
  this.x = U.clamp(this.x, 0, w.pxw - this.w);
};

Player.prototype.stepX = function (dx) {
  if (!dx) return;
  var w = this.world;
  this.x += dx;
  var r = this.rect();
  var c0 = Math.floor(r.x / TILE), c1 = Math.floor((r.x + r.w - 0.01) / TILE);
  var r0 = Math.floor(r.y / TILE), r1 = Math.floor((r.y + r.h - 0.01) / TILE);
  for (var rr = r0; rr <= r1; rr++) {
    for (var cc = c0; cc <= c1; cc++) {
      if (!w.solidAt(cc, rr)) continue;
      if (dx > 0) this.x = cc * TILE - this.w;
      else this.x = (cc + 1) * TILE;
      this.vx = 0;
      return;
    }
  }
};

Player.prototype.stepY = function (dy) {
  var w = this.world;
  var prevB = this.y + this.h;
  this.y += dy;
  var r = this.rect();
  var c0 = Math.floor(r.x / TILE), c1 = Math.floor((r.x + r.w - 0.01) / TILE);
  var rr, cc;

  if (dy >= 0) {
    // falling: solid + semi-solid
    var rb = Math.floor((r.y + r.h - 0.01) / TILE);
    for (cc = c0; cc <= c1; cc++) {
      var t = w.tile(cc, rb);
      var hit = false;
      if (t === 1 || t === 3) hit = true;
      else if (t === 2) {
        // semi-solid: only from above, and only if we were above it last step
        var top = rb * TILE;
        if (prevB <= top + 1.5 && !Input.down('down')) hit = true;
      }
      if (hit) {
        this.y = rb * TILE - this.h;
        this.vy = 0; this.grounded = true; this.carry = null;
        return;
      }
    }
  } else {
    // rising: head bump
    var rt = Math.floor(r.y / TILE);
    // hidden blocks are empty until your head finds them
    for (cc = c0; cc <= c1; cc++) {
      var hm = w.meta[rt] && w.meta[rt][cc];
      if (hm && hm.t === 'hidden' && !hm.shown && w.tile(cc, rt) === 0) {
        hm.shown = true;
        w.setTile(cc, rt, 1, { t: 'hidden', shown: true });
        w.bump(cc, rt);
        Audio_.sfx('bump');
        this.y = (rt + 1) * TILE; this.vy = 30;
        var o = w.spawnEnt({ k: 'orb', x: cc * TILE + 8, y: rt * TILE - 4, v: 1 });
        if (o) o.pop();
        w.particles(cc * TILE + 8, rt * TILE, 10, { c: '#fff6cf', life: .5, up: 70 });
        w.game.toast('숨은 블록 발견!');
        return;
      }
    }
    for (cc = c0; cc <= c1; cc++) {
      if (!w.solidAt(cc, rt)) continue;
      // corner correction: if only one side clips, nudge around it
      var centerC = Math.floor((this.x + this.w / 2) / TILE);
      if (cc !== centerC) {
        var push = cc < centerC ? 1 : -1;
        var freeC = cc + (push > 0 ? 1 : -1);
        void freeC;
        var nx = this.x + push * K.CORNER;
        var okc0 = Math.floor(nx / TILE), okc1 = Math.floor((nx + this.w - 0.01) / TILE);
        var clear = true;
        for (var k = okc0; k <= okc1; k++) if (w.solidAt(k, rt)) clear = false;
        if (clear) { this.x = nx; return; }
      }
      this.y = (rt + 1) * TILE;
      this.vy = 30;
      this.headBump(cc, rt);
      return;
    }
  }
};

Player.prototype.headBump = function (c, r) {
  var w = this.world, m = w.meta[r] && w.meta[r][c];
  if (!m) { Audio_.sfx('bump'); return; }
  w.bump(c, r);
  var wx = c * TILE + 8, wy = r * TILE;
  if (m.t === 'capsule' || m.t === 'spore' || m.t === 'data') {
    Audio_.sfx('bump');
    // orbs burst out of the block on the same frame (game-time, so pausing is safe)
    var n = m.t === 'capsule' ? 3 : 2;
    for (var i = 0; i < n; i++) {
      var o = w.spawnEnt({ k: 'orb', x: wx, y: wy - 3, v: 1 });
      if (o) o.pop((i - (n - 1) / 2) * 34, 0.42 + i * 0.07);
    }
    w.setTile(c, r, 1, { t: 'used' });
    w.particles(wx, wy, 8, { c: '#ffe08a', life: 0.4, up: 60 });
  } else if (m.t === 'brick') {
    Audio_.sfx('bump');
  } else Audio_.sfx('bump');
};

/* ---- pipe entry / exit ---- */
Player.prototype.enterPipe = function (pipe) {
  this.state = 'pipe'; this.pipeT = 0; this.pipeRef = pipe; this.pipeMode = 'in';
  this.vx = 0; this.vy = 0; this.anim = 'enter';
  this.x = pipe.x + TILE - this.w / 2;
  Audio_.sfx('pipe');
};
Player.prototype.updatePipe = function (dt) {
  this.pipeT += dt;
  if (this.pipeMode === 'in') {
    this.y += K.PIPE_SPEED * dt;
    if (this.pipeT > (TILE * 2) / K.PIPE_SPEED + K.PIPE_PAUSE) {
      this.world.game.doWarp(this.pipeRef);
      this.state = 'frozen';
    }
  }
  this.animate(dt);
};

/* ================= ENTITIES ================= */
function Orb(x, y, v, big) {
  this.x = x; this.y = y; this.v = v || 1; this.big = !!big;
  this.w = big ? 12 : 9; this.h = this.w;
  this.t = Math.random() * 6.28; this.dead = false;
  this.popping = 0; this.baseY = y;
}
/* burst up out of a bumped block, then auto-collect (SMB's coin-pop beat) */
Orb.prototype.pop = function (vx, life) {
  this.popping = life || 0.5; this.vy = -178; this.vxp = vx || 0;
};
Orb.prototype.update = function (dt, w) {
  this.t += dt * 5;
  if (this.popping > 0) {
    this.popping -= dt;
    this.vy += 900 * dt;
    this.y += this.vy * dt;
    this.x += (this.vxp || 0) * dt;
    if (this.popping <= 0) {
      this.dead = true;
      w.game.addOrb(this, true);
      w.particles(this.x, this.y, 5, { c: '#eaffc4', life: 0.35, up: 30, r: 1.2 });
    }
    return;
  }
  var p = w.player;
  var r = { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  if (U.aabb(r, p.rect()) && p.state !== 'dead') { this.dead = true; w.game.addOrb(this); }
};
Orb.prototype.draw = function (x, cam) {
  var A = W.SM.Assets;
  var img = A.img('st_orb');
  var s = this.big ? 1.5 : 1;
  var bob = this.popping > 0 ? 0 : Math.sin(this.t * 0.5) * 1.3;   // gentle float
  var cx = this.x - cam.x, cy = this.y - cam.y + bob;
  if (img) {
    /* Through fit() so the 기억 조각 keeps its artwork's own proportions — the old
       code forced ST.orb's 16x17.3 box onto whatever image was supplied, which
       would squash a square pickup. Trimming also means export padding cannot
       shrink it. */
    var fo = fit(img, ST.orb);
    var w = fo.w * s, h = fo.h * s;
    // soft glow behind
    x.save();
    x.globalAlpha = 0.28 + Math.sin(this.t * 1.1) * 0.10;
    var g = x.createRadialGradient(cx, cy, 1, cx, cy, w * 0.9);
    g.addColorStop(0, '#c9ff9a'); g.addColorStop(1, 'rgba(160,255,140,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, w * 0.9, 0, 7); x.fill();
    x.restore();
    x.save();
    x.translate(cx, cy);
    x.scale(Math.cos(this.t * 0.5) * 0.12 + 0.98, 1);     // slow turn
    x.drawImage(img, fo.sx, fo.sy, fo.sw, fo.sh, -w / 2, -h / 2, w, h);
    x.restore();
  } else {
    var f = A.orb[Math.floor(this.t) % A.orb.length];
    x.drawImage(f, cx - 6 * s, cy - 6 * s, 12 * s, 12 * s);
  }
};

function Shroom(x, y) { this.x = x; this.y = y; this.w = 32; this.h = 18; this.sq = 0; }
Shroom.prototype.update = function (dt, w) {
  if (this.sq > 0) this.sq -= dt * 4;
  var p = w.player;
  var top = { x: this.x + 3, y: this.y + 1, w: this.w - 6, h: 6 };
  if (p.vy >= 0 && U.aabb(top, p.rect()) && p.prevBottom <= this.y + 8) {
    p.y = this.y + 1 - p.h;
    p.vy = -(Input.down('jump') ? K.SHROOM_BOUNCE : K.SHROOM_BOUNCE * 0.72);
    p.jumping = true; p.jumpHeld = Input.down('jump'); p.grounded = false;
    this.sq = 1; Audio_.sfx('bounce');
    w.particles(this.x + 16, this.y + 2, 8, { c: '#ffd9cf', life: .4, up: 60 });
  }
};
Shroom.prototype.draw = function (x, cam) {
  var A = W.SM.Assets, img = A.img('st_shroom');
  if (!img) {
    x.drawImage(A.props.shroom[this.sq > 0 ? 1 : 0], this.x - cam.x, this.y - cam.y, 32, 18);
    return;
  }
  var w = ST.shroom[0], h = ST.shroom[1];
  var cx = this.x + this.w / 2 - cam.x;
  var capTop = this.y + 1 - cam.y;          // the art's top edge IS the bounce surface
  var k = Math.max(0, this.sq);             // 1 -> fully squashed, decays to 0
  var sy = 1 - k * 0.32, sx = 1 + k * 0.16;
  x.save();
  x.translate(cx, capTop);
  x.scale(sx, sy);                          // squash about the cap top, so the
  x.drawImage(img, -w / 2, 0, w, h);        // contact surface never moves
  x.restore();
};

function Bubble(x, y) { this.x = x; this.y = y; this.t = Math.random() * 6.28; this.pop = 0; }
Bubble.prototype.update = function (dt, w) {
  this.t += dt * 2;
  if (this.pop > 0) { this.pop -= dt; return; }
  var p = w.player;
  var r = { x: this.x - 7, y: this.y - 7, w: 14, h: 14 };
  if (p.vy >= 0 && U.aabb(r, p.rect()) && p.prevBottom <= this.y) {
    p.y = this.y - 6 - p.h;
    p.vy = -K.BUBBLE_BOUNCE * (Input.down('jump') ? 1 : 0.75);
    p.grounded = false; p.jumpHeld = Input.down('jump');
    this.pop = 1.4; Audio_.sfx('bounce');
    w.particles(this.x, this.y, 10, { c: 'rgba(190,250,255,.9)', life: .5 });
  }
};
Bubble.prototype.draw = function (x, cam) {
  if (this.pop > 0) return;
  var A = W.SM.Assets;
  var f = A.props.bubble[Math.floor(this.t * 2) % 2];
  var bob = Math.sin(this.t) * 2;
  x.drawImage(f, this.x - cam.x - 8, this.y - cam.y - 8 + bob, 16, 16);
};

function MPlat(x, y, axis, range) {
  this.x = x; this.y = y; this.ox = x; this.oy = y;
  this.w = 48; this.h = 10; this.axis = axis; this.range = range;
  this.t = Math.random() * 6.28; this.dx = 0; this.dy = 0;
}
MPlat.prototype.update = function (dt, w) {
  this.t += dt * 1.1;
  var px = this.x, py = this.y;
  if (this.axis === 'x') this.x = this.ox + Math.sin(this.t) * this.range;
  else this.y = this.oy + Math.sin(this.t) * this.range;
  this.dx = this.x - px; this.dy = this.y - py;
  var p = w.player;
  var top = { x: this.x + 2, y: this.y, w: this.w - 4, h: 5 };
  if (p.vy >= 0 && p.state !== 'dead' && U.aabb(top, p.rect()) && p.prevBottom <= this.y + 6) {
    p.y = this.y - p.h; p.vy = 0; p.grounded = true; p.carry = this;
    p.y += this.dy;
  } else if (p.carry === this) {
    var still = U.aabb({ x: this.x - 1, y: this.y - 2, w: this.w + 2, h: 8 },
                       { x: p.x, y: p.y + p.h - 3, w: p.w, h: 4 });
    if (!still) p.carry = null;
  }
};
MPlat.prototype.draw = function (x, cam) {
  x.drawImage(W.SM.Assets.props.mplat, Math.round(this.x - cam.x), Math.round(this.y - cam.y), 48, 10);
};

function FPlat(x, y) {
  this.x = x; this.y = y; this.oy = y; this.w = 32; this.h = 8;
  this.state = 0; this.t = 0; this.vy = 0; this.dx = 0; this.dy = 0; this.respawn = 0;
}
FPlat.prototype.update = function (dt, w) {
  var p = w.player;
  if (this.state === 0) {
    var top = { x: this.x + 1, y: this.y, w: this.w - 2, h: 5 };
    if (p.vy >= 0 && U.aabb(top, p.rect()) && p.prevBottom <= this.y + 6) {
      p.y = this.y - p.h; p.vy = 0; p.grounded = true; p.carry = this;
      this.state = 1; this.t = 0;
    }
  } else if (this.state === 1) {
    this.t += dt;
    var top2 = { x: this.x + 1, y: this.y, w: this.w - 2, h: 5 };
    if (p.vy >= 0 && U.aabb(top2, p.rect()) && p.prevBottom <= this.y + 6) {
      p.y = this.y - p.h; p.vy = 0; p.grounded = true; p.carry = this;
    }
    if (this.t > 0.5) { this.state = 2; this.vy = 0; if (p.carry === this) p.carry = null; }
  } else if (this.state === 2) {
    this.vy += 700 * dt; this.y += this.vy * dt;
    this.respawn += dt;
    if (this.respawn > 2.2) { this.state = 0; this.y = this.oy; this.vy = 0; this.respawn = 0; }
  }
};
FPlat.prototype.draw = function (x, cam) {
  var sh = this.state === 1 ? Math.sin(this.t * 45) * 1.1 : 0;
  var a = this.state === 2 ? Math.max(0, 1 - this.respawn) : 1;
  x.save(); x.globalAlpha = a;
  var c = W.SM.Assets.props.mplat;
  x.drawImage(c, Math.round(this.x - cam.x + sh), Math.round(this.y - cam.y), 32, 8);
  x.restore();
};

function Checkpoint(x, y) { this.x = x; this.y = y; this.on = false; this.t = 0; }
Checkpoint.prototype.update = function (dt, w) {
  this.t += dt;
  if (this.on) return;
  var p = w.player;
  if (U.aabb({ x: this.x, y: this.y - 24, w: 16, h: 56 }, p.rect())) {
    this.on = true;
    w.game.setCheckpoint(this.x, this.y);
    Audio_.sfx('checkpoint');
    w.game.toast('체크포인트!');
    w.particles(this.x + 8, this.y, 18, { c: '#8ee63f', life: .8, up: 90 });
  }
};
Checkpoint.prototype.draw = function (x, cam) {
  var A = W.SM.Assets, img = A.img('st_checkpoint');
  var cx = this.x - cam.x + 8, base = this.y - cam.y + 16;
  if (!img) {
    x.drawImage(A.props.flag[this.on ? 1 : 0], cx - 8, base - 40, 16, 40);
    return;
  }
  var fb = fit(img, ST.checkpoint, 'checkpoint'), w = fb.w, h = fb.h;
  // glow pool under an active beacon
  if (this.on) {
    x.save();
    x.globalAlpha = 0.3 + Math.sin(this.t * 4) * 0.14;
    var g = x.createRadialGradient(cx, base - 2, 1, cx, base - 2, 20);
    g.addColorStop(0, '#8ee63f'); g.addColorStop(1, 'rgba(142,230,63,0)');
    x.fillStyle = g; x.fillRect(cx - 22, base - 24, 44, 26);
    x.restore();
  }
  x.save();
  // dim + desaturated until reached, bright once it saves
  if (!this.on) x.filter = 'grayscale(0.85) brightness(0.72)';
  var bob = this.on ? Math.sin(this.t * 3) * 0.6 : 0;
  x.drawImage(img, fb.sx, fb.sy, fb.sw, fb.sh, cx - w / 2, base - h + bob, w, h);
  x.restore();
  if (this.on) {
    x.save();
    x.globalAlpha = 0.5 + Math.sin(this.t * 5) * 0.3;
    x.fillStyle = '#d8ffb0';
    x.beginPath(); x.arc(cx, base - h + 6 + bob, 3.2, 0, 7); x.fill();
    x.restore();
  }
};

function Goal(x, y, world) {
  this.x = x; this.y = y; this.t = 0; this.active = !(world.def.boss); this.taken = false;
  this.world = world;                 // draw() needs it to read the observation lock
}
Goal.prototype.update = function (dt, w) {
  this.t += dt;
  if (!this.active || this.taken) return;
  var p = w.player;
  if (p.state !== 'play') return;
  if (U.aabb({ x: this.x - 6, y: this.y - 40, w: 28, h: 72 }, p.rect())) {
    /* Locked until this stage's observation cards are in. Deliberately does NOT
       set taken, block movement or damage: the player just walks away, reads what
       is missing, and takes the pipe standing right next to them. */
    if (w.game.goalObsDone && !w.game.goalObsDone(w.def.id)) { w.game.blockGoal(); return; }
    this.taken = true;
    w.game.onGoal();
  }
};
/* true once every card this EXIT needs is in hand — drives the lock/unlock glow.
   goalObsDone, not obsDone: 진실의 방's door asks for all four confirmations, so the
   padlock has to reflect the same rule the collision check uses. */
Goal.prototype.unlocked = function (w) {
  return !(w.game.goalObsDone && !w.game.goalObsDone(w.def.id));
};
Goal.prototype.draw = function (x, cam) {
  var A = W.SM.Assets;
  var base = A.img('st_portal_base'), ring = A.img('st_portal_ring');
  var cx = this.x - cam.x + 8, ground = this.y - cam.y + 16;
  /* "open" means BOTH gates are clear: the boss (stage 4) and this stage's
     observations. The dormant/blazing pair below already reads as locked vs
     unlocked, so the observation lock just joins it — no new effect, no extra
     blinking. */
  var open = this.active && this.unlocked(this.world);
  if (!base || !ring) {
    var f = A.props.goal[Math.floor(this.t * 5) % 3];
    x.save(); if (!open) x.globalAlpha = 0.35;
    x.drawImage(f, cx - 14, ground - 56, 28, 56); x.restore();
    return;
  }
  var fbase = fit(base, ST.portal_base, 'portal_base'), fring = fit(ring, ST.portal_ring, 'portal_ring');
  var bw = fbase.w, bh = fbase.h;
  var rw = fring.w, rh = fring.h;
  var ringCy = ground - bh * 0.55 - rh * 0.42;

  // an inactive portal is visibly dormant; an active one blazes
  if (open && !this.taken) {
    x.save();
    x.globalAlpha = 0.3 + Math.sin(this.t * 3) * 0.14;
    var g = x.createRadialGradient(cx, ringCy, 2, cx, ringCy, 40);
    g.addColorStop(0, '#7ff0ff'); g.addColorStop(1, 'rgba(127,240,255,0)');
    x.fillStyle = g; x.fillRect(cx - 42, ringCy - 42, 84, 84);
    x.restore();
  }
  // spinning ring
  x.save();
  x.translate(cx, ringCy);
  x.rotate(open ? this.t * 1.6 : this.t * 0.25);
  var pul = open ? 1 + Math.sin(this.t * 4) * 0.06 : 0.86;
  x.scale(pul, pul);
  if (!open) x.filter = 'grayscale(0.8) brightness(0.55)';
  x.globalAlpha = open ? 1 : 0.5;
  x.drawImage(ring, fring.sx, fring.sy, fring.sw, fring.sh, -rw / 2, -rh / 2, rw, rh);
  x.restore();
  // base
  x.save();
  if (!open) x.filter = 'grayscale(0.7) brightness(0.65)';
  x.drawImage(base, fbase.sx, fbase.sy, fbase.sw, fbase.sh, cx - bw / 2, ground - bh, bw, bh);
  x.restore();
  // locked padlock hint
  if (!open) {
    x.save();
    x.globalAlpha = 0.75;
    x.fillStyle = '#dbe6f0'; x.strokeStyle = '#2b3a4a'; x.lineWidth = 0.9;
    Art.rr(x, cx - 3.5, ringCy - 2, 7, 6, 1.2); x.fill(); x.stroke();
    x.beginPath(); x.arc(cx, ringCy - 2, 2.6, Math.PI, 0); x.stroke();
    x.restore();
  }
};

function Pipe(x, y, id, warp) { this.x = x; this.y = y; this.id = id; this.warp = warp; this.t = 0; }
Pipe.prototype.update = function (dt, w) {
  this.t += dt;
  if (this.hi > 0) this.hi -= dt;
  if (!this.warp) return;
  var p = w.player;
  if (p.state !== 'play' || !p.grounded) { this.near = false; return; }
  var mouth = { x: this.x + 8, y: this.y - 6, w: 16, h: 8 };
  var near = U.aabb(mouth, { x: p.x, y: p.y + p.h - 4, w: p.w, h: 6 });
  this.near = near;
  if (near) {
    w.game.showPrompt(this.x + 16, this.y - 8, '↓');
    if (Input.down('down')) p.enterPipe(this);
  }
};
Pipe.prototype.draw = function (x, cam) {
  var A = W.SM.Assets, img = A.img('st_pipe');
  var dx = this.x - cam.x, dy = this.y - cam.y;
  if (img) {
    /* The WHOLE tube, at its own proportions — the same way 슈퍼마이크로 drew it.
       Cropping the art to a stub was a mistake: the mouth row sits exactly one tile
       above the floor, so only ~16px of the pipe is ever visible above ground no
       matter how the art is cut. What matters is that those 16px are the rim, and
       that the tube is wide enough to fill its 2-tile opening.

       Width therefore drives the size (PIPE_W, a little over the 32px mouth so no
       sliver of background shows beside it) and the height follows the artwork's
       ratio. The body runs down through the floor tiles, which is where a pipe body
       belongs. */
    var b = trimBox(img);
    /* 슈퍼마이크로 drew the tube 28.7 wide beside a 31px explorer; that same
       child-relative width is the base. HEIGHT comes from the base width so that
       widening the tube does not also lengthen it, then the width is fattened on
       its own — the tube gets chunkier, not taller. */
    var baseW = Math.max(TILE * 2 + 3, propHeight('pipe_w', [0, PIPE_W]));
    var ph = b ? baseW * (b.h / b.w) : ST.pipe[1];
    var pw = baseW * PIPE_FAT;
    var px0 = dx + TILE - pw / 2;
    var py0 = dy - ph * PIPE_RIM_LIFT;      // seat the player on the rim, not behind it
    if (b) x.drawImage(img, b.x, b.y, b.w, b.h, px0, py0, pw, ph);
    else x.drawImage(img, px0, py0, pw, ph);
  } else {
    x.drawImage(A.props.pipe, dx, dy, 32, 16);
  }
  if (this.warp) {
    /* Briefly flare when the gate sends the player back, so "the pipe behind you"
       is something they can actually spot rather than a direction to guess at. */
    if (this.hi > 0) {
      x.save();
      x.globalAlpha = 0.5 + Math.sin(this.t * 10) * 0.35;
      var hg = x.createRadialGradient(dx + 16, dy + 2, 2, dx + 16, dy + 2, 40);
      hg.addColorStop(0, '#ffe58a'); hg.addColorStop(1, 'rgba(255,229,138,0)');
      x.fillStyle = hg; x.fillRect(dx - 26, dy - 38, 84, 78);
      x.restore();
    }
    x.save();
    x.globalAlpha = 0.35 + Math.sin(this.t * 3) * 0.2;
    var g = x.createRadialGradient(dx + 16, dy + 4, 1, dx + 16, dy + 4, 12);
    g.addColorStop(0, '#bfffe0'); g.addColorStop(1, 'rgba(120,255,200,0)');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(dx + 16, dy + 4, 11, 5, 0, 0, 7); x.fill();
    x.restore();
    // downward chevron so the entrance reads as enterable
    x.save();
    x.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3;
    x.strokeStyle = '#eafff5'; x.lineWidth = 1.4;
    var ay = dy - 7 + Math.sin(this.t * 4) * 1.2;
    x.beginPath(); x.moveTo(dx + 12, ay); x.lineTo(dx + 16, ay + 4); x.lineTo(dx + 20, ay); x.stroke();
    x.restore();
  }
};

/* ---------- device (science prop / mission trigger) ---------- */
function Device(e, world) {
  this.x = e.x; this.y = e.y;
  this.kind = e.kind; this.img = e.img; this.mission = e.mission;
  this.w = e.w || 20; this.h = e.h || 22;
  this.deco = !!e.deco;
  this.status = e.status || null;      // linked read-out, never a mission opener
  this.world = world;                  // draw() needs it to read live mission state
  this.done = false; this.t = Math.random() * 6.28; this.near = false;
  this.puffs = [];
}
/* true only while the console this device is wired to has its popup open */
Device.prototype.isRunning = function () {
  if (!this.status || this.done) return false;
  var g = this.world && this.world.game;
  return !!(g && g.missionCtx && g.missionCtx.id === 'humidity');
};
Device.prototype.update = function (dt, w) {
  this.t += dt;
  if (this.deco) return;

  /* A status device reports; it never opens anything. It gets a plain label so
     walking up to it is not a dead end, but no ↓ prompt and no touch-button glow
     — those would promise an interaction that does not exist. */
  if (this.status) {
    var pl = w.player;
    if (pl.state !== 'play') { this.near = false; return; }
    var sr = { x: this.x + 8 - this.w / 2 - 10, y: this.y + 16 - this.h - 6,
               w: this.w + 20, h: this.h + 12 };
    this.near = U.aabb(sr, pl.rect()) && pl.grounded;
    if (this.near) {
      w.game.showLabel(this.x + 8, this.y + 16 - this.h - 4,
        this.done ? '환기 장치 작동 중' : '왼쪽 조절 장치와 연결됨', this.done);
    }
    return;
  }

  if (!this.mission) return;
  var p = w.player;
  if (p.state !== 'play') { this.near = false; this._fired = false; return; }
  // generous reach: the whole body of the prop plus a tile either side
  var r = { x: this.x + 8 - this.w / 2 - 10, y: this.y + 16 - this.h - 6,
            w: this.w + 20, h: this.h + 12 };
  this.near = U.aabb(r, p.rect()) && p.grounded;
  if (this.near && !this.done) {
    w.game.showPrompt(this.x + 8, this.y + 16 - this.h - 4, '↓');
    // held (not hit) so approaching with ↓ already down still works; latched so it fires once
    if (Input.down('down')) {
      if (!this._fired) { this._fired = true; w.game.openMission(this.mission, this); }
    } else this._fired = false;
  } else if (!this.near) this._fired = false;
};
/* which styled prop stands in for each device role */
var DEVICE_ART = {
  humidity: 'st_console', vent: 'st_switch', scope: 'st_terminal',
  valve: 'st_switch', cpipe: 'st_console', classify: 'st_terminal',
  ferment: 'st_console', purify: 'st_switch', purifytile: 'st_terminal',
  fungicore: 'st_terminal', fermcore: 'st_console', seacore: 'st_switch',
  moldcore: 'st_console', deco: 'st_terminal',
  /* 왜냐면 과학실 확인실 consoles. st_console is the evidence board — the right
     object for a room where you sort what is confirmed from what is guessed. */
  verify_glass: 'st_console', verify_gloves: 'st_console',
  verify_witness: 'st_console', verify_firstaid: 'st_console'
};

Device.prototype.draw = function (x, cam) {
  var A = W.SM.Assets;
  var key = DEVICE_ART[this.kind] || 'st_console';
  var img = A.img(key);
  var cx = this.x + 8 - cam.x, base = this.y + 16 - cam.y;

  /* Status devices report the linked console's state, so they must never wear the
     amber "press me" pulse — that is the mission target's signature. Three
     distinct looks: idle (weak, slow amber), running (busy cyan flicker), done
     (steady green). */
  var running = this.isRunning();

  if (this.status) {
    x.save();
    if (this.done) {
      x.globalAlpha = 0.34 + Math.sin(this.t * 2.2) * 0.06;   // steady, not blinking
      var gs = x.createRadialGradient(cx, base - 14, 2, cx, base - 14, 26);
      gs.addColorStop(0, '#8ee63f'); gs.addColorStop(1, 'rgba(142,230,63,0)');
      x.fillStyle = gs; x.fillRect(cx - 28, base - 42, 56, 48);
    } else if (running) {
      x.globalAlpha = 0.30 + Math.sin(this.t * 9) * 0.14;     // busy flicker
      var gr = x.createRadialGradient(cx, base - 14, 2, cx, base - 14, 24);
      gr.addColorStop(0, '#7fe8ff'); gr.addColorStop(1, 'rgba(127,232,255,0)');
      x.fillStyle = gr; x.fillRect(cx - 26, base - 40, 52, 46);
    } else {
      x.globalAlpha = 0.10 + Math.sin(this.t * 1.5) * 0.05;   // weak, clearly idle
      var gi = x.createRadialGradient(cx, base - 14, 2, cx, base - 14, 20);
      gi.addColorStop(0, '#ffa63d'); gi.addColorStop(1, 'rgba(255,166,61,0)');
      x.fillStyle = gi; x.fillRect(cx - 22, base - 38, 44, 44);
    }
    x.restore();
  } else if (this.done) {                // completed devices hum green
    x.save();
    x.globalAlpha = 0.28 + Math.sin(this.t * 3) * 0.14;
    var g = x.createRadialGradient(cx, base - 10, 2, cx, base - 10, 26);
    g.addColorStop(0, '#8ee63f'); g.addColorStop(1, 'rgba(142,230,63,0)');
    x.fillStyle = g; x.fillRect(cx - 28, base - 38, 56, 44);
    x.restore();
  } else if (!this.deco && this.mission) {   // pending devices pulse so they read as the target
    x.save();
    x.globalAlpha = 0.22 + Math.sin(this.t * 3.5) * 0.16;
    var g2 = x.createRadialGradient(cx, base - 10, 2, cx, base - 10, 24);
    g2.addColorStop(0, '#ffd76a'); g2.addColorStop(1, 'rgba(255,215,106,0)');
    x.fillStyle = g2; x.fillRect(cx - 26, base - 36, 52, 42);
    x.restore();
  }

  if (img) {
    var fd = fit(img, ST[key.replace('st_', '')] || [this.w, this.h], key.replace('st_', ''));
    var dw = fd.w, dh = fd.h;
    x.save();
    if (this.deco) {
      /* Scenery props share the same artwork as the real mission consoles, so at
         full strength kids walked up and pressed ↓ on the furniture. Pushed back
         in size, colour and opacity: still readable as a lab, no longer a target. */
      x.globalAlpha = 0.62;
      x.filter = 'saturate(.6) brightness(.82)';
      dw *= 0.85; dh *= 0.85;
    } else if (this.status && !this.done && !running) {
      x.filter = 'brightness(.7) saturate(.55)';               // powered down
    } else if (!this.done) {
      x.filter = 'brightness(.88) saturate(.85)';
    }
    // a running vent physically shudders; idle and finished ones sit still
    var shake = running ? Math.sin(this.t * 34) * 0.5 : 0;
    x.drawImage(img, fd.sx, fd.sy, fd.sw, fd.sh, cx - dw / 2 + shake, base - dh, dw, dh);
    x.restore();
  } else {
    x.save();
    if (this.deco) x.globalAlpha = 0.62;
    x.fillStyle = this.done ? '#8ee63f' : '#5a6b7d';
    Art.rr(x, cx - this.w / 2, base - this.h, this.w, this.h, 3); x.fill();
    x.restore();
  }

  /* Air actually moving is what sells "the vent is working" from across the
     screen — the glow alone reads as just another lamp. */
  if (this.status && (running || this.done)) {
    var topY = base - (ST[key.replace('st_', '')] || [0, this.h])[1];
    x.save();
    var pc = this.done ? '142,230,63' : '127,232,255';
    for (var pi = 0; pi < 3; pi++) {
      var ph = (this.t * (running ? 1.5 : 0.8) + pi / 3) % 1;
      x.globalAlpha = (1 - ph) * (running ? 0.55 : 0.4);
      var py = topY + 2 - ph * 16;
      var px2 = cx + Math.sin((ph + pi) * 5.5) * 5;
      x.fillStyle = 'rgba(' + pc + ',1)';
      x.beginPath(); x.arc(px2, py, 1.5 - ph * 0.9, 0, 6.28); x.fill();
    }
    // core spins only while the console is being operated
    if (running) {
      x.globalAlpha = 0.9;
      x.strokeStyle = '#7fe8ff'; x.lineWidth = 1.1;
      var ccy = topY + 8, rr = 3.2, an = this.t * 7;
      for (var bi = 0; bi < 3; bi++) {
        var a1 = an + bi * 2.094;
        x.beginPath(); x.moveTo(cx, ccy);
        x.lineTo(cx + Math.cos(a1) * rr, ccy + Math.sin(a1) * rr); x.stroke();
      }
    }
    x.restore();
  }

  if (!this.done && !this.deco && this.mission) {
    var ay = base - (ST[key.replace('st_', '')] || [0, this.h])[1] - 5 + Math.sin(this.t * 4) * 1.4;
    x.save();
    x.globalAlpha = 0.65 + Math.sin(this.t * 4) * 0.3;
    x.fillStyle = '#ffd76a'; x.strokeStyle = '#5a3a00'; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(cx - 3.5, ay - 4); x.lineTo(cx + 3.5, ay - 4); x.lineTo(cx, ay + 1.5);
    x.closePath(); x.fill(); x.stroke();
    x.restore();
  }
};

/* ---------- enemies ---------- */
var ETYPE = {
  sporeblob: { w: 13, h: 12, sp: 26, gravity: true, stomp: true, art: 'sporeblob', flat: true },
  moldball:  { w: 12, h: 12, sp: 52, gravity: true, stomp: true, art: 'moldball', roll: true },
  woodchunk: { w: 11, h: 9, sp: 0, gravity: false, stomp: false, art: 'woodchunk', faller: true },
  droplet:   { w: 12, h: 13, sp: 30, gravity: true, stomp: true, art: 'droplet', hop: true },
  redtide:   { w: 14, h: 14, sp: 22, gravity: false, stomp: true, art: 'redtide', drift: true },
  dataerr:   { w: 12, h: 12, sp: 40, gravity: true, stomp: true, art: 'dataerr' },
  overgrow:  { w: 14, h: 12, sp: 18, gravity: true, stomp: true, art: 'overgrow', grow: true },

  /* ---- 왜냐면 과학실 ----
     The safety lesson is carried by the physics, not by a caption:
       glassshard  깨진 유리 — never stompable. There is no "deal with it" move;
                   the only correct answer is to go around, which is exactly what
                   the book teaches. Physics mirror woodchunk (still, no gravity).
       ember       불씨 — rolls like moldball and CAN be put out by stepping on it.
       fallingjar  떨어지는 유리병 — scripted faller, same beat as woodchunk, but it
                   breaks instead of thudding.
       rumor       소문 — drifts like redtide; stomping it IS checking it, so it
                   pops. The one hazard you are meant to meet head-on. */
  glassshard: { w: 17, h: 14, sp: 0,  gravity: false, stomp: false, art: 'hazard_glassshard_styled', still: true, sits: true },
  ember:      { w: 11, h: 11, sp: 46, gravity: true,  stomp: true,  art: 'hazard_ember_styled', roll: true, snuff: true, sits: true },
  fallingjar: { w: 11, h: 13, sp: 0,  gravity: false, stomp: false, art: 'hazard_fallingjar_styled', faller: true, glass: true },
  /* The rumour is the one hazard you are meant to seek out and land on, and it was
     smaller than the decorative bubbles drifting behind it — so the thing to aim at
     read as background. Enlarged in both hitbox and art so it is unmistakably the
     target, and so stomping it is a fair jump rather than a pixel hunt. */
  rumor:      { w: 22, h: 18, sp: 20, gravity: false, stomp: true,  art: 'hazard_rumor_styled', drift: true, verify: true }
};

function Enemy(x, y, type, world, spMul) {
  var d = ETYPE[type];
  this.type = type; this.d = d;
  this.w = d.w; this.h = d.h;
  this.x = x + (16 - d.w) / 2; this.y = y + 16 - d.h;
  // sp is read only here; later turns just flip the sign, so scaling it once
  // is enough to make a single individual permanently slower
  this.vx = -d.sp * (spMul || 1); this.vy = 0;
  this.t = Math.random() * 6.28;
  this.dead = false; this.flat = 0; this.squashT = 0;
  this.oy = this.y; this.ox = this.x;
  this.state = 'idle';
  this.grounded = false;
  this.dropT = U.rand(0, 1.6);
}
Enemy.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };

Enemy.prototype.update = function (dt, w) {
  if (this.dead) return;
  this.t += dt;
  var d = this.d, p = w.player;
  // boss-spawned errors fade out on their own (ttl) — they used to accumulate
  if (this.ttl != null) {
    this.ttl -= dt;
    if (this.ttl <= 0) { this.squashT = 0.34; this.ttl = null; }
  }

  if (this.squashT > 0) {
    this.squashT -= dt;
    if (this.squashT <= 0) this.dead = true;
    return;
  }

  // offscreen sleep (keeps perf + prevents enemies wandering off before you see them)
  if (this.x - w.cam.x < -80 || this.x - w.cam.x > VW + 90) {
    if (!d.faller) return;
  }

  if (d.faller) {
    // falling rotten wood: waits above, drops, resets
    this.dropT -= dt;
    if (this.state === 'idle') {
      this.y = this.oy + Math.sin(this.t * 6) * 0.8;
      if (Math.abs(p.x - this.x) < 26 && this.dropT <= 0) { this.state = 'fall'; this.vy = 0; }
    } else {
      this.vy += 900 * dt; this.y += this.vy * dt;
      var cr = Math.floor((this.y + this.h) / TILE), cc = Math.floor((this.x + this.w / 2) / TILE);
      if (w.solidAt(cc, cr) || this.y > w.pxh) {
        // glass shatters and scatters pale shards; wood just thuds
        if (d.glass) {
          w.particles(this.x + this.w / 2, this.y + this.h, 12,
            { c: '#d3f2ff', life: .55, up: 70, spMax: 150 });
          Audio_.sfx('break');
        } else {
          w.particles(this.x + this.w / 2, this.y + this.h, 7, { c: '#6b4a2c', life: .45, up: 50 });
          Audio_.sfx('bump');
        }
        this.state = 'idle'; this.y = this.oy; this.vy = 0; this.dropT = U.rand(1.4, 2.4);
      }
    }
  } else if (d.drift) {
    this.x = this.ox + Math.sin(this.t * 0.7) * 30;
    this.y = this.oy + Math.cos(this.t * 1.1) * 14;
  } else {
    if (d.hop) {
      if (this.grounded) { this.vy = -180; this.grounded = false; }
    }
    if (d.gravity) { this.vy += 900 * dt; if (this.vy > 380) this.vy = 380; }
    // horizontal with wall/ledge turn
    var nx = this.x + this.vx * dt;
    var side = this.vx > 0 ? nx + this.w + 1 : nx - 1;
    var cSide = Math.floor(side / TILE);
    var rMid = Math.floor((this.y + this.h / 2) / TILE);
    var rFoot = Math.floor((this.y + this.h + 2) / TILE);
    if (w.solidAt(cSide, rMid)) this.vx = -this.vx;
    else if (this.grounded && !w.solidAt(cSide, rFoot) && w.tile(cSide, rFoot) !== 2) this.vx = -this.vx;
    else this.x = nx;

    // vertical
    this.y += this.vy * dt;
    this.grounded = false;
    var c0 = Math.floor(this.x / TILE), c1 = Math.floor((this.x + this.w - 0.01) / TILE);
    if (this.vy >= 0) {
      var rb = Math.floor((this.y + this.h) / TILE);
      for (var cc2 = c0; cc2 <= c1; cc2++) {
        var t = w.tile(cc2, rb);
        if (t === 1 || t === 3 || t === 2) {
          this.y = rb * TILE - this.h; this.vy = 0; this.grounded = true; break;
        }
      }
    }
    if (this.y > w.pxh + 30) { this.dead = true; return; }
  }

  if (d.grow) this.gs = 1 + Math.sin(this.t * 3) * 0.12;

  /* ---- player interaction: stomp vs damage (velocity + prevBottom gates) ---- */
  if (p.state !== 'play' && p.state !== 'hurt') return;
  var er = this.rect();
  if (d.stomp) {
    var stompBox = { x: er.x - K.STOMP_GROW, y: er.y, w: er.w + K.STOMP_GROW * 2, h: Math.max(5, er.h * 0.45) };
    if (p.vy > K.STOMP_MIN_FALL && p.prevBottom <= er.y + K.STOMP_TOL && U.aabb(stompBox, p.rect())) {
      this.stomped(w, p);
      return;
    }
  }
  var dmgBox = { x: er.x + 1, y: er.y + 1, w: er.w - 2, h: er.h - 2 };
  var pr = p.rect();
  var pBox = { x: pr.x + K.DMG_SHRINK, y: pr.y + 1, w: pr.w - K.DMG_SHRINK * 2, h: pr.h - 2 };
  if (U.aabb(dmgBox, pBox)) p.hurt();
};

Enemy.prototype.stomped = function (w, p) {
  var d = this.d;
  p.vy = -(Input.down('jump') ? K.BOUNCE_HELD : K.BOUNCE);
  p.grounded = false; p.jumpHeld = Input.down('jump');
  w.game.addScore(100, this.x + this.w / 2, this.y);

  /* Two of the 왜냐면 과학실 hazards mean something specific when you land on
     them, so they get their own sound and debris rather than the generic squash. */
  if (d.snuff) {                       // 불씨: stepping on it puts it OUT
    Audio_.sfx('splash');
    w.particles(this.x + this.w / 2, this.y + this.h / 2, 12,
      { c: '#c9d3dd', life: .6, up: 40 });
    this.squashT = 0.001;
    return;
  }
  if (d.verify) {                      // 소문: checking it makes it pop
    Audio_.sfx('orb');
    w.particles(this.x + this.w / 2, this.y + this.h / 2, 14,
      { c: '#cdbdf5', life: .55, spMax: 130 });
    w.game.toast('확인했어요! 소문이 사라졌어요');
    this.squashT = 0.001;
    return;
  }

  Audio_.sfx('stomp');
  w.particles(this.x + this.w / 2, this.y + this.h / 2, 10,
    { c: this.type === 'redtide' ? '#ff8a70' : '#dcebA0'.toLowerCase(), life: .5 });
  if (d.flat) { this.squashT = 0.35; this.flat = 1; }
  else { this.squashT = 0.001; }
};

/* Styled artwork for the hazards that appear closest to the player. The 왜냐면
   과학실 entries point at image/hazard_*_styled.png; art.js also bakes code-drawn
   twins under the same names, so a missing PNG costs polish, not the hazard. */
var HAZARD_ART = {
  sporeblob: 'st_spore', redtide: 'st_redtide', dataerr: 'st_dataerr',
  glassshard: 'hazard_glassshard_styled', ember: 'hazard_ember_styled',
  fallingjar: 'hazard_fallingjar_styled', rumor: 'hazard_rumor_styled'
};

Enemy.prototype.draw = function (x, cam) {
  if (this.dead) return;
  var A = W.SM.Assets, d = this.d;

  var styled = HAZARD_ART[this.type] && A.img(HAZARD_ART[this.type]);
  if (styled && !this.flat) {
    var artKey = HAZARD_ART[this.type];
    // 'st_spore' -> 'spore'; the 왜냐면 과학실 keys have no prefix and are looked up
    // whole. Falling back to the hitbox keeps a new hazard drawable without a size.
    var fe = fit(styled, ST[artKey] || ST[artKey.replace(/^st_/, '')] || [this.w, this.h]);
    var sw = fe.w, sh = fe.h;
    var cx = this.x + this.w / 2 - cam.x;
    /* Anchoring. The code-drawn fallback has always put a hazard's BOTTOM on the
       bottom of its hitbox, but this styled path centred the art on the hitbox
       instead — so any artwork shorter than its box hovered above the floor, which
       is what made the glass shards look like they were floating. Hazards that rest
       on the ground (`sits`) are now bottom-anchored to match; the ones that fly,
       drift or drop stay centred, which is right for them. */
    var cy = d.sits
      ? (this.y + this.h + SIT_SINK - cam.y) - sh / 2
      : this.y + this.h / 2 - cam.y;
    // things resting on the floor or dropping under script must not float
    var bob = (d.still || d.faller || d.sits) ? 0 : Math.sin(this.t * 2.2) * 1.1;
    x.save();
    if (this.squashT > 0) x.globalAlpha = Math.max(0, this.squashT / 0.35);
    // data errors glitch-jitter; blobs drift softly
    if (this.type === 'dataerr') {
      cx += Math.round(Math.sin(this.t * 31) * 0.8);
      x.save();
      x.globalAlpha = (x.globalAlpha || 1) * (0.25 + Math.sin(this.t * 6) * 0.12);
      var g = x.createRadialGradient(cx, cy, 1, cx, cy, sw);
      g.addColorStop(0, '#e58aff'); g.addColorStop(1, 'rgba(190,90,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, sw, 0, 7); x.fill();
      x.restore();
    }
    x.translate(cx, cy + bob);
    var s = d.grow && this.gs ? this.gs : 1;
    x.scale(s * (this.vx < 0 ? 1 : -1) * -1, s);   // face travel direction
    x.drawImage(styled, fe.sx, fe.sy, fe.sw, fe.sh, -sw / 2, -sh / 2, sw, sh);
    x.restore();
    return;
  }

  var frames = A.enemies[d.art];
  var f;
  if (this.flat && A.enemies[d.art + '_flat']) f = A.enemies[d.art + '_flat'][0];
  else if (d.roll) f = frames[Math.floor(this.t * 9) % frames.length];
  else f = frames[Math.floor(this.t * 5) % frames.length];
  var dx = Math.round(this.x - cam.x), dy = Math.round(this.y - cam.y);
  x.save();
  if (this.squashT > 0 && !this.flat) {
    var k = 1 - this.squashT / 0.35;
    x.globalAlpha = Math.max(0, 1 - k);
  }
  var gw = f.lw, gh = f.lh;
  if (this.flat) { x.drawImage(f, dx - 1, dy + this.h - 6, 16, 6); x.restore(); return; }
  var sc = d.grow && this.gs ? this.gs : 1;
  var cx = dx + this.w / 2, cy = dy + this.h;
  x.translate(cx, cy); x.scale(sc, sc); x.translate(-cx, -cy);
  x.drawImage(f, dx - (gw - this.w) / 2, dy - (gh - this.h), gw, gh);
  x.restore();
};

/* ================= BOSS: 균형 오류 코어 ================= */
/* One boss, configured per stage. `def.boss` may be `true` (the original 균형 오류
   코어) or an object describing a different final encounter — which is how 진실의 방
   gets a swollen rumour instead of a data error, reusing this whole fight rather
   than growing a second one. */
function Boss(x, y, world) {
  var cfg = (world.def.boss && typeof world.def.boss === 'object') ? world.def.boss : {};
  this.cfg = cfg;
  this.minion = cfg.minion || 'dataerr';   // what it releases
  this.art = cfg.art || 'st_dataerr';      // image key, or an art.js frame list
  this.size = cfg.size || 34;              // drawn size in game px
  this.glow = cfg.glow || '190,90,255';
  this.x = x; this.y = y; this.ox = x; this.oy = y;
  this.w = cfg.w || 26; this.h = cfg.h || 26;
  this.hp = cfg.hp || 3; this.t = 0; this.dead = false;
  this.hit = 0; this.spawnT = 1.5; this.world = world;
  this.state = 'fight';
}
Boss.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
Boss.prototype.update = function (dt, w) {
  if (this.dead) return;
  this.t += dt;
  if (this.hit > 0) this.hit -= dt;
  var p = w.player;
  // Gentler than before: it used to speed UP as its health dropped, so the last
  // hit was the hardest. Now it stays readable, with a narrow sweep.
  var speed = 1 + (3 - this.hp) * 0.12;
  this.x = this.ox + Math.sin(this.t * 0.6 * speed) * 44;
  this.y = this.oy + Math.sin(this.t * 1.0 * speed) * 12;

  // Release error bodies slowly, and NEVER let them pile up: previously they
  // spawned every 1.6-2.6s and never despawned, so the arena filled with hazards.
  this.spawnT -= dt;
  var live = 0, mt = this.minion;
  w.ents.forEach(function (e) { if (e.type === mt && !e.dead) live++; });
  if (this.spawnT <= 0 && this.hp > 0 && live < 2) {
    this.spawnT = 5.0;
    var e = w.spawnEnt({ k: 'enemy', type: mt, x: this.x + 6, y: this.y + 20 });
    if (e) { e.vy = -40; e.vx = (Math.random() < .5 ? -1 : 1) * 30; e.ttl = 9; }
    w.particles(this.x + 13, this.y + 22, 8, { c: 'rgba(' + this.glow + ',.9)', life: .5 });
  }

  if (p.state !== 'play' && p.state !== 'hurt') return;
  var er = this.rect();
  var stompBox = { x: er.x - 2, y: er.y, w: er.w + 4, h: er.h * 0.5 };
  if (p.vy > K.STOMP_MIN_FALL && p.prevBottom <= er.y + 6 && U.aabb(stompBox, p.rect()) && this.hit <= 0) {
    this.hp--; this.hit = 0.9;
    p.vy = -(Input.down('jump') ? K.BOUNCE_HELD : K.BOUNCE);
    p.grounded = false;
    Audio_.sfx('stomp'); w.shake = 7;
    w.game.addScore(500, this.x + 13, this.y);
    w.particles(this.x + 13, this.y + 13, 18, { c: '#ffd2e4', life: .7 });
    var total = this.cfg.hp || 3;
    if (this.hp <= 0) {
      this.dead = true;
      W.SM.UI.goal.set(total);
      W.SM.UI.goal.complete(this.cfg.doneMsg || '완료! 균형이 회복됐어요');
      w.game.onBossDown();
    } else {
      W.SM.UI.goal.set(total - this.hp);
      w.game.toast((this.cfg.hitMsg || '균형 오류 코어') + ' ' + this.hp + '회 남음!');
    }
    return;
  }
  if (this.hit <= 0 && U.aabb({ x: er.x + 3, y: er.y + 3, w: er.w - 6, h: er.h - 6 }, p.rect())) p.hurt();
};
Boss.prototype.draw = function (x, cam) {
  if (this.dead) return;
  var A = W.SM.Assets;
  var dx = this.x - cam.x, dy = this.y - cam.y;
  /* Never a creature with a face — it is the thing the stage is ABOUT, blown up:
     a data error in 균형 코어, a swollen rumour in 진실의 방. Whichever art the
     stage names is used; a missing PNG falls back to the code-drawn twin of the
     same name, and only then to the original imbalance body. */
  var styled = A.img(this.art);
  var frames = !styled && A.enemies[this.art];
  x.save();
  if (this.hit > 0 && Math.floor(this.t * 30) % 2) x.globalAlpha = 0.45;
  var g = x.createRadialGradient(dx + 13, dy + 13, 3, dx + 13, dy + 13, 38);
  g.addColorStop(0, 'rgba(' + this.glow + ',.5)');
  g.addColorStop(1, 'rgba(' + this.glow + ',0)');
  x.fillStyle = g; x.fillRect(dx - 26, dy - 26, 78, 78);
  var s = this.size, jit = Math.round(Math.sin(this.t * 29) * 1.1);
  var pul = 1 + Math.sin(this.t * 3) * 0.06;
  if (styled || frames) {
    var img = styled || frames[Math.floor(this.t * 5) % frames.length];
    var iw = s, ih = s;
    // keep the artwork's proportions at this size
    if (styled) {
      var b = trimBox(styled);
      if (b) { iw = s * (b.w / b.h) ; ih = s; }
    } else { iw = s * (img.lw / img.lh); ih = s; }
    x.save();
    x.translate(dx + this.w / 2 + jit, dy + this.h / 2);
    x.scale(pul, pul);
    if (styled) {
      var tb = trimBox(styled);
      if (tb) x.drawImage(styled, tb.x, tb.y, tb.w, tb.h, -iw / 2, -ih / 2, iw, ih);
      else x.drawImage(styled, -iw / 2, -ih / 2, iw, ih);
    } else {
      x.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    }
    x.restore();
  } else {
    var f = A.enemies.imbalance[Math.floor(this.t * 6) % 3];
    x.drawImage(f, dx - 4, dy - 4, 34, 34);
  }
  x.restore();
  // hp pips, centred over whatever width this boss has
  var total = this.cfg.hp || 3;
  var px0 = dx + this.w / 2 - ((total - 1) * 6) / 2;
  for (var i = 0; i < total; i++) {
    x.fillStyle = i < this.hp ? '#ff5d7a' : 'rgba(255,255,255,.2)';
    x.beginPath(); x.arc(px0 + i * 6, dy - 9, 2, 0, 7); x.fill();
  }
};

/* ================= WORLD UPDATE ================= */
World.prototype.update = function (dt) {
  this.time += dt;
  var i;
  this.player.update(dt);
  for (i = 0; i < this.ents.length; i++) {
    var e = this.ents[i];
    if (e.update) e.update(dt, this);
  }
  for (i = this.ents.length - 1; i >= 0; i--) if (this.ents[i].dead) this.ents.splice(i, 1);
  if (this.boss) this.boss.update(dt, this);

  // block bumps
  for (i = this.bumps.length - 1; i >= 0; i--) {
    var b = this.bumps[i]; b.t += dt;
    if (b.t > K.BUMP_T) this.bumps.splice(i, 1);
  }
  // particles
  for (i = this.parts.length - 1; i >= 0; i--) {
    var p = this.parts[i];
    p.t += dt;
    if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 22);
  this.updateCam(dt);
};

World.prototype.updateCam = function (dt) {
  var p = this.player, cam = this.cam;
  // look-ahead, eased
  var want = (Math.abs(p.vx) > 12 ? Math.sign(p.vx) : p.face) * K.CAM_LOOK;
  cam.look = U.lerp(cam.look, want, 1 - Math.exp(-(1 / K.CAM_LOOK_T) * dt));

  var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  var tx = pcx + cam.look - VW / 2;
  // deadzone horizontal
  var curCx = cam.x + VW / 2;
  if (Math.abs(pcx - curCx + cam.look * 0) > K.CAM_DZ_W) {
    cam.x += (tx - cam.x) * (1 - Math.exp(-K.CAM_K * dt));
  } else {
    cam.x += (tx - cam.x) * (1 - Math.exp(-K.CAM_K * 0.35 * dt));
  }
  // vertical: laggier, and mostly ignore ordinary jumps
  var ty = pcy - VH / 2 + 14;
  var dy = pcy - (cam.y + VH / 2);
  if (p.grounded || Math.abs(dy) > K.CAM_DZ_H) {
    cam.y += (ty - cam.y) * (1 - Math.exp(-K.CAM_KV * dt));
  }
  cam.x = U.clamp(cam.x, 0, Math.max(0, this.pxw - VW));
  cam.y = U.clamp(cam.y, 0, Math.max(0, this.pxh - VH));
};

/* ================= RENDER ================= */
World.prototype.draw = function (x) {
  var A = W.SM.Assets;
  // resolved once per frame, not once per tile
  this._hintReveal = charStat('hintReveal', false);
  var cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
  if (this.shake > 0) {
    cam.x += Math.round(U.rand(-this.shake, this.shake));
    cam.y += Math.round(U.rand(-this.shake, this.shake) * 0.6);
  }

  /* --- sky --- */
  var SKY = {
    fungi:    ['#63c8f2', '#a8e6f7', '#3f7f6a'],
    protist:  ['#1aa6c4', '#48d6d0', '#06303f'],
    bacteria: ['#2b3f8f', '#5470d8', '#070d22'],
    core:     ['#5b3fa8', '#8f6bd8', '#120a2a'],
    /* 왜냐면 과학실: an indoor room reads as warm and enclosed, the backyard as
       open daylight, the chat space as cold screen-light, the truth room as the
       lab again but lit by what you finally understand. */
    labroom:   ['#6b5c46', '#a8977a', '#2a2118'],
    backyard:  ['#7fc6ef', '#bfe9ad', '#3d6b2e'],
    chatspace: ['#101a33', '#27407a', '#050a16'],
    truthroom: ['#8a6b3c', '#ffd68a', '#2e2010']
  };
  var sky = SKY[this.def.tiles === 'core' ? 'core' : this.def.world] || SKY.fungi;
  var g = x.createLinearGradient(0, -cam.y * 0.25, 0, VH);
  g.addColorStop(0, sky[0]); g.addColorStop(.62, sky[1]); g.addColorStop(1, sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, VW, VH);

  /* --- distant photo backdrop: a faint atmospheric band, never the main read --- */
  var bg = A.img(this.def.bg);
  if (bg) {
    x.save();
    x.globalAlpha = 0.20;
    x.globalCompositeOperation = 'soft-light';
    var bw = VH * 2.2, bh = VH * 1.15;
    var span = bw;
    var off = -((cam.x * 0.18) % span);
    for (var bx = off - span; bx < VW + span; bx += span) {
      x.drawImage(bg, bx, VH * 0.06 - cam.y * 0.08, bw, bh);
    }
    x.restore();
  }
  this.drawParallax(x, cam);

  /* --- tiles --- */
  var c0 = Math.max(0, Math.floor(cam.x / TILE)), c1 = Math.min(this.w - 1, Math.ceil((cam.x + VW) / TILE));
  var r0 = Math.max(0, Math.floor(cam.y / TILE)), r1 = Math.min(this.h - 1, Math.ceil((cam.y + VH) / TILE));
  var set = A.tileset(this.def.tiles);
  var set2 = this.def.tiles2 ? A.tileset(this.def.tiles2) : set;
  for (var r = r0; r <= r1; r++) {
    for (var c = c0; c <= c1; c++) {
      var t = this.grid[r][c];
      if (!t) {
        var hm = this.meta[r][c];
        if (hm && hm.t === 'hidden' && hm.shown) {
          x.drawImage(A.blocks.hidden[0], c * TILE - cam.x, r * TILE - cam.y, TILE, TILE);
        } else if (hm && hm.t === 'hidden' && this._hintReveal) {
          this.drawHiddenHint(x, cam, c, r);
        }
        continue;
      }
      var bump = this.bumpAt(c, r);
      var yo = 0;
      if (bump) {
        var k = bump.t / K.BUMP_T;
        yo = -Math.sin(k * Math.PI) * K.BUMP_H;
      }
      var dx = c * TILE - cam.x, dy = r * TILE - cam.y + yo;
      if (t === 2) { x.drawImage(set.plat, dx, dy, TILE, 6); continue; }
      if (t === 4) { x.drawImage(A.props.hypha, dx + 4, dy, 8, TILE); continue; }
      if (t === 5) { this.drawCurrent(x, c, r, dx, dy); continue; }
      var m = this.meta[r][c];
      if (t === 3 && m) {
        var bl = A.blocks[m.t];
        if (bl) { x.drawImage(bl[Math.floor(this.time * 4) % bl.length], dx, dy, TILE, TILE); continue; }
      }
      if (t === 1 && m && m.t === 'used') { x.drawImage(A.blocks.used[0], dx, dy, TILE, TILE); continue; }
      if (t === 1 && m && m.t === 'hidden') { x.drawImage(A.blocks.hidden[0], dx, dy, TILE, TILE); continue; }
      /* Pipe tiles, split by role:
           pipetop  — the mouth row, which stands ONE TILE ABOVE the floor. Skipped,
                      because the pipe artwork is the only thing that should appear
                      there. Drawing it as ground put a dark-outlined dirt block
                      above the floor line with the pipe sitting inside it.
           pipebody — the rows buried in the floor. Drawn as ordinary ground, so no
                      hole shows beside a tube narrower than its 2-tile opening. */
      if (t === 1 && m && m.t === 'pipetop') continue;
      var mk = this.mask[r][c];
      var use = (m && m.deep) ? set2 : set;
      x.drawImage(use[mk < 0 ? 0 : mk], dx, dy, TILE, TILE);
    }
  }
  /* Pipe bodies (drawn once per 2-wide pair, at the left column).
     SKIPPED when the styled tube loaded: that artwork already includes its own
     body, which now descends over these rows. Drawing both put the bright
     code-drawn green body behind the muted styled tube — two different pipes in
     the same hole. */
  if (!A.img('st_pipe')) {
    for (r = r0; r <= r1; r++) {
      for (c = c0; c <= c1; c++) {
        var mm = this.meta[r][c];
        if (!mm || mm.t !== 'pipebody') continue;
        var lm = c > 0 ? this.meta[r][c - 1] : null;
        if (lm && lm.t === 'pipebody') continue;
        x.drawImage(A.props.pipebody, c * TILE - cam.x, r * TILE - cam.y, 32, 16);
      }
    }
  }

  /* --- entities --- */
  var self = this;
  this.ents.forEach(function (e) {
    if (e.draw && e.x - cam.x > -70 && e.x - cam.x < VW + 70) e.draw(x, cam);
  });
  if (this.boss) this.boss.draw(x, cam);

  /* --- player --- */
  this.drawPlayer(x, cam);

  /* --- particles --- */
  this.parts.forEach(function (p) {
    var a = 1 - p.t / p.life;
    x.globalAlpha = a;
    x.fillStyle = p.c;
    x.beginPath(); x.arc(p.x - cam.x, p.y - cam.y, p.r * a + 0.4, 0, 7); x.fill();
  });
  x.globalAlpha = 1;

  /* --- world tint (red tide etc.) --- */
  if (this.tint) {
    x.save(); x.globalAlpha = this.tint.a; x.fillStyle = this.tint.c;
    x.fillRect(0, 0, VW, VH); x.restore();
  }
  /* --- water veil --- */
  if (this.water) {
    x.save(); x.globalAlpha = 0.10; x.fillStyle = '#39c6ff'; x.fillRect(0, 0, VW, VH);
    x.globalAlpha = 0.06; x.fillStyle = '#fff';
    for (var i = 0; i < 3; i++) {
      var yy = ((this.time * 12 + i * 70) % (VH + 40)) - 20;
      x.fillRect(0, yy, VW, 6);
    }
    x.restore();
  }
  void self;
};

/* Repeating parallax band: places `count` items spaced `gap` apart, wrapped into
   [0, count*gap) so every item that lands on screen actually gets drawn. */
function band(cam, count, gap, factor, fn) {
  var span = count * gap;
  var scroll = cam.x * factor;
  for (var i = 0; i < count; i++) {
    var bx = ((i * gap - scroll) % span + span) % span;
    if (bx > VW + 80) continue;
    fn(i, bx);
  }
}

World.prototype.drawParallax = function (x, cam) {
  var wd = this.def.world, core = this.def.tiles === 'core';
  var yo = -cam.y * 0.12;
  x.save();

  if (wd === 'fungi' && !core) {
    // far hills
    x.globalAlpha = 0.5; x.fillStyle = '#5fa88a';
    x.beginPath(); x.moveTo(-10, VH);
    band(cam, 10, 90, 0.14, function (i, bx) {
      x.lineTo(bx - 45, VH - 30 - (i % 3) * 14 + yo);
      x.lineTo(bx, VH - 6 + yo);
    });
    x.lineTo(VW + 10, VH); x.closePath(); x.fill();

    // mid mushroom canopy — hazy, cool, sits behind everything
    band(cam, 14, 84, 0.30, function (i, bx) {
      var h0 = 40 + (i % 4) * 16;
      var by = VH - 30 - h0 * 0.35 + yo;
      var cap = 14 + (i % 3) * 5;
      x.globalAlpha = 0.34;
      x.fillStyle = '#2f6b52';
      x.fillRect(bx + 10, by, 5.5, h0 + 20);
      x.fillStyle = ['#4b8f74', '#5b7fa0', '#7a6494'][i % 3];
      x.beginPath(); x.arc(bx + 12.7, by + 2, cap, Math.PI, 0); x.closePath(); x.fill();
    });
    // near mushroom grove — the reference's signature colours, but kept hazy and
    // low so it never competes with platforms for the player's read
    band(cam, 9, 118, 0.48, function (i, bx) {
      var h0 = 16 + (i % 3) * 13;
      var by = VH - 14 - h0 + yo;
      var cap = 11 + (i % 4) * 4;
      var COL = [['#e0574a', '#a32b22'], ['#a768e0', '#6b2fa3'],
                 ['#ffb03d', '#c47210'], ['#4fc4e0', '#1d7fa3']][i % 4];
      x.globalAlpha = 0.5;
      x.fillStyle = '#f0e4cd';
      x.fillRect(bx + cap - 2.5, by, 5, h0 + 18);
      var cg = x.createLinearGradient(0, by - cap, 0, by + 3);
      cg.addColorStop(0, COL[0]); cg.addColorStop(1, COL[1]);
      x.beginPath(); x.arc(bx + cap, by + 1, cap, Math.PI, 0); x.closePath();
      x.fillStyle = cg; x.fill();
      x.strokeStyle = 'rgba(50,15,12,.4)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = 'rgba(255,248,235,.75)';
      [[-0.45, 0.5, .24], [0.2, 0.3, .17]].forEach(function (s) {
        x.beginPath();
        x.arc(bx + cap + s[0] * cap, by - s[1] * cap, cap * s[2], 0, 7); x.fill();
      });
    });
    // atmospheric haze over the whole backdrop -> foreground pops
    x.globalAlpha = 0.22;
    var hz = x.createLinearGradient(0, VH * 0.45, 0, VH);
    hz.addColorStop(0, 'rgba(168,230,247,0)'); hz.addColorStop(1, 'rgba(168,230,247,.95)');
    x.fillStyle = hz; x.fillRect(0, VH * 0.45, VW, VH * 0.55);
    // drifting spores
    var t = this.time;
    band(cam, 16, 62, 0.55, function (i, bx) {
      x.globalAlpha = 0.30;
      x.fillStyle = '#eaffc4';
      var py = 30 + ((i * 37 + t * 9) % (VH - 50));
      x.beginPath(); x.arc(bx, py + yo, 1.1 + (i % 3) * 0.5, 0, 7); x.fill();
    });

  } else if (wd === 'protist' && !core) {
    // algae fronds
    band(cam, 12, 78, 0.28, function (i, bx) {
      var h0 = 60 + (i % 4) * 26;
      x.globalAlpha = 0.34;
      x.strokeStyle = '#3f9c6a'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(bx, VH + yo);
      x.quadraticCurveTo(bx + 12, VH - h0 * 0.6 + yo, bx + 3, VH - h0 + yo);
      x.stroke();
    });
    // rising bubbles
    var t2 = this.time;
    band(cam, 20, 44, 0.5, function (i, bx) {
      var py = VH - ((i * 53 + t2 * 22) % (VH + 40));
      x.globalAlpha = 0.24;
      x.fillStyle = '#cdf6ff';
      x.beginPath(); x.arc(bx + Math.sin(t2 + i) * 4, py + yo, 1.4 + (i % 3), 0, 7); x.fill();
    });

  } else if (wd === 'labroom' || wd === 'truthroom') {
    /* An old science room: cabinets and shelved glassware behind, dust in the
       light. truthroom is the SAME room at the climax, so it shares the geometry
       and only changes temperature — that continuity is the point of the world. */
    /* These cabinets used to be 74x110 game px — half the 216px screen — which made
       the children look like a detail in someone else's furniture and flattened the
       floor line into the background. They are now roughly one child tall, sit well
       above the ground so the floor stays the strongest horizontal, and are faded
       further back so nothing competes with the platforms. */
    var warm = wd === 'truthroom';
    band(cam, 14, 68, 0.20, function (i, bx) {
      var cw = 46, chh = 52, top = VH - 74 - (i % 2) * 4 + yo;
      x.globalAlpha = 0.26;
      x.fillStyle = warm ? '#6b5330' : '#4a3d2a';
      x.fillRect(bx, top, cw, chh);                           // cabinet
      x.globalAlpha = 0.30;
      x.fillStyle = warm ? '#3c2c14' : '#2c2418';
      for (var s = 0; s < 2; s++) x.fillRect(bx + 3, top + 16 + s * 18, cw - 6, 2);
      // glassware silhouettes on the shelves
      x.globalAlpha = 0.20;
      x.fillStyle = warm ? '#ffe1a8' : '#9fb6bd';
      for (var q = 0; q < 3; q++) {
        if ((i + q) % 3 === 0) continue;
        var gx = bx + 8 + q * 13, gy = top + 16 + ((i + q) % 2) * 18;
        x.fillRect(gx + 1.4, gy - 6, 2, 3.4);
        x.beginPath(); x.arc(gx + 2.4, gy - 2, 2.6, Math.PI, 0, true); x.fill();
        x.fillRect(gx - 0.2, gy - 2, 5.2, 2);
      }
    });
    // dust motes in the window light
    var td = this.time;
    band(cam, 18, 56, 0.5, function (i, bx) {
      x.globalAlpha = 0.24;
      x.fillStyle = warm ? '#ffe8b8' : '#e8dcc0';
      var py = 24 + ((i * 43 + td * 6) % (VH - 44));
      x.beginPath(); x.arc(bx, py + yo, 0.9 + (i % 3) * 0.4, 0, 7); x.fill();
    });

  } else if (wd === 'backyard') {
    // hedge line, then the school fence, then slow pollen
    band(cam, 12, 84, 0.18, function (i, bx) {
      x.globalAlpha = 0.4; x.fillStyle = '#3d6b2e';
      x.beginPath(); x.arc(bx + 30, VH - 26 + yo, 34 + (i % 3) * 7, Math.PI, 0); x.fill();
    });
    band(cam, 22, 30, 0.34, function (i, bx) {
      x.globalAlpha = 0.36; x.fillStyle = '#8a9aa6';
      x.fillRect(bx, VH - 52 + yo, 3, 54);
      if (i % 2 === 0) x.fillRect(bx, VH - 44 + yo, 30, 2.4);
    });
    var tb = this.time;
    band(cam, 16, 62, 0.55, function (i, bx) {
      x.globalAlpha = 0.3; x.fillStyle = '#fff3b0';
      var py = 30 + ((i * 37 + tb * 8) % (VH - 60));
      x.beginPath(); x.arc(bx + Math.sin(tb * 0.6 + i) * 5, py + yo, 1.1 + (i % 2) * 0.5, 0, 7); x.fill();
    });

  } else if (wd === 'chatspace') {
    /* Drifting message bubbles, deliberately EMPTY: unread claims with nothing
       inside them. They scroll past faster than the player, like a feed. */
    /* Decorative empty bubbles. They used to be up to 62px wide — wider than the
       rumour hazard itself — so the scenery looked like the thing to jump on.
       Smaller and fainter now: the drifting hazard has to be the biggest bubble on
       screen, because it is the only one the player can act on. */
    var tc = this.time;
    band(cam, 13, 74, 0.26, function (i, bx) {
      var by = 26 + ((i * 47 + tc * 5) % (VH - 70));
      var bw2 = 16 + (i % 4) * 6;
      x.globalAlpha = 0.11 + (i % 3) * 0.03;
      x.fillStyle = i % 2 ? '#8fd6ff' : '#c8ecff';
      Art.rr(x, bx, by + yo, bw2, 9, 3.5); x.fill();
      x.beginPath();
      x.moveTo(bx + 5, by + 9 + yo); x.lineTo(bx + 3.5, by + 13 + yo); x.lineTo(bx + 10, by + 9 + yo);
      x.closePath(); x.fill();
    });
    band(cam, 20, 44, 0.6, function (i, bx) {
      x.globalAlpha = 0.4; x.fillStyle = '#8fd6ff';
      var py = ((i * 53 + tc * 26) % (VH + 40)) - 20;
      x.fillRect(bx, py + yo, 1.6, 7);
    });

  } else {
    // data-city towers (also used for the balance core)
    band(cam, 14, 76, 0.30, function (i, bx) {
      var hh = 60 + (i % 5) * 28;
      x.globalAlpha = 0.55;
      x.fillStyle = core ? '#2a1b52' : '#132a5e';
      x.fillRect(bx, VH - hh + yo, 40, hh + 50);
      x.globalAlpha = 0.85;
      x.fillStyle = core ? '#9b7ade' : '#39e0ff';
      for (var q = 0; q < 5; q++) {
        if ((i + q) % 3) continue;
        x.fillRect(bx + 7 + (q % 2) * 20, VH - hh + 9 + q * 15 + yo, 5, 5);
      }
    });
    var t3 = this.time;
    band(cam, 10, 96, 0.62, function (i, bx) {
      x.globalAlpha = 0.5;
      x.fillStyle = core ? '#c9a8ff' : '#7ff0ff';
      var py = 24 + ((i * 41 + t3 * 14) % (VH - 60));
      x.fillRect(bx, py + yo, 2, 6);
    });
  }
  x.restore();
  x.globalAlpha = 1;
};

/* 예민혜's perk, drawn rather than told: an undiscovered hidden block breathes a
   faint outline when she is near, on a slow cycle so it "잠깐 드러남" instead of
   permanently marking the map. Other characters never see it — _hintReveal is set
   once per frame in draw(), so this costs nothing for them. */
World.prototype.drawHiddenHint = function (x, cam, c, r) {
  var p = this.player;
  var dxp = (c * TILE + 8) - (p.x + p.w / 2);
  var dyp = (r * TILE + 8) - (p.y + p.h / 2);
  var dist = Math.sqrt(dxp * dxp + dyp * dyp);
  if (dist > 72) return;
  // 3.2s cycle, visible for roughly the first third of it
  var ph = (this.time % 3.2) / 3.2;
  if (ph > 0.34) return;
  var fade = Math.sin(ph / 0.34 * Math.PI);
  var near = 1 - dist / 72;
  var dx = c * TILE - cam.x, dy = r * TILE - cam.y;
  x.save();
  x.globalAlpha = 0.55 * fade * near;
  x.strokeStyle = '#ffe58a'; x.lineWidth = 1;
  x.setLineDash([3, 2.4]);
  x.strokeRect(dx + 1.5, dy + 1.5, TILE - 3, TILE - 3);
  x.setLineDash([]);
  x.globalAlpha = 0.30 * fade * near;
  x.fillStyle = '#fff6cf';
  x.beginPath(); x.arc(dx + 8, dy + 8, 2.2, 0, 7); x.fill();
  x.restore();
};

World.prototype.drawCurrent = function (x, c, r, dx, dy) {
  var m = this.meta[r][c];
  x.save();
  x.globalAlpha = 0.22; x.fillStyle = '#6fe6ff';
  x.fillRect(dx, dy, TILE, TILE);
  x.globalAlpha = 0.55; x.strokeStyle = '#cdf6ff'; x.lineWidth = 1;
  var off = (this.time * 60 * (m ? m.dir : 1)) % 16;
  for (var i = -1; i < 2; i++) {
    var sx = dx + ((off + i * 16) % 16 + 16) % 16;
    x.beginPath(); x.moveTo(sx, dy + 4); x.lineTo(sx + 5, dy + 8); x.lineTo(sx, dy + 12); x.stroke();
  }
  x.restore();
};

World.prototype.drawPlayer = function (x, cam) {
  var p = this.player, A = W.SM.Assets;
  if (p.state === 'pipe' && p.pipeRef) {
    // render behind the pipe: clip to above the mouth
    x.save();
    x.beginPath();
    x.rect(0, 0, VW, p.pipeRef.y - cam.y);
    x.clip();
    this._blitPlayer(x, cam);
    x.restore();
    return;
  }
  if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2) return;
  this._blitPlayer(x, cam);
};
/* Player state -> logical pose name. The pose then resolves to one pre-cut frame
   file per character (see player_atlas.js), which is why this table names poses
   rather than sheet indices: 예민혜's jump sheet has four poses and 신중한's has
   six, so an index table could not be shared. */
var ANIM_MAP = {
  idle: 'idle', run: 'run',
  jump: 'rise', apex: 'apex', fall: 'fall',
  skid: 'crouch', land: 'crouch', crouch: 'crouch', enter: 'crouch',
  hurt: 'hurt', clear: 'clear'
};

World.prototype._blitPlayer = function (x, cam) {
  var p = this.player, A = W.SM.Assets;
  var PA = W.SM.PlayerAtlas;
  if (!PA) return this._blitPlayerFallback(x, cam);

  var pose = ANIM_MAP[p.anim] || 'idle';

  /* The selected character's pre-cut pose files, or the code-drawn explorer if
     they have not loaded. Each frame carries its own image, so there is no shared
     atlas and no source rect. */
  var own = PA.resolve && PA.resolve(W.SM.currentCharacter, pose);
  if (!own) own = PA.resolve && PA.resolve(W.SM.currentCharacter, 'idle');
  if (!own) return this._blitPlayerFallback(x, cam);
  var list = own.frames;

  var f = (pose === 'run') ? list[p.frame % list.length] : list[0];
  if (!f) return this._blitPlayerFallback(x, cam);

  var cx = p.x + p.w / 2 - cam.x;
  var feet = p.y + p.h - cam.y;
  // idle breathes very slightly; landing squashes then recovers
  var sy = 1, sx = 1;
  if (p.anim === 'idle') sy = 1 + Math.sin(this.time * 3) * 0.012;
  else if (p.anim === 'land') { var k = 1 - Math.max(0, p.landT) / 0.12; sy = 0.86 + 0.14 * k; sx = 1.1 - 0.1 * k; }

  x.save();
  x.translate(cx, feet);
  if (p.face < 0) x.scale(-1, 1);
  x.scale(sx, sy);
  if (p.state === 'dead') x.rotate(p.deadT * 5);
  /* Only the frame's INK is drawn (sx..sh), and ay is its height, so the feet land
     exactly on p.y + p.h — the line the hitbox rests on. Any transparent margin in
     the file is skipped rather than pushing the character up off the floor. */
  x.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.ax, -f.ay, f.gw, f.gh);
  x.restore();
};

/* only used if the atlas failed to load */
World.prototype._blitPlayerFallback = function (x, cam) {
  var p = this.player, A = W.SM.Assets;
  if (!A.player) return;
  var F = A.player[p.anim] || A.player.idle;
  var f = F[Math.min(p.frame, F.length - 1)];
  var dx = Math.round(p.x + p.w / 2 - 12 - cam.x);
  var dy = Math.round(p.y + p.h - 26 - cam.y + 1);
  x.save();
  if (p.face < 0) { x.translate(dx + 12, 0); x.scale(-1, 1); x.translate(-(dx + 12), 0); }
  x.drawImage(f, dx, dy, 24, 26);
  x.restore();
};

W.SM.Play = { World: World, Player: Player, Boss: Boss, K: K, VW: VW, VH: VH, TILE: TILE };
})(window);
