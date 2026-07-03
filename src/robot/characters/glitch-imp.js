// The saboteur (Part 3d): a glitch imp. Same character contract as the CRT
// toddler, but smaller, quicker, and mean: an angular near-black monitor with
// a red-magenta pixel face and dusty-purple accordion legs. It shares the
// character-agnostic engine; only look and tuning live here.
//
// It reuses the same face buffer helpers (f.px, f.block, f.eye, f.t). Its
// signature faces are mischief (a scheming grin, doubling as idle), cackle (a
// gloating laugh on a successful sabotage), panic (caught / fleeing), and
// fumble (a botched tamper). Engine-driven expressions it does not define
// (happy, curious, sync) fall back to idle in the Face renderer.

const COL = {
  bezel: 0x3a2b3f, // dark aubergine shell
  bezelShade: 0x271a2b,
  bezelDetail: 0x120a15,
  screenFrame: 0x1a0f1e,
  screen: 0x0a050c,
  body: 0x6b1030, // dark red chest
  bodyHi: 0x9a1f45,
  bodyDark: 0x360616,
  legNear: 0x5a4560, // dusty purple rings
  legNearCore: 0x140a18,
  legFar: 0x3d2f42,
  legFarCore: 0x0d060f,
  glow: 0xff2d6a, // red-magenta power light / accents
  pix: [0, 0x7c1d3a, 0xff2d6a, 0xffd9e6],
};

const PARAMS = {
  scale: 1.1, // smaller than the toddler (1.4)
  bodyW: 21,
  bodyH: 12,
  headW: 50,
  headH: 38,
  hipX: [8.5, 4.5, -4.5, -8.5],
  hipY: 6,
  footRestX: [11, 6, -6, -11],
  standH: 18,
  stepThresholdBase: 10, // quick, skittery steps
  walkSpeed: 260,
  wanderSpeed: 150,
  accel: 1500, // darts and stops hard
};

const FACES = {
  // Idle IS a scheming look: low, slanted eyes and a thin smug line.
  idle(f) {
    f.block(2, 4, 3, 2, 2);
    f.px(3, 4, 3);
    f.block(9, 4, 3, 2, 2);
    f.px(10, 4, 3);
    f.block(4, 7, 6, 1, 1);
  },
  // Mischief: inward V brows, hot eyes, a wide jagged grin.
  mischief(f) {
    for (const [bx, dir] of [
      [1, 1],
      [12, -1],
    ]) {
      f.px(bx, 2, 2);
      f.px(bx + dir, 2, 2);
      f.px(bx + dir * 2, 3, 2);
    }
    f.block(2, 4, 3, 2, 2);
    f.px(3, 5, 3);
    f.block(9, 4, 3, 2, 2);
    f.px(10, 5, 3);
    for (let x = 3; x <= 10; x++) f.px(x, 7, 2);
    f.px(4, 8, 3);
    f.px(6, 8, 3);
    f.px(8, 8, 3);
  },
  // Cackle: squeezed-shut eyes, a mouth flapping open, corner twinkles.
  cackle(f) {
    const open = Math.sin(f.t * 16) > 0 ? 1 : 0;
    for (const c of [2, 9]) {
      f.px(c, 4, 2);
      f.px(c + 1, 3, 3);
      f.px(c + 2, 4, 2);
    }
    f.block(4, 6, 6, 2 + open, 2);
    f.block(5, 6, 4, 1, 3);
    const tw = ((f.t * 8) | 0) % 2;
    f.px(0, 2, tw ? 3 : 1);
    f.px(13, 3, tw ? 1 : 3);
  },
  // Panic: huge round eyes with darting pupils, a tiny worried mouth, jitter.
  panic(f) {
    const j = ((f.t * 20) | 0) % 2;
    f.block(2 + j, 2, 3, 4, 2);
    f.px(3 + j, 3, 3);
    f.block(9 - j, 2, 3, 4, 2);
    f.px(10 - j, 3, 3);
    f.block(6, 8, 2, 1, 1);
  },
  // Fumble: crossed rolling eyes, a dropped-jaw O.
  fumble(f) {
    const k = (f.t * 10) | 0;
    f.block(3, 3, 3, 3, 1);
    f.px(4 + (k % 2), 4, 3);
    f.block(8, 3, 3, 3, 1);
    f.px(9 - (k % 2), 4, 3);
    f.block(6, 7, 3, 2, 2);
    f.px(7, 7, 3);
  },
  // Torn static, red flavored (engine sets this on a failed plan / startle).
  glitch(f) {
    for (const [c, r] of [
      [2, 3],
      [9, 3],
    ]) {
      for (let y = 0; y < 3; y++) {
        const s = ((Math.random() * 5) | 0) - 2;
        f.block(Math.min(Math.max(c + s, 0), f.w - 3), r + y, 3, 1, Math.random() < 0.7 ? 2 : 1);
      }
    }
    for (let i = 0; i < 10; i++) {
      f.px((Math.random() * f.w) | 0, (Math.random() * f.h) | 0, ((Math.random() * 3) | 0) + 1);
    }
  },
  curious(f) {
    f.eye(2, 2, 3, 5, true);
    f.block(9, 4, 3, 2, 1);
    f.px(10, 3, 2);
  },
  sleepy(f) {
    f.block(2, 5, 3, 1, 1);
    f.block(9, 5, 3, 1, 1);
    f.px(6, 7, 1);
  },
};

export const GLITCH_IMP = {
  name: 'glitch-imp',
  params: PARAMS,
  palette: COL,
  legs: {
    rings: 4,
    near: { core: COL.legNearCore, ring: COL.legNear, width: 4.4 },
    far: { core: COL.legFarCore, ring: COL.legFar, width: 3.8 },
  },
  face: {
    w: 14,
    h: 10,
    animated: ['cackle', 'panic', 'fumble', 'glitch'],
    exprs: FACES,
  },

  // Chest: small dark-red angular box with a glowing core slit.
  buildBody(g) {
    const P = PARAMS;
    g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 2).fill(COL.body);
    g.roundRect(-P.bodyW / 2 + 2, -P.bodyH / 2 + 1.2, P.bodyW - 4, 3, 1).fill(COL.bodyHi);
    g.roundRect(-4, -1.2, 8, 4.4, 1).fill(COL.bodyDark);
    g.rect(-1, -1.2, 2, 4.4).fill(COL.glow);
  },

  // Monitor: sharp-cornered dark shell, angular side fin, red power light.
  buildHead(g) {
    const w = PARAMS.headW;
    const h = PARAMS.headH;
    g.roundRect(-w / 2 + 1.6, -h / 2 + 2.2, w, h, 3).fill(COL.bezelShade);
    g.roundRect(-w / 2, -h / 2, w, h, 3).fill(COL.bezel);
    g.poly([
      { x: -w / 2 - 4, y: -6 },
      { x: -w / 2, y: -9 },
      { x: -w / 2, y: 7 },
      { x: -w / 2 - 4, y: 5 },
    ]).fill(COL.bezelShade); // angular fin
    g.roundRect(-w / 2 + 5, -h / 2 + 3.6, w - 10, h - 12, 2).fill(COL.screenFrame);
    g.roundRect(-w / 2 + 6.8, -h / 2 + 5.2, w - 13.6, h - 15, 1.5).fill(COL.screen);
    g.circle(w / 2 - 9, h / 2 - 4, 1.5).fill(COL.bezelDetail);
    g.circle(-w / 2 + 9, h / 2 - 4, 2.6).fill({ color: COL.glow, alpha: 0.3 }); // glow
    g.circle(-w / 2 + 9, h / 2 - 4, 1.5).fill(COL.glow); // power light
    const sw = w - 13.6;
    const sh = h - 15;
    return { x: -sw / 2, y: -h / 2 + 5.2, w: sw, h: sh };
  },

  // A single sharp diagonal glint over the screen.
  buildHeadGloss(g, box) {
    const { x: gx, y: gy, w: sw, h: sh } = box;
    g.poly([
      { x: gx + sw * 0.55, y: gy },
      { x: gx + sw * 0.7, y: gy },
      { x: gx + sw * 0.3, y: gy + sh },
      { x: gx + sw * 0.15, y: gy + sh },
    ]).fill({ color: 0xff6a9a, alpha: 0.06 });
  },
};
