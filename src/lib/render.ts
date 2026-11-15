import { TerrainClass } from "@/lib/core/terrain";
import type { Region } from "@/lib/data/region";

type RGB = [number, number, number];

function ramp(stops: [number, RGB][], t: number): RGB {
  if (!(t >= stops[0][0])) return stops[0][1];
  for (let k = 1; k < stops.length; k++) {
    const [t1, c1] = stops[k];
    if (t <= t1) {
      const [t0, c0] = stops[k - 1];
      const f = (t - t0) / (t1 - t0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1][1];
}

function toImage(w: number, h: number, fn: (i: number) => [number, number, number, number]): ImageData {
  const img = new ImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = fn(i);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a;
  }
  return img;
}

export const ELEVATION_RAMP: [number, RGB][] = [
  // viridis
  [0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]],
];
export const SLOPE_RAMP: [number, RGB][] = [
  // sequential YlOrRd, degrees
  [0, [255, 255, 204]], [6, [254, 217, 118]], [12, [253, 141, 60]], [18, [227, 26, 28]], [30, [128, 0, 38]],
];
export const CLASS_COLORS: Record<number, [number, number, number, number]> = {
  [TerrainClass.LOW_COST]: [16, 185, 129, 0],
  [TerrainClass.MODERATE_COST]: [211, 162, 74, 70],
  [TerrainClass.HIGH_COST]: [208, 120, 60, 140],
  [TerrainClass.EXCLUDED]: [200, 70, 60, 210],
  [TerrainClass.INSUFFICIENT_DATA]: [120, 110, 150, 210],
};

/**
 * Approximate Mars colour for a monochrome HiRISE RED-band image: maps brightness onto a
 * dust/basalt palette. Visual aid only; it is NOT true colour and is labelled as such in the UI.
 */
export const MARS_TINT: [number, RGB][] = [
  [0, [28, 16, 11]], [0.3, [96, 52, 30]], [0.55, [164, 98, 58]], [0.78, [208, 150, 102]], [1, [242, 214, 180]],
];

export function tintImage(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.naturalWidth; c.height = src.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const [r, gg, b] = ramp(MARS_TINT, v / 255);
    lut[v * 3] = r; lut[v * 3 + 1] = gg; lut[v * 3 + 2] = b;
  }
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    d[i] = lut[v * 3]; d[i + 1] = lut[v * 3 + 1]; d[i + 2] = lut[v * 3 + 2];
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function hillshade(region: Region): ImageData {
  const { width: w, height: h, cellSize: d, z } = region.grid;
  const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180;
  const zf = 2; // vertical exaggeration for readability
  return toImage(w, h, (i) => {
    const r = Math.floor(i / w), c = i % w;
    if (r === 0 || c === 0 || r === h - 1 || c === w - 1) return [0, 0, 0, 0];
    const dzdx = ((z[i - w + 1] + 2 * z[i + 1] + z[i + w + 1]) - (z[i - w - 1] + 2 * z[i - 1] + z[i + w - 1])) / (8 * d) * zf;
    const dzdy = ((z[i + w - 1] + 2 * z[i + w] + z[i + w + 1]) - (z[i - w - 1] + 2 * z[i - w] + z[i - w + 1])) / (8 * d) * zf;
    const slope = Math.atan(Math.hypot(dzdx, dzdy));
    const aspect = Math.atan2(dzdy, -dzdx);
    const v = Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - aspect);
    const g = Math.max(0, Math.min(255, v * 255));
    return [g, g, g, 255];
  });
}

export function elevationImage(region: Region): ImageData {
  const { z_min, z_max } = region.meta;
  const z = region.grid.z;
  return toImage(region.grid.width, region.grid.height, (i) => {
    const [r, g, b] = ramp(ELEVATION_RAMP, (z[i] - z_min) / (z_max - z_min));
    return [r, g, b, 255];
  });
}

export function slopeImage(region: Region): ImageData {
  return toImage(region.grid.width, region.grid.height, (i) => {
    const s = region.slope[i];
    if (!Number.isFinite(s)) return [0, 0, 0, 0];
    const [r, g, b] = ramp(SLOPE_RAMP, s);
    return [r, g, b, 255];
  });
}

export function roughnessImage(region: Region): ImageData {
  return toImage(region.grid.width, region.grid.height, (i) => {
    const v = region.roughness[i];
    if (!Number.isFinite(v)) return [0, 0, 0, 0];
    const [r, g, b] = ramp([[0, [15, 23, 42]], [0.3, [56, 189, 248]], [0.6, [250, 204, 21]], [1, [239, 68, 68]]], v);
    return [r, g, b, 255];
  });
}

export function uncertaintyImage(region: Region): ImageData {
  return toImage(region.grid.width, region.grid.height, (i) => {
    const u = region.uncertainty[i];
    const [r, g, b] = ramp([[0, [16, 185, 129]], [0.3, [56, 189, 248]], [0.6, [245, 158, 11]], [1, [139, 92, 246]]], u);
    return [r, g, b, 255];
  });
}

export function classesImage(w: number, h: number, classes: Uint8Array): ImageData {
  return toImage(w, h, (i) => CLASS_COLORS[classes[i]]);
}

export function rgbCss([r, g, b]: RGB) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export { ramp };
