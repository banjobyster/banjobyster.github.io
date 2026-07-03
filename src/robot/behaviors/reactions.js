// Instant reactions that never own the job slot: bracing under a violent
// scroll, looking at page clicks, the hero click escalation, and the
// repeat-poke escalation. All the "toddler with feelings" one-shots.

export function reactions() {
  return {
    name: 'reactions',
    priority: 40,

    init() {
      this.pokes = [];
      this.clicks = [];
    },

    update(ctx) {
      const { R, sensors: s } = ctx;
      // Big scroll: brace a little (stumbles are disabled, this is the nod to it).
      if (s.scrollSpeed > 2200 && R.state === 'idle' && R.mode === 'ground') {
        R.heightScale = Math.max(0.82, R.heightScale - ctx.dt * 2.5);
        // a truly violent scroll leaves it reeling for a beat
        if (R.face.expr === 'idle') R.face.set(s.scrollSpeed > 3600 ? 'dizzy' : 'curious', 0.6);
      }
      return false;
    },

    // Repeat pokes stop being funny to the robot pretty fast.
    onPoke(ctx) {
      const { d, R, fx } = ctx;
      const now = performance.now();
      this.pokes = this.pokes.filter((t) => now - t < 5000);
      this.pokes.push(now);
      if (this.pokes.length >= 3) {
        this.pokes = [];
        R.face.set('angry', 1.4);
        d.shrug(0.7);
        fx.burst(R.headX, R.headY - 10, 0xf08c3c, 6);
        const flee = R.x - R.facing * 130;
        R.commandGoto(flee, R.bodyY, { noise: 0.2, quiet: true, speed: R.P.walkSpeed * 1.3 });
        d.note('poked too much, storming off');
      }
    },

    onPageClick(ctx, x, y, target) {
      const { d, R, api } = ctx;
      if (target && target.closest && target.closest('a, button, [role="button"]')) return;

      d.lookAt(x, y, 0.9);

      if (ctx.section !== 'hero') {
        if (R.face.expr === 'idle') R.face.set('curious', 0.8);
        return;
      }

      const now = performance.now();
      this.clicks = this.clicks.filter((t) => now - t < 4500);
      this.clicks.push(now);
      const n = this.clicks.length;
      if (n === 1) {
        R.face.set('curious', 1.0);
      } else if (n <= 3) {
        R.wakeIfSleeping();
        if (R.mode === 'ground' && R.state !== 'wake') {
          R.startle(Math.sign(R.x - x) || -R.facing);
        }
      } else {
        R.face.set('angry', 1.2);
        d.shrug(0.7);
        const port = api.segsByTag('port')[0];
        if (port) {
          R.commandGotoSeg(port.id, (port.x1 + port.x2) / 2, {
            noise: 0.15,
            quiet: true,
            speed: R.P.walkSpeed * 1.25,
          });
        }
        this.clicks = [];
      }
    },
  };
}
