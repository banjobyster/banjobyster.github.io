// A route planner with temperament, injected per byster through the
// framework's planner seam (SurfaceMover opts.planner, passed as the cast
// spec's `planner`). Same contract and step shape as the library's planRoute,
// because it IS planRoute: temperament is nothing but cost shaping, composed
// onto the library search through planRoute's `shapeCost` option (multipliers
// are inflation-only there, so the heuristic stays admissible and these stay
// biases, never bans: reachability is untouched).
//
// whimsy: each plan call prices every edge with a random markup of up to
// `whimsy` (0 = always the strict shortest path, 1 = up to double cost),
// stable within the call, so near-tied routes win at random and a byster
// stops grinding the exact same staircase back and forth. Variety by METRIC,
// not by memory: stateless across calls, no forbidden-edge lists.
//
// wallTax: surcharge every edge that lands on a non-top surface (a wall or
// an underside), so a heavyset byster prefers to travel along the tops of
// things and only climbs when the wall is genuinely the only way.

import { planRoute } from "@banjobyster/bysters";

// One markup per edge per plan call: priced on first sight, held for the
// rest of the search, forgotten when the plan ends.
const whimsyShaper = (whimsy) => {
  const priced = new Map();
  return (e) => {
    let m = priced.get(e);
    if (m == null) {
      m = 1 + Math.random() * whimsy;
      priced.set(e, m);
    }
    return m;
  };
};

const wallTaxShaper = (tax) => (e, graph) => {
  const s = graph.surfaces[graph.vertices[e.to].surface];
  return s && s.side !== "top" ? 1 + tax : 1;
};

export function whimsicalPlanner(whimsy = 0.5, { wallTax = 0 } = {}) {
  return (graph, startId, goalId, caps) => {
    const roll = whimsyShaper(whimsy);
    const tax = wallTax ? wallTaxShaper(wallTax) : null;
    const shapeCost = tax ? (e, g) => roll(e) * tax(e, g) : roll;
    return planRoute(graph, startId, goalId, caps, { shapeCost });
  };
}
