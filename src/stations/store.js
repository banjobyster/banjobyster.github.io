// Single source of truth for task-station state (Part 3 rework).
//
// Previously the state lived in the DOM data-state attribute: React owned it
// and robot behaviors read/wrote it through a window event. That made the game
// logic depend on React's async commit (a broken station was invisible to the
// hero for a frame or two), which is both fragile and untestable. This store
// is a tiny synchronous observable instead: behaviors read and write it
// directly, React subscribes for its CSS view, and the canvas FX read it live.
// One truth, no lag, deterministic.

export function createStationStore() {
  const state = new Map(); // name -> 'ok' | 'broken' | 'busy'
  const listeners = new Set();

  return {
    get: (name) => state.get(name) || 'ok',
    has: (name) => state.has(name),
    names: () => [...state.keys()],
    register(name) {
      if (!state.has(name)) state.set(name, 'ok');
    },
    set(name, next) {
      if ((state.get(name) || 'ok') === next) return;
      state.set(name, next);
      for (const l of listeners) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

// The app-wide instance shared between the React site and the robot overlay.
export const stationStore = createStationStore();
