// A route planner with temperament, injected per byster through the
// framework's planner seam (SurfaceMover opts.planner, passed as the cast
// spec's `planner`). Same contract and step shape as the library's planRoute:
//   (graph, startVertexId, goalVertexId, caps) => steps | null
//
// The one difference: each plan call prices every edge with a random markup
// of up to `whimsy` (0 = always the strict shortest path, 1 = up to double
// cost), stable within the call. Near-tied routes then win at random, so a
// byster stops grinding the exact same staircase back and forth when two
// ways round are almost equal. This is variety by METRIC, not by memory:
// stateless, no forbidden-edge lists, no "don't go back" special case, and
// the genuinely shortest route still wins most of the time because the
// markup only ever inflates.

import { edgeAllowed } from "@banjobyster/bysters";

export function whimsicalPlanner(whimsy = 0.5) {
  return (graph, startId, goalId, caps) => {
    const byId = (id) => graph.vertices[id];
    const goal = byId(goalId);
    if (!goal || !byId(startId)) return null;
    const h = (v) => Math.hypot(v.x - goal.x, v.y - goal.y);

    // One random markup per edge per plan. Inflation keeps the euclidean
    // heuristic admissible, so this stays a correct A* under the new metric.
    const priced = new Map();
    const cost = (e) => {
      let c = priced.get(e);
      if (c == null) {
        c = e.cost * (1 + Math.random() * whimsy);
        priced.set(e, c);
      }
      return c;
    };

    const open = [{ id: startId, f: h(byId(startId)) }];
    const g = new Map([[startId, 0]]);
    const cameFrom = new Map(); // id -> { prev, edge }
    const closed = new Set();

    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.id === goalId) break;
      if (closed.has(cur.id)) continue;
      closed.add(cur.id);
      for (const e of graph.adj.get(cur.id) || []) {
        if (closed.has(e.to)) continue;
        if (!edgeAllowed(e, caps)) continue;
        const ng = g.get(cur.id) + cost(e);
        if (ng < (g.get(e.to) ?? Infinity)) {
          g.set(e.to, ng);
          cameFrom.set(e.to, { prev: cur.id, edge: e });
          open.push({ id: e.to, f: ng + h(byId(e.to)) });
        }
      }
    }

    if (!g.has(goalId)) return null;

    const chain = [];
    let cur = goalId;
    while (cur !== startId) {
      const link = cameFrom.get(cur);
      if (!link) return null;
      chain.push({ node: byId(cur), edge: link.edge, prev: byId(link.prev) });
      cur = link.prev;
    }
    chain.reverse();

    return chain.map(({ node, edge, prev }) => {
      const from = { x: prev.x, y: prev.y, surface: prev.surface };
      const to = { x: node.x, y: node.y, surface: node.surface };
      return edge.type === "jump"
        ? { type: "jump", from, to, launch: edge.launch }
        : { type: "walk", from, to };
    });
  };
}
