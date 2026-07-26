/* ===== 왜냐면 과학실 — level data & builder =====
   Grid: 18 rows tall. Segments are BOTTOM-ALIGNED: you write only the lower rows and
   seg() pads empties on top, so every segment's ground lines up by construction.
   Ground occupies rows 15,16,17 (top surface y = 240). Device anchors sit at row 14.

   Legend
     .  empty            #  solid          =  semi-solid platform   B  brick
     ?  capsule block    S  spore block    D  data block            H  hidden block
     o  orb              *  big orb        M  mushroom bounce       b  bubble bounce
     P  pipe top         p  pipe body      C  checkpoint            F  goal core
     @  spawn            X  h-moving plat  Y  v-moving plat         Z  falling plat
     ~  hyphae rope      G  device anchor  g  device anchor 2
     w  current right    W  current left
     1 spore blob  2 mold ball  3 falling wood  4 droplet  5 red tide  6 data error  7 overgrowth
     V 유리 조각(밟을 수 없음)  R 불씨(밟으면 꺼짐)  L 떨어지는 유리병  Q 소문 말풍선(밟으면 확인)
*/
(function (W) {
'use strict';

var H = 18;

function seg(rows) {
  var w = 0, i;
  for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
  var blank = new Array(w + 1).join('.');
  var out = [];
  for (i = 0; i < H - rows.length; i++) out.push(blank);
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    while (r.length < w) r += '.';
    out.push(r);
  }
  if (out.length !== H) throw new Error('seg height ' + out.length);
  return out;
}
function join(segs) {
  var out = [];
  for (var r = 0; r < H; r++) {
    var line = '';
    for (var s = 0; s < segs.length; s++) line += segs[s][r];
    out.push(line);
  }
  return out;
}
var GND = ['################', '################', '################'];
function g(n) { var s = new Array(n + 1).join('#'); return [s, s, s]; }

/* ============================================================
   STAGE 1 — 균류 숲
   Opening mirrors SMB 1-1's teaching order:
   risk-free walking -> lone reward block -> approaching enemy ->
   constrained geometry -> escalate one variable -> first pit.
   ============================================================ */
var S1 = {
  id: 's1', world: 'fungi', name: '균류 숲',
  tiles: 'fungi', tiles2: 'fungi_dark',
  bg: 'bg_fungi', music: 'explore', amb: 'fungi',
  intro: {
    eyebrow: 'STAGE 1', title: '균류 숲',
    note: '비가 그친 뒤의 버섯 숲이에요. 버섯과 곰팡이는 실처럼 가늘고 긴 균사로 이루어진 균류예요. 숲 끝의 균류 코어를 찾아 주세요.',
    art: 'loading_fungi_zone'
  },
  rows: join([
    /* 1. only walking is possible */
    seg(['.@..............'].concat(GND)),
    /* 2. one lone capsule block, reachable with a plain standing jump */
    seg([
      '.....?......',
      '............',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* 3. first enemy approaches; ceiling row teaches that geometry matters */
    seg([
      '....BBBB....',
      '............',
      '...?B?B?....',
      '............',
      '............',
      '.........1..',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* 4. mushroom bounce over safe ground */
    seg([
      '.......o.o..',
      '............',
      '......o.o...',
      '............',
      '......M.....',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* 5. escalate a single variable: step height */
    seg([
      '..........oo....',
      '.........=====..',
      '......o.........',
      '.....===........',
      '..o.............',
      '.===......1.....',
      '################',
      '################',
      '################'
    ]),
    /* 6. first pit */
    seg([
      '....oo....',
      '..........',
      '..........',
      '####..####',
      '####..####',
      '####..####'
    ]),
    /* 7. hidden block reveals a step up to a big orb */
    seg([
      '.......*....',
      '......===...',
      '............',
      '...H........',
      '.......o....',
      '............',
      '......1.....',
      '############',
      '############',
      '############'
    ]),
    /* 8. bonus pipe -> microscope observation room */
    seg([
      '..o.o.....',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    /* 9. rolling mold ball + gap */
    seg([
      '.....oo.....',
      '....====....',
      '............',
      '..2.........',
      '............',
      '............',
      '####...#####',
      '####...#####',
      '####...#####'
    ]),
    /* 10. checkpoint */
    /* checkpoint, then the OBSERVATION GATE (K): 7 tiles tall, so it cannot be
       jumped or sprinted over. It stands a short walk past the pipe — far enough
       that finding the pipe still feels like exploring, close enough that walking
       back costs seconds. The checkpoint sits just before it on purpose. */
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* 11. falling rotten wood under a bark ceiling */
    seg([
      '.BBBBBBBBBBB.',
      '.............',
      '...3.....3...',
      '.............',
      '.....o.o.....',
      '.............',
      '.............',
      '#############',
      '#############',
      '#############'
    ]),
    /* 12. REQUIRED MISSION: humidity + ventilation -> a hyphae bridge grows */
    seg([
      '........................',
      '........................',
      '..G.....g...............',
      '##########..............',
      '##########..............',
      '##########..............'
    ]),
    /* 13. landing */
    seg(['....oo....', '..........', '..........'].concat(g(10))),
    /* 14. moving platforms over a pit */
    seg([
      '...*......',
      '..........',
      '..X....X..',
      '..........',
      '..........',
      '###....###',
      '###....###',
      '###....###'
    ]),
    /* 15. stepped climb with blobs */
    seg([
      '..........oo....',
      '.........=====..',
      '.......1........',
      '.....=====......',
      '..o.............',
      '..===...........',
      '...........1....',
      '................',
      '################',
      '################',
      '################'
    ]),
    /* 16. dead-wood wall — too tall to jump (7 tiles); decomposition opens it */
    seg([
      '.....BB..',
      '.....BB..',
      '.....BB..',
      '.....BB..',
      '..o..BB..',
      '.....BB..',
      '.....BB..',
      '#########',
      '#########',
      '#########'
    ]),
    /* 17. goal */
    /* 17. goal — nothing to do here but finish. The observation gate sits back
       near the pipe, so by the time the player arrives the learning is done. */
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'b1', kind: 'bonus' } },
  devices: {
    /* One console opens the mission. The vent tower used to carry mission:'humidity'
       too, which made it a second, redundant start button for the same popup — and
       once the mission was done it went inert and read as scenery. It is now a
       STATUS device: no mission of its own, it just shows what the console did. */
    G: { kind: 'humidity', img: 'obj_humidity_regulator', w: 22, h: 24, mission: 'humidity' },
    g: { kind: 'vent', img: 'obj_ventilation_tower', w: 15, h: 28, status: 'vent' }
  },
  bridge: true,
  goal: {
    title: '균사 다리를 만들어 끊어진 길을 이으세요.',
    how: '빛나는 초록 화살표 장치에서 ↓(또는 S)를 누르세요.',
    next: '오른쪽 길이 이어져요.',
    total: 0,
    hints: ['오른쪽으로 계속 가면 빛나는 장치가 있어요.',
            '장치 바로 위에 서서 아래 방향키를 눌러 보세요.',
            '균류는 따뜻하고 습한 곳에서 잘 자라요.']
  },
  facts: [
    '버섯과 곰팡이는 균사로 이루어진 균류예요.',
    '균류는 포자로 번식하고 따뜻하고 습한 곳에서 잘 자라요.',
    '죽은 생물을 분해하지만 음식도 상하게 할 수 있어요.'
  ],
  clearImg: 'impact_decaying_log',
  badge: 'badge_fungi_researcher',
  core: 'fungi'
};

var B1 = {
  id: 'b1', world: 'fungi', name: '균류 관찰실', sub: true,
  tiles: 'fungi_dark', bg: 'bg_fungi', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'scope', img: 'obj_scan_beacon', w: 16, h: 26, mission: 'scope_fungi' } }
};

/* ============================================================
   STAGE 2 — 원생생물 연못
   ============================================================ */
var S2 = {
  id: 's2', world: 'protist', name: '원생생물 연못',
  tiles: 'protist', tiles2: 'protist_deep',
  bg: 'bg_protist', music: 'explore', amb: 'protist',
  water: true,
  intro: {
    eyebrow: 'STAGE 2', title: '원생생물 연못',
    note: '한 방울의 연못물 속이에요. 해캄과 짚신벌레 같은 생물을 원생생물이라고 해요. 오염 물질이 흘러드는 곳을 찾아 물을 되살려 주세요.',
    art: 'loading_protist_zone'
  },
  rows: join([
    seg(['.@..........$...'].concat(GND)),
    /* bubbles teach the floatier feel, safely */
    seg([
      '.......o.o......',
      '................',
      '......o...o.....',
      '................',
      '.......b........',
      '................',
      '################',
      '################',
      '################'
    ]),
    /* 해캄 strands = climbable ropes */
    seg([
      '....~....~......',
      '....~....~......',
      '....~....~..o...',
      '....~....~......',
      '....~....~......',
      '..o.~..o.~......',
      '....~....~......',
      '................',
      '.......4........',
      '################',
      '################',
      '################'
    ]),
    /* current pushes right — the flow sits at body height so it actually shoves you,
       and the pit stays inside a walking jump (3 tiles) because the push is constant */
    seg([
      '....o..o..o.....',
      '................',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      '######...#######',
      '######...#######',
      '######...#######'
    ]),
    /* 3-tile pit: clearable with a plain walking jump. The bubble only exists to
       fling you up to the big orb — it is never required to cross. */
    seg([
      '.....*..........',
      '................',
      '......b.........',
      '................',
      '................',
      '######...#######',
      '######...#######',
      '######...#######'
    ]),
    /* bonus pipe — flat, no pit; the droplet sits away from the pipe mouth */
    seg([
      '.4.o.o....',
      '..........',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    /* checkpoint, then the OBSERVATION GATE (K): 7 tiles tall, so it cannot be
       jumped or sprinted over. It stands a short walk past the pipe — far enough
       that finding the pipe still feels like exploring, close enough that walking
       back costs seconds. The checkpoint sits just before it on purpose. */
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* pollution begins — first valve */
    seg([
      '..............',
      '..............',
      '.....G........',
      '..............',
      '...4......4...',
      '..............',
      '..............',
      '##############',
      '##############',
      '##############'
    ]),
    /* red tide drifts above; the moving platforms sit just above floor height
       so stepping on is a hop, not a leap of faith */
    seg([
      '......5.......',
      '..............',
      '..............',
      '..............',
      '.....5........',
      '..............',
      '...X.....X....',
      '###........###',
      '###........###',
      '###........###'
    ]),
    /* second valve on a ledge; a droplet guards the corridor into the last valve */
    seg([
      '..............',
      '.....===......',
      '.....G........',
      '..o...........',
      '.====.........',
      '..............',
      '...4.....5....',
      '..............',
      '##############',
      '##############',
      '##############'
    ]),
    /* third valve beside the contamination pipe */
    seg([
      '...............',
      '...............',
      '......G........',
      '...............',
      '...g...........',
      '....4.....4....',
      '...............',
      '###############',
      '###############',
      '###############'
    ]),
    /* climb */
    seg([
      '.........o..',
      '........===.',
      '............',
      '.....o......',
      '....===.....',
      '............',
      '..o.........',
      '.===........',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    seg([
      '....*.....',
      '..........',
      '...b......',
      '..........',
      '..........',
      '###....###',
      '###....###',
      '###....###'
    ]),
    /* 17. goal — nothing to do here but finish. The observation gate sits back
       near the pipe, so by the time the player arrives the learning is done. */
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'b2', kind: 'bonus' } },
  devices: {
    G: { kind: 'valve', img: 'obj_water_purification_valve', w: 18, h: 20, mission: 'valves' },
    g: { kind: 'cpipe', img: 'obj_contamination_pipe', w: 26, h: 16, deco: true }
  },
  valveCount: 3,
  goal: {
    title: '오염 물질이 들어오는 밸브를 모두 잠그세요.',
    how: '빛나는 밸브 장치 위에서 ↓(또는 S)를 누르세요.',
    next: '붉은 물이 맑아져요.',
    total: 3,
    hints: ['빛나는 장치를 찾아 오른쪽으로 나아가세요.',
            '적조 덩어리를 없앨 필요는 없어요. 오염 원인을 막으면 돼요.',
            '장치 바로 위에 서서 아래 방향키를 눌러 보세요.']
  },
  facts: [
    '해캄과 짚신벌레 같은 생물을 원생생물이라고 해요.',
    '원생생물은 주로 논, 연못, 하천처럼 물이 있는 곳에서 살아요.',
    '일부 원생생물이 지나치게 늘어나면 적조 피해가 생길 수 있어요.'
  ],
  clearImg: 'impact_red_tide',
  badge: 'badge_protist_researcher',
  core: 'protist'
};

var B2 = {
  id: 'b2', world: 'protist', name: '연못물 관찰실', sub: true,
  tiles: 'protist_deep', bg: 'bg_protist', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'scope', img: 'obj_scan_beacon', w: 16, h: 26, mission: 'scope_protist' } }
};

/* ============================================================
   STAGE 3 — 세균 데이터 도시
   ============================================================ */
var S3 = {
  id: 's3', world: 'bacteria', name: '세균 데이터 도시',
  tiles: 'bacteria', tiles2: 'purify',
  bg: 'bg_bacteria', music: 'explore', amb: 'bacteria',
  intro: {
    eyebrow: 'STAGE 3', title: '세균 데이터 도시',
    note: '세균은 균류나 원생생물보다 훨씬 작아 맨눈으로 관찰하기 어려워요. 멈춰 버린 발효 공장과 정화 시설을 되살려 주세요.',
    art: 'loading_bacteria_zone'
  },
  startBanner: '세균은 <b>맨눈으로 관찰하기 어려워요.</b> 사진 자료로 생김새를 조사해 봅시다.',
  rows: join([
    seg(['.@..............'].concat(GND)),
    seg([
      '....DDD.....',
      '............',
      '............',
      '............',
      '.......6....',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* rapidly-multiplying temporary platforms — they collapse under you, so keep
       the hops short (3 tiles) and the pit narrow enough to recover */
    seg([
      '.....oo.....o...',
      '................',
      '..Z..Z..Z..Z..Z.',
      '................',
      '................',
      '####........####',
      '####........####',
      '####........####'
    ]),
    seg([
      '......*.......',
      '..............',
      '..............',
      '....6.....6...',
      '..............',
      '...X......X...',
      '###........###',
      '###........###',
      '###........###'
    ]),
    seg([
      '...o.o....',
      '..........',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    seg(['....C.....', '..........', '..........'].concat(g(10))),
    /* MISSION A: shape classification -> the shape gate opens */
    /* This wall used to be opened by a 'classify' device standing at its foot —
       but that mission was the same bacteria photo-reading activity as the pipe
       room, so the stage taught it twice. The device is gone and the full
       activity now lives only in the pipe room; the wall became the gate. */
    seg([
      '..........KK..',
      '..........KK..',
      '..........KK..',
      '..........KK..',
      '..........KK..',
      '..........KK..',
      '..........KK..',
      '##############',
      '##############',
      '##############'
    ]),
    seg([
      '.....oo.......',
      '....=====.....',
      '..............',
      '...7......7...',
      '..............',
      '..............',
      '..............',
      '##############',
      '##############',
      '##############'
    ]),
    /* MISSION B: fermentation tank (김치·요구르트) */
    seg([
      '.............BBB..',
      '.............BBB..',
      '.............BBB..',
      '.............BBB..',
      '.............BBB..',
      '.............BBB..',
      '..G..........BBB..',
      '##################',
      '##################',
      '##################'
    ]),
    seg([
      '.....oo.....',
      '............',
      '............',
      '............',
      '..X......X..',
      '###......###',
      '###......###',
      '###......###'
    ]),
    /* MISSION C: purification facility */
    seg([
      '..............BBB.',
      '..............BBB.',
      '..............BBB.',
      '..............BBB.',
      '..............BBB.',
      '.....6...6....BBB.',
      '..G...g.......BBB.',
      '##################',
      '##################',
      '##################'
    ]),
    seg([
      '..........o.....',
      '.........====...',
      '................',
      '......o.........',
      '.....====.......',
      '................',
      '..o.........7...',
      '.===............',
      '################',
      '################',
      '################'
    ]),
    /* 17. goal — nothing to do here but finish. The observation gate sits back
       near the pipe, so by the time the player arrives the learning is done. */
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'b3', kind: 'bonus' } },
  devices: {
    G: { kind: 'multi', w: 22, h: 24 },
    g: { kind: 'purifytile', img: 'obj_sterilization_station', w: 20, h: 22, deco: true }
  },
  multiOrder: [
    /* 'classify' removed: it repeated the pipe room's photo-reading activity.
       Its wall is now the observation gate. */
    { kind: 'ferment', img: 'obj_fermentation_tank', mission: 'bacteria_roles' },
    { kind: 'purify', img: 'obj_water_purification_valve', mission: 'bacteria_habitat' }
  ],
  goal: {
    title: '데이터 오류체를 정화하세요.',
    how: '빛나는 스위치를 작동하세요.',
    next: '막힌 벽이 열리고 포털이 활성화돼요.',
    total: 2,
    hints: ['빛나는 화살표가 있는 스위치를 찾아보세요.',
            '스위치 바로 위에 서서 아래 방향키(↓)를 누르세요.',
            '두 곳을 모두 정화하면 출구가 열려요.']
  },
  facts: [
    '세균에는 공 모양, 막대 모양, 나선 모양 등이 있어요.',
    '세균은 알맞은 조건에서 빠르게 번식할 수 있어요.',
    '발효와 정화에 이용되기도 하고 질병을 일으키는 경우도 있어요.'
  ],
  clearImg: 'impact_kimchi',
  badge: 'badge_bacteria_researcher',
  core: 'bacteria'
};

var B3 = {
  id: 'b3', world: 'bacteria', name: '세균 자료실', sub: true,
  tiles: 'purify', bg: 'bg_bacteria', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'scope', img: 'obj_data_core', w: 18, h: 18, mission: 'scope_bacteria' } }
};

/* ============================================================
   STAGE 4 — 생명의 균형 코어
   ============================================================ */
var S4 = {
  id: 's4', world: 'core', name: '생명의 균형 코어',
  tiles: 'core', tiles2: 'fungi_dark',
  bg: 'bg_bacteria', music: 'explore', amb: 'core',
  intro: {
    eyebrow: 'FINAL STAGE', title: '생명의 균형 코어',
    note: '균류·원생생물·세균의 역할이 멈추자 세상의 균형이 무너지고 있어요. 네 곳을 되살리고 균형 오류 코어를 멈춰 주세요.',
    art: 'loading_balance_core'
  },
  rows: join([
    seg(['.@..............'].concat(GND)),
    /* 상황 1 — 분해가 멈춘 숲: 균류 코어를 켜면 분해가 되살아나 길이 열려요 */
    seg([
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..o.......BBBB.....',
      '...3......BBBB.....',
      '..G.......BBBB.....',
      '###################',
      '###################',
      '###################'
    ]),
    seg(['....oo....', '..........', '..........'].concat(g(10))),
    /* 상황 2 — 발효가 멈춘 주방 */
    seg([
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..........BBBB.....',
      '..o..6....BBBB.....',
      '..G.......BBBB.....',
      '###################',
      '###################',
      '###################'
    ]),
    seg([
      '.....*......',
      '............',
      '............',
      '............',
      '..X......X..',
      '###......###',
      '###......###',
      '###......###'
    ]),
    /* 상황 3 — 붉어진 바다: 원생생물을 없애지 않고 오염수 유입만 막아요 */
    seg([
      '..........BBBB......',
      '..........BBBB......',
      '..........BBBB......',
      '..........BBBB......',
      '..........BBBB......',
      '.....5..5.BBBB......',
      '..G...g...BBBB......',
      '####################',
      '####################',
      '####################'
    ]),
    seg(['....C.....', '..........', '..........'].concat(g(10))),
    /* 상황 4 — 곰팡이가 퍼진 식품 보관실 */
    seg([
      '..........BBBB......',
      '..........BBBB......',
      '..........BBBB......',
      '..........BBBB......',
      '..o.......BBBB......',
      '.....2....BBBB......',
      '..G...g...BBBB......',
      '####################',
      '####################',
      '####################'
    ]),
    /* 3-tile pit: inside a plain walking jump (3.66 tiles). The ledge above is a
       bonus route to the orbs, never the way through. */
    seg([
      '.....oo.....',
      '............',
      '....====....',
      '............',
      '............',
      '####...#####',
      '####...#####',
      '####...#####'
    ]),
    /* finale arena — a checkpoint right at the door so a miss costs seconds, not
       the whole stage.

       The row-11 ledges are the only place the boss can be stomped from, and they
       sit 64px above the floor. A walking jump only lifts ~59px, so they used to
       need a SPRINT — which touch players have no button for, making the last
       stage unfinishable on a tablet. The '===' step at row 13 fixes that: floor
       -> step -> ledge is two ordinary jumps (32px each), while a sprint jump
       still passes straight through it (semi-solids only catch a falling player)
       and reaches the ledge in one go, so the shortcut survives.

       It sits under the LEFT ledge on purpose. The centre gap looks like the
       natural spot, but the boss patrols cols 145.75-151.25 and dips to y=192,
       so a step there would park the player's head inside the boss. */
    seg([
      '........................',
      '........................',
      '........................',
      '..======....======......',
      '........................',
      '..C.===.F...............',
      '........................',
      '########################',
      '########################',
      '########################'
    ])
  ]),
  warps: {},
  devices: {
    G: { kind: 'multi', w: 22, h: 26 },
    g: { kind: 'deco2', w: 18, h: 22 }
  },
  multiOrder: [
    { kind: 'fungicore', img: 'obj_spore_storm_core', mission: 'restore_fungi' },
    { kind: 'fermcore', img: 'obj_fermentation_tank', mission: 'restore_ferment' },
    { kind: 'seacore', img: 'obj_water_purification_valve', mission: 'restore_sea' },
    { kind: 'moldcore', img: 'obj_humidity_regulator', mission: 'restore_mold' }
  ],
  decoOrder: [
    { img: 'obj_contamination_pipe', w: 26, h: 16 },
    { img: 'obj_ventilation_tower', w: 15, h: 28 }
  ],
  boss: true,
  goal: {
    title: '멈춰 버린 네 곳의 역할을 되살리세요.',
    how: '빛나는 스위치 위에서 ↓(또는 S)를 누르세요.',
    next: '균형 오류 코어가 나타나요.',
    total: 4,
    hints: ['숲 · 주방 · 바다 · 보관실을 차례로 되살려요.',
            '생물을 없애는 게 아니라 환경을 바로잡는 거예요.',
            '빛나는 화살표가 있는 스위치 위에 서서 아래 방향키를 누르세요.']
  },
  facts: [
    '균류·원생생물·세균은 모두 생태계에서 중요한 역할을 해요.',
    '생물을 없애는 것이 아니라 균형을 되찾는 것이 중요해요.'
  ],
  clearImg: 'impact_water_purification',
  badge: 'badge_balance_guardian',
  core: 'balance'
};

/* ============================================================
   왜냐면 과학실 1권 — 아무도 다치지 않았다

   Every world repeats S1's teaching order, because it works:
     risk-free walking -> a lone reward -> the first hazard, alone and slow ->
     a breather -> the pipe (required mission, grants the card) -> checkpoint ->
     the observation gate -> the same hazard escalated -> the goal.

   The pipe/gate loop is unchanged from the original game: the K wall is 7 tiles
   tall so it cannot be jumped, and only the card earned inside the pipe room
   opens it. The checkpoint sits just before the gate so walking back to the pipe
   costs seconds, not a life.
   ============================================================ */

/* ---- WORLD 1: 낡은 과학실 ----
   Teaches the one rule the whole book turns on: 금 간 유리는 만지지 않는다.
   The glass shards are the first hazard in the game that CANNOT be dealt with by
   jumping on it. There is no move that "solves" them — you go around. */
var W1 = {
  id: 'w1', world: 'labroom', name: '낡은 과학실',
  tiles: 'labroom', tiles2: 'labroom',
  bg: 'world_labroom_bg', music: 'explore', amb: 'core',
  intro: {
    eyebrow: 'WORLD 1', title: '낡은 과학실',
    note: '오래 방치된 과학실이에요. 위험한 것들을 그냥 지나치지 말고, 확인하면서 나아가세요.',
    art: 'loading_labroom_zone'
  },
  rows: join([
    /* 1. only walking is possible */
    seg(['.@..............'].concat(GND)),
    /* 2. one lone capsule, reachable with a plain standing jump */
    seg([
      '.....?......',
      '............',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* 3. the first 유리 조각 — alone, on open floor, with orbs overhead drawing
       the jump line. Stomping it does nothing, so the only lesson available is
       "go over it". */
    seg([
      '............',
      '........oo..',
      '............',
      '.........V..',
      '############',
      '############',
      '############'
    ]),
    /* 4. breather: step height only */
    seg([
      '..........oo....',
      '.........=====..',
      '......o.........',
      '.....===........',
      '..o.............',
      '.===............',
      '################',
      '################',
      '################'
    ]),
    /* 5. 떨어지는 유리병 under a shelf: it drops when you are beneath it, so the
       lesson is to look up before walking under things */
    seg([
      '.BBBBBBBBBBB.',
      '.............',
      '...L.....L...',
      '.............',
      '.....o.o.....',
      '.............',
      '.............',
      '#############',
      '#############',
      '#############'
    ]),
    /* 6. the pipe down to the 확인 room */
    seg([
      '..o.o.....',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    /* 7. checkpoint, then the observation gate */
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* 8. both hazards at once — shards on the floor, jars overhead. The landing
       spots between shards are 4-5 tiles wide, so a careful player always has
       somewhere safe to come down. */
    seg([
      '..BBBBBBBBBB..',
      '..............',
      '.....L....L...',
      '..............',
      '...o......o...',
      '..............',
      '..V....V...V..',
      '##############',
      '##############',
      '##############'
    ]),
    /* 9. goal */
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'bw1', kind: 'bonus' } },
  goal: {
    title: '깨진 유리를 어떻게 해야 할지 확인하세요.',
    how: '파이프를 타고 내려가, 빛나는 장치 위에서 ↓(또는 S)를 누르세요.',
    next: '선생님께 알리는 법을 알게 돼요.',
    total: 1,
    hints: ['짐작하지 말고, 배운 대로 확인해보세요.',
            '바닥의 초록 파이프 위에서 아래 방향키를 눌러 보세요.',
            '유리 조각은 밟을 수 없어요. 뛰어넘어 피하세요.']
  },
  facts: [
    '금 가거나 깨진 유리 기구는 만지지 말고 선생님께 알려야 해요.',
    '위험해 보이는 것은 짐작하지 말고 어른에게 확인받아요.'
  ],
  clearImg: 'impact_glass_safety',
  badge: 'badge_labroom_guardian',
  core: 'labroom'
};

var BW1 = {
  id: 'bw1', world: 'labroom', name: '유리 확인실', sub: true,
  tiles: 'labroom', bg: 'world_labroom_bg', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'verify_glass', img: 'obj_scan_beacon', w: 18, h: 22, mission: 'verify_glass' } }
};

/* ---- WORLD 2: 학교 뒤뜰 ----
   Deliberately the calmest world in the game. There are no hazards out here at
   all: the risk in a field trip is what you FORGET to do, not something that
   chases you, so the whole lesson lives in the pipe room. */
var W2 = {
  id: 'w2', world: 'backyard', name: '학교 뒤뜰',
  tiles: 'backyard', tiles2: 'backyard',
  bg: 'world_backyard_bg', music: 'explore', amb: 'fungi',
  intro: {
    eyebrow: 'WORLD 2', title: '학교 뒤뜰',
    note: '야외 관찰을 나왔어요. 서두르지 말고, 활동 전에 무엇을 준비해야 하는지 확인해요.',
    art: 'loading_backyard_zone'
  },
  rows: join([
    seg(['.@..............'].concat(GND)),
    seg([
      '.....?......',
      '............',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* bounce, taught over safe ground before it is ever needed */
    seg([
      '.......o.o..',
      '............',
      '......o.o...',
      '............',
      '......M.....',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* first pit — inside a plain walking jump */
    seg([
      '....oo....',
      '..........',
      '..........',
      '####..####',
      '####..####',
      '####..####'
    ]),
    /* stepped climb to a big orb */
    seg([
      '.......*....',
      '......===...',
      '............',
      '...H........',
      '.......o....',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    seg([
      '..o.o.....',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* moving platforms over a pit: the only real skill test in this world */
    seg([
      '...*......',
      '..........',
      '..X....X..',
      '..........',
      '..........',
      '###....###',
      '###....###',
      '###....###'
    ]),
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'bw2', kind: 'bonus' } },
  goal: {
    title: '야외 활동 규칙을 확인하세요.',
    how: '파이프를 타고 내려가, 빛나는 장치 위에서 ↓(또는 S)를 누르세요.',
    next: '안전하게 관찰하는 법을 알게 돼요.',
    total: 1,
    hints: ['뒤뜰 어딘가에 내려가는 파이프가 있어요.',
            '버섯 발판을 밟으면 높이 뛸 수 있어요.',
            '장갑, 알레르기, 채집량, 손씻기 — 무엇이 맞을까요?']
  },
  facts: [
    '야외 관찰을 할 때는 장갑을 끼고 생물을 함부로 만지지 않아요.',
    '알레르기가 있으면 활동 전에 미리 알려야 해요.',
    '필요한 만큼만 채집하고, 활동이 끝나면 손을 씻어요.'
  ],
  clearImg: 'impact_outdoor_safety',
  badge: 'badge_backyard_guardian',
  core: 'backyard'
};

var BW2 = {
  id: 'bw2', world: 'backyard', name: '준비물 확인실', sub: true,
  tiles: 'backyard', bg: 'world_backyard_bg', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'verify_gloves', img: 'obj_scan_beacon', w: 18, h: 22, mission: 'verify_gloves' } }
};

/* ---- WORLD 3: 채팅방 미궁 ----
   The rumours are the level. They are the only hazard in the game you are meant
   to meet head-on: stomping one means checking it, and a checked rumour pops.
   Avoiding them forever is possible but slower — the level quietly rewards the
   child who verifies instead of dodging. */
var W3 = {
  id: 'w3', world: 'chatspace', name: '채팅방 미궁',
  tiles: 'chatspace', tiles2: 'chatspace',
  bg: 'world_chatspace_bg', music: 'explore', amb: 'bacteria',
  intro: {
    eyebrow: 'WORLD 3', title: '채팅방 미궁',
    note: '이야기가 부풀어 오르는 곳이에요. 떠다니는 말풍선을 밟아 확인하면, 소문은 사라져요.',
    art: 'loading_chatspace_zone'
  },
  rows: join([
    seg(['.@..............'].concat(GND)),
    seg([
      '.....?......',
      '............',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* the first rumour: low, slow, over flat ground — a safe place to learn that
       landing on it is the answer */
    seg([
      '............',
      '............',
      '.......Q....',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    seg([
      '.....oo.....',
      '....====....',
      '............',
      '............',
      '............',
      '............',
      '####...#####',
      '####...#####',
      '####...#####'
    ]),
    /* two drifting rumours with a platform to bounce between them */
    seg([
      '..............',
      '....Q.....Q...',
      '..............',
      '.....=====....',
      '..o........o..',
      '..............',
      '..............',
      '##############',
      '##############',
      '##############'
    ]),
    seg([
      '..o.o.....',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* the maze proper: rumours stacked at three heights over stepped ground */
    seg([
      '................',
      '...Q.......Q....',
      '.........=====..',
      '......Q.........',
      '.....===........',
      '..o.........Q...',
      '.===............',
      '................',
      '################',
      '################',
      '################'
    ]),
    seg([
      '...o.o.o....',
      '............',
      '......F.....',
      '............',
      '############',
      '############',
      '############'
    ])
  ]),
  warps: { 0: { to: 'bw3', kind: 'bonus' } },
  goal: {
    title: '확인된 사실과 짐작을 가려내세요.',
    how: '파이프를 타고 내려가, 빛나는 장치 위에서 ↓(또는 S)를 누르세요.',
    next: '진짜 있었던 일만 남아요.',
    total: 1,
    hints: ['말풍선을 밟으면 확인한 것이 되어 사라져요.',
            '내려가는 파이프를 찾아보세요.',
            '본 사람이 없는 이야기는 사실이 아니에요.']
  },
  facts: [
    '직접 확인한 것만 사실이에요.',
    '소문은 옮겨지면서 점점 부풀어 올라요.',
    '“누가 그랬대”는 근거가 아니에요.'
  ],
  clearImg: 'impact_rumor_truth',
  badge: 'badge_chatspace_guardian',
  core: 'chatspace'
};

var BW3 = {
  id: 'bw3', world: 'chatspace', name: '사실 확인실', sub: true,
  tiles: 'chatspace', bg: 'world_chatspace_bg', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'verify_witness', img: 'obj_scan_beacon', w: 18, h: 22, mission: 'verify_witness' } }
};

/* ---- WORLD 4: 진실의 방 (climax) ----
   Physically the same room as world 1, which is why it reuses tex_labroom_floor.
   The embers are the alcohol-lamp fire that actually happened, and they are
   stompable: unlike the glass, this is a thing you are allowed to put out. One
   glass shard returns near the end as a callback — the rule from world 1 still
   holds even now that the player feels capable. */
var W4 = {
  id: 'w4', world: 'truthroom', name: '진실의 방',
  tiles: 'truthroom', tiles2: 'labroom',
  bg: 'world_truthroom_bg', music: 'explore', amb: 'core',
  intro: {
    eyebrow: 'FINAL WORLD', title: '진실의 방',
    note: '그날 과학실에서 정말 무슨 일이 있었을까요? 모은 확인 카드 네 장이 마지막 문을 엽니다.',
    art: 'loading_truthroom_zone'
  },
  rows: join([
    seg(['.@..............'].concat(GND)),
    seg([
      '.....?......',
      '............',
      '............',
      '............',
      '############',
      '############',
      '############'
    ]),
    /* first ember, alone: it rolls, and it CAN be put out */
    seg([
      '............',
      '........oo..',
      '............',
      '.......R....',
      '############',
      '############',
      '############'
    ]),
    seg([
      '.....oo.....',
      '....====....',
      '............',
      '..R.........',
      '............',
      '............',
      '####...#####',
      '####...#####',
      '####...#####'
    ]),
    /* embers under a shelf of jars — the fire and the glass in one frame */
    seg([
      '.BBBBBBBBBBB.',
      '.............',
      '...L.....L...',
      '.............',
      '.....o.o.....',
      '.............',
      '..R.......R..',
      '#############',
      '#############',
      '#############'
    ]),
    seg([
      '..o.o.....',
      '..........',
      '.....PP...',
      '#####pp###',
      '#####pp###',
      '#####pp###'
    ]),
    seg([
      '........K.',
      '........K.',
      '........K.',
      '........K.',
      '....C...K.',
      '........K.',
      '........K.',
      '##########',
      '##########',
      '##########'
    ]),
    /* the callback: world 1's shard, still unstompable, among embers you can
       stamp out. Same screen, two different correct answers. */
    seg([
      '..............',
      '..............',
      '....o.....o...',
      '.....=====....',
      '..............',
      '..R..V....R.V.',
      '##############',
      '##############',
      '##############'
    ]),
    /* 9. FINALE — 부풀어 오른 소문.
       Every unchecked story in the book piles up into one huge rumour that guards
       the last door. Stomping it means checking it, exactly as in world 3, only now
       it takes three confirmations and it answers back.

       Arena geometry is lifted from 슈퍼마이크로's boss room because it was tuned
       for a reason: the two row-11 ledges are the only place the boss can be
       stomped from, and the '===' step under the LEFT ledge makes floor -> step ->
       ledge two ordinary jumps, so a player on a tablet with no sprint button can
       still finish. The step sits left on purpose — under the centre it would park
       the player's head inside the boss's patrol. The checkpoint is at the door so
       a miss costs seconds, not the stage. */
    seg([
      '........................',
      '........................',
      '........................',
      '..======....======......',
      '........................',
      '..C.===.F...............',
      '........................',
      '########################',
      '########################',
      '########################'
    ])
  ]),
  warps: { 0: { to: 'bw4', kind: 'bonus' } },
  /* The final encounter. `boss` as an object rather than `true` reconfigures the
     original fight instead of adding a second one: same three stomps, same patrol,
     but it releases 소문 말풍선 and wears the rumour artwork. */
  boss: {
    minion: 'rumor',
    art: 'hazard_rumor_styled',
    size: 44, w: 30, h: 30, hp: 3,
    glow: '190,150,255',
    title: '부풀어 오른 소문을 확인하세요.',
    how: '발판에서 뛰어올라 위에서 밟으면 확인이 돼요.',
    next: '진실의 방 문이 열려요.',
    intro: '확인하지 않은 이야기들이 뭉쳐 <b>커다란 소문 덩어리</b>가 됐어요!<br>' +
           '발판 위로 올라가 <b>위에서 세 번</b> 확인해 주세요.',
    hints: ['양쪽 발판 위로 올라가면 위에서 밟기 쉬워요.',
            '왼쪽 발판 아래에 작은 디딤판이 있어요. 두 번 뛰면 올라갈 수 있어요.',
            '떨어져 나온 작은 소문들도 밟아서 확인할 수 있어요.'],
    hitMsg: '소문 덩어리',
    doneMsg: '완료! 소문이 모두 걷혔어요',
    down: '<b>소문이 모두 걷혔습니다.</b><br>남은 것은 확인된 사실뿐 — 그날, 아무도 다치지 않았어요.'
  },
  goal: {
    title: '응급처치 순서를 확인하세요.',
    how: '파이프를 타고 내려가, 빛나는 장치 위에서 ↓(또는 S)를 누르세요.',
    next: '진실의 방 문이 열려요.',
    total: 1,
    hints: ['불씨는 밟아서 끌 수 있어요. 유리 조각은 안 돼요.',
            '내려가는 파이프를 찾아보세요.',
            '가장 먼저 할 일은 상처를 깨끗한 물로 씻는 거예요.']
  },
  /* the last door needs every card in the book, not just this world's */
  finalGate: true,
  facts: [
    '다쳤을 때는 상처를 깨끗한 물로 씻고, 선생님께 바로 알려요.',
    '치료는 선생님의 안내에 따라 받아요.',
    '확인한 사실만 모으면, 아무도 다치지 않았다는 것을 알 수 있어요.'
  ],
  clearImg: 'card_true_ending',
  badge: 'badge_truthroom_guardian',
  core: 'truthroom'
};

var BW4 = {
  id: 'bw4', world: 'truthroom', name: '응급처치 확인실', sub: true,
  tiles: 'truthroom', bg: 'world_truthroom_bg', music: 'lab', amb: null,
  rows: join([seg([
    '..........................',
    '.@.....o.o.o.o......G.....',
    '..........................',
    '.......=======............',
    '..........................',
    '..................PP......',
    '##################pp######',
    '##################pp######',
    '##################pp######'
  ])]),
  warps: { 0: { to: 'exit', kind: 'exit' } },
  devices: { G: { kind: 'verify_firstaid', img: 'obj_scan_beacon', w: 18, h: 22, mission: 'verify_firstaid_order' } }
};

/* The original 슈퍼 마이크로 stages (s1-s4, b1-b3) are still registered so any old
   save, deep link or bookmark resolves instead of throwing. They are simply no
   longer in ORDER, so nothing routes to them. */
var STAGES = { w1: W1, w2: W2, w3: W3, w4: W4, bw1: BW1, bw2: BW2, bw3: BW3, bw4: BW4,
               s1: S1, s2: S2, s3: S3, s4: S4, b1: B1, b2: B2, b3: B3 };
var ORDER = ['w1', 'w2', 'w3', 'w4'];
var START = 'w1', FINAL = 'w4';

/* ---------- required observation cards ----------
   Keyed by stage. Every id here is a card granted INSIDE that stage's pipe room:
     s1 -> b1 / scope_fungi    : shiitake, hyphae, spores
     s2 -> b2 / scope_protist  : spirogyra, paramecium
     s3 -> b3 / scope_bacteria : shapes  (the s3 classify mission grants the same
                                 card, so either route counts)
   Deliberately NOT here: 'pondwater' (valves reward) and 'breadmold'
   (restore_mold reward) — they are not pipe observations. */
var REQUIRED_OBS = {
  s1: ['shiitake', 'hyphae', 'spores'],
  s2: ['spirogyra', 'paramecium'],
  s3: ['shapes'],

  /* 왜냐면 과학실: one card per world, each earned in that world's pipe room.
     This is what the mid-stage K wall checks. */
  w1: ['broken_glass'],
  w2: ['glove_rule'],
  w3: ['confirmed_source'],
  w4: ['firstaid_wash']
};

/* The LAST door is different: 진실의 방 opens only for someone carrying all four
   confirmations, so the ending cannot be reached by finishing world 4 alone.
   Checked separately from REQUIRED_OBS so world 4's own K wall still needs just
   its own card — the final gate is the goal portal, not the mid-stage wall. */
var FINAL_OBS = ['broken_glass', 'glove_rule', 'confirmed_source', 'firstaid_wash'];

var CARDS = {
  hyphae:    { name: '균사', img: 'micro_fungi_hyphae', desc: '실처럼 가늘고 긴 균사예요.' },
  spores:    { name: '포자가 든 주머니', img: 'micro_mold_spores', desc: '균류는 포자로 번식해요.' },
  breadmold: { name: '빵에 자란 곰팡이', img: 'specimen_bread_mold', desc: '균류는 음식을 상하게 하기도 해요.' },
  shiitake:  { name: '표고버섯', img: 'specimen_shiitake_block', desc: '버섯도 균사로 이루어진 균류예요.' },
  spirogyra: { name: '해캄', img: 'micro_spirogyra', desc: '가늘고 긴 머리카락 모양이에요.' },
  paramecium:{ name: '짚신벌레', img: 'micro_paramecium', desc: '길쭉한 둥근 모양이에요.' },
  pondwater: { name: '연못물', img: 'specimen_pond_water', desc: '원생생물은 물이 있는 곳에 살아요.' },
  shapes:    { name: '세균의 생김새', img: 'micro_bacteria_shapes', desc: '공·막대·나선 모양 등이 있어요.' },

  /* ---- 왜냐면 과학실 확인 카드 ----
     Each one is a rule the player proved for themselves in a pipe room, not a
     fact they were handed. `where` is shown on the ending screen when a card is
     still missing, so nobody has to guess which room they skipped. */
  broken_glass:     { name: '깨진 유리 규칙', img: 'card_broken_glass',
                      desc: '금 간 유리는 만지지 말고 선생님께 알려요.', where: '낡은 과학실 · 유리 확인실' },
  glove_rule:       { name: '장갑 규칙', img: 'card_glove_rule',
                      desc: '야외 관찰에는 장갑을 끼고, 미리 알릴 것은 알려요.', where: '학교 뒤뜰 · 준비물 확인실' },
  confirmed_source: { name: '확인된 사실', img: 'card_confirmed_source',
                      desc: '직접 확인한 것만 사실이에요.', where: '채팅방 미궁 · 사실 확인실' },
  firstaid_wash:    { name: '응급처치 순서', img: 'card_firstaid_wash',
                      desc: '씻고 → 알리고 → 안내에 따라 치료받아요.', where: '진실의 방 · 응급처치 확인실' }
};

/* ---------- build: rows -> grid + entity list ---------- */

/* Devices and the spawn point MUST rest on a floor or they are unreachable.
   Rather than trusting hand-authored rows, snap them down to the first floor
   below the anchor. Authoring a device one row off can no longer break a stage. */
function floorRowBelow(grid, h, c, row) {
  for (var r = row + 1; r < h; r++) {
    var t = grid[r][c];
    if (t === 1 || t === 2 || t === 3) return r - 1;
  }
  return row;
}

function build(def) {
  var rows = def.rows, h = rows.length, w = rows[0].length;
  var grid = [], meta = [], ents = [], spawn = { x: 32, y: 224 }, r, c;
  for (r = 0; r < h; r++) { grid.push(new Array(w)); meta.push(new Array(w)); }

  var pipeIdx = 0, deviceQueue = [], spawnCell = null;

  for (r = 0; r < h; r++) {
    for (c = 0; c < w; c++) {
      var ch = rows[r][c], px = c * 16, py = r * 16;
      grid[r][c] = 0;
      switch (ch) {
        case '#': grid[r][c] = 1; break;
        case '=': grid[r][c] = 2; break;
        case 'B': grid[r][c] = 3; meta[r][c] = { t: 'brick' }; break;
        /* observation gate: a brick wall that only the observation cards open */
        case 'K': grid[r][c] = 3; meta[r][c] = { t: 'brick', obsgate: true }; break;
        case '?': grid[r][c] = 3; meta[r][c] = { t: 'capsule' }; break;
        case 'S': grid[r][c] = 3; meta[r][c] = { t: 'spore' }; break;
        case 'D': grid[r][c] = 3; meta[r][c] = { t: 'data' }; break;
        case 'H': grid[r][c] = 0; meta[r][c] = { t: 'hidden' }; break;
        case 'p': grid[r][c] = 1; meta[r][c] = { t: 'pipebody' }; break;
        case 'P':
          grid[r][c] = 1;
          if (rows[r][c - 1] !== 'P') {
            var id = pipeIdx++;
            meta[r][c] = { t: 'pipetop', id: id, left: true };
            ents.push({ k: 'pipe', x: px, y: py, id: id, warp: (def.warps || {})[id] || null });
          } else meta[r][c] = { t: 'pipetop' };
          break;
        case '@': spawnCell = { c: c, r: r }; break;
        case 'o': ents.push({ k: 'orb', x: px + 8, y: py + 8, v: 1 }); break;
        case '*': ents.push({ k: 'orb', x: px + 8, y: py + 8, v: 5, big: true }); break;
        case 'M': ents.push({ k: 'shroom', x: px, y: py }); break;
        case 'b': ents.push({ k: 'bubble', x: px + 8, y: py + 8 }); break;
        case 'C': ents.push({ k: 'checkpoint', x: px, y: py }); break;
        case 'F': ents.push({ k: 'goal', x: px, y: py }); break;
        case 'X': ents.push({ k: 'mplat', x: px, y: py, axis: 'x', range: 44 }); break;
        case 'Y': ents.push({ k: 'mplat', x: px, y: py, axis: 'y', range: 44 }); break;
        case 'Z': ents.push({ k: 'fplat', x: px, y: py }); break;
        case '~': grid[r][c] = 4; break;
        case 'w': grid[r][c] = 5; meta[r][c] = { dir: 1 }; break;
        case 'W': grid[r][c] = 5; meta[r][c] = { dir: -1 }; break;
        case 'G': deviceQueue.push({ ch: 'G', x: px, y: py }); break;
        case 'g': deviceQueue.push({ ch: 'g', x: px, y: py }); break;
        case '1': ents.push({ k: 'enemy', type: 'sporeblob', x: px, y: py }); break;
        case '2': ents.push({ k: 'enemy', type: 'moldball', x: px, y: py }); break;
        case '3': ents.push({ k: 'enemy', type: 'woodchunk', x: px, y: py }); break;
        case '4': ents.push({ k: 'enemy', type: 'droplet', x: px, y: py }); break;
        /* '$' is a droplet that moves 15% slower — used for the very first one a
           player meets, so the dodge is learnable before it matters. */
        case '$': ents.push({ k: 'enemy', type: 'droplet', x: px, y: py, spMul: 0.85 }); break;
        case '5': ents.push({ k: 'enemy', type: 'redtide', x: px, y: py }); break;
        case '6': ents.push({ k: 'enemy', type: 'dataerr', x: px, y: py }); break;
        case '7': ents.push({ k: 'enemy', type: 'overgrow', x: px, y: py }); break;
        /* ---- 왜냐면 과학실 hazards ---- */
        case 'V': ents.push({ k: 'enemy', type: 'glassshard', x: px, y: py }); break;
        case 'R': ents.push({ k: 'enemy', type: 'ember', x: px, y: py }); break;
        case 'L': ents.push({ k: 'enemy', type: 'fallingjar', x: px, y: py }); break;
        case 'Q': ents.push({ k: 'enemy', type: 'rumor', x: px, y: py }); break;
      }
    }
  }

  // snap the spawn onto its floor
  if (spawnCell) {
    var sr = floorRowBelow(grid, h, spawnCell.c, spawnCell.r);
    spawn = { x: spawnCell.c * 16 + 2, y: sr * 16 };
  }

  /* ---- snap the standing props onto their floor ----
     Checkpoints, goal portals and bounce mushrooms all draw UPWARDS from y+16, so
     an anchor authored a row or two above the ground leaves them visibly hovering.
     Every stage in the original data placed C/F/M two rows above the floor, which
     is exactly what made the beacon and the portal float in mid-air. Devices and
     the spawn were already snapped; these are now held to the same rule, so a
     hand-authored row being off can no longer put a prop in the sky.
     Bubbles are deliberately excluded — a floating bubble is meant to float. */
  var SNAP_TO_FLOOR = { checkpoint: 1, goal: 1, shroom: 1 };
  ents.forEach(function (e) {
    if (!SNAP_TO_FLOOR[e.k]) return;
    var ec = Math.floor(e.x / 16);
    e.y = floorRowBelow(grid, h, ec, Math.floor(e.y / 16)) * 16;
  });

  var mi = 0, di = 0;
  deviceQueue.forEach(function (d) {
    var cfg = (def.devices || {})[d.ch];
    if (!cfg) return;
    var dc = Math.floor(d.x / 16);
    d.y = floorRowBelow(grid, h, dc, Math.floor(d.y / 16)) * 16;   // stand it on the floor
    var e = { k: 'device', x: d.x, y: d.y };
    if (cfg.kind === 'multi' && def.multiOrder) {
      var m = def.multiOrder[mi++]; if (!m) return;
      e.kind = m.kind; e.img = m.img; e.mission = m.mission;
      e.w = cfg.w; e.h = cfg.h;
    } else if (cfg.kind === 'deco2' && def.decoOrder) {
      var o = def.decoOrder[di++]; if (!o) return;
      e.kind = 'deco'; e.img = o.img; e.w = o.w; e.h = o.h; e.deco = true;
    } else {
      e.kind = cfg.kind; e.img = cfg.img; e.mission = cfg.mission;
      e.w = cfg.w; e.h = cfg.h; e.deco = !!cfg.deco; e.status = cfg.status || null;
    }
    ents.push(e);
  });

  return { def: def, grid: grid, meta: meta, ents: ents, spawn: spawn,
           w: w, h: h, pxw: w * 16, pxh: h * 16 };
}

W.SM.Level = { STAGES: STAGES, ORDER: ORDER, CARDS: CARDS, REQUIRED_OBS: REQUIRED_OBS,
               FINAL_OBS: FINAL_OBS, START: START, FINAL: FINAL,
               build: build, H: H, seg: seg };
})(window);
