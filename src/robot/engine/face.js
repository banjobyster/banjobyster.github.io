// The pixel face: a low-res buffer (16x12) that the renderer upscales
// nearest-neighbor onto the head screen. Values: 0 off, 1 dim, 2 bright,
// 3 white-hot.

import { clamp, randRange } from './math.js';

export const FACE_W = 16;
export const FACE_H = 12;

// Expressions that re-render every frame (the rest only redraw on gaze/blink).
const ANIMATED = new Set(['glitch', 'sync', 'dizzy', 'excited', 'angry', 'suspicious']);

export class Face {
  constructor() {
    this.buf = new Uint8Array(FACE_W * FACE_H);
    this.expr = 'off';
    this.holdT = 0; // time left before reverting to idle (0 = sticky)
    this.blink = 0; // 0 open .. 1 closed
    this.blinkTimer = randRange(2, 5);
    this.blinkPhase = 0; // 0 idle, >0 animating
    this.gazeX = 0; // -1..1
    this.gazeY = 0;
    this.t = 0;
    this.dirty = true;
  }

  set(expr, hold = 0) {
    if (this.expr !== expr) this.dirty = true;
    this.expr = expr;
    this.holdT = hold;
  }

  update(dt, gazeX, gazeY) {
    this.t += dt;
    const gx = clamp(gazeX, -1, 1);
    const gy = clamp(gazeY, -1, 1);
    if (Math.abs(gx - this.gazeX) > 0.02 || Math.abs(gy - this.gazeY) > 0.02) this.dirty = true;
    this.gazeX = gx;
    this.gazeY = gy;

    if (this.holdT > 0) {
      this.holdT -= dt;
      if (this.holdT <= 0) this.set('idle');
    }

    // Blink cycle (only meaningful for open-eye expressions).
    const slow = this.expr === 'sleepy' ? 2.2 : 1;
    if (this.blinkPhase > 0) {
      this.blinkPhase += dt / slow;
      const u = this.blinkPhase / 0.16;
      this.blink = u < 0.5 ? u * 2 : clamp(2 - u * 2, 0, 1);
      if (u >= 1) {
        this.blinkPhase = 0;
        this.blink = 0;
        this.blinkTimer = randRange(2, 5) * slow;
      }
      this.dirty = true;
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) this.blinkPhase = 0.0001;
    }

    if (ANIMATED.has(this.expr)) this.dirty = true; // animate every frame
    if (this.dirty) this.render();
  }

  px(c, r, v) {
    if (c < 0 || c >= FACE_W || r < 0 || r >= FACE_H) return;
    this.buf[r * FACE_W + c] = v;
  }

  block(c, r, w, h, v) {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) this.px(x, y, v);
  }

  eye(c, r, w, h, withPupil) {
    // Eyelid closes from the top.
    const visible = Math.round(h * (1 - this.blink));
    if (visible <= 0) {
      this.block(c, r + h - 1, w, 1, 1);
      return;
    }
    this.block(c, r + (h - visible), w, visible, 1);
    if (withPupil && visible >= 2) {
      const pc = c + Math.round((w - 2) / 2) + Math.round(this.gazeX);
      const pr = r + (h - visible) + Math.round((visible - 2) / 2) + Math.round(this.gazeY * 0.8);
      this.block(clamp(pc, c, c + w - 2), clamp(pr, r + (h - visible), r + h - 2), 2, 2, 2);
    }
  }

  render() {
    this.buf.fill(0);
    switch (this.expr) {
      case 'off':
        break;
      case 'idle':
        this.eye(3, 3, 3, 4, true);
        this.eye(10, 3, 3, 4, true);
        this.block(7, 9, 2, 1, 1); // small resting mouth
        break;
      case 'curious': {
        // One eye wide, the other squinting, a raised brow pixel row.
        this.eye(2, 2, 4, 5, true);
        this.block(10, 5, 3, 2, 1);
        this.px(11, 6, 2);
        this.block(10, 2, 3, 1, 1);
        break;
      }
      case 'happy': {
        // Chevron eyes and a small smile.
        for (const c of [3, 10]) {
          this.px(c, 5, 2);
          this.px(c + 1, 4, 2);
          this.px(c + 2, 4, 2);
          this.px(c + 3, 5, 2);
        }
        this.px(5, 8, 2);
        this.block(6, 9, 4, 1, 2);
        this.px(10, 8, 2);
        break;
      }
      case 'sync': {
        // Scanning bar sweeping across while data loads.
        const c = Math.round((Math.sin(this.t * 5) * 0.5 + 0.5) * (FACE_W - 3));
        this.block(c, 4, 3, 4, 2);
        this.block(0, 4, FACE_W, 4, 0);
        this.block(c, 4, 3, 4, 2);
        this.px(c + 1, 5, 3);
        break;
      }
      case 'glitch': {
        // Torn eyes plus flickering static.
        for (const [c, r] of [
          [3, 3],
          [10, 3],
        ]) {
          for (let y = 0; y < 4; y++) {
            const shift = ((Math.random() * 5) | 0) - 2;
            this.block(clamp(c + shift, 0, FACE_W - 3), r + y, 3, 1, Math.random() < 0.7 ? 2 : 1);
          }
        }
        for (let i = 0; i < 14; i++) {
          this.px((Math.random() * FACE_W) | 0, (Math.random() * FACE_H) | 0, ((Math.random() * 3) | 0) + 1);
        }
        break;
      }
      case 'sleepy': {
        this.block(3, 5, 3, 2, 1);
        this.block(10, 5, 3, 2, 1);
        break;
      }
      case 'excited': {
        // Bouncing chevron eyes, an open grin, twinkling corner sparkles.
        const b = Math.sin(this.t * 10) > 0 ? 1 : 0;
        for (const c of [3, 10]) {
          this.px(c, 5 - b, 2);
          this.px(c + 1, 4 - b, 3);
          this.px(c + 2, 4 - b, 3);
          this.px(c + 3, 5 - b, 2);
        }
        this.block(6, 8, 4, 2, 2);
        this.block(7, 8, 2, 1, 3);
        const tw = ((this.t * 6) | 0) % 2;
        this.px(1, 2, tw ? 3 : 1);
        this.px(14, 6, tw ? 1 : 3);
        this.px(13, 1, tw ? 2 : 1);
        break;
      }
      case 'dizzy': {
        // Counter-rotating pupils orbiting dim eye plates, a wobbling mouth.
        const ORBIT = [
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
        ];
        const k = (this.t * 8) | 0;
        for (const [c, off] of [
          [3, 0],
          [10, 2],
        ]) {
          this.block(c, 3, 3, 4, 1);
          const [ox, oy] = ORBIT[(k + off) % 4];
          this.px(c + ox, 3 + oy + 1, 3);
        }
        for (let x = 5; x <= 10; x++) this.px(x, 9 + ((x + k) % 2), 1);
        break;
      }
      case 'angry': {
        // Brows slanted hard toward the center, narrowed hot eyes, gritted
        // mouth; the brows tremble sideways like it is fuming.
        const j = ((this.t * 14) | 0) % 2;
        for (const [bx, dir] of [
          [2, 1],
          [13, -1],
        ]) {
          this.px(bx + j * dir, 2, 2);
          this.px(bx + dir + j * dir, 2, 2);
          this.px(bx + dir * 2 + j * dir, 3, 2);
          this.px(bx + dir * 3 + j * dir, 3, 2);
        }
        this.block(3, 5, 3, 2, 2);
        this.px(4, 5, 3);
        this.block(10, 5, 3, 2, 2);
        this.px(11, 5, 3);
        for (let x = 5; x <= 10; x++) this.px(x, 9, x % 2 ? 2 : 1);
        break;
      }
      case 'suspicious': {
        // Flat-lidded eyes, both pupils sweeping slowly side to side in sync.
        const sl = Math.round(Math.sin(this.t * 2.2) * 1.4);
        for (const c of [3, 10]) {
          this.block(c, 4, 3, 2, 1);
          this.px(clamp(c + 1 + sl, c, c + 2), 5, 3);
        }
        this.block(6, 9, 3, 1, 1);
        break;
      }
      case 'wink': {
        // One eye open and tracking, the other a closed happy arc, plus the
        // full smile. Used as a wave flourish.
        this.eye(3, 3, 3, 4, true);
        this.px(9, 4, 1);
        this.block(10, 5, 3, 1, 2);
        this.px(13, 4, 1);
        this.px(5, 8, 2);
        this.block(6, 9, 4, 1, 2);
        this.px(10, 8, 2);
        break;
      }
      case 'portrait': {
        // A tiny pixel portrait of Sayan: hair, face, bright eyes, a smile,
        // shoulders. Static; shown once while sitting beside the About text.
        this.block(5, 1, 6, 1, 2); // hair top
        this.block(4, 2, 8, 1, 2); // hair
        for (const r of [3, 4, 5]) {
          this.px(4, r, 2); // hair sides
          this.px(11, r, 2);
          this.block(5, r, 6, 1, 1); // face
        }
        this.px(6, 5, 3); // eyes
        this.px(9, 5, 3);
        this.block(5, 6, 6, 1, 1);
        this.block(5, 7, 6, 1, 1);
        this.block(6, 7, 4, 1, 2); // smile
        this.block(6, 8, 4, 1, 1); // chin
        this.block(7, 9, 2, 1, 1); // neck
        this.block(3, 10, 10, 2, 2); // shoulders
        break;
      }
      default:
        this.eye(3, 3, 3, 4, true);
        this.eye(10, 3, 3, 4, true);
    }
    this.dirty = true; // renderer clears this after drawing
  }
}
