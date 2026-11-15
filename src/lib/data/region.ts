import { computeRoughness, computeSlope, computeUncertainty, Grid } from "@/lib/core/terrain";

export interface DemMeta {
  region: string;
  width: number;
  height: number;
  cell_size_m: number;
  bounds: { north: number; south: number; west: number; east: number };
  z_min: number;
  z_max: number;
  valid_fraction: number;
  resampling: string;
  source: { dataset: string; producer: string; doi: string; file: string; url: string; native_resolution_m: number; license: string };
  ortho: { file: string; pixel_size_m: number; dataset: string; producer: string; doi: string; source_file: string; native_resolution_m: number; resampling: string };
}

export interface RoverPoint {
  sol: number;
  lat: number;
  lon: number;
  col: number;
  row: number;
  elev_rover: number;
  tilt_rover: number;
  elev_dem: number | null;
  slope_dem: number | null;
}

export interface Validation {
  n_waypoints: number;
  sol_range: [number, number];
  elevation_m: { mean_diff_dem_minus_rover: number; mae: number; std: number; n: number };
  slope_deg: { mean_diff_dem_minus_tilt: number; mae: number; corr: number; n: number };
  source: { waypoints: string; dem: string };
}

export interface Region {
  meta: DemMeta;
  grid: Grid;
  slope: Float32Array;
  roughness: Float32Array;
  uncertainty: Float32Array;
  /** terrain factor proxy for the metabolic model (MODELLED) */
  eta: Float32Array;
  rover: RoverPoint[];
  validation: Validation;
  orthoUrl: string;
}

/** Roughness: 3x3 plane-fit RMS residual; 0.5 m maps to 1 (calibrated: ~p99 of this DEM). */
export const ROUGHNESS_FULL_SCALE_M = 0.5;

export async function loadRegion(base = "/data/jezero"): Promise<Region> {
  const [meta, buf, rover, validation] = await Promise.all([
    fetch(`${base}/dem.meta.json`).then((r) => r.json() as Promise<DemMeta>),
    fetch(`${base}/dem.bin`).then((r) => r.arrayBuffer()),
    fetch(`${base}/rover_traverse.json`).then((r) => r.json() as Promise<RoverPoint[]>),
    fetch(`${base}/validation.json`).then((r) => r.json() as Promise<Validation>),
  ]);
  const grid: Grid = { width: meta.width, height: meta.height, cellSize: meta.cell_size_m, z: new Float32Array(buf) };
  const slope = computeSlope(grid);
  const roughness = computeRoughness(grid, ROUGHNESS_FULL_SCALE_M);
  const uncertainty = computeUncertainty(grid, meta.source.native_resolution_m);
  const eta = new Float32Array(roughness.length);
  for (let i = 0; i < eta.length; i++) eta[i] = 1 + 0.3 * (Number.isFinite(roughness[i]) ? roughness[i] : 1);
  return { meta, grid, slope, roughness, uncertainty, eta, rover, validation, orthoUrl: `${base}/${meta.ortho.file}` };
}

export function cellToLatLon(meta: DemMeta, col: number, row: number) {
  const b = meta.bounds;
  return {
    lat: b.north - ((row + 0.5) / meta.height) * (b.north - b.south),
    lon: b.west + ((col + 0.5) / meta.width) * (b.east - b.west),
  };
}

export function latLonToCell(meta: DemMeta, lat: number, lon: number) {
  const b = meta.bounds;
  return {
    col: Math.round(((lon - b.west) / (b.east - b.west)) * meta.width - 0.5),
    row: Math.round(((b.north - lat) / (b.north - b.south)) * meta.height - 0.5),
  };
}
