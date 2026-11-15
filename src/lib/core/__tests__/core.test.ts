import { describe, expect, it } from "vitest";
import {
  classifyTerrain, computeRoughness, computeSlope, computeUncertainty, DEFAULT_CLASSIFY, Grid, TerrainClass,
} from "../terrain";
import { CostLayers, findPath, ROUTE_PROFILES } from "../routing";
import { DEFAULT_EVA, metabolicRateW, o2LitresPerMin, simulateEva } from "../eva";
import { soiBreakdown } from "../soi";

function plane(w: number, h: number, cell: number, deg: number): Grid {
  const z = new Float32Array(w * h);
  const t = Math.tan((deg * Math.PI) / 180);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) z[r * w + c] = c * cell * t;
  return { width: w, height: h, cellSize: cell, z };
}

function layersFor(g: Grid, sMax = 15): CostLayers {
  const slope = computeSlope(g);
  const roughness = computeRoughness(g);
  const uncertainty = computeUncertainty(g, 1);
  const classes = classifyTerrain(slope, roughness, uncertainty, { ...DEFAULT_CLASSIFY, sMax });
  return {
    width: g.width, height: g.height, cellSize: g.cellSize, slope, roughness, uncertainty,
    slip: new Float32Array(g.width * g.height), classes, sMax,
  };
}

describe("terrain", () => {
  it("Horn slope recovers a 10 degree plane", () => {
    const s = computeSlope(plane(20, 20, 5, 10));
    expect(s[10 * 20 + 10]).toBeCloseTo(10, 1);
  });

  it("plane has ~zero roughness", () => {
    const r = computeRoughness(plane(10, 10, 5, 20));
    expect(r[5 * 10 + 5]).toBeLessThan(1e-4);
  });

  it("missing data is never classified as safe", () => {
    const g = plane(10, 10, 5, 2);
    g.z[55] = NaN;
    const L = layersFor(g);
    expect(L.classes[55]).toBe(TerrainClass.INSUFFICIENT_DATA);
    expect(L.classes[54]).toBe(TerrainClass.INSUFFICIENT_DATA);
  });

  it("lower sMax excludes more cells", () => {
    const g = plane(30, 30, 5, 0);
    for (let r = 0; r < 30; r++) for (let c = 10; c < 20; c++) g.z[r * 30 + c] = (c - 10) * 5 * Math.tan(0.2) ;
    const count = (sMax: number) => layersFor(g, sMax).classes.filter((k) => k === TerrainClass.EXCLUDED).length;
    expect(count(8)).toBeGreaterThan(count(25));
  });
});

describe("routing", () => {
  // flat field with a wall of steep cells and a single gap
  function walled(): CostLayers {
    const w = 40, h = 40;
    const g = plane(w, h, 5, 0);
    const L = layersFor(g);
    for (let r = 0; r < h; r++) if (r !== 35) L.classes[r * w + 20] = TerrainClass.EXCLUDED;
    return L;
  }

  it("A* and Dijkstra return the same optimal cost", () => {
    const L = walled();
    const s = 5 * 40 + 2, t = 5 * 40 + 37;
    for (const k of ["A", "B", "C"] as const) {
      const a = findPath(L, s, t, ROUTE_PROFILES[k].weights, "astar");
      const d = findPath(L, s, t, ROUTE_PROFILES[k].weights, "dijkstra");
      expect(a.cost).toBeCloseTo(d.cost, 6);
      expect(a.expanded).toBeLessThanOrEqual(d.expanded);
    }
  });

  it("route goes through the gap and never enters excluded cells", () => {
    const L = walled();
    const r = findPath(L, 5 * 40 + 2, 5 * 40 + 37, ROUTE_PROFILES.B.weights);
    expect(r.path.length).toBeGreaterThan(0);
    expect(r.path).toContain(35 * 40 + 20);
    for (const i of r.path) expect(L.classes[i]).not.toBe(TerrainClass.EXCLUDED);
  });

  it("unreachable goal returns empty path", () => {
    const L = walled();
    L.classes[35 * 40 + 20] = TerrainClass.EXCLUDED;
    expect(findPath(L, 5 * 40 + 2, 5 * 40 + 37, ROUTE_PROFILES.A.weights).path).toEqual([]);
  });
});

describe("eva", () => {
  it("level walking gives a plausible O2 rate (0.5 - 1.5 L/min)", () => {
    const rate = o2LitresPerMin(metabolicRateW(DEFAULT_EVA, 0.8, 0));
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(1.5);
  });

  it("uphill costs more than level; downhill is not cheaper than level", () => {
    const lvl = metabolicRateW(DEFAULT_EVA, 0.8, 0);
    expect(metabolicRateW(DEFAULT_EVA, 0.8, 15)).toBeGreaterThan(lvl);
    expect(metabolicRateW(DEFAULT_EVA, 0.8, -15)).toBeCloseTo(lvl, 6);
  });

  it("heavier load raises consumption", () => {
    expect(metabolicRateW({ ...DEFAULT_EVA, loadKg: 40 }, 0.8, 0)).toBeGreaterThan(metabolicRateW(DEFAULT_EVA, 0.8, 0));
  });

  it("bingo triggers when the tank is too small", () => {
    const n = 200;
    const input = { stepM: new Array(n - 1).fill(10), elevM: Array.from({ length: n }, (_, i) => i * 0.5), eta: new Array(n).fill(1) };
    const ok = simulateEva(DEFAULT_EVA, input);
    expect(ok.bingoIndex).toBe(-1);
    expect(ok.totals.distanceM).toBe(1990);
    const tight = simulateEva({ ...DEFAULT_EVA, tankL: 60 }, input);
    expect(tight.bingoIndex).toBeGreaterThan(0);
    expect(tight.totals.feasible).toBe(false);
  });
});

describe("soi", () => {
  it("weights are normalised and parts sum to total", () => {
    const b = soiBreakdown({ M: 1, G: 0.5, T: 0.8, Q: 0.6 }, { alpha: 2, beta: 2, gamma: 2, delta: 2 });
    expect(b.weights.alpha).toBeCloseTo(0.25);
    expect(b.M + b.G + b.T + b.Q).toBeCloseTo(b.total);
    expect(b.total).toBeCloseTo((1 + 0.5 + 0.8 + 0.6) / 4);
  });
});
