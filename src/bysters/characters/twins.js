// The twins, Kip and Pip: two tiny handheld-TV toddlers, one warm, one cool.
// Same body, mirrored souls: a factory builds both so the geometry stays
// literally identical and only palette + accessory + face dialect differ.
//
// A character is plain data for the renderer: params (proportions + motion
// tuning), palette (with pix: the 4-level face palette [off, dim, main, hot]),
// legs (accordion style), face ({ w, h, animated, exprs }), buildBody(g),
// buildHead(g) -> faceBox, optional buildHeadGloss(g, faceBox).

const PARAMS = {
  scale: 1.0,
  bodyW: 20,
  bodyH: 12,
  headW: 44,
  headH: 36,
  hipX: [8, 4.5, -4.5, -8],
  hipY: 6,
  footRestX: [10, 5, -5, -10],
  standH: 18,
  stepThresholdBase: 9, // quick little toddler steps
  walkSpeed: 200,
  wanderSpeed: 120,
  accel: 1400, // zippy starts and stops
  bodySpring: 260, // under-damped: lands with a bouncy squash
  bodyDamp: 13,
  rotSpring: 220,
  rotDamp: 14,
  leanGain: 0.0005,
  leanMax: 0.09,
  headMass: 0.6,
};

// Shared face dialect: big round eyes, everything oversized and readable.
const FACES = {
  idle(f) {
    f.eye(3, 3, 4, 5, true);
    f.eye(9, 3, 4, 5, true);
    f.block(7, 9, 2, 1, 1);
  },
  curious(f) {
    f.eye(2, 2, 5, 6, true);
    f.eye(10, 4, 3, 4, true);
    f.px(7, 9, 2);
    f.px(8, 10, 2);
  },
  happy(f) {
    for (const c of [3, 9]) {
      f.px(c, 5, 2);
      f.px(c + 1, 4, 3);
      f.px(c + 2, 4, 3);
      f.px(c + 3, 5, 2);
    }
    f.px(5, 8, 2);
    f.block(6, 9, 4, 1, 3);
    f.px(10, 8, 2);
  },
  grin(f) {
    f.eye(3, 3, 4, 4, true);
    f.eye(9, 3, 4, 4, true);
    f.block(4, 8, 8, 1, 2);
    f.block(5, 9, 6, 1, 3);
  },
  excited(f) {
    // Bouncing eyes plus a wide open mouth: the whole face vibrates.
    const b = Math.sin(f.t * 11) > 0 ? 1 : 0;
    for (const c of [3, 9]) {
      f.px(c, 5 - b, 2);
      f.px(c + 1, 4 - b, 3);
      f.px(c + 2, 4 - b, 3);
      f.px(c + 3, 5 - b, 2);
    }
    f.block(6, 8, 4, 3, 2);
    f.block(7, 9, 2, 1, 3);
    const tw = ((f.t * 7) | 0) % 2;
    f.px(1, 1, tw ? 3 : 1);
    f.px(14, 3, tw ? 1 : 3);
  },
  sad(f) {
    // Downturned lids and a wobbly small mouth.
    f.block(3, 4, 4, 2, 1);
    f.px(3, 3, 2);
    f.block(9, 4, 4, 2, 1);
    f.px(12, 3, 2);
    f.px(6, 10, 2);
    f.block(7, 9, 2, 1, 2);
    f.px(9, 10, 2);
  },
  cry(f) {
    // Squeezed-shut eyes, a wailing mouth, and big tears that fall.
    f.block(3, 4, 4, 1, 2);
    f.block(9, 4, 4, 1, 2);
    const drop = ((f.t * 6) | 0) % 4;
    f.px(3, 5 + drop, 3);
    f.px(12, 5 + ((drop + 2) % 4), 3);
    f.block(6, 8, 4, 2, 2);
    const wob = ((f.t * 9) | 0) % 2;
    f.block(6 + wob, 9, 3, 1, 3);
  },
  dizzy(f) {
    const ORBIT = [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ];
    const k = (f.t * 8) | 0;
    for (const [c, off] of [
      [3, 0],
      [9, 2],
    ]) {
      f.block(c, 3, 4, 4, 1);
      const [ox, oy] = ORBIT[(k + off) % 4];
      f.px(c + 1 + ox, 3 + oy, 3);
    }
    for (let x = 5; x <= 10; x++) f.px(x, 9 + ((x + k) % 2), 1);
  },
  panic(f) {
    // Tiny pupils in huge whites, mouth a quivering o, static at the edges.
    for (const c of [2, 9]) {
      f.block(c, 2, 5, 6, 1);
      f.px(c + 2, 4, 3);
    }
    const j = ((f.t * 13) | 0) % 2;
    f.block(6 + j, 9, 3, 2, 2);
    f.px(0, 5, j ? 2 : 0);
    f.px(15, 7, j ? 0 : 2);
  },
  peek(f) {
    // Eyes squeezed to one side, watching without watching.
    f.block(2, 4, 3, 3, 1);
    f.px(2, 5, 3);
    f.block(8, 4, 3, 3, 1);
    f.px(8, 5, 3);
    f.px(6, 9, 1);
  },
  grit(f) {
    // Playing at being the engineer: brows down, mouth set, very serious.
    f.px(2, 2, 2);
    f.px(3, 3, 2);
    f.px(12, 2, 2);
    f.px(11, 3, 2);
    f.block(3, 4, 3, 2, 2);
    f.block(10, 4, 3, 2, 2);
    f.block(5, 9, 6, 1, 2);
  },
  focus(f) {
    // Playing at being the operator: a little scanning blip, chin up.
    const c = Math.round((Math.sin(f.t * 4) * 0.5 + 0.5) * (f.w - 4));
    f.block(c, 3, 3, 3, 2);
    f.px(c + 1, 4, 3);
    f.block(6, 9, 4, 1, 1);
  },
  sleepy(f) {
    f.block(3, 5, 4, 2, 1);
    f.block(9, 5, 4, 2, 1);
  },
};

function makeTwin(name, col, accessory) {
  return {
    name,
    params: PARAMS,
    palette: col,
    legs: {
      rings: 3,
      near: { core: col.legCore, ring: col.legRing, width: 4.6 },
      far: { core: col.legCoreFar, ring: col.legRingFar, width: 4 },
    },
    face: {
      w: 16,
      h: 12,
      animated: ['excited', 'cry', 'dizzy', 'panic', 'focus'],
      exprs: FACES,
    },

    // Chest: a tiny rounded pack with a carry-handle detail.
    buildBody(g) {
      const P = PARAMS;
      g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 5).fill(col.chest);
      g.roundRect(-P.bodyW / 2 + 2.4, -P.bodyH / 2 + 1.2, P.bodyW - 4.8, 3.4, 2).fill(col.chestHi);
      g.roundRect(-3.5, -1, 7, 4, 1.5).fill(col.chestDark);
    },

    // Head: a rounded handheld TV. The accessory tells the twins apart at a
    // glance: Kip wears a single bobble antenna, Pip a pair of rabbit ears.
    buildHead(g) {
      const w = PARAMS.headW;
      const h = PARAMS.headH;
      if (accessory === 'bobble') {
        g.rect(-1.2, -h / 2 - 8, 2.4, 9).fill(col.bezelShade);
        g.circle(0, -h / 2 - 9, 3.4).fill(col.chest);
      } else {
        g.rect(-8.5, -h / 2 - 7.5, 2.2, 9).fill(col.bezelShade);
        g.rect(6.3, -h / 2 - 7.5, 2.2, 9).fill(col.bezelShade);
        g.circle(-7.4, -h / 2 - 8, 2.2).fill(col.chest);
        g.circle(7.4, -h / 2 - 8, 2.2).fill(col.chest);
      }
      g.roundRect(-w / 2 + 1.4, -h / 2 + 2, w, h, 12).fill(col.bezelShade);
      g.roundRect(-w / 2, -h / 2, w, h, 12).fill(col.bezel);
      g.roundRect(-w / 2 + 4.5, -h / 2 + 3.8, w - 9, h - 10, 7).fill(col.screenFrame);
      g.roundRect(-w / 2 + 6, -h / 2 + 5.2, w - 12, h - 12.8, 5).fill(col.screen);
      g.circle(w / 2 - 7, h / 2 - 3.6, 1.5).fill(col.bezelShade);
      g.circle(-w / 2 + 7, h / 2 - 3.6, 1.5).fill(col.chest);
      const sw = w - 12;
      const sh = h - 12.8;
      return { x: -sw / 2, y: -h / 2 + 5.2, w: sw, h: sh };
    },

    buildHeadGloss(g, box) {
      const { x: gx, y: gy, w: sw, h: sh } = box;
      g.poly([
        { x: gx + sw * 0.55, y: gy },
        { x: gx + sw * 0.75, y: gy },
        { x: gx + sw * 0.35, y: gy + sh },
        { x: gx + sw * 0.15, y: gy + sh },
      ]).fill({ color: 0xffffff, alpha: 0.08 });
    },
  };
}

// Kip: warm coral. The bold one.
export const KIP = makeTwin('kip', {
  bezel: 0xe8c9a0,
  bezelShade: 0xbd9a6b,
  screenFrame: 0x4a3826,
  screen: 0x150f08,
  chest: 0xf08c3c,
  chestHi: 0xf7b078,
  chestDark: 0xa85a1e,
  legCore: 0x2a2118,
  legRing: 0xd8b88c,
  legCoreFar: 0x1c1610,
  legRingFar: 0x9c8462,
  pix: [0, 0xa04e20, 0xf2913f, 0xffe1c2],
}, 'bobble');

// Pip: cool mint. The shy one.
export const PIP = makeTwin('pip', {
  bezel: 0xc7ddd2,
  bezelShade: 0x93b0a2,
  screenFrame: 0x27473c,
  screen: 0x0a1410,
  chest: 0x4fb39a,
  chestHi: 0x83d1bd,
  chestDark: 0x2c7a66,
  legCore: 0x18241f,
  legRing: 0xa9cabc,
  legCoreFar: 0x101a16,
  legRingFar: 0x7a9c8c,
  pix: [0, 0x2f7d68, 0x5fd9b8, 0xe0fff4],
}, 'ears');
