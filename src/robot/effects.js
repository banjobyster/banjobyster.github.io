// Diegetic effects around the robot: the plug cable (drawn under the body),
// spark bursts and sleep Zzz (drawn over it). Everything works in document
// coordinates, same as the robot; plug targets are live DOM elements so the
// cable survives reflow for free.

import { Graphics } from 'pixi.js';
import { clamp, qbez, randRange } from 'bysters/core/math.js';

export class Effects {
  constructor(robot) {
    this.R = robot;
    this.under = new Graphics();
    this.over = new Graphics();
    this.plug = null; // { el, color }
    this.sparks = [];
    this.zzz = [];
    this.zzzTimer = 0;
  }

  plugTo(el, color = 0x3ddc97) {
    this.plug = { el, color };
  }

  unplug() {
    this.plug = null;
  }

  burst(x, y, color = 0xf08c3c, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = randRange(-Math.PI * 0.95, -Math.PI * 0.05); // upward fan
      const sp = randRange(120, 340);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        life: randRange(0.3, 0.6),
        color: Math.random() < 0.35 ? 0xffffff : color,
      });
    }
  }

  // space: the current Space snapshot (TDD Section 5). The plug target is a
  // live DOM element; rectOf gives its document-space rect so the cable draws
  // in the robot's coordinates without reading window.
  update(dt, space) {
    const R = this.R;

    const u = this.under;
    u.clear();
    const plugRect =
      this.plug && this.plug.el && this.plug.el.isConnected && space
        ? space.rectOf(this.plug.el)
        : null;
    if (plugRect) {
      const px = plugRect.x + plugRect.w / 2;
      const py = plugRect.y + plugRect.h / 2;
      const cx = R.x;
      const cy = R.bodyY + 3;
      const mx = (cx + px) / 2;
      const my = Math.max(cy, py) + 14; // cable sag
      const N = 18;
      let prev = { x: cx, y: cy };
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        const pt = { x: qbez(cx, mx, px, t), y: qbez(cy, my, py, t) };
        if (i % 2 === 1) {
          u.moveTo(prev.x, prev.y)
            .lineTo(pt.x, pt.y)
            .stroke({ width: 2, color: this.plug.color, alpha: 0.9, cap: 'round' });
        }
        prev = pt;
      }
      u.circle(px, py, 2.5).fill(this.plug.color);
    }

    const o = this.over;
    o.clear();

    for (const s of this.sparks) {
      s.t += dt;
      s.vy += 1100 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.t / s.life;
      if (k > 0) o.rect(s.x - 1.5, s.y - 1.5, 3, 3).fill({ color: s.color, alpha: clamp(k, 0, 1) });
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);

    if (R.state === 'sleep') {
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = randRange(1.1, 1.7);
        this.zzz.push({
          x: R.headX + R.facing * 16,
          y: R.headY - 24,
          t: 0,
          life: 2.4,
          drift: randRange(6, 14),
        });
      }
    }
    for (const z of this.zzz) {
      z.t += dt;
      const k = z.t / z.life;
      const a = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.9;
      const s = 4 + k * 5;
      const x = z.x + Math.sin(z.t * 2.2) * 4 + z.drift * k;
      const y = z.y - k * 34;
      o.moveTo(x, y)
        .lineTo(x + s, y)
        .lineTo(x, y + s)
        .lineTo(x + s, y + s)
        .stroke({ width: 1.6, color: 0x9aa3ad, alpha: clamp(a, 0, 1) });
    }
    this.zzz = this.zzz.filter((z) => z.t < z.life);
  }
}
