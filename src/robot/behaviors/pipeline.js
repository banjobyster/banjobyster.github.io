// The bench deploy toy (hero section): chase the active stage across the
// bench hardware and supervise with the sync face, cheer a pass, spark on a
// flaked stage. The pipeline state is read off the DOM container's
// data-pipeline / data-failed attributes (written by Bench.jsx); the robot
// never drives the pipeline, it reacts to it.

export function pipeline() {
  return {
    name: 'pipeline',
    priority: 50,

    init() {
      this.seen = null;
      this.benchEl = null;
    },

    update(ctx) {
      const { d, R, api } = ctx;
      if (ctx.owner || ctx.section !== 'hero') return false;
      if (!this.benchEl || !this.benchEl.isConnected) {
        this.benchEl = document.querySelector('.bench');
        if (!this.benchEl) return false;
      }
      const phase = this.benchEl.dataset.pipeline || 'idle';
      const running = phase === 'build' || phase === 'test' || phase === 'ship';
      if (phase !== this.seen) {
        this.seen = phase;
        const stageDevice = { build: 'intake', test: 'mon', ship: 'rack' };
        const device =
          phase === 'fail'
            ? stageDevice[this.benchEl.dataset.failed] || 'intake'
            : { ...stageDevice, done: 'rack' }[phase];
        const seg = device
          ? api.segsByTag('bench').find((g) => g.rect.el.dataset.bench === device)
          : null;
        if (running) {
          R.wakeIfSleeping();
          if (seg && R.mode === 'ground') {
            R.commandGotoSeg(seg.id, (seg.x1 + seg.x2) / 2, {
              noise: 0.1,
              quiet: true,
              speed: R.P.walkSpeed * 1.15,
              onDone: () => {
                if (this.seen === phase) R.face.set('sync');
              },
            });
          } else {
            R.face.set('sync');
          }
          d.note(`pipeline: supervising ${phase}`);
        } else if (phase === 'done') {
          R.face.set('excited', 1.8);
          R.bodyYV -= 120 * R.P.scale;
          d.note('pipeline: deploy passed');
        } else if (phase === 'fail') {
          // The villain and the station fault FX already carry the break; the
          // hero just reads as annoyed before repair (priority 55) marches it
          // over to fix the jammed stage.
          R.face.set('angry', 1.4);
          d.shrug(0.7);
          d.note('pipeline: stage jammed');
        } else if (phase === 'idle' && R.face.expr === 'sync') {
          R.face.set('idle');
        }
      }
      if (running) {
        R.sleepTimer = Math.max(R.sleepTimer, 15);
        return true;
      }
      return false;
    },
  };
}
