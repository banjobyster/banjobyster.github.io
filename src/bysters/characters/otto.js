// Otto, the operator: a calm control-room byster with a wide flat wall
// monitor for a head. His face is a tiny dashboard: gauge eyes and a live
// graph-line mouth. Smooth, intentional movement; nothing rattles him.

const COL = {
  bezel: 0x3a4148,
  bezelShade: 0x262b31,
  bezelHi: 0x4d565f,
  screenFrame: 0x1b2025,
  screen: 0x0a0f0c,
  chest: 0x39424b,
  chestHi: 0x4c5762,
  badge: 0x56d989,
  legCore: 0x14181c,
  legRing: 0x5b656f,
  legCoreFar: 0x0e1114,
  legRingFar: 0x424a53,
  pix: [0, 0x2b6b45, 0x56d989, 0xe4ffe9],
};

const PARAMS = {
  scale: 1.25,
  bodyW: 24,
  bodyH: 14,
  headW: 58,
  headH: 34,
  hipX: [9, 5, -5, -9],
  hipY: 7,
  footRestX: [11, 6, -6, -11],
  standH: 22,
  stepThresholdBase: 12,
  walkSpeed: 150,
  wanderSpeed: 85,
  accel: 800,
  bodySpring: 170, // critically calm: glides, settles without bounce
  bodyDamp: 22,
  rotSpring: 150,
  rotDamp: 22,
  leanGain: 0.0003,
  leanMax: 0.04,
  headMass: 1.0,
};

// The dashboard dialect: eyes are round gauges, the mouth is a data line.
const FACES = {
  idle(f) {
    // Steady gauges and a gently drifting flatline.
    f.eye(3, 3, 4, 4, true);
    f.eye(9, 3, 4, 4, true);
    const y = 9 + (Math.sin(f.t * 1.4) > 0.6 ? -1 : 0);
    f.block(4, y, 8, 1, 1);
  },
  calm(f) {
    // Half-lidded gauges: all systems nominal.
    f.block(3, 4, 4, 2, 1);
    f.px(4, 5, 2);
    f.block(9, 4, 4, 2, 1);
    f.px(10, 5, 2);
    f.block(5, 9, 6, 1, 1);
  },
  focus(f) {
    // Working: a scan blip sweeps the mouth-graph, needles up.
    f.eye(3, 2, 4, 5, true);
    f.eye(9, 2, 4, 5, true);
    const c = 4 + (((f.t * 10) | 0) % 8);
    f.block(4, 9, 8, 1, 1);
    f.px(c, 8, 3);
    f.px(c, 9, 3);
  },
  tada(f) {
    // The presentation flourish: starburst corners and a proud open smile.
    const tw = ((f.t * 6) | 0) % 2;
    f.px(1, 2, tw ? 3 : 1);
    f.px(14, 1, tw ? 1 : 3);
    f.px(1, 8, tw ? 1 : 3);
    f.px(14, 9, tw ? 3 : 1);
    for (const c of [3, 9]) {
      f.px(c, 4, 2);
      f.px(c + 1, 3, 3);
      f.px(c + 2, 3, 3);
      f.px(c + 3, 4, 2);
    }
    f.block(5, 8, 6, 2, 2);
    f.block(6, 8, 4, 1, 3);
  },
  alarm(f) {
    // Something is jammed: gauges pinned wide, the graph spiking hard.
    f.block(2, 2, 5, 5, 1);
    f.px(4, 4, 3);
    f.block(9, 2, 5, 5, 1);
    f.px(11, 4, 3);
    const k = (f.t * 12) | 0;
    for (let x = 3; x <= 12; x++) f.px(x, 9 - ((x + k) % 3), 2);
  },
  happy(f) {
    for (const c of [3, 9]) {
      f.px(c, 4, 2);
      f.px(c + 1, 3, 3);
      f.px(c + 2, 3, 3);
      f.px(c + 3, 4, 2);
    }
    f.block(5, 9, 6, 1, 2);
  },
  curious(f) {
    f.eye(2, 2, 5, 5, true);
    f.eye(10, 4, 3, 3, true);
    f.block(5, 9, 5, 1, 1);
  },
  sleepy(f) {
    f.block(3, 5, 4, 2, 1);
    f.block(9, 5, 4, 2, 1);
  },
};

export const OTTO = {
  name: 'otto',
  params: PARAMS,
  palette: COL,
  legs: {
    rings: 3,
    near: { core: COL.legCore, ring: COL.legRing, width: 4.6 },
    far: { core: COL.legCoreFar, ring: COL.legRingFar, width: 4 },
  },
  face: {
    w: 16,
    h: 12,
    animated: ['idle', 'focus', 'tada', 'alarm'],
    exprs: FACES,
  },

  // Chest: a slim console unit with a green status badge.
  buildBody(g) {
    const P = PARAMS;
    g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 4).fill(COL.chest);
    g.roundRect(-P.bodyW / 2 + 2.4, -P.bodyH / 2 + 1.4, P.bodyW - 4.8, 3.6, 2).fill(COL.chestHi);
    g.circle(P.bodyW / 2 - 5, 1.5, 2).fill({ color: COL.badge, alpha: 0.35 });
    g.circle(P.bodyW / 2 - 5, 1.5, 1.1).fill(COL.badge);
  },

  // Head: a wide thin-bezel wall display on a stub mount, tilted at nothing,
  // plus a tiny antenna nub for the ops radio.
  buildHead(g) {
    const w = PARAMS.headW;
    const h = PARAMS.headH;
    g.rect(w / 2 - 6, -h / 2 - 6, 1.8, 7).fill(COL.bezelShade);
    g.circle(w / 2 - 5.1, -h / 2 - 6.5, 1.8).fill(COL.badge);
    g.roundRect(-w / 2 + 1.4, -h / 2 + 2, w, h, 7).fill(COL.bezelShade);
    g.roundRect(-w / 2, -h / 2, w, h, 7).fill(COL.bezel);
    g.roundRect(-w / 2 + 3.4, -h / 2 + 3, w - 6.8, h - 8, 4).fill(COL.screenFrame);
    g.roundRect(-w / 2 + 4.6, -h / 2 + 4.2, w - 9.2, h - 10.4, 3).fill(COL.screen);
    // control strip
    g.circle(-w / 2 + 7, h / 2 - 2.6, 1.2).fill(COL.bezelHi);
    g.circle(-w / 2 + 11, h / 2 - 2.6, 1.2).fill(COL.bezelHi);
    const sw = w - 9.2;
    const sh = h - 10.4;
    return { x: -sw / 2, y: -h / 2 + 4.2, w: sw, h: sh };
  },

  buildHeadGloss(g, box) {
    const { x: gx, y: gy, w: sw, h: sh } = box;
    g.poly([
      { x: gx + sw * 0.68, y: gy },
      { x: gx + sw * 0.78, y: gy },
      { x: gx + sw * 0.52, y: gy + sh },
      { x: gx + sw * 0.42, y: gy + sh },
    ]).fill({ color: 0xffffff, alpha: 0.05 });
  },
};
