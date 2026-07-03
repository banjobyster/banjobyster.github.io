// Hovered-card plug-in (SPEC 4.4): when the visitor hovers a featured card,
// scuttle over, plug into its port, and tint the face to the card's accent
// while "reading" it. Purposeful job: near-zero noise, claims the slot while
// walking or plugged.

import { clamp } from '../engine/math.js';
import { cssColorToInt, accentPalette } from './util.js';

export function hoverCard() {
  return {
    name: 'hover-card',
    priority: 80,

    init() {
      this.el = null;
      this.phase = 'none'; // none | walk | plugged
      this.plugFaceT = 0;
    },

    plug(ctx, el) {
      const { d, R, fx, rd } = ctx;
      this.phase = 'plugged';
      d.note('hover: plugged into card');
      const port = el.querySelector('.devicePort') || el;
      const accent = cssColorToInt(getComputedStyle(el).getPropertyValue('--accent'), 0x3ddc97);
      fx.plugTo(port, accent);
      rd.setFacePalette(accentPalette(accent));
      R.face.set('sync'); // reading the card...
      R.face.dirty = true;
      this.plugFaceT = 1.1;
      R.facing = port === el ? R.facing : -1; // the port sits at the card's right edge
    },

    unplug(ctx) {
      const { R, fx, rd } = ctx;
      fx.unplug();
      rd.setFacePalette(null);
      R.face.dirty = true;
      if (R.face.expr === 'sync' || R.face.expr === 'happy') R.face.set('idle');
      this.plugFaceT = 0;
    },

    update(ctx) {
      const { R, sensors: s } = ctx;
      // a higher-priority job took over: let the card go
      const el = ctx.owner ? null : s.hoverCard;

      if (el !== this.el) {
        if (this.phase === 'plugged') this.unplug(ctx);
        this.el = el;
        this.phase = 'none';
        if (el) {
          const segIx = ctx.api.segFor(el);
          if (segIx >= 0) {
            const seg = ctx.api.graph().segments[segIx];
            const port = el.querySelector('.devicePort');
            const pr = port ? port.getBoundingClientRect() : null;
            const px = pr ? pr.left + pr.width / 2 + window.scrollX : (seg.x1 + seg.x2) / 2;
            this.phase = 'walk';
            R.commandGotoSeg(segIx, clamp(px, seg.x1 + 4, seg.x2 - 4), {
              noise: 0.08,
              speed: R.P.walkSpeed * 1.15,
              quiet: true,
              onDone: () => {
                if (this.el === el && this.phase === 'walk') this.plug(ctx, el);
              },
              onFail: () => {
                this.phase = 'none';
              },
            });
          }
        }
        return this.phase !== 'none';
      }

      if (this.phase === 'plugged') {
        R.sleepTimer = Math.max(R.sleepTimer, 20);
        if (this.plugFaceT > 0) {
          this.plugFaceT -= ctx.dt;
          if (this.plugFaceT <= 0) R.face.set('happy');
        }
      }
      return this.phase !== 'none';
    },

    onTerrainRebuilt(ctx) {
      if (this.phase === 'walk') {
        this.el = null; // re-detected next frame while the pointer stays on the card
        this.phase = 'none';
      } else if (this.phase === 'plugged' && this.el && ctx.api.segFor(this.el) < 0) {
        this.unplug(ctx);
        this.el = null;
        this.phase = 'none';
      }
    },
  };
}
