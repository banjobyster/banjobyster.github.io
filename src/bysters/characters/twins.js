// The twins, Kip and Pip: two tiny handheld-TV toddlers, one warm, one cool.
// Same body, mirrored souls: a factory builds both so the geometry stays
// literally identical and only palette + accessory differ. They are the
// smallest walkers on the page (knee-high to Chunk), so the face grid is
// deliberately COARSE: 12x9 pixels on the same screen area means every
// expression pixel is big and readable at their size.
//
// A character is plain data for the renderer: params (proportions + motion
// tuning), palette (with pix: the 4-level face palette [off, dim, main, hot]),
// legs (accordion style), face ({ w, h, animated, exprs }), buildBody(g),
// buildHead(g) -> faceBox, optional buildHeadGloss(g, faceBox).

const PARAMS = {
  scale: 0.75,
  bodyW: 14,
  bodyH: 8,
  headW: 30,
  headH: 26,
  hipX: [6, 3.5, -3.5, -6],
  hipY: 4.5,
  footRestX: [7.5, 4, -4, -7.5],
  standH: 13,
  stepThresholdBase: 7, // quick little toddler steps
  walkSpeed: 185,
  wanderSpeed: 110,
  accel: 1400, // zippy starts and stops
  bodySpring: 260, // under-damped: lands with a bouncy squash
  bodyDamp: 13,
  rotSpring: 220,
  rotDamp: 14,
  headMass: 0.55,
  leanGain: 0.0005,
  leanMax: 0.09,
};

// Shared face dialect on a coarse 12x9 grid: everything oversized.
const FACES = {
  idle(f) {
    f.eye(2, 2, 3, 4, true);
    f.eye(7, 2, 3, 4, true);
    f.block(5, 7, 2, 1, 1);
  },
  curious(f) {
    f.eye(1, 1, 4, 5, true);
    f.eye(7, 3, 3, 3, true);
    f.px(5, 7, 2);
    f.px(6, 8, 2);
  },
  happy(f) {
    for (const c of [2, 7]) {
      f.px(c, 4, 2);
      f.px(c + 1, 3, 3);
      f.px(c + 2, 4, 2);
    }
    f.px(3, 6, 2);
    f.block(4, 7, 4, 1, 3);
    f.px(8, 6, 2);
  },
  grin(f) {
    f.eye(2, 2, 3, 3, true);
    f.eye(7, 2, 3, 3, true);
    f.block(3, 6, 6, 1, 2);
    f.block(4, 7, 4, 1, 3);
  },
  excited(f) {
    // Bouncing chevron eyes over a wide open mouth; corners twinkle.
    const b = Math.sin(f.t * 11) > 0 ? 1 : 0;
    for (const c of [2, 7]) {
      f.px(c, 4 - b, 2);
      f.px(c + 1, 3 - b, 3);
      f.px(c + 2, 4 - b, 2);
    }
    f.block(4, 6, 4, 2, 2);
    f.block(5, 6, 2, 1, 3);
    const tw = ((f.t * 7) | 0) % 2;
    f.px(0, 0, tw ? 3 : 1);
    f.px(11, 2, tw ? 1 : 3);
  },
  sad(f) {
    // Outer-drooping lids over pupils that still track, a small wobbly mouth.
    const g = Math.round(f.gazeX);
    f.px(2, 2, 2);
    f.block(2, 3, 3, 1, 1);
    f.px(9, 2, 2);
    f.block(7, 3, 3, 1, 1);
    f.px(Math.min(Math.max(3 + g, 2), 4), 4, 2);
    f.px(Math.min(Math.max(8 + g, 7), 9), 4, 2);
    f.px(4, 8, 2);
    f.block(5, 7, 2, 1, 2);
    f.px(7, 8, 2);
  },
  cry(f) {
    // Squeezed-shut eyes, a wailing mouth, big tears that fall.
    f.block(2, 3, 3, 1, 2);
    f.block(7, 3, 3, 1, 2);
    const drop = ((f.t * 6) | 0) % 4;
    f.px(2, 4 + drop, 3);
    f.px(9, 4 + ((drop + 2) % 4), 3);
    const wob = ((f.t * 9) | 0) % 2;
    f.block(4, 6, 4, 2, 2);
    f.block(4 + wob, 7, 3, 1, 3);
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
      [2, 0],
      [7, 2],
    ]) {
      f.block(c, 2, 3, 3, 1);
      const [ox, oy] = ORBIT[(k + off) % 4];
      f.px(c + ox, 2 + oy, 3);
    }
    for (let x = 3; x <= 8; x++) f.px(x, 7 + ((x + k) % 2), 1);
  },
  panic(f) {
    // Tiny pupils in huge whites, locked on the threat, a quivering o mouth.
    const gx = Math.round(f.gazeX);
    const gy = Math.round(f.gazeY * 0.8);
    for (const c of [1, 7]) {
      f.block(c, 1, 4, 4, 1);
      f.px(Math.min(Math.max(c + 1 + gx, c), c + 3), Math.min(Math.max(2 + gy, 1), 4), 3);
    }
    const j = ((f.t * 13) | 0) % 2;
    f.block(4 + j, 6, 3, 2, 2);
  },
  peek(f) {
    // Eyes squeezed low, but the pupils stay on whatever they fear.
    const g = Math.round(f.gazeX);
    f.block(1, 3, 3, 2, 1);
    f.px(Math.min(Math.max(2 + g, 1), 3), 4, 3);
    f.block(6, 3, 3, 2, 1);
    f.px(Math.min(Math.max(7 + g, 6), 8), 4, 3);
    f.px(5, 7, 1);
  },
  mimicChunk(f) {
    // The Chunk act, dialed to eleven: his brow slashes, his narrowed hot
    // eyes (pupils pinned on the real engineer), his gritted jaw. On the
    // coarse twin grid every borrowed feature is oversized and unmistakable.
    const g = Math.round(f.gazeX);
    f.px(0, 0, 2);
    f.px(1, 1, 2);
    f.px(2, 2, 2);
    f.px(11, 0, 2);
    f.px(10, 1, 2);
    f.px(9, 2, 2);
    f.block(1, 3, 4, 2, 2);
    f.px(Math.min(Math.max(2 + g, 1), 4), 4, 3);
    f.block(7, 3, 4, 2, 2);
    f.px(Math.min(Math.max(8 + g, 7), 10), 4, 3);
    for (let x = 3; x <= 8; x++) f.px(x, 7, x % 2 ? 2 : 1);
  },
  mimicOtto(f) {
    // The Otto act: his round gauge eyes (needles tracking the model) over
    // his graph-line mouth, blip included. A pocket dashboard.
    f.eye(1, 1, 4, 4, true);
    f.eye(7, 1, 4, 4, true);
    const c = 3 + (((f.t * 8) | 0) % 6);
    f.block(3, 7, 6, 1, 1);
    f.px(c, 6, 3);
    f.px(c, 7, 3);
  },
  sleepy(f) {
    f.block(2, 4, 3, 1, 1);
    f.block(7, 4, 3, 1, 1);
  },
};

function makeTwin(name, col, accessory) {
  return {
    name,
    params: PARAMS,
    palette: col,
    legs: {
      rings: 3,
      near: { core: col.legCore, ring: col.legRing, width: 3.8 },
      far: { core: col.legCoreFar, ring: col.legRingFar, width: 3.3 },
    },
    face: {
      w: 12,
      h: 9,
      animated: ['excited', 'cry', 'dizzy', 'panic', 'mimicChunk', 'mimicOtto', 'peek'],
      exprs: FACES,
    },

    // Chest: a tiny rounded pack with a carry-handle detail.
    buildBody(g) {
      const P = PARAMS;
      g.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 3.5).fill(col.chest);
      g.roundRect(-P.bodyW / 2 + 1.8, -P.bodyH / 2 + 1, P.bodyW - 3.6, 2.4, 1.4).fill(col.chestHi);
      g.roundRect(-2.4, -0.6, 4.8, 2.8, 1).fill(col.chestDark);
    },

    // Head: a rounded handheld TV. The accessory tells the twins apart at a
    // glance: Kip wears a single bobble antenna, Pip a pair of rabbit ears.
    buildHead(g) {
      const w = PARAMS.headW;
      const h = PARAMS.headH;
      if (accessory === 'bobble') {
        g.rect(-0.9, -h / 2 - 6, 1.8, 7).fill(col.bezelShade);
        g.circle(0, -h / 2 - 6.8, 2.6).fill(col.chest);
      } else {
        g.rect(-6, -h / 2 - 5.5, 1.7, 7).fill(col.bezelShade);
        g.rect(4.3, -h / 2 - 5.5, 1.7, 7).fill(col.bezelShade);
        g.circle(-5.2, -h / 2 - 6, 1.7).fill(col.chest);
        g.circle(5.2, -h / 2 - 6, 1.7).fill(col.chest);
      }
      g.roundRect(-w / 2 + 1.1, -h / 2 + 1.5, w, h, 9).fill(col.bezelShade);
      g.roundRect(-w / 2, -h / 2, w, h, 9).fill(col.bezel);
      g.roundRect(-w / 2 + 3, -h / 2 + 2.6, w - 6, h - 6.8, 5).fill(col.screenFrame);
      g.roundRect(-w / 2 + 4, -h / 2 + 3.6, w - 8, h - 8.8, 4).fill(col.screen);
      g.circle(w / 2 - 4.6, h / 2 - 2.4, 1.1).fill(col.bezelShade);
      g.circle(-w / 2 + 4.6, h / 2 - 2.4, 1.1).fill(col.chest);
      const sw = w - 8;
      const sh = h - 8.8;
      return { x: -sw / 2, y: -h / 2 + 3.6, w: sw, h: sh };
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
