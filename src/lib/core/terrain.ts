/**
 * Terrain analysis on a regular ground-metre grid.
 * Grid layout: row-major, row 0 = north, col 0 = west, NaN = no data.
 */

export interface Grid {
  width: number;
  height: number;
  /** ground cell size in metres (square cells) */
  cellSize: number;
  /** elevation in metres, NaN = no data */
  z: Float32Array;
}

export enum TerrainClass {
  LOW_COST = 0,
  MODERATE_COST = 1,
  HIGH_COST = 2,
  EXCLUDED = 3,
  INSUFFICIENT_DATA = 4,
}

export const TERRAIN_CLASS_LABEL: Record<TerrainClass, string> = {
  [TerrainClass.LOW_COST]: "Low cost",
  [TerrainClass.MODERATE_COST]: "Moderate cost",
  [TerrainClass.HIGH_COST]: "High cost",
  [TerrainClass.EXCLUDED]: "Excluded",
  [TerrainClass.INSUFFICIENT_DATA]: "Insufficient data",
};

export interface ClassifyParams {
  /** upper bound of LOW_COST (deg) */
  lowMax: number;
  /** upper bound of MODERATE_COST (deg) */
  moderateMax: number;
  /** maximum slope the suited crew may walk (deg) */
  sMax: number;
  /** roughness (0-1) at or above which a cell is an obstacle */
  roughnessObstacle: number;
  /** uncertainty above which a cell is INSUFFICIENT_DATA */
  uMax: number;
}

export const DEFAULT_CLASSIFY: ClassifyParams = {
  lowMax: 6,
  moderateMax: 12,
  sMax: 15,
  roughnessObstacle: 0.85,
  uMax: 0.6,
};

const RAD2DEG = 180 / Math.PI;

/**
 * Slope in degrees using Horn's (1981) 3x3 finite-difference method.
 * Edge cells and cells with any missing neighbour get NaN.
 */
export function computeSlope(g: Grid): Float32Array {
  const { width: w, height: h, cellSize: d, z } = g;
  const out = new Float32Array(w * h).fill(NaN);
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c;
      const a = z[i - w - 1], b = z[i - w], cc = z[i - w + 1];
      const dd = z[i - 1], f = z[i + 1];
      const gg = z[i + w - 1], hh = z[i + w], ii = z[i + w + 1];
      const dzdx = (cc + 2 * f + ii - (a + 2 * dd + gg)) / (8 * d);
      const dzdy = (gg + 2 * hh + ii - (a + 2 * b + cc)) / (8 * d);
      const s = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
      out[i] = s; // NaN propagates automatically if any neighbour is NaN
    }
  }
  return out;
}

/**
 * Surface roughness: RMS residual (m) of the 3x3 neighbourhood after removing the
 * best-fit plane, then normalised to 0..1 by `fullScaleM` (residual that maps to 1).
 * Captures metre-scale bumps (blocks, scarps, ripples) that a smooth slope misses.
 */
export function computeRoughness(g: Grid, fullScaleM = 1.0): Float32Array {
  const { width: w, height: h, cellSize: d, z } = g;
  const out = new Float32Array(w * h).fill(NaN);
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      let sum = 0, sx = 0, sy = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const v = z[(r + dr) * w + c + dc];
          sum += v; sx += dc * v; sy += dr * v; n++;
        }
      const mean = sum / n;
      // least-squares plane on a symmetric 3x3 stencil: slope = sum(k*v)/6
      const ax = sx / 6, ay = sy / 6;
      let ss = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const v = z[(r + dr) * w + c + dc];
          const res = v - (mean + ax * dc + ay * dr);
          ss += res * res;
        }
      const rms = Math.sqrt(ss / n);
      out[r * w + c] = Number.isFinite(rms) ? Math.min(1, rms / fullScaleM) : NaN;
    }
  }
  void d;
  return out;
}

/**
 * Cartographic uncertainty U in 0..1.
 *  - base term from the source's native resolution vs. a suited astronaut's step scale
 *    (1 m HiRISE -> 0.15; 463 m MOLA -> 1)
 *  - penalty when the analysis grid is coarser than the native data (resampling)
 *  - cells with no data, or next to no-data, are 1 / 0.7
 */
export function computeUncertainty(
  g: Grid,
  nativeResolutionM: number,
  extraPenalty = 0,
): Float32Array {
  const { width: w, height: h, cellSize, z } = g;
  const base = Math.min(1, 0.15 * Math.max(1, nativeResolutionM) ** 0.31);
  const resample = cellSize > nativeResolutionM ? Math.min(0.2, 0.04 * Math.log2(cellSize / nativeResolutionM)) : 0;
  const u0 = Math.min(1, base + resample + extraPenalty);
  const out = new Float32Array(w * h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!Number.isFinite(z[i])) { out[i] = 1; continue; }
      let edge = false;
      for (let dr = -1; dr <= 1 && !edge; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, c2 = c + dc;
          if (rr < 0 || rr >= h || c2 < 0 || c2 >= w || !Number.isFinite(z[rr * w + c2])) { edge = true; break; }
        }
      out[i] = edge ? Math.max(u0, 0.7) : u0;
    }
  }
  return out;
}

export function classifyTerrain(
  slope: Float32Array,
  roughness: Float32Array,
  uncertainty: Float32Array,
  p: ClassifyParams = DEFAULT_CLASSIFY,
): Uint8Array {
  const n = slope.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = slope[i], rgh = roughness[i], u = uncertainty[i];
    if (!(u <= p.uMax) || !Number.isFinite(s)) out[i] = TerrainClass.INSUFFICIENT_DATA;
    else if (s > p.sMax || rgh >= p.roughnessObstacle) out[i] = TerrainClass.EXCLUDED;
    else if (s <= p.lowMax) out[i] = TerrainClass.LOW_COST;
    else if (s <= p.moderateMax) out[i] = TerrainClass.MODERATE_COST;
    else out[i] = TerrainClass.HIGH_COST;
  }
  return out;
}

/** Bilinear elevation sample at fractional (col, row). */
export function sampleBilinear(g: Grid, col: number, row: number): number {
  const c0 = Math.floor(col), r0 = Math.floor(row);
  if (c0 < 0 || r0 < 0 || c0 >= g.width - 1 || r0 >= g.height - 1) return NaN;
  const fc = col - c0, fr = row - r0, w = g.width, z = g.z;
  const i = r0 * w + c0;
  return (z[i] * (1 - fc) + z[i + 1] * fc) * (1 - fr) + (z[i + w] * (1 - fc) + z[i + w + 1] * fc) * fr;
}
