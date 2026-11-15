/**
 * Multi-criteria shortest path on an 8-connected grid.
 * A* with an admissible heuristic; Dijkstra is the same search with h = 0, used to
 * verify that A* returns the optimal cost.
 */
import { TerrainClass } from "./terrain";

export interface CostWeights {
  /** per metre walked */
  wD: number;
  /** slope penalty, applied to (S / sMax)^2 */
  wS: number;
  /** roughness 0..1 */
  wR: number;
  /** cartographic uncertainty 0..1 */
  wU: number;
  /** slip hazard 0..1 */
  wL: number;
}

export interface CostLayers {
  width: number;
  height: number;
  cellSize: number;
  slope: Float32Array;
  roughness: Float32Array;
  uncertainty: Float32Array;
  slip: Float32Array;
  classes: Uint8Array;
  sMax: number;
}

export interface SearchResult {
  /** cell indices from start to goal; empty if unreachable */
  path: number[];
  cost: number;
  expanded: number;
  ms: number;
  algorithm: "astar" | "dijkstra";
}

export const ROUTE_PROFILES: Record<"A" | "B" | "C", { name: string; weights: CostWeights }> = {
  A: { name: "Shortest", weights: { wD: 1, wS: 0.15, wR: 0.1, wU: 0.1, wL: 0.1 } },
  B: { name: "Safest / lowest O₂", weights: { wD: 1, wS: 6, wR: 3, wU: 3, wL: 3 } },
  C: { name: "Max science", weights: { wD: 1, wS: 2, wR: 1, wU: 1, wL: 1 } },
};

/** Cost per metre of entering cell i. Infinity if the cell is not traversable. */
export function cellCostPerMetre(L: CostLayers, i: number, w: CostWeights): number {
  const cls = L.classes[i];
  if (cls === TerrainClass.EXCLUDED || cls === TerrainClass.INSUFFICIENT_DATA) return Infinity;
  const s = L.slope[i] / L.sMax;
  return (
    w.wD +
    w.wS * s * s +
    w.wR * (L.roughness[i] || 0) +
    w.wU * (L.uncertainty[i] || 0) +
    w.wL * (L.slip[i] || 0)
  );
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop(): number {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

const DIRS: [number, number, number][] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [1, 1, Math.SQRT2],
];

export function findPath(
  L: CostLayers,
  start: number,
  goal: number,
  weights: CostWeights,
  algorithm: "astar" | "dijkstra" = "astar",
): SearchResult {
  const t0 = performance.now();
  const { width: w, height: h, cellSize } = L;
  const n = w * h;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  // admissible: every per-metre cost is >= wD
  const hScale = algorithm === "astar" ? weights.wD * cellSize : 0;
  const gr = Math.floor(goal / w), gc = goal % w;
  const heur = (i: number) => {
    if (hScale === 0) return 0;
    const dr = Math.floor(i / w) - gr, dc = (i % w) - gc;
    return hScale * Math.sqrt(dr * dr + dc * dc);
  };

  const heap = new MinHeap();
  g[start] = 0;
  heap.push(heur(start), start);
  let expanded = 0;

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goal) break;
    const r = Math.floor(cur / w), c = cur % w;
    for (const [dr, dc, len] of DIRS) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= h || cc < 0 || cc >= w) continue;
      const nb = rr * w + cc;
      if (closed[nb]) continue;
      const perM = cellCostPerMetre(L, nb, weights);
      if (perM === Infinity) continue;
      const ng = g[cur] + perM * len * cellSize;
      if (ng < g[nb]) {
        g[nb] = ng;
        came[nb] = cur;
        heap.push(ng + heur(nb), nb);
      }
    }
  }

  const path: number[] = [];
  if (g[goal] < Infinity) {
    for (let i = goal; i !== -1; i = came[i]) path.push(i);
    path.reverse();
  }
  return { path, cost: g[goal], expanded, ms: performance.now() - t0, algorithm };
}

/**
 * Route through intermediate science stops: tries every visiting order of the stops
 * (<= 4 stops -> <= 24 orders) and keeps the cheapest feasible chain.
 */
export function findPathVia(
  L: CostLayers,
  start: number,
  stops: number[],
  goal: number,
  weights: CostWeights,
): SearchResult & { order: number[] } {
  const t0 = performance.now();
  const nodes = [start, ...stops, goal];
  const memo = new Map<string, SearchResult>();
  const leg = (a: number, b: number) => {
    const key = `${a}-${b}`;
    let r = memo.get(key);
    if (!r) { r = findPath(L, a, b, weights, "astar"); memo.set(key, r); }
    return r;
  };
  const perms = permutations(stops);
  let best: { cost: number; order: number[]; legs: SearchResult[] } | null = null;
  for (const order of perms) {
    const seq = [start, ...order, goal];
    let cost = 0;
    const legs: SearchResult[] = [];
    let ok = true;
    for (let k = 0; k < seq.length - 1; k++) {
      const r = leg(seq[k], seq[k + 1]);
      if (r.path.length === 0) { ok = false; break; }
      cost += r.cost; legs.push(r);
    }
    if (ok && (!best || cost < best.cost)) best = { cost, order, legs };
  }
  void nodes;
  if (!best) return { path: [], cost: Infinity, expanded: 0, ms: performance.now() - t0, algorithm: "astar", order: [] };
  const path: number[] = [];
  best.legs.forEach((r, k) => path.push(...(k === 0 ? r.path : r.path.slice(1))));
  const expanded = [...memo.values()].reduce((s, r) => s + r.expanded, 0);
  return { path, cost: best.cost, expanded, ms: performance.now() - t0, algorithm: "astar", order: best.order };
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a.slice()];
  const out: T[][] = [];
  a.forEach((x, i) => {
    for (const p of permutations([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}
