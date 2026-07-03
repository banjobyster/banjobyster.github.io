// Boot theater (SPEC 4.4): the robot wakes on the hero, walks to the hero
// port, plugs in while the real fetch runs, and reacts to the outcome. After
// boot it keeps watching the fetch state and replays the reaction wherever it
// happens to be (a late refetch, an error after a retry).
//
// Claims the job slot until the theater is over, so nothing purposeful or
// ambient can interrupt the opening beat.

import { cssColorToInt } from './util.js';

function reactToFetch(ctx, state) {
  const { d, R, fx, api } = ctx;
  d.note(`fetch reaction: ${state}`);
  if (state === 'ready') {
    R.face.set('excited', 2.2);
    R.bodyYV -= 140 * R.P.scale;
    api.emit('synced');
  } else {
    fx.burst(R.x, R.bodyY + 2, 0xf08c3c, 14);
    R.face.set('glitch', 1.5);
    d.shrug(0.7);
    api.emit('offline');
  }
}

export function boot() {
  return {
    name: 'boot',
    priority: 100,

    init() {
      this.phase = 'start';
      this.plugT = 0;
      this.portEl = null;
      this.fetchSeen = 'loading';
      this.ledColor = cssColorToInt(
        getComputedStyle(document.documentElement).getPropertyValue('--led'),
        0x3ddc97,
      );
    },

    update(ctx) {
      const { d, R, fx, api, page } = ctx;

      if (this.phase === 'done') {
        // post-boot: fetch resolutions play wherever the robot is
        if (page.fetch !== this.fetchSeen && page.fetch !== 'loading') {
          this.fetchSeen = page.fetch;
          reactToFetch(ctx, page.fetch);
        }
        return false;
      }

      if (this.phase === 'start') {
        if (R.state === 'wake') return true; // let the eyes flick on first
        const port = api.segsByTag('port')[0];
        if (!port) {
          // page loaded scrolled away from the hero; skip the plug theater
          d.note('boot: no port visible, skipping plug theater');
          this.phase = 'done';
          return false;
        }
        this.portEl = port.rect.el;
        this.phase = 'walk';
        d.note('boot: walking to port');
        R.commandGotoSeg(port.id, (port.x1 + port.x2) / 2, {
          noise: 0.15,
          quiet: true,
          onDone: () => {
            this.phase = 'plug';
            this.plugT = 0;
            d.note('boot: arrived at port, plugging in');
          },
          onFail: () => {
            this.phase = 'done';
            d.note('boot: no route to port, skipping');
          },
        });
      } else if (this.phase === 'plug') {
        this.plugT += ctx.dt;
        if (!fx.plug) {
          fx.plugTo(this.portEl, this.ledColor);
          R.face.set('sync');
        }
        R.facing = 1; // face the page while syncing
        R.sleepTimer = Math.max(R.sleepTimer, 20);
        if (page.fetch !== 'loading' && this.plugT > 1.4) {
          fx.unplug();
          this.fetchSeen = page.fetch;
          reactToFetch(ctx, page.fetch);
          this.phase = 'done';
          d.note(`boot: unplugged, reacted to ${page.fetch}`);
        }
      }
      return this.phase !== 'done';
    },

    onTerrainRebuilt() {
      // the rebind canceled the walk; restart it from the new graph
      if (this.phase === 'walk') this.phase = 'start';
    },
  };
}
