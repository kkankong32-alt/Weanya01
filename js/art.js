/* ===== 왜냐면 과학실 — procedural art (player, enemies, tiles, props, logo) ===== */
(function (W) {
'use strict';
var U = W.SM.U;

var S = 3;                       // bake scale (matches renderer scale => 1:1 crisp)
var TILE = 16;

/* ---------- bake helper ---------- */
function bake(w, h, fn) {
  var c = document.createElement('canvas');
  c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  var x = c.getContext('2d');
  x.scale(S, S);
  x.lineJoin = 'round'; x.lineCap = 'round';
  fn(x, w, h);
  c.lw = w; c.lh = h;
  return c;
}
function rr(x, a, b, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(a, b, w, h, r);
  else {
    r = Math.min(r, w / 2, h / 2);
    x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r); x.closePath();
  }
}
function ell(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); }
function fs(x, c) { x.fillStyle = c; x.fill(); }
function st(x, c, w) { x.strokeStyle = c; x.lineWidth = w == null ? 1 : w; x.stroke(); }

/* ================= PALETTES ================= */
var P = {
  ink: '#241a12',
  inkCool: '#122033',
  skin: '#f7c99b', skinSh: '#dc9a6b',
  suit: '#f2e7c9', suitSh: '#cbb98f',
  helm: '#a8845a', helmSh: '#7d6040', helmHi: '#c9a675',
  lens: '#6fe6ff', lensHi: '#d8fbff', rim: '#3c4d5e',
  pack: '#9a7048', packSh: '#6f4f31',
  boot: '#4f3d2a', scarf: '#ff8a5c',
  orb: '#8ee63f', orbHi: '#e8ffc0', orbDk: '#3f8a15'
};

/* ================= PLAYER ================= */
/* Original character: young bio-science explorer.
   Helmet + observation goggle lens, small survey backpack, bright field suit. */
function drawExplorer(x, o) {
  o = o || {};
  var bob = o.bob || 0;            // torso bob
  var la = o.la || 0, ra = o.ra || 0;   // arm angles (rad)
  var ll = o.ll || 0, rl = o.rl || 0;   // leg angles
  var crouch = o.crouch || 0;      // 0..1
  var lean = o.lean || 0;          // torso lean
  var eye = o.eye == null ? 1 : o.eye;  // 1 open, 0 closed/hurt
  var mouth = o.mouth || 0;        // 0 neutral, 1 open
  var arms = o.arms || 'normal';   // 'up' | 'normal'

  var cx = 12;                     // sprite center
  var hipY = 19 - crouch * 3 + bob;
  var shY = 11 - crouch * 2.2 + bob;
  var headY = 6.6 - crouch * 2 + bob;

  x.save();
  x.translate(cx, 0);
  x.rotate(lean * 0.06);
  x.translate(-cx, 0);

  /* ---- backpack (behind) ---- */
  x.save();
  rr(x, cx - 8.4, shY - 1.2, 5.2, 7.4, 1.8);
  fs(x, P.pack); st(x, P.ink, 0.85);
  rr(x, cx - 7.8, shY + 0.2, 3.6, 2.2, .7); fs(x, P.packSh);
  ell(x, cx - 5.9, shY + 4.6, 1.1, 1.1); fs(x, P.lens); st(x, P.rim, .6);
  x.restore();

  /* ---- legs ---- */
  function leg(ang, dx, shade) {
    x.save();
    x.translate(cx + dx, hipY);
    x.rotate(ang);
    rr(x, -1.6, 0, 3.2, 5.2, 1.3); fs(x, shade ? P.suitSh : P.suit); st(x, P.ink, .8);
    // boot
    x.translate(0, 4.6);
    rr(x, -1.9, 0, 4.4, 2.5, 1); fs(x, P.boot); st(x, P.ink, .8);
    x.restore();
  }
  leg(rl, 1.5, true);
  leg(ll, -1.5, false);

  /* ---- torso ---- */
  rr(x, cx - 4.2, shY - 1, 8.4, 9.6, 2.6);
  fs(x, P.suit); st(x, P.ink, .9);
  // chest strap + module
  x.beginPath(); x.moveTo(cx - 3.4, shY + 0.6); x.lineTo(cx + 3.4, shY + 2.6); st(x, P.packSh, 1.1);
  rr(x, cx - 1.4, shY + 2.4, 3, 2.2, .7); fs(x, '#2f4a63'); st(x, P.ink, .6);
  ell(x, cx + 0.1, shY + 3.5, .55, .55); fs(x, P.lens);
  // scarf
  rr(x, cx - 3.6, shY - 1.6, 7.2, 2.1, 1); fs(x, P.scarf); st(x, P.ink, .7);
  x.beginPath(); x.moveTo(cx + 2.6, shY - 0.4); x.lineTo(cx + 5.2, shY + 1.4 + bob * .3);
  x.lineTo(cx + 2.8, shY + 1.2); x.closePath(); fs(x, P.scarf); st(x, P.ink, .6);

  /* ---- arms ---- */
  function arm(ang, dx, shade) {
    x.save();
    x.translate(cx + dx, shY + 0.8);
    x.rotate(ang);
    rr(x, -1.35, 0, 2.7, 5, 1.2); fs(x, shade ? P.suitSh : P.suit); st(x, P.ink, .8);
    ell(x, 0, 5.4, 1.4, 1.3); fs(x, P.skin); st(x, P.ink, .7);   // hand
    x.restore();
  }
  if (arms === 'up') { arm(2.5, 4.2, true); arm(-2.5, -4.2, false); }
  else { arm(ra, 4.2, true); arm(la, -4.2, false); }

  /* ---- head ---- */
  // face
  ell(x, cx, headY, 4.1, 3.9); fs(x, P.skin); st(x, P.ink, .9);
  // eyes
  if (eye > 0) {
    ell(x, cx - 1.5, headY + 0.5, .62, .72 * eye); fs(x, P.ink);
    ell(x, cx + 1.7, headY + 0.5, .62, .72 * eye); fs(x, P.ink);
    ell(x, cx - 1.3, headY + 0.25, .22, .24); fs(x, '#fff');
    ell(x, cx + 1.9, headY + 0.25, .22, .24); fs(x, '#fff');
  } else {
    x.beginPath(); x.moveTo(cx - 2.2, headY + .4); x.lineTo(cx - .8, headY + .4);
    x.moveTo(cx + 1, headY + .4); x.lineTo(cx + 2.4, headY + .4); st(x, P.ink, .75);
  }
  // mouth
  x.beginPath();
  if (mouth) { ell(x, cx + 0.2, headY + 2.3, 1.05, .95); fs(x, '#8c3b3b'); st(x, P.ink, .55); }
  else { x.moveTo(cx - .8, headY + 2.2); x.quadraticCurveTo(cx + .2, headY + 2.9, cx + 1.3, headY + 2.1); st(x, P.ink, .7); }
  // cheeks
  ell(x, cx - 2.9, headY + 1.6, .8, .55); fs(x, 'rgba(255,120,110,.4)');
  ell(x, cx + 3.1, headY + 1.6, .8, .55); fs(x, 'rgba(255,120,110,.4)');

  // helmet dome
  x.beginPath();
  x.arc(cx, headY - 0.2, 4.5, Math.PI * 1.02, Math.PI * 2.02);
  x.closePath(); fs(x, P.helm); st(x, P.ink, .9);
  x.beginPath(); x.arc(cx - 1, headY - 1.2, 2.6, Math.PI * 1.1, Math.PI * 1.75); st(x, P.helmHi, .8);
  // brim
  rr(x, cx - 5.2, headY - 0.7, 10.4, 1.5, .75); fs(x, P.helmSh); st(x, P.ink, .8);
  // goggle lens on helmet (observation lens)
  x.save();
  ell(x, cx + 2.6, headY - 2.2, 1.9, 1.9); fs(x, P.rim); st(x, P.ink, .8);
  ell(x, cx + 2.6, headY - 2.2, 1.25, 1.25); fs(x, P.lens);
  ell(x, cx + 2.1, headY - 2.7, .45, .38); fs(x, P.lensHi);
  x.restore();
  // antenna
  x.beginPath(); x.moveTo(cx - 2.4, headY - 3.6); x.quadraticCurveTo(cx - 4, headY - 6.4, cx - 2.2, headY - 7.2);
  st(x, P.ink, .75);
  ell(x, cx - 2.1, headY - 7.5, .95, .95); fs(x, P.orb); st(x, P.ink, .6);

  x.restore();
}

/* player animation frames */
function buildPlayer() {
  var F = {};
  var W_ = 24, H_ = 26;
  var mk = function (o) { return bake(W_, H_, function (x) { drawExplorer(x, o); }); };

  F.idle = [ mk({ bob: 0, la: .12, ra: -.12 }), mk({ bob: .45, la: .2, ra: -.2, eye: .8 }) ];
  F.run = [
    mk({ bob: 0,   ll: -.75, rl: .6,  la: .95,  ra: -.9,  lean: 1, mouth: 1 }),
    mk({ bob: -.6, ll: -.15, rl: -.1, la: .25,  ra: -.25, lean: 1, mouth: 1 }),
    mk({ bob: 0,   ll: .6,   rl: -.75, la: -.9, ra: .95,  lean: 1, mouth: 1 }),
    mk({ bob: -.6, ll: -.1,  rl: -.15, la: -.25, ra: .25, lean: 1, mouth: 1 })
  ];
  F.skid = [ mk({ bob: .3, ll: .5, rl: -.35, la: -1.5, ra: 1.1, lean: -2.4, eye: .5, mouth: 1 }) ];
  F.jump = [ mk({ bob: -.5, ll: -.5, rl: .3, arms: 'up', lean: .6, mouth: 1 }) ];
  F.fall = [ mk({ bob: .2, ll: .25, rl: -.4, la: -1.9, ra: 1.9, eye: .7, mouth: 1 }) ];
  F.land = [ mk({ bob: 1.4, crouch: .75, ll: .15, rl: -.15, la: -.9, ra: .9 }) ];
  F.crouch = [ mk({ crouch: 1, la: .5, ra: -.5, eye: .6 }) ];
  F.enter = [ mk({ crouch: .5, arms: 'up', eye: .3 }) ];
  F.hurt = [ mk({ bob: .3, ll: -.9, rl: .9, la: -2.2, ra: 2.2, eye: 0, mouth: 1, lean: -1 }) ];
  F.clear = [ mk({ bob: -.4, arms: 'up', mouth: 1 }), mk({ bob: .3, arms: 'up', mouth: 1, ll: -.3, rl: .3 }) ];
  return F;
}

/* ================= COLLECTIBLE: life-energy orb ================= */
function buildOrb() {
  var f = [];
  for (var i = 0; i < 6; i++) {
    (function (i) {
      f.push(bake(12, 12, function (x) {
        var t = i / 6 * Math.PI * 2;
        var pul = 1 + Math.sin(t) * 0.09;
        var r = 3.6 * pul;
        // glow
        var g = x.createRadialGradient(6, 6, 0, 6, 6, 5.8);
        g.addColorStop(0, 'rgba(190,255,120,.85)');
        g.addColorStop(.55, 'rgba(142,230,63,.35)');
        g.addColorStop(1, 'rgba(142,230,63,0)');
        ell(x, 6, 6, 5.8, 5.8); fs(x, g);
        // body
        var g2 = x.createRadialGradient(4.8, 4.6, .3, 6, 6, r);
        g2.addColorStop(0, '#f4ffdf'); g2.addColorStop(.45, P.orb); g2.addColorStop(1, P.orbDk);
        ell(x, 6, 6, r, r); fs(x, g2); st(x, 'rgba(30,60,10,.75)', .7);
        ell(x, 4.7, 4.5, 1.1, .8); fs(x, 'rgba(255,255,255,.85)');
        // orbiting spark
        var a = t * 1.6;
        ell(x, 6 + Math.cos(a) * 4.6, 6 + Math.sin(a) * 4.6, .55, .55); fs(x, '#eaffc4');
      }));
    })(i);
  }
  return f;
}

/* ================= BLOCKS ================= */
function blockShell(x, w, h, base, edge, hi) {
  rr(x, .5, .5, w - 1, h - 1, 2.2); fs(x, base); st(x, edge, 1);
  rr(x, 1.8, 1.6, w - 3.6, 2.4, 1); fs(x, hi);
  // rivets
  [[3, 3], [w - 3, 3], [3, h - 3], [w - 3, h - 3]].forEach(function (p) {
    ell(x, p[0], p[1], .55, .55); fs(x, edge);
  });
}
function buildBlocks() {
  var B = {};
  // specimen capsule block (the "?" analogue) — glowing capsule glyph
  B.capsule = [0, 1, 2].map(function (i) {
    return bake(16, 16, function (x) {
      var pul = [1, 1.12, 1][i];
      blockShell(x, 16, 16, '#e8b23c', '#8a5c14', 'rgba(255,255,255,.35)');
      x.save(); x.translate(8, 8); x.scale(pul, pul); x.translate(-8, -8);
      rr(x, 6.2, 4.2, 3.6, 7.6, 1.8); fs(x, '#bff4ff'); st(x, '#2b4a5e', .9);
      rr(x, 6.2, 4.2, 3.6, 3.6, 1.8); fs(x, '#6fe6ff');
      ell(x, 8, 9.6, .8, .8); fs(x, P.orb);
      x.restore();
    });
  });
  // spore block
  B.spore = [bake(16, 16, function (x) {
    blockShell(x, 16, 16, '#b98a4e', '#5f3f1e', 'rgba(255,255,255,.22)');
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * 6.28;
      ell(x, 8 + Math.cos(a) * 3.4, 8 + Math.sin(a) * 3.4, 1.15, 1.15);
      fs(x, '#dfe9a8'); st(x, '#5f3f1e', .6);
    }
    ell(x, 8, 8, 1.4, 1.4); fs(x, '#8fbf5a'); st(x, '#3d5f22', .7);
  })];
  // life-data block
  B.data = [bake(16, 16, function (x) {
    blockShell(x, 16, 16, '#3d63a8', '#16294d', 'rgba(255,255,255,.28)');
    x.font = 'bold 5px monospace'; x.fillStyle = '#7ff0ff'; x.textAlign = 'center';
    x.fillText('01', 8, 7.4); x.fillText('10', 8, 12.4);
  })];
  // brick
  B.brick = [bake(16, 16, function (x) {
    fs(x, '#a8613a'); x.fillRect(0, 0, 16, 16);
    x.strokeStyle = 'rgba(60,25,10,.85)'; x.lineWidth = .9;
    for (var r = 0; r < 4; r++) {
      x.beginPath(); x.moveTo(0, r * 4 + 4); x.lineTo(16, r * 4 + 4); x.stroke();
      var off = (r % 2) ? 0 : 4;
      for (var c = 0; c < 3; c++) {
        x.beginPath(); x.moveTo(off + c * 8, r * 4); x.lineTo(off + c * 8, r * 4 + 4); x.stroke();
      }
    }
    x.strokeStyle = 'rgba(255,220,180,.28)'; x.lineWidth = 1;
    x.strokeRect(.5, .5, 15, 15);
  })];
  // used / empty block
  B.used = [bake(16, 16, function (x) {
    rr(x, .5, .5, 15, 15, 2.2); fs(x, '#7c6a52'); st(x, '#3d3226', 1);
    rr(x, 2, 2, 12, 2, 1); fs(x, 'rgba(255,255,255,.12)');
  })];
  // hidden (revealed) block
  B.hidden = [bake(16, 16, function (x) {
    rr(x, .5, .5, 15, 15, 2.2); fs(x, '#cfa93f'); st(x, '#6f4b12', 1);
    ell(x, 8, 8, 2.2, 2.2); fs(x, '#fff6cf');
  })];
  return B;
}

/* ================= ENEMIES ================= */
function buildEnemies() {
  var E = {};

  /* fungi: clumped spore blob (walker) — a puff, not a "monster to exterminate" */
  E.sporeblob = [0, 1].map(function (i) {
    return bake(16, 14, function (x) {
      var sq = i ? .92 : 1;
      x.save(); x.translate(8, 13); x.scale(1 / sq, sq); x.translate(-8, -13);
      ell(x, 8, 8.4, 5.6, 5); fs(x, '#c9d98a'); st(x, '#5f6b33', 1);
      // puff lumps
      [[3.4, 5.4, 2.2], [8, 3.6, 2.6], [12.6, 5.6, 2.1]].forEach(function (p) {
        ell(x, p[0], p[1], p[2], p[2] * .85); fs(x, '#dcebA0'.replace('A0', 'a0')); st(x, '#5f6b33', .9);
      });
      ell(x, 6, 8.4, .8, 1); fs(x, '#3a4020');
      ell(x, 10.2, 8.4, .8, 1); fs(x, '#3a4020');
      x.beginPath(); x.moveTo(7, 10.6); x.quadraticCurveTo(8.2, 11.5, 9.6, 10.5); st(x, '#3a4020', .8);
      // feet
      ell(x, 5.4, 12.8, 1.5, .9); fs(x, '#8a9a52');
      ell(x, 10.8, 12.8, 1.5, .9); fs(x, '#8a9a52');
      x.restore();
    });
  });
  E.sporeblob_flat = [bake(16, 6, function (x) {
    ell(x, 8, 4.4, 6, 2); fs(x, '#b6c67a'); st(x, '#5f6b33', .9);
    for (var i = 0; i < 5; i++) { ell(x, 3 + i * 2.5, 2.6, .8, .7); fs(x, 'rgba(220,235,160,.9)'); }
  })];

  /* fungi: rolling contaminated mold ball */
  E.moldball = [0, 1, 2, 3].map(function (i) {
    return bake(14, 14, function (x) {
      x.save(); x.translate(7, 7); x.rotate(i / 4 * Math.PI / 2); x.translate(-7, -7);
      ell(x, 7, 7, 5.8, 5.8); fs(x, '#5f7a4a'); st(x, '#2b3a1e', 1);
      for (var k = 0; k < 7; k++) {
        var a = k / 7 * 6.28;
        ell(x, 7 + Math.cos(a) * 3.2, 7 + Math.sin(a) * 3.2, 1.3, 1.3);
        fs(x, k % 2 ? '#8fae6a' : '#3f5630');
      }
      ell(x, 7, 7, 1.8, 1.8); fs(x, '#c3d99a');
      x.restore();
    });
  });

  /* protist: pollution droplet (hops) */
  E.droplet = [0, 1].map(function (i) {
    return bake(14, 15, function (x) {
      var st_ = i ? -.6 : 0;
      x.beginPath();
      x.moveTo(7, 1.5 + st_);
      x.bezierCurveTo(11.5, 6 + st_, 12.8, 9, 12.8, 10.4);
      x.bezierCurveTo(12.8, 13.2, 10.2, 14.4, 7, 14.4);
      x.bezierCurveTo(3.8, 14.4, 1.2, 13.2, 1.2, 10.4);
      x.bezierCurveTo(1.2, 9, 2.5, 6 + st_, 7, 1.5 + st_);
      x.closePath();
      var g = x.createLinearGradient(0, 2, 0, 14);
      g.addColorStop(0, '#9c6ac2'); g.addColorStop(1, '#5a2f7d');
      fs(x, g); st(x, '#2c1440', 1);
      ell(x, 5.2, 10, .85, 1.05); fs(x, '#1a0c26');
      ell(x, 9, 10, .85, 1.05); fs(x, '#1a0c26');
      x.beginPath(); x.moveTo(5.8, 12.2); x.quadraticCurveTo(7, 11.4, 8.4, 12.2); st(x, '#1a0c26', .8);
      ell(x, 4.4, 6.6, 1.1, 1.6); fs(x, 'rgba(255,255,255,.35)');
    });
  });

  /* protist: red-tide cluster (drifts) — caused by pollution, not "evil life" */
  E.redtide = [0, 1, 2].map(function (i) {
    return bake(16, 16, function (x) {
      var t = i / 3 * 6.28;
      ell(x, 8, 8, 6.4, 6.4); fs(x, 'rgba(255,80,70,.22)');
      for (var k = 0; k < 8; k++) {
        var a = k / 8 * 6.28 + t * .3;
        var r = 3.4 + Math.sin(t + k) * .5;
        ell(x, 8 + Math.cos(a) * r, 8 + Math.sin(a) * r, 1.7, 1.7);
        fs(x, k % 2 ? '#ff5b45' : '#c9301f'); st(x, '#701208', .6);
      }
      ell(x, 8, 8, 2.4, 2.4); fs(x, '#ff8a70'); st(x, '#701208', .7);
      ell(x, 7, 7.2, .8, .8); fs(x, 'rgba(255,255,255,.5)');
    });
  });

  /* bacteria: data error body */
  E.dataerr = [0, 1].map(function (i) {
    return bake(14, 14, function (x) {
      x.save(); x.translate(7, 7); x.rotate(i ? .12 : -.12); x.translate(-7, -7);
      rr(x, 1.5, 1.5, 11, 11, 2); fs(x, '#7a2f9e'); st(x, '#2a0d3c', 1);
      x.font = 'bold 4px monospace'; x.fillStyle = '#ff8adf'; x.textAlign = 'center';
      x.fillText(i ? '10' : '01', 7, 6); x.fillText(i ? '01' : '11', 7, 10.5);
      // glitch bars
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.fillRect(1.5, i ? 4 : 8, 11, .8);
      x.restore();
    });
  });

  /* bacteria: overgrowth cluster (rapid multiply visual) */
  E.overgrow = [0, 1].map(function (i) {
    return bake(16, 14, function (x) {
      ell(x, 8, 8, 6.2, 5.2); fs(x, 'rgba(120,255,220,.16)');
      var n = i ? 6 : 5;
      for (var k = 0; k < n; k++) {
        var a = k / n * 6.28 + (i ? .4 : 0);
        rr(x, 8 + Math.cos(a) * 3 - 1.4, 8 + Math.sin(a) * 2.6 - .9, 2.8, 1.8, .9);
        fs(x, '#3fd8b0'); st(x, '#0d5546', .7);
      }
      ell(x, 8, 8, 1.6, 1.6); fs(x, '#c9fff0'); st(x, '#0d5546', .6);
    });
  });

  /* final: imbalance error body */
  E.imbalance = [0, 1, 2].map(function (i) {
    return bake(18, 18, function (x) {
      var t = i / 3 * 6.28;
      ell(x, 9, 9, 8, 8); fs(x, 'rgba(255,90,150,.15)');
      x.beginPath();
      for (var k = 0; k <= 12; k++) {
        var a = k / 12 * 6.28;
        var r = 5.6 + Math.sin(a * 3 + t) * 1.5;
        var px = 9 + Math.cos(a) * r, py = 9 + Math.sin(a) * r;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath();
      var g = x.createRadialGradient(9, 9, 1, 9, 9, 7);
      g.addColorStop(0, '#ffd2e4'); g.addColorStop(.5, '#ff4f8b'); g.addColorStop(1, '#7d1038');
      fs(x, g); st(x, '#40071c', 1);
      ell(x, 6.8, 8, 1, 1.3); fs(x, '#2a0512');
      ell(x, 11.2, 8, 1, 1.3); fs(x, '#2a0512');
      x.beginPath(); x.moveTo(6.6, 12); x.quadraticCurveTo(9, 10.2, 11.4, 12); st(x, '#2a0512', .9);
    });
  });

  /* ================= 왜냐면 과학실 hazards =================
     Keyed by the styled-PNG names the levels ask for, so a level never has to know
     whether the photo art shipped: Assets.img() wins when the file is there, and
     these code-drawn twins stand in when it is not. Same silhouettes either way. */

  /* 금 간 유리 조각 — sits still, cannot be stomped. Read as SHARP: hard spikes,
     cold highlights, no face. Nothing here should invite a jump on top. */
  E.hazard_glassshard_styled = [0, 1].map(function (i) {
    return bake(14, 12, function (x) {
      var gl = 0.55 + i * 0.25;
      // ground glitter
      x.save(); x.globalAlpha = gl * 0.5;
      ell(x, 7, 11, 6.4, 1.6); fs(x, 'rgba(190,240,255,.7)'); x.restore();
      // three shards of different heights
      [[2.2, 11.6, 4.4, 4.2], [6.0, 11.8, 8.2, 1.5], [8.6, 11.6, 12.4, 5.4]].forEach(function (p, k) {
        x.beginPath();
        x.moveTo(p[0], p[1]);
        x.lineTo(p[0] + (p[2] - p[0]) * 0.42, p[3]);
        x.lineTo(p[2], p[1]);
        x.closePath();
        var g = x.createLinearGradient(0, p[3], 0, p[1]);
        g.addColorStop(0, k % 2 ? '#eafcff' : '#d3f2ff');
        g.addColorStop(1, '#7fb6c9');
        fs(x, g); st(x, '#3d5f6e', 0.8);
      });
      // specular flash
      x.save(); x.globalAlpha = gl;
      x.beginPath(); x.moveTo(9.4, 7.4); x.lineTo(10.6, 9.6); st(x, '#ffffff', 0.9);
      x.restore();
    });
  });

  /* 굴러다니는 불씨 — rolls, and CAN be stomped (밟으면 꺼짐). Warm, round,
     obviously soft-edged, which is the visual opposite of the glass. */
  E.hazard_ember_styled = [0, 1, 2, 3].map(function (i) {
    return bake(12, 12, function (x) {
      var t = i / 4 * Math.PI * 2;
      x.save(); x.translate(6, 6); x.rotate(t); x.translate(-6, -6);
      ell(x, 6, 6, 5.6, 5.6); fs(x, 'rgba(255,150,60,.22)');
      var g = x.createRadialGradient(4.8, 4.6, 0.4, 6, 6, 4.4);
      g.addColorStop(0, '#fff3c4'); g.addColorStop(.45, '#ff9a2e'); g.addColorStop(1, '#a83c08');
      ell(x, 6, 6, 4.4, 4.4); fs(x, g); st(x, '#5e1d04', .8);
      // charred flecks so the roll is readable
      for (var k = 0; k < 4; k++) {
        var a = k / 4 * 6.28;
        ell(x, 6 + Math.cos(a) * 2.4, 6 + Math.sin(a) * 2.4, .7, .7); fs(x, 'rgba(90,30,5,.65)');
      }
      x.restore();
      // flame tongue always points up, never rotates with the body
      x.beginPath();
      x.moveTo(6, 0.6); x.quadraticCurveTo(8, 2.6, 6, 4.2);
      x.quadraticCurveTo(4, 2.6, 6, 0.6); x.closePath();
      fs(x, i % 2 ? '#ffd76a' : '#ffb03d');
    });
  });

  /* 떨어지는 유리병 — dropped from above by script, cannot be stomped. */
  E.hazard_fallingjar_styled = [bake(12, 14, function (x) {
    rr(x, 4.4, 0.6, 3.2, 2.2, .7); fs(x, '#9fb3bd'); st(x, '#33505e', .8);   // cap
    x.beginPath();
    x.moveTo(4.6, 2.6); x.lineTo(4.6, 4.4);
    x.bezierCurveTo(1.8, 5.6, 1.4, 7.6, 1.4, 9.6);
    x.lineTo(1.4, 12.2); x.quadraticCurveTo(1.4, 13.4, 3, 13.4);
    x.lineTo(9, 13.4); x.quadraticCurveTo(10.6, 13.4, 10.6, 12.2);
    x.lineTo(10.6, 9.6); x.bezierCurveTo(10.6, 7.6, 10.2, 5.6, 7.4, 4.4);
    x.lineTo(7.4, 2.6); x.closePath();
    var g = x.createLinearGradient(1, 0, 11, 14);
    g.addColorStop(0, 'rgba(214,246,255,.95)'); g.addColorStop(1, 'rgba(126,178,196,.95)');
    fs(x, g); st(x, '#31525f', .9);
    rr(x, 2.6, 9.2, 6.8, 3.4, 1); fs(x, 'rgba(120,205,175,.75)');            // liquid
    x.beginPath(); x.moveTo(3.4, 6.4); x.lineTo(3.4, 11); st(x, 'rgba(255,255,255,.8)', 1.1);
  })];

  /* 떠다니는 소문 말풍선 — stomping it means CHECKING it, so it pops. A speech
     bubble with a "?" reads as an unverified claim, not a creature. */
  E.hazard_rumor_styled = [0, 1].map(function (i) {
    return bake(16, 13, function (x) {
      var bob = i ? .5 : 0;
      rr(x, 0.8, 0.8 + bob, 14.4, 9.4, 3.4);
      fs(x, i ? '#fdfbff' : '#eef2ff'); st(x, '#5a5f8a', 1);
      // tail
      x.beginPath();
      x.moveTo(5, 9.8 + bob); x.lineTo(4.2, 12.4 + bob); x.lineTo(8, 10 + bob);
      x.closePath(); fs(x, i ? '#fdfbff' : '#eef2ff'); st(x, '#5a5f8a', 1);
      // "?" — the whole point of the hazard
      x.font = 'bold 7px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#7a4fd0'; x.fillText('?', 8, 5.6 + bob);
      // whisper dots trailing off
      x.globalAlpha = .55; x.fillStyle = '#a99ad8';
      ell(x, 12.6, 2.4 + bob, .7, .7); fs(x, '#a99ad8');
      ell(x, 14.2, 3.6 + bob, .5, .5); fs(x, '#a99ad8');
    });
  });

  /* falling rotten wood chunk */
  E.woodchunk = [bake(12, 10, function (x) {
    rr(x, 1, 1.5, 10, 7, 1.4); fs(x, '#6b4a2c'); st(x, '#2f1e10', 1);
    x.strokeStyle = 'rgba(40,25,12,.6)'; x.lineWidth = .7;
    for (var i = 0; i < 3; i++) { x.beginPath(); x.moveTo(2, 3 + i * 2); x.lineTo(10, 3.4 + i * 2); x.stroke(); }
    ell(x, 4, 3, 1, .7); fs(x, '#7e9a52');
  })];

  return E;
}

/* ================= PROPS (procedural) ================= */
function buildProps() {
  var R = {};

  /* mushroom bounce platform */
  R.shroom = [0, 1].map(function (i) {
    return bake(32, 18, function (x) {
      var squash = i ? .72 : 1;
      /* The cap used to be an r=14 half-disc centred at y=10, so its dome reached
         y=-4 — four pixels ABOVE this 32x18 canvas, which clipped the top flat and
         made the mushroom look broken. The dome is now sized to sit fully inside:
         centre y=13, r=11 spans y 2..13, and the stem runs from there to the
         bottom. Squash still pivots on the cap top, so the bounce reads the same. */
      var capCy = 13, capR = 11;
      // stem, behind the cap
      rr(x, 13.4, capCy - 1, 5.2, 18 - capCy + 1, 1.8);
      fs(x, '#f0e4cd'); st(x, '#6b5a3e', 1);
      // gills under the rim, so the cap does not float over the stem
      ell(x, 16, capCy, capR * 0.72, 1.5); fs(x, '#d8c7a6');
      // cap
      x.save(); x.translate(16, capCy); x.scale(1, squash); x.translate(-16, -capCy);
      x.beginPath(); x.arc(16, capCy, capR, Math.PI, 0); x.closePath();
      var g = x.createLinearGradient(0, capCy - capR, 0, capCy);
      g.addColorStop(0, '#ff7a6b'); g.addColorStop(1, '#c73b34');
      fs(x, g); st(x, '#5e1a16', 1.1);
      [[10, capCy - 6.5, 1.7], [16, capCy - 8.4, 2.2], [22.2, capCy - 6.2, 1.6],
       [13, capCy - 3, 1.2], [19.6, capCy - 2.6, 1.3]].forEach(function (p) {
        ell(x, p[0], p[1], p[2], p[2] * .8); fs(x, '#fff3e0'); st(x, 'rgba(120,40,30,.35)', .5);
      });
      x.restore();
    });
  });

  /* hyphae rope segment (single canvas — not a frame list) */
  R.hypha = bake(8, 16, function (x) {
    x.beginPath(); x.moveTo(4, 0); x.quadraticCurveTo(1.6, 8, 4, 16); st(x, '#e3d7b6', 2.6);
    x.beginPath(); x.moveTo(4, 0); x.quadraticCurveTo(1.6, 8, 4, 16); st(x, '#fffbe9', 1);
    ell(x, 4, 8, 1.5, 1.5); fs(x, '#fffbe9'); st(x, 'rgba(120,100,60,.5)', .5);
  });

  /* bubble (bounce, protist world) */
  R.bubble = [0, 1].map(function (i) {
    return bake(16, 16, function (x) {
      var r = i ? 6.8 : 6.2;
      ell(x, 8, 8, r, r);
      var g = x.createRadialGradient(6, 6, 1, 8, 8, r);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(.7, 'rgba(140,240,255,.22)');
      g.addColorStop(1, 'rgba(90,220,255,.5)');
      fs(x, g); st(x, 'rgba(190,250,255,.9)', 1);
      ell(x, 5.6, 5.4, 1.6, 1.1); fs(x, 'rgba(255,255,255,.8)');
    });
  });

  /* checkpoint beacon (procedural fallback / active state) */
  R.flag = [0, 1].map(function (i) {
    return bake(16, 40, function (x) {
      rr(x, 6.6, 2, 2.8, 38, 1.2); fs(x, '#b9c7d6'); st(x, '#39505f', .9);
      ell(x, 8, 2.5, 2.4, 2.4); fs(x, i ? '#8ee63f' : '#6fe6ff'); st(x, '#22303c', .8);
      // banner
      x.beginPath();
      x.moveTo(9.4, 5); x.lineTo(16, 7.4); x.lineTo(9.4, 11); x.closePath();
      fs(x, i ? '#8ee63f' : '#39e0ff'); st(x, '#22303c', .8);
    });
  });

  /* stage goal: world core pillar */
  R.goal = [0, 1, 2].map(function (i) {
    return bake(28, 56, function (x) {
      var t = i / 3 * 6.28;
      // pillar
      rr(x, 9, 12, 10, 42, 2); fs(x, '#20364e'); st(x, '#0d1b2b', 1);
      rr(x, 10.5, 14, 7, 38, 1.5); fs(x, 'rgba(90,220,255,.18)');
      // base
      rr(x, 4, 50, 20, 6, 2); fs(x, '#2c4763'); st(x, '#0d1b2b', 1);
      // core
      var pul = 1 + Math.sin(t) * .1;
      var g = x.createRadialGradient(14, 10, 1, 14, 10, 9 * pul);
      g.addColorStop(0, '#fff'); g.addColorStop(.4, '#7ff0ff'); g.addColorStop(1, 'rgba(57,224,255,0)');
      ell(x, 14, 10, 9 * pul, 9 * pul); fs(x, g);
      ell(x, 14, 10, 5 * pul, 5 * pul); fs(x, '#39e0ff'); st(x, '#0a4a63', 1);
      ell(x, 12.2, 8.2, 1.6, 1.2); fs(x, 'rgba(255,255,255,.85)');
      // rings
      for (var k = 0; k < 2; k++) {
        var rr_ = 7 + k * 2.5 + Math.sin(t + k) * .8;
        x.beginPath(); x.ellipse(14, 10, rr_, rr_ * .35, t * .5 + k, 0, 7);
        st(x, 'rgba(142,230,63,.7)', .8);
      }
    });
  });

  /* science transit tube (pipe) — single canvases */
  R.pipe = bake(32, 16, function (x) {
    rr(x, 0, 0, 32, 7, 2); fs(x, '#2f9c6a'); st(x, '#12452e', 1);
    rr(x, 2, 1.4, 28, 2, 1); fs(x, 'rgba(255,255,255,.28)');
    rr(x, 3, 7, 26, 9, 1); fs(x, '#268a5c'); st(x, '#12452e', 1);
    rr(x, 5.5, 7, 4, 9, 1); fs(x, 'rgba(255,255,255,.16)');
    rr(x, 22, 7, 3, 9, 1); fs(x, 'rgba(0,0,0,.14)');
  });
  R.pipebody = bake(32, 16, function (x) {
    rr(x, 3, 0, 26, 16, 1); fs(x, '#268a5c'); st(x, '#12452e', 1);
    rr(x, 5.5, 0, 4, 16, 1); fs(x, 'rgba(255,255,255,.16)');
    rr(x, 22, 0, 3, 16, 1); fs(x, 'rgba(0,0,0,.14)');
  });

  R.spike = bake(16, 8, function (x) {
    for (var i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(1 + i * 5, 8); x.lineTo(3.5 + i * 5, 1); x.lineTo(6 + i * 5, 8); x.closePath();
      fs(x, '#b9c7d6'); st(x, '#39505f', .8);
    }
  });

  /* moving platform */
  R.mplat = bake(48, 10, function (x) {
    rr(x, .5, .5, 47, 9, 2.5); fs(x, '#3a5a7d'); st(x, '#132538', 1);
    rr(x, 2, 1.6, 44, 2.6, 1.2); fs(x, 'rgba(140,230,255,.45)');
    for (var i = 0; i < 4; i++) { ell(x, 7 + i * 11, 7, .9, .9); fs(x, '#6fe6ff'); }
  });

  return R;
}

/* ================= TILES ================= */
/* Built per world from a palette + optional photo texture from assets/tex_*.jpg */
var TILESETS = {
  fungi: { top: '#6fbf4a', topHi: '#a8e86f', body: '#7a5334', bodyDk: '#4e341f', edge: '#2b1a0e', tex: 'tex_fungi_ground' },
  fungi_dark: { top: '#8a6a44', topHi: '#b08a5c', body: '#4a3524', bodyDk: '#2e2015', edge: '#1a1009', tex: 'tex_rotten_bark' },
  protist: { top: '#4fd6a8', topHi: '#9cf5d4', body: '#2b6e6a', bodyDk: '#17423f', edge: '#0a2422', tex: 'tex_protist_algae' },
  protist_deep: { top: '#5aa8c9', topHi: '#a5e2f5', body: '#2a5470', bodyDk: '#15303f', edge: '#08181f', tex: 'tex_protist_waterbed' },
  bacteria: { top: '#7fe8ff', topHi: '#d6faff', body: '#33507a', bodyDk: '#1c2e4a', edge: '#0a1424', tex: 'tex_bacteria_city_floor' },
  purify: { top: '#b8e6ff', topHi: '#eaf8ff', body: '#5e7a94', bodyDk: '#35485c', edge: '#131f2b', tex: 'tex_purification_facility' },
  core: { top: '#b98aff', topHi: '#e6d2ff', body: '#3b2a63', bodyDk: '#221741', edge: '#0d0820', tex: 'tex_hologram_grid' },

  /* ---- 왜냐면 과학실 worlds ----
     truthroom deliberately reuses tex_labroom_floor: it is the same physical room
     as world 1 at the climax, so a second floor texture would break that read. */
  labroom:   { top: '#c9b896', topHi: '#e8dcc0', body: '#8a6f4a', bodyDk: '#5c4a30', edge: '#2e2416', tex: 'tex_labroom_floor' },
  backyard:  { top: '#7fc94a', topHi: '#b0e878', body: '#8a6a44', bodyDk: '#5c4a2e', edge: '#2e2418', tex: 'tex_backyard_ground' },
  chatspace: { top: '#8fd6ff', topHi: '#c8ecff', body: '#3a4a7a', bodyDk: '#222e4a', edge: '#0f1424', tex: 'tex_chatspace_surface' },
  truthroom: { top: '#ffd68a', topHi: '#ffe8b8', body: '#a8875a', bodyDk: '#6c5230', edge: '#2e2010', tex: 'tex_labroom_floor' }
};

function makeTile(pal, mask, tex) {
  // mask bits: 1=up open, 2=right open, 4=down open, 8=left open
  return bake(TILE, TILE, function (x) {
    var open = { u: !!(mask & 1), r: !!(mask & 2), d: !!(mask & 4), l: !!(mask & 8) };
    // body
    var g = x.createLinearGradient(0, 0, 0, TILE);
    g.addColorStop(0, pal.body); g.addColorStop(1, pal.bodyDk);
    x.fillStyle = g; x.fillRect(0, 0, TILE, TILE);
    // photo texture overlay
    if (tex) {
      x.save(); x.globalAlpha = .34; x.globalCompositeOperation = 'overlay';
      x.drawImage(tex, 0, 0, TILE, TILE); x.restore();
    }
    // grass / top cap
    if (open.u) {
      x.fillStyle = pal.top; x.fillRect(0, 0, TILE, 4.4);
      x.fillStyle = pal.topHi; x.fillRect(0, 0, TILE, 1.6);
      // little drips
      x.fillStyle = pal.top;
      [2, 7, 12].forEach(function (dx, i) {
        var h = 2 + (i % 2) * 1.6;
        x.fillRect(dx, 4.4, 3, h);
      });
    }
    // side highlights
    x.fillStyle = 'rgba(255,255,255,.10)';
    if (open.l) x.fillRect(0, open.u ? 4.4 : 0, 1.4, TILE);
    x.fillStyle = 'rgba(0,0,0,.22)';
    if (open.r) x.fillRect(TILE - 1.4, open.u ? 4.4 : 0, 1.4, TILE);
    if (open.d) x.fillRect(0, TILE - 1.4, TILE, 1.4);
    // outline on exposed edges
    x.strokeStyle = pal.edge; x.lineWidth = 1;
    x.beginPath();
    if (open.u) { x.moveTo(0, .5); x.lineTo(TILE, .5); }
    if (open.d) { x.moveTo(0, TILE - .5); x.lineTo(TILE, TILE - .5); }
    if (open.l) { x.moveTo(.5, 0); x.lineTo(.5, TILE); }
    if (open.r) { x.moveTo(TILE - .5, 0); x.lineTo(TILE - .5, TILE); }
    x.stroke();
  });
}
function buildTileset(name, tex) {
  var pal = TILESETS[name];
  var set = [];
  for (var m = 0; m < 16; m++) set[m] = makeTile(pal, m, tex);
  // semi-solid platform
  set.plat = bake(TILE, 6, function (x) {
    rr(x, .3, .3, TILE - .6, 5.4, 1.6); fs(x, pal.body); st(x, pal.edge, .9);
    x.fillStyle = pal.top; x.fillRect(1, 1, TILE - 2, 2);
    x.fillStyle = pal.topHi; x.fillRect(1, 1, TILE - 2, .9);
  });
  return set;
}

/* ================= TITLE LOGO (canvas text, exact wording) =================
   Currently unused: the title screen is the key art, which carries its own
   lettering. Kept because it is the only code path that can draw a title without
   any image at all. */
function drawLogo(cv) {
  var w = 1000, h = 380;
  cv.width = w; cv.height = h;
  var x = cv.getContext('2d');
  x.clearRect(0, 0, w, h);
  var fam = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","맑은 고딕",sans-serif';

  function chunky(text, size, cx, cy, fills) {
    x.save();
    x.font = '900 ' + size + 'px ' + fam;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    // dark outline layers
    x.strokeStyle = '#14243c'; x.lineWidth = size * .30; x.strokeText(text, cx, cy);
    x.strokeStyle = '#ffffff'; x.lineWidth = size * .17; x.strokeText(text, cx, cy);
    x.strokeStyle = '#14243c'; x.lineWidth = size * .07; x.strokeText(text, cx, cy);
    // gradient fill
    var g = x.createLinearGradient(0, cy - size * .55, 0, cy + size * .55);
    fills.forEach(function (f, i) { g.addColorStop(i / (fills.length - 1), f); });
    x.fillStyle = g; x.fillText(text, cx, cy);
    // top gloss
    x.save();
    x.beginPath(); x.rect(0, cy - size * .56, w, size * .30); x.clip();
    x.fillStyle = 'rgba(255,255,255,.38)'; x.fillText(text, cx, cy);
    x.restore();
    x.restore();
  }

  // sized + spaced so the lower line's outline never eats the upper line
  chunky('왜냐면', 120, 500, 80, ['#ffe98a', '#ffc23d', '#e08a12']);
  chunky('과학실', 185, 500, 252, ['#9ff4ff', '#3aa8ff', '#2748c8']);

  // star accent
  x.save();
  x.translate(672, 44); x.rotate(.2);
  x.beginPath();
  for (var i = 0; i < 10; i++) {
    var a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 10 : 24;
    x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  x.closePath();
  x.fillStyle = '#6fe6ff'; x.strokeStyle = '#14243c'; x.lineWidth = 6;
  x.fill(); x.stroke();
  x.restore();
  return cv;
}

W.SM.Art = {
  S: S, TILE: TILE, bake: bake, rr: rr, ell: ell, fs: fs, st: st, P: P,
  buildPlayer: buildPlayer, buildOrb: buildOrb, buildBlocks: buildBlocks,
  buildEnemies: buildEnemies, buildProps: buildProps,
  buildTileset: buildTileset, TILESETS: TILESETS, drawLogo: drawLogo,
  drawExplorer: drawExplorer
};
})(window);
