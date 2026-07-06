// Chunk, the engineer: a rotund little mechanic in denim overalls with a
// small steel head. Inverse silhouette to the twins (huge body, small head)
// and inverse temperament: grounded, weary, dedicated. Heavy tuning: slow
// heaving strides, ponderous starts, a body that sways and settles late.

const COL = {
  denim: 0x51718f,
  denimShade: 0x3c556e,
  denimHi: 0x6d8dab,
  strap: 0x33485e,
  buckle: 0xd9a13b,
  pocket: 0x2f4257,
  steel: 0x9aa4ae,
  steelShade: 0x717b86,
  screenFrame: 0x2c3138,
  screen: 0x111417,
  legCore: 0x1d2126,
  legRing: 0x848d97,
  legCoreFar: 0x14171b,
  legRingFar: 0x5b636c,
  pix: [0, 0x8a5c1d, 0xe0a83c, 0xffedc4],
};

const PARAMS = {
  scale: 1.55,
  bodyW: 48,
  bodyH: 26,
  headW: 34,
  headH: 28,
  hipX: [12, 6, -6, -12],
  hipY: 9,
  footRestX: [15, 8, -8, -15],
  standH: 24,
  stepThresholdBase: 17, // long heaving strides
  walkSpeed: 120,
  wanderSpeed: 60,
  accel: 480, // takes a moment to get going, and to stop
  bodySpring: 120, // soft and heavy: settles with a sway
  bodyDamp: 26,
  rotSpring: 100,
  rotDamp: 25,
  leanGain: 0.0006,
  leanMax: 0.06,
  headMass: 1.35,
};

const FACES = {
  idle(f) {
    // Weary flat lids, a resting mouth: tired but on duty, and the pupils
    // still follow the world.
    const g = Math.round(f.gazeX * 1.2);
    for (const c of [3, 9]) {
      f.block(c, 4, 4, 2, 1);
      f.px(Math.min(Math.max(c + 1 + g, c), c + 3), 5, 3);
    }
    f.block(6, 9, 4, 1, 1);
  },
  grit(f) {
    // On the job: brows down hard, eyes narrowed hot, jaw set.
    f.px(2, 2, 2);
    f.px(3, 3, 2);
    f.px(13, 2, 2);
    f.px(12, 3, 2);
    f.block(3, 4, 4, 2, 2);
    f.px(4, 4, 3);
    f.block(9, 4, 4, 2, 2);
    f.px(10, 4, 3);
    for (let x = 5; x <= 10; x++) f.px(x, 9, x % 2 ? 2 : 1);
  },
  wipe(f) {
    // Break time: eyes closed, and a sweat drop slides down the brow.
    f.block(3, 5, 4, 1, 1);
    f.block(9, 5, 4, 1, 1);
    const drop = ((f.t * 5) | 0) % 4;
    f.px(13, 1 + drop, 3);
    f.block(6, 9, 4, 1, 1);
  },
  sigh(f) {
    // Lids half down, mouth a small open o: the long exhale.
    f.block(3, 4, 4, 2, 1);
    f.block(9, 4, 4, 2, 1);
    f.block(6, 8, 3, 2, 1);
    f.px(7, 9, 0);
  },
  squint(f) {
    // The suspicious once-over: flat lids, pupils pinned on the cursor
    // (gaze), so his glare literally follows you around.
    const sl = Math.round(f.gazeX * 1.6);
    for (const c of [3, 9]) {
      f.block(c, 4, 4, 2, 1);
      f.px(Math.min(Math.max(c + 1 + sl, c), c + 3), 5, 3);
    }
    f.block(6, 9, 3, 1, 1);
  },
  happy(f) {
    // Rare, and worth it: soft chevron eyes over a small proud smile.
    for (const c of [3, 9]) {
      f.px(c, 5, 2);
      f.px(c + 1, 4, 2);
      f.px(c + 2, 4, 2);
      f.px(c + 3, 5, 2);
    }
    f.block(6, 9, 4, 1, 2);
  },
  curious(f) {
    f.eye(2, 3, 4, 4, true);
    f.block(9, 5, 3, 2, 1);
    f.block(9, 3, 3, 1, 1);
    f.block(6, 9, 3, 1, 1);
  },
  sleepy(f) {
    f.block(3, 5, 4, 2, 1);
    f.block(9, 5, 4, 2, 1);
  },
};

export const CHUNK = {
  name: 'chunk',
  params: PARAMS,
  palette: COL,
  legs: {
    rings: 5,
    near: { core: COL.legCore, ring: COL.legRing, width: 7 },
    far: { core: COL.legCoreFar, ring: COL.legRingFar, width: 6 },
  },
  face: {
    w: 16,
    h: 12,
    animated: ['wipe', 'squint'],
    exprs: FACES,
  },

  // The overalls: a broad denim barrel with straps, a chest pocket holding a
  // wrench silhouette, and a brass buckle.
  buildBody(g) {
    const P = PARAMS;
    g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 9).fill(COL.denimShade);
    g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH - 3, 9).fill(COL.denim);
    g.roundRect(-P.bodyW / 2 + 3, -P.bodyH / 2 + 2, P.bodyW - 6, 4, 2).fill(COL.denimHi);
    // straps
    g.rect(-P.bodyW / 2 + 7, -P.bodyH / 2 - 1, 5, 8).fill(COL.strap);
    g.rect(P.bodyW / 2 - 12, -P.bodyH / 2 - 1, 5, 8).fill(COL.strap);
    g.rect(-P.bodyW / 2 + 7.8, -P.bodyH / 2 + 5, 3.4, 3.4).fill(COL.buckle);
    g.rect(P.bodyW / 2 - 11.2, -P.bodyH / 2 + 5, 3.4, 3.4).fill(COL.buckle);
    // chest pocket with a peeking wrench
    g.roundRect(-7, -2, 14, 10, 2.5).fill(COL.pocket);
    g.rect(-2.2, -5, 2.2, 4.5).fill(COL.steel);
    g.circle(-1.1, -5.4, 1.9).fill(COL.steel);
    g.circle(-1.1, -5.4, 0.9).fill(COL.pocket);
  },

  // A small square steel head, dented and dependable, screen slightly low
  // like he is peering down at his work.
  buildHead(g) {
    const w = PARAMS.headW;
    const h = PARAMS.headH;
    g.roundRect(-w / 2 + 1.4, -h / 2 + 2, w, h, 6).fill(COL.steelShade);
    g.roundRect(-w / 2, -h / 2, w, h, 6).fill(COL.steel);
    // rivets
    g.circle(-w / 2 + 4, -h / 2 + 4, 1.1).fill(COL.steelShade);
    g.circle(w / 2 - 4, -h / 2 + 4, 1.1).fill(COL.steelShade);
    g.roundRect(-w / 2 + 4, -h / 2 + 6, w - 8, h - 11, 4).fill(COL.screenFrame);
    g.roundRect(-w / 2 + 5.4, -h / 2 + 7.4, w - 10.8, h - 13.8, 3).fill(COL.screen);
    const sw = w - 10.8;
    const sh = h - 13.8;
    return { x: -sw / 2, y: -h / 2 + 7.4, w: sw, h: sh };
  },

  buildHeadGloss(g, box) {
    const { x: gx, y: gy, w: sw, h: sh } = box;
    g.poly([
      { x: gx + sw * 0.6, y: gy },
      { x: gx + sw * 0.74, y: gy },
      { x: gx + sw * 0.4, y: gy + sh },
      { x: gx + sw * 0.26, y: gy + sh },
    ]).fill({ color: 0xffffff, alpha: 0.06 });
  },
};
