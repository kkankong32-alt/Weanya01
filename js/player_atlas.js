/* ===== 왜냐면 과학실 — playable cast + sprite frames =====

   The three characters ship as three big sheets each (run / jump / misc), but the
   game does NOT read those sheets. The poses in them sit at irregular x positions
   and neighbouring poses touch, so no slicing rule — even grid or alpha gap
   detection — cuts them reliably; a mis-cut frame is what made the character look
   tiny and hover above the floor.

   So the sheets are cut ONCE, offline, into one PNG per pose:

     image/frames/<char>_<anim>_<n>.png

   and that is what loads here. Each file is already trimmed to the character's ink,
   which means this file needs no pixel scanning at all: the foot anchor is simply
   the bottom-centre of the image, and the only computation is one scale factor per
   character so every pose shares a body size.

   To repaint a pose, edit its PNG. Nothing here needs to change — not even if the
   new file has different pixel dimensions.

   The frame COUNTS and the pose INDICES below were read off the real artwork and
   differ per character (예민혜's jump sheet holds 4 poses, 신중한's misc sheet holds
   5), so they are stated explicitly rather than assumed.
*/
window.SM = window.SM || {};

(function (W) {
'use strict';

var FRAME_DIR = 'image/frames/';

/* ---------- the cast ----------
   `stats` is the difficulty/assist table. Every value is read at the point of use
   (see play.js) so the shared jump/move constants in Play.K are never rewritten —
   a character tweaks the game, it does not retune it.

     hintReveal      : hidden blocks briefly shimmer when you are close, and the
                       objective panel offers its nudges sooner.
     retryOnce       : one forgiven wrong answer per mission.
     speedMul        : multiplies the walk/run cap only (acceleration untouched).
     heartPenaltyMul : damage per hit; 1.3 means two hits end a life, not three.

   `counts` is how many pose files each animation has.
   `pose` maps a logical pose to [animation, frame index]. Indices verified against
   the contact sheets in image/frames/_contact_*.png. */
var Characters = {
  yeminhye: {
    id: 'yeminhye', name: '예민혜', type: '관찰형',
    blurb: '작은 것도 놓치지 않아요. 숨은 것이 잠깐 보여요.',
    perk: '숨은 힌트 드러내기',
    portrait: 'charselect_yeminhye',
    color: '#65f2d3',
    counts: { run: 6, jump: 4, misc: 6 },
    // jump sheet: 0 crouch · 1 tuck · 2 arms-up rise · 3 descend
    // misc sheet: 0 stand · 2 crying · 5 cheer
    pose: { idle: ['misc', 0], hurt: ['misc', 2], clear: ['misc', 5],
            crouch: ['jump', 0], rise: ['jump', 2], apex: ['jump', 1], fall: ['jump', 3] },
    stats: { hintReveal: true }
  },
  shinjunghan: {
    id: 'shinjunghan', name: '신중한', type: '분석형',
    blurb: '서두르지 않아요. 한 번 더 확인할 기회가 있어요.',
    perk: '미션 재확인 기회',
    portrait: 'charselect_shinjunghan',
    color: '#8fd6ff',
    counts: { run: 6, jump: 6, misc: 5 },
    // jump sheet: 0 crouch · 1 push off · 2 rise · 3 apex · 4 descend · 5 land
    // misc sheet: 0 stand · 2 worried · 4 cheer   (five poses, not six)
    pose: { idle: ['misc', 0], hurt: ['misc', 2], clear: ['misc', 4],
            crouch: ['jump', 0], rise: ['jump', 2], apex: ['jump', 3], fall: ['jump', 4] },
    stats: { retryOnce: true }
  },
  yonggamhui: {
    id: 'yonggamhui', name: '용감희', type: '실행형',
    blurb: '누구보다 빨라요. 대신 다치면 더 아파요.',
    perk: '빠른 이동 · 큰 피해',
    portrait: 'charselect_yonggamhui',
    color: '#ffb03d',
    counts: { run: 6, jump: 6, misc: 6 },
    // misc sheet: 0 stand · 2 startled · 5 cheer
    pose: { idle: ['misc', 0], hurt: ['misc', 2], clear: ['misc', 5],
            crouch: ['jump', 0], rise: ['jump', 3], apex: ['jump', 3], fall: ['jump', 4] },
    stats: { speedMul: 1.15, heartPenaltyMul: 1.3 }
  }
};

var ORDER = ['yeminhye', 'shinjunghan', 'yonggamhui'];
var DEFAULT_ID = 'yeminhye';

/* On-screen height in GAME px for the IDLE pose. The tile is 16px, so ~40 puts a
   standing child a bit over two and a half tiles tall. */
var IDLE_H = 40;

/* ---------- why the sizes are a fixed table ----------
   The on-screen height of each pose is NOT derived from its file. It used to be
   ("scale so the tallest frame is 40px"), and that made the whole system fragile:
   re-saving one running frame at 2x turned it into the tallest, which silently
   shrank every pose of that character to under half size.

   HEIGHTS below are the pose heights from the original clean cut, in source px.
   Only their RATIO to the idle pose is used, so a frame's on-screen height is
   fixed by this table and cannot be changed by editing the PNG. Repainting a pose
   at any resolution, with any margin, is therefore safe: the file only decides how
   the pose LOOKS, never how big it is drawn.

   Width still comes from the file, as the ink's aspect ratio at that height, so a
   genuinely wider pose (arms out) does get wider on screen. */
var HEIGHTS = {
  yeminhye: {
    run:  [478, 457, 478, 480, 458, 489],
    jump: [397, 439, 450, 470],
    misc: [484, 457, 454, 480, 458, 495]
  },
  shinjunghan: {
    run:  [432, 441, 433, 433, 442, 432],
    jump: [333, 441, 449, 496, 446, 433],
    misc: [435, 441, 434, 433, 423, 488]
  },
  yonggamhui: {
    run:  [414, 415, 438, 415, 415, 433],
    jump: [337, 415, 351, 466, 460, 419],
    misc: [420, 420, 423, 408, 415, 428]
  }
};

function frameKey(charId, anim, n) { return 'pf_' + charId + '_' + anim + '_' + n; }

/* Intended on-screen height of one pose, in game px. */
function poseHeight(charId, anim, n) {
  var H = HEIGHTS[charId];
  if (!H) return IDLE_H;
  var ref = (H.misc && H.misc[0]) || 1;            // the idle pose is the yardstick
  var list = H[anim];
  var h = (list && list[n]) || ref;
  return IDLE_H * (h / ref);
}

/* ---------- ink measurement ----------
   Frames are measured by their opaque bounding box, never by their canvas. Empty
   margin around a pose is then completely inert — in particular, padding under the
   feet can no longer lift the character off the floor, which is what happened after
   the sheets were re-exported with extra space.

   Self-contained on purpose: this module loads before play.js, which keeps its own
   copy for the scenery props. */
var inkCache = {};
function inkBox(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  var key = img.src + '|' + img.naturalWidth + 'x' + img.naturalHeight;
  if (key in inkCache) return inkCache[key];
  var box = null;
  try {
    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    var cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    var d = cx.getImageData(0, 0, cv.width, cv.height).data;
    var minX = cv.width, maxX = -1, minY = cv.height, maxY = -1;
    for (var y = 0; y < cv.height; y++) {
      var row = y * cv.width * 4;
      for (var x = 0; x < cv.width; x++) {
        if (d[row + x * 4 + 3] > 12) {
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
    console.warn('[왜냐면 과학실] 프레임 여백을 측정할 수 없어 캔버스 전체를 사용합니다:', e.message);
    box = null;
  }
  if (!box) box = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  inkCache[key] = box;
  return box;
}

var PlayerAtlas = {
  Characters: Characters,
  ORDER: ORDER,
  DEFAULT: DEFAULT_ID,
  FRAME_DIR: FRAME_DIR,

  def: function (id) { return Characters[id] || Characters[DEFAULT_ID]; },

  /* -> { img, frames:[{gw,gh,ax,ay}] } for one animation, or null if the art is
     not loaded. Frames are whole images, so there is no source rect: the caller
     draws the entire file. */
  resolve: function (charId, anim) {
    var A = W.SM && W.SM.Assets;
    if (!A) return null;
    var c = this.def(charId);

    var list = [];
    if (anim === 'run') {
      for (var n = 0; n < c.counts.run; n++) list.push(['run', n]);
    } else {
      var p = c.pose[anim];
      if (!p) return null;
      list.push(p);
    }

    var frames = [], img0 = null;
    for (var i = 0; i < list.length; i++) {
      var slot = list[i][0], idx = list[i][1];
      var img = A.img(frameKey(charId, slot, idx));
      if (!img || !img.naturalWidth) continue;
      if (!img0) img0 = img;
      var b = inkBox(img);
      var gh = poseHeight(charId, slot, idx);      // fixed by the table, not the file
      var gw = gh * (b.w / b.h);                   // aspect from the file's own ink
      frames.push({
        img: img,
        sx: b.x, sy: b.y, sw: b.w, sh: b.h,        // draw the ink, ignore the margin
        gw: gw, gh: gh,
        ax: gw / 2,                                // centred on the ink
        ay: gh                                     // feet at the bottom of the ink
      });
    }
    if (!frames.length) return null;
    return { img: img0, frames: frames };
  },

  /* Portraits only — small, and all three are needed to draw the picker. */
  portraitList: function () {
    return ORDER.map(function (id) {
      var c = Characters[id];
      return [c.portrait, 'image/' + c.portrait + '.png'];
    });
  },

  /* Every pose file for ONE character, loaded on demand so choosing 예민혜 never
     downloads 용감희's artwork. */
  sheetList: function (charId) {
    var c = this.def(charId), out = [];
    Object.keys(c.counts).forEach(function (anim) {
      for (var n = 0; n < c.counts[anim]; n++) {
        out.push([frameKey(c.id, anim, n),
                  FRAME_DIR + c.id + '_' + anim + '_' + n + '.png']);
      }
    });
    return out;
  },

  assetList: function () {
    var self = this, out = [];
    ORDER.forEach(function (id) { out = out.concat(self.sheetList(id)); });
    return out.concat(this.portraitList());
  }
};

/* ---------- current selection ---------- */
W.SM.PlayerAtlas = PlayerAtlas;
W.SM.Characters = Characters;
W.SM.currentCharacter = DEFAULT_ID;

W.SM.Char = {
  cur: function () { return PlayerAtlas.def(W.SM.currentCharacter); },
  set: function (id) {
    if (!Characters[id]) return false;
    W.SM.currentCharacter = id;
    return true;
  },
  /* One accessor for the whole ability table, with the neutral value inline at
     every call site — an unknown stat can never become a silent 0. */
  stat: function (name, dflt) {
    var s = this.cur().stats || {};
    return (s[name] === undefined) ? dflt : s[name];
  },

  /* retryOnce bookkeeping: one forgiveness per mission id. */
  _retry: {},
  resetRetry: function (missionId) { this._retry[missionId] = false; },
  consumeRetry: function (missionId) {
    if (!this.stat('retryOnce', false)) return false;
    if (this._retry[missionId]) return false;
    this._retry[missionId] = true;
    return true;
  }
};

})(window);
