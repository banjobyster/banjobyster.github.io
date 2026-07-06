// Nib, the lamplighter: the smallest byster on the page, a walking brass
// lantern with a warm amber face. Nocturnal energy: sleeps a lot, tends the
// neon, shies from the cursor. Light on his feet, slow, a little dreamy.

const COL = {
  brass: 0xb08948,
  brassShade: 0x86672f,
  brassHi: 0xd0ab6b,
  screenFrame: 0x3d2f14,
  screen: 0x140e05,
  chest: 0x6e5628,
  chestHi: 0x8d7140,
  legCore: 0x241b0c,
  legRing: 0xc4a262,
  legCoreFar: 0x181206,
  legRingFar: 0x8a713f,
  pix: [0, 0x7a5a20, 0xe8b64a, 0xfff3cf],
};

const PARAMS = {
  scale: 0.8,
  bodyW: 12,
  bodyH: 8,
  headW: 26,
  headH: 22,
  hipX: [5, 2.5, -2.5, -5],
  hipY: 4,
  footRestX: [6, 3, -3, -6],
  standH: 14,
  stepThresholdBase: 7,
  walkSpeed: 85,
  wanderSpeed: 50,
  accel: 600,
  bodySpring: 200,
  bodyDamp: 16,
  rotSpring: 160,
  rotDamp: 18,
  leanGain: 0.0004,
  leanMax: 0.07,
  headMass: 0.5,
};

// A smaller buffer: Nib's face is chunkier, fewer and warmer pixels.
const FACES = {
  idle(f) {
    f.eye(2, 3, 3, 3, true);
    f.eye(7, 3, 3, 3, true);
    f.px(5, 7, 1);
    f.px(6, 7, 1);
  },
  happy(f) {
    for (const c of [2, 7]) {
      f.px(c, 4, 2);
      f.px(c + 1, 3, 3);
      f.px(c + 2, 4, 2);
    }
    f.block(4, 7, 4, 1, 3);
  },
  sleepy(f) {
    // Closed arcs, and a little z that floats up and fades.
    f.block(2, 4, 3, 1, 1);
    f.block(7, 4, 3, 1, 1);
    const k = ((f.t * 3) | 0) % 3;
    f.px(10, 2 - k, k === 2 ? 1 : 2);
    f.px(11, 1 - k < 0 ? 0 : 1 - k, 1);
  },
  startle(f) {
    // Wide amber saucers, a jitter to the whole frame.
    const j = ((f.t * 12) | 0) % 2;
    f.block(1 + j, 2, 4, 4, 1);
    f.px(2 + j, 3, 3);
    f.block(7 + j, 2, 4, 4, 1);
    f.px(8 + j, 3, 3);
    f.block(5, 7, 2, 2, 2);
  },
  peek(f) {
    f.block(2, 4, 3, 2, 1);
    f.px(2, 4, 3);
    f.block(7, 4, 3, 2, 1);
    f.px(7, 4, 3);
  },
  dream(f) {
    // Half-open, pupils drifted up: watching something no one else sees.
    f.block(2, 3, 3, 2, 1);
    f.px(3, 3, 3);
    f.block(7, 3, 3, 2, 1);
    f.px(8, 3, 3);
    f.px(5, 7, 2);
  },
  curious(f) {
    f.eye(1, 2, 4, 4, true);
    f.eye(7, 3, 3, 3, true);
    f.px(5, 7, 2);
  },
};

export const NIB = {
  name: 'nib',
  params: PARAMS,
  palette: COL,
  legs: {
    rings: 3,
    near: { core: COL.legCore, ring: COL.legRing, width: 3.6 },
    far: { core: COL.legCoreFar, ring: COL.legRingFar, width: 3.1 },
  },
  face: {
    w: 12,
    h: 10,
    animated: ['sleepy', 'startle'],
    exprs: FACES,
  },

  // Chest: a little fuel canister with a strap.
  buildBody(g) {
    const P = PARAMS;
    g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 3).fill(COL.chest);
    g.roundRect(-P.bodyW / 2 + 1.6, -P.bodyH / 2 + 1, P.bodyW - 3.2, 2.2, 1.5).fill(COL.chestHi);
  },

  // Head: a rounded lantern: brass cap with a carry loop, amber glass pane,
  // brass base. The glow is drawn as gloss over the glass.
  buildHead(g) {
    const w = PARAMS.headW;
    const h = PARAMS.headH;
    // carry loop
    g.roundRect(-4, -h / 2 - 5, 8, 4, 2).stroke({ width: 1.6, color: COL.brassShade });
    // cap
    g.roundRect(-w / 2 + 2, -h / 2 - 2.2, w - 4, 4.5, 2).fill(COL.brass);
    g.roundRect(-w / 2 + 1.2, -h / 2 + 1.6, w, h, 8).fill(COL.brassShade);
    g.roundRect(-w / 2, -h / 2, w, h, 8).fill(COL.brass);
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 7.5, 5).fill(COL.screenFrame);
    g.roundRect(-w / 2 + 4.2, -h / 2 + 4.2, w - 8.4, h - 9.9, 4).fill(COL.screen);
    // base plate
    g.roundRect(-w / 2 + 4, h / 2 - 2.4, w - 8, 2.4, 1).fill(COL.brassHi);
    const sw = w - 8.4;
    const sh = h - 9.9;
    return { x: -sw / 2, y: -h / 2 + 4.2, w: sw, h: sh };
  },

  // The lantern glow: a soft warm halo over the glass instead of a shine.
  buildHeadGloss(g, box) {
    const { x: gx, y: gy, w: sw, h: sh } = box;
    g.circle(gx + sw / 2, gy + sh / 2, Math.max(sw, sh) * 0.62).fill({ color: 0xe8b64a, alpha: 0.08 });
    g.circle(gx + sw / 2, gy + sh / 2, Math.max(sw, sh) * 0.38).fill({ color: 0xffdf9a, alpha: 0.09 });
  },
};
