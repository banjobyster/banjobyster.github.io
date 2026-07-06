// A route planner with temperament, injected per byster through the
// framework's planner seam (SurfaceMover opts.planner, passed as the cast
// spec's `planner`). Same contract and step shape as the library's planRoute:
//   (graph, startVertexId, goalVertexId, caps) => steps | null
//
// The differences: each plan call prices every edge with a random markup
// of up to `whimsy` (0 = always the strict shortest path, 1 = up to double
// cost), stable within the call, so near-tied routes win at random and a
// byster stops grinding the exact same staircase back and forth. And an
// optional `wallTax` surcharges every edge that lands on a non-top surface
// (a wall or an underside), so a heavyset byster prefers to travel along
// the tops of things and only climbs when the wall is genuinely the only
// way (a bias, never a ban: reachability is untouched). This is variety
// and gait-dignity by METRIC, not by memory: stateless, no forbidden-edge
// lists, no "don't go back" special case, and every markup only inflates,
// so the euclidean heuristic stays admissible.

import { edgeAllowed } from "@banjobyster/bysters";

export function whimsicalPlanner(whimsy = 0.5, { wallTax = 0 } = {}) {
  return (graph, startId, goalId, caps) => {
    const byId = (id) => graph.vertices[id];
    const goal = byId(goalId);
    if (!goal || !byId(startId)) return null;
    const h = (v) => Math.hypot(v.x - goal.x, v.y - goal.y);

    const offTop = (v) => {
      const s = graph.surfaces[v.surface];
      return !!s && s.side !== "top";
    };

    // One price per edge per plan: the whimsy markup, times the wall tax
    // when the edge lands somewhere a heavy byster would rather not walk.
    const priced = new Map();
    const cost = (e) => {
      let c = priced.get(e);
      if (c == null) {
        c = e.cost * (1 + Math.random() * whimsy) * (wallTax && offTop(byId(e.to)) ? 1 + wallTax : 1);
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
