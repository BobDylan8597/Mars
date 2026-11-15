/**
 * Surface radiation budget.
 * Baseline: Curiosity RAD at Gale crater, Hassler et al., Science 343 (2014):
 *   absorbed dose rate ~0.21 mGy/day, dose-equivalent rate ~0.64 mSv/day (mean quality factor ~3).
 * Applied to Jezero as an approximation (different elevation and season), and scaled by the
 * fraction of open sky when sheltering (galactic cosmic rays arrive from the open sky).
 */

export const RAD_GCR_UGY_PER_DAY = 210;
export const RAD_GCR_USV_PER_DAY = 640;

export interface DoseResult {
  absorbedUGy: number;
  equivalentUSv: number;
}

/** @param spMultiplier scenario multiplier for a solar particle event (1 = quiet) */
export function evaDose(hours: number, spMultiplier = 1, openSkyFraction = 1): DoseResult {
  const f = (hours / 24) * spMultiplier * openSkyFraction;
  return { absorbedUGy: RAD_GCR_UGY_PER_DAY * f, equivalentUSv: RAD_GCR_USV_PER_DAY * f };
}
