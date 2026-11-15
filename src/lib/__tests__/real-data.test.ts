import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeRoughness, computeSlope, computeUncertainty, Grid } from "@/lib/core/terrain";
import { DEFAULT_EVA } from "@/lib/core/eva";
import { DemMeta, Region, ROUGHNESS_FULL_SCALE_M } from "@/lib/data/region";
import { buildTerrainModel, planRoutes, verifyWithDijkstra } from "@/lib/plan";

const dir = join(process.cwd(), "public", "data", "jezero");

function loadFromDisk(): Region {
  const meta: DemMeta = JSON.parse(readFileSync(join(dir, "dem.meta.json"), "utf8"));
  const b = readFileSync(join(dir, "dem.bin"));
  const z = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const grid: Grid = { width: meta.width, height: meta.height, cellSize: meta.cell_size_m, z };
  const slope = computeSlope(grid);
  const roughness = computeRoughness(grid, ROUGHNESS_FULL_SCALE_M);
  const uncertainty = computeUncertainty(grid, meta.source.native_resolution_m);
  const eta = roughness.map((r) => 1 + 0.3 * (Number.isFinite(r) ? r : 1));
  return {
    meta, grid, slope, roughness, uncertainty, eta,
    rover: JSON.parse(readFileSync(join(dir, "rover_traverse.json"), "utf8")),
    validation: JSON.parse(readFileSync(join(dir, "validation.json"), "utf8")),
    orthoUrl: "",
  };
}

describe("real Jezero data", () => {
  const region = loadFromDisk();
  const t = buildTerrainModel(region, 15);

  it("plans three feasible routes to Cheyava Falls with slope limits respected", () => {
    const plans = planRoutes(region, t, "JZ-T1", DEFAULT_EVA);
    for (const k of ["A", "B", "C"] as const) {
      const p = plans[k];
      expect(p.cells.length).toBeGreaterThan(10);
      expect(p.maxSlopeDeg).toBeLessThanOrEqual(15 + 1e-6);
      console.log(k, p.name, {
        km: +(p.eva!.totals.distanceM / 1000).toFixed(2),
        maxSlope: +p.maxSlopeDeg.toFixed(1),
        meanSlope: +p.meanSlopeDeg.toFixed(1),
        ascent: Math.round(p.eva!.totals.ascentM),
        tankPct: +p.eva!.totals.tankPct.toFixed(1),
        outMin: Math.round(p.eva!.totals.outboundMin),
        ms: Math.round(p.search.ms),
        expanded: p.search.expanded,
      });
    }
    // B minimises accumulated slope (not the single worst cell), so compare mean slope
    expect(plans.B.meanSlopeDeg).toBeLessThan(plans.A.meanSlopeDeg);
    expect(plans.B.eva!.totals.distanceM).toBeGreaterThanOrEqual(plans.A.eva!.totals.distanceM * 0.98);
  });

  it("A* matches Dijkstra on the real terrain", () => {
    for (const v of verifyWithDijkstra(region, t, "JZ-T1")) {
      console.log(v.key, { astarMs: Math.round(v.astar.ms), astarExp: v.astar.expanded, dijMs: Math.round(v.dijkstra.ms), dijExp: v.dijkstra.expanded });
      expect(v.sameCost).toBe(true);
    }
  });
});
