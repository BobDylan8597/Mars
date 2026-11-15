import { classifyTerrain, DEFAULT_CLASSIFY, TerrainClass } from "@/lib/core/terrain";
import { CostLayers, findPath, findPathVia, ROUTE_PROFILES, SearchResult } from "@/lib/core/routing";
import { EvaParams, EvaProfile, simulateEva } from "@/lib/core/eva";
import { latLonToCell, Region } from "@/lib/data/region";
import { BASE_SITE, TARGETS } from "@/lib/data/targets";
import type { RouteKey } from "@/lib/store";

export interface RoutePlan {
  key: RouteKey;
  name: string;
  search: SearchResult & { order?: number[] };
  /** path in [col,row] */
  cells: [number, number][];
  eva: EvaProfile | null;
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  /** % of path cells in each terrain class */
  classShare: number[];
  stops: string[];
}

export interface TerrainModel {
  classes: Uint8Array;
  layers: CostLayers;
  /** % of map cells in each class */
  classShare: number[];
}

export function buildTerrainModel(region: Region, sMax: number): TerrainModel {
  const classes = classifyTerrain(region.slope, region.roughness, region.uncertainty, { ...DEFAULT_CLASSIFY, sMax });
  const share = [0, 0, 0, 0, 0];
  for (let i = 0; i < classes.length; i++) share[classes[i]]++;
  return {
    classes,
    classShare: share.map((v) => (v / classes.length) * 100),
    layers: {
      width: region.grid.width,
      height: region.grid.height,
      cellSize: region.grid.cellSize,
      slope: region.slope,
      roughness: region.roughness,
      uncertainty: region.uncertainty,
      // Loose-sand slip needs THEMIS thermal inertia (not loaded); roughness is the proxy.
      slip: region.roughness,
      classes,
      sMax,
    },
  };
}

/** Nearest traversable cell to (col,row) within `maxR` cells (targets often sit on steep outcrops). */
export function snapToTraversable(t: TerrainModel, col: number, row: number, maxR = 30): number {
  const { width: w, height: h } = t.layers;
  const ok = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < w && r < h &&
    t.classes[r * w + c] !== TerrainClass.EXCLUDED && t.classes[r * w + c] !== TerrainClass.INSUFFICIENT_DATA;
  if (ok(col, row)) return row * w + col;
  for (let rad = 1; rad <= maxR; rad++) {
    let best = -1, bestD = Infinity;
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (!ok(col + dc, row + dr)) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) { bestD = d; best = (row + dr) * w + col + dc; }
      }
    if (best >= 0) return best;
  }
  return row * w + col;
}

export function targetCell(region: Region, t: TerrainModel, lat: number, lon: number) {
  const { col, row } = latLonToCell(region.meta, lat, lon);
  return snapToTraversable(t, col, row);
}

function describe(region: Region, t: TerrainModel, key: RouteKey, search: RoutePlan["search"], eva: EvaParams, stops: string[]): RoutePlan {
  const w = region.grid.width;
  const cells: [number, number][] = search.path.map((i) => [i % w, Math.floor(i / w)]);
  const classShare = [0, 0, 0, 0, 0];
  let maxS = 0, sumS = 0;
  for (const i of search.path) {
    const s = region.slope[i];
    if (Number.isFinite(s)) { maxS = Math.max(maxS, s); sumS += s; }
    classShare[t.classes[i]]++;
  }
  const n = search.path.length;
  let profile: EvaProfile | null = null;
  if (n > 1) {
    const stepM: number[] = [], elevM: number[] = [], eta: number[] = [];
    for (let k = 0; k < n; k++) {
      const i = search.path[k];
      elevM.push(region.grid.z[i]);
      eta.push(region.eta[i]);
      if (k > 0) {
        const [c0, r0] = cells[k - 1], [c1, r1] = cells[k];
        stepM.push(Math.hypot(c1 - c0, r1 - r0) * region.grid.cellSize);
      }
    }
    profile = simulateEva(eva, { stepM, elevM, eta });
  }
  return {
    key, name: ROUTE_PROFILES[key].name, search, cells, eva: profile,
    maxSlopeDeg: maxS, meanSlopeDeg: n ? sumS / n : 0,
    classShare: classShare.map((v) => (n ? (v / n) * 100 : 0)), stops,
  };
}

export function planRoutes(region: Region, t: TerrainModel, targetId: string, eva: EvaParams): Record<RouteKey, RoutePlan> {
  const target = TARGETS.find((x) => x.id === targetId) ?? TARGETS[0];
  const start = targetCell(region, t, BASE_SITE.lat, BASE_SITE.lon);
  const goal = targetCell(region, t, target.lat, target.lon);
  const a = findPath(t.layers, start, goal, ROUTE_PROFILES.A.weights);
  const b = findPath(t.layers, start, goal, ROUTE_PROFILES.B.weights);
  const others = TARGETS.filter((x) => x.region === target.region && x.id !== target.id);
  const stopCells = others.map((o) => targetCell(region, t, o.lat, o.lon));
  const c = findPathVia(t.layers, start, stopCells, goal, ROUTE_PROFILES.C.weights);
  return {
    A: describe(region, t, "A", a, eva, []),
    B: describe(region, t, "B", b, eva, []),
    C: describe(region, t, "C", c, eva, others.map((o) => o.name)),
  };
}

export interface ValidationRun { key: RouteKey; astar: SearchResult; dijkstra: SearchResult; sameCost: boolean }

/** Runs Dijkstra on the same problem to prove A* optimality (routes A and B). */
export function verifyWithDijkstra(region: Region, t: TerrainModel, targetId: string): ValidationRun[] {
  const target = TARGETS.find((x) => x.id === targetId) ?? TARGETS[0];
  const start = targetCell(region, t, BASE_SITE.lat, BASE_SITE.lon);
  const goal = targetCell(region, t, target.lat, target.lon);
  return (["A", "B"] as const).map((key) => {
    const astar = findPath(t.layers, start, goal, ROUTE_PROFILES[key].weights, "astar");
    const dijkstra = findPath(t.layers, start, goal, ROUTE_PROFILES[key].weights, "dijkstra");
    return { key, astar, dijkstra, sameCost: Math.abs(astar.cost - dijkstra.cost) < 1e-6 * Math.max(1, astar.cost) };
  });
}
