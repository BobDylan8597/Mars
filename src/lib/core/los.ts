/**
 * Radio line-of-sight from the base antenna, and topographic shelters.
 * Computed on a coarser grid (every `step` cells) for speed; results are per coarse cell.
 */
import type { Grid } from "./terrain";

export const MARS_RADIUS_M = 3396190;

export interface CoarseMask {
  step: number;
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * 1 = in line of sight of the antenna, 0 = COMM_BLACKOUT (terrain blocks the ray).
 * Includes Mars curvature: the surface drops d^2 / (2R) below the tangent plane.
 */
export function radioLineOfSight(g: Grid, antCol: number, antRow: number, antennaH: number, receiverH = 2, step = 4): CoarseMask {
  const { width: w, height: h, cellSize, z } = g;
  const cw = Math.ceil(w / step), chh = Math.ceil(h / step);
  const out = new Uint8Array(cw * chh);
  const z0 = z[antRow * w + antCol] + antennaH;
  const drop = (dCells: number) => {
    const d = dCells * cellSize;
    return (d * d) / (2 * MARS_RADIUS_M);
  };
  for (let cr = 0; cr < chh; cr++) {
    for (let cc = 0; cc < cw; cc++) {
      const r = Math.min(h - 1, cr * step + (step >> 1)), c = Math.min(w - 1, cc * step + (step >> 1));
      const zt = z[r * w + c];
      if (!Number.isFinite(zt)) continue;
      const dr = r - antRow, dc = c - antCol;
      const dist = Math.hypot(dr, dc);
      if (dist < 1) { out[cr * cw + cc] = 1; continue; }
      const target = zt + receiverH - drop(dist);
      const n = Math.ceil(dist);
      let visible = 1;
      for (let k = 1; k < n; k++) {
        const f = k / n;
        const rr = Math.round(antRow + dr * f), c2 = Math.round(antCol + dc * f);
        const zs = z[rr * w + c2] - drop(dist * f);
        const zLine = z0 + (target - z0) * f;
        if (zs > zLine) { visible = 0; break; }
      }
      out[cr * cw + cc] = visible;
    }
  }
  return { step, width: cw, height: chh, data: out };
}

export interface Shelter {
  col: number;
  row: number;
  /** fraction of the sky hemisphere blocked by terrain (0..1, solid-angle weighted) */
  skyBlocked: number;
}

/**
 * Fraction of the sky blocked by surrounding terrain, from the horizon elevation angle in
 * `azimuths` directions out to `radiusM`. Blocked solid-angle fraction = mean(sin(horizon)).
 */
export function skyBlockage(g: Grid, col: number, row: number, azimuths = 16, radiusM = 400): number {
  const { width: w, height: h, cellSize, z } = g;
  const z0 = z[row * w + col] + 1.5;
  if (!Number.isFinite(z0)) return 0;
  const maxK = Math.floor(radiusM / cellSize);
  let sum = 0;
  for (let a = 0; a < azimuths; a++) {
    const th = (a / azimuths) * Math.PI * 2;
    const dx = Math.cos(th), dy = Math.sin(th);
    let maxAng = 0;
    for (let k = 1; k <= maxK; k++) {
      const c = Math.round(col + dx * k), r = Math.round(row + dy * k);
      if (c < 0 || r < 0 || c >= w || r >= h) break;
      const zz = z[r * w + c];
      if (!Number.isFinite(zz)) continue;
      const ang = Math.atan2(zz - z0, k * cellSize);
      if (ang > maxAng) maxAng = ang;
    }
    sum += Math.sin(maxAng);
  }
  return sum / azimuths;
}

/** Best shelter candidates: highest sky blockage, on walkable cells, at least `spacingM` apart. */
export function findShelters(
  g: Grid, walkable: (i: number) => boolean, opts: { step?: number; minBlocked?: number; spacingM?: number; max?: number } = {},
): Shelter[] {
  const step = opts.step ?? 8, minBlocked = opts.minBlocked ?? 0.12, spacing = (opts.spacingM ?? 250) / g.cellSize, max = opts.max ?? 12;
  const cands: Shelter[] = [];
  for (let r = step; r < g.height - step; r += step)
    for (let c = step; c < g.width - step; c += step) {
      if (!walkable(r * g.width + c)) continue;
      const b = skyBlockage(g, c, r);
      if (b >= minBlocked) cands.push({ col: c, row: r, skyBlocked: b });
    }
  cands.sort((a, b) => b.skyBlocked - a.skyBlocked);
  const out: Shelter[] = [];
  for (const s of cands) {
    if (out.every((o) => Math.hypot(o.col - s.col, o.row - s.row) >= spacing)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
