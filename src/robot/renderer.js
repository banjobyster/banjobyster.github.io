// Pixi render edge: draws the robot from the state Robot.update() produced.
// Flat-cartoon take on the reference: a big CRT monitor with a green pixel
// face, sitting on a small blue chest with four ring-armored accordion legs.

import { Container, Graphics } from 'pixi.js';
import { FACE_W, FACE_H } from './face.js';
import { clamp, qbez } from './math.js';

const COL = {
  bezel: 0xd3d7dc,
  bezelShade: 0xa8aeb7,
  bezelDetail: 0x8f969f,
  screenFrame: 0x394049,
  screen: 0x0b100d,
  blue: 0x5b9fe3,
  blueHi: 0x7ab5ee,
  blueDark: 0x2f5d8f,
  legNear: 0xc6cbd2,
  legNearCore: 0x2a2e33,
  legFar: 0x878e97,
  legFarCore: 0x1d2126,
  orange: 0xf08c3c,
  pix: [0, 0x3f8f55, 0x7de88a, 0xe2ffe4],
};

export class RobotRenderer {
  constructor(parent, P) {
    this.P = P;
    this.pix = COL.pix; // face palette; the director may tint it to a card accent
    this.root = new Container();
    parent.addChild(this.root);

    // Per-leg secondary-motion state, keyed by the leg's index on the robot:
    // ring spread lags the core on stretch, the core bows against fast swings.
    this.legState = [0, 1, 2, 3].map(() => ({ spread: 0, whip: 0, fx: 0, fy: 0, init: false }));

    this.shadowG = new Graphics();
    this.legsFar = new Graphics();
    this.bodyC = new Container();
    this.legsNear = new Graphics();
    this.headC = new Container();

    // Chest: small blue box with a highlight and a port slot.
    const chestG = new Graphics();
    chestG.roundRect(-P.bodyW / 2, -P.bodyH / 2, P.bodyW, P.bodyH, 5).fill(COL.blue);
    chestG.roundRect(-P.bodyW / 2 + 2.8, -P.bodyH / 2 + 1.4, P.bodyW - 5.6, 4.2, 2).fill(COL.blueHi);
    chestG.roundRect(-5, -1.5, 10, 5.5, 1.5).fill(COL.blueDark);
    this.bodyC.addChild(chestG);

    // Monitor: bezel with bottom-right shading, recessed screen, detail bits.
    const w = P.headW;
    const h = P.headH;
    const headG = new Graphics();
    headG.roundRect(-w / 2 + 1.7, -h / 2 + 2.5, w, h, 10).fill(COL.bezelShade);
    headG.roundRect(-w / 2, -h / 2, w, h, 10).fill(COL.bezel);
    headG.roundRect(-w / 2 - 4, -8.5, 6.5, 17, 2).fill(COL.bezelShade); // side unit
    headG.roundRect(-w / 2 + 5.5, -h / 2 + 4.2, w - 11, h - 13.5, 7).fill(COL.screenFrame);
    headG.roundRect(-w / 2 + 7.5, -h / 2 + 6.2, w - 15, h - 17.5, 5).fill(COL.screen);
    // control strip under the screen
    headG.circle(w / 2 - 10, h / 2 - 4.6, 1.8).fill(COL.bezelDetail);
    headG.circle(w / 2 - 16, h / 2 - 4.6, 1.8).fill(COL.bezelDetail);
    headG.circle(-w / 2 + 10, h / 2 - 4.6, 3).fill({ color: COL.orange, alpha: 0.3 }); // glow
    headG.circle(-w / 2 + 10, h / 2 - 4.6, 1.7).fill(COL.orange); // power light
    this.headC.addChild(headG);

    this.faceG = new Graphics();
    const sw = w - 15;
    const sh = h - 17.5;
    this.faceG.scale.set(sw / FACE_W, sh / FACE_H);
    this.faceG.position.set(-sw / 2, -h / 2 + 6.2);
    this.headC.addChild(this.faceG);

    // Glossy CRT glass: two diagonal shines over the screen.
    const glassG = new Graphics();
    const gx = -sw / 2;
    const gy = -h / 2 + 6.2;
    glassG
      .poly([
        { x: gx + sw * 0.52, y: gy },
        { x: gx + sw * 0.72, y: gy },
        { x: gx + sw * 0.34, y: gy + sh },
        { x: gx + sw * 0.14, y: gy + sh },
      ])
      .fill({ color: 0xffffff, alpha: 0.07 });
    glassG
      .poly([
        { x: gx + sw * 0.8, y: gy },
        { x: gx + sw * 0.87, y: gy },
        { x: gx + sw * 0.62, y: gy + sh },
        { x: gx + sw * 0.55, y: gy + sh },
      ])
      .fill({ color: 0xffffff, alpha: 0.05 });
    this.headC.addChild(glassG);

    this.root.addChild(this.shadowG, this.legsFar, this.bodyC, this.legsNear, this.headC);
  }

  setFacePalette(pix) {
    this.pix = pix || COL.pix;
  }

  // Accordion legs: a stretchy inner core wrapped in hard rings. The rings
  // never deform; they just ride the core, sitting flush at rest, spreading
  // apart when the leg reaches, and stacking up when it compresses. The core
  // thins as it stretches, which sells the elastic. Two layers of secondary
  // motion: the ring stack (anchored at the boot) lags a beat behind a sudden
  // stretch before spreading, and the core bows against fast sideways swings.
  drawLegs(g, legs, coreColor, ringColor, width, dt) {
    const RINGS = 4;
    const S = this.P.scale;
    for (const l of legs) {
      const st = this.legState[l.i];
      const hx = l.hip.x;
      const hy = l.hip.y;
      let dx = l.foot.x - hx;
      let dy = l.foot.y - 2 - hy;
      let len = Math.hypot(dx, dy) || 0.001;
      const s = len / l.rest;
      // soft cap: past 3.5x rest length extra reach is heavily damped
      if (s > 3.5) {
        const k = (l.rest * (3.5 + (s - 3.5) * 0.25)) / len;
        dx *= k;
        dy *= k;
        len *= k;
      }
      const ux = dx / len;
      const uy = dy / len;

      if (!st.init) {
        st.init = true;
        st.spread = len;
        st.fx = l.foot.x;
        st.fy = l.foot.y;
      }
      // Compression snaps (the stack rides the boot down); stretch spreads
      // with a short lag, so reaches read as the accordion pulling open.
      st.spread += (len - st.spread) * (len < st.spread ? 1 : 1 - Math.exp(-dt * 14));
      if (dt > 0.0001) {
        const lv = ((l.foot.x - st.fx) * -uy + (l.foot.y - st.fy) * ux) / dt;
        st.whip += (clamp(lv * -0.004, -3, 3) * S - st.whip) * (1 - Math.exp(-dt * 12));
      }
      st.fx = l.foot.x;
      st.fy = l.foot.y;

      const cpx = hx + ux * len * 0.5 - uy * st.whip;
      const cpy = hy + uy * len * 0.5 + ux * st.whip;
      const ex = hx + ux * (len - 0.5);
      const ey = hy + uy * (len - 0.5);
      const px = (t) => qbez(hx, cpx, ex, t);
      const py = (t) => qbez(hy, cpy, ey, t);

      const coreW = width * 0.6 * clamp(Math.pow(1 / s, 0.5), 0.45, 1);
      g.moveTo(hx + ux, hy + uy)
        .quadraticCurveTo(cpx, cpy, ex, ey)
        .stroke({ width: coreW, color: coreColor, cap: 'round' });

      const ringLen = l.rest / RINGS;
      // stretch biases the stack toward the boot: the bare core shows hip-side
      const bias = clamp(st.spread / l.rest, 1, 1.5);
      for (let i = 0; i < RINGS; i++) {
        const c = len - Math.pow(1 - (i + 0.5) / RINGS, bias) * st.spread;
        const b = Math.min(c + ringLen / 2, len);
        const ta = clamp((b - ringLen) / len, 0, 1);
        const tb = clamp(b / len, 0, 1);
        // rings taper toward the foot, except the last one: a chunky little boot
        const rw = i === RINGS - 1 ? width : width * (1 - 0.07 * i);
        g.moveTo(px(ta), py(ta))
          .lineTo(px(tb), py(tb))
          .stroke({ width: rw, color: ringColor, cap: 'butt' });
      }
    }
  }

  draw(R, dt) {
    const P = this.P;
    this.bodyC.position.set(R.x, R.bodyY);
    this.bodyC.rotation = R.rot;
    this.headC.position.set(R.headX, R.headY);
    this.headC.rotation = R.headRot;

    // Soft ground shadow, fading with altitude.
    this.shadowG.clear();
    if (R.graph) {
      const surf = R.segment.y;
      const alt = Math.max(surf - R.bodyY - P.standH, 0);
      const k = clamp(1 - alt / 170, 0, 1);
      if (k > 0.05) {
        this.shadowG
          .ellipse(R.x, surf + 2, 27 * (0.55 + 0.45 * k), 4.4 * (0.6 + 0.4 * k))
          .fill({ color: 0x000000, alpha: 0.22 * k });
      }
    }

    this.legsFar.clear();
    this.legsNear.clear();
    this.drawLegs(this.legsFar, R.legs.filter((l) => !l.near), COL.legFarCore, COL.legFar, 4.8, dt);
    this.drawLegs(this.legsNear, R.legs.filter((l) => l.near), COL.legNearCore, COL.legNear, 5.4, dt);

    if (R.face.dirty) {
      this.faceG.clear();
      const buf = R.face.buf;
      for (let r = 0; r < FACE_H; r++) {
        for (let c = 0; c < FACE_W; c++) {
          const v = buf[r * FACE_W + c];
          if (v) this.faceG.rect(c + 0.07, r + 0.07, 0.86, 0.86).fill(this.pix[v]);
        }
      }
      R.face.dirty = false;
    }
  }
}
