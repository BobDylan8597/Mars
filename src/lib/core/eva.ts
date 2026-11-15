/**
 * EVA life-support model.
 *
 * Metabolic rate: Pandolf et al. (1977) load-carriage equation, adapted to Mars gravity.
 *   M = 1.5 W                                             (standing/basal, not gravity-scaled)
 *     + g_r [ 2.0 (W+L)(L/W)^2 + eta (W+L)(1.5 V^2 + 0.35 V G) ]
 *   all x k_suit (pressurised-suit penalty, ASSUMPTION)
 *   W body mass (kg), L suit + PLSS + carried load (kg), V speed (m/s), G grade (%),
 *   eta terrain factor, g_r = g_Mars / g_Earth.
 *   Downhill: the grade term is clamped at 0 so descending never costs less than level walking.
 *
 * O2: 1 L of O2 releases ~20.1 kJ of metabolic energy, so VO2 (L/min) = M * 60 / 20100.
 * All of this is MODELLED: Pandolf was fitted to unsuited walking on Earth.
 */

export const G_MARS = 3.721;
export const G_EARTH = 9.80665;
export const G_RATIO = G_MARS / G_EARTH;
export const J_PER_L_O2 = 20100;

export interface EvaParams {
  bodyMassKg: number;
  suitMassKg: number;
  loadKg: number;
  speedMs: number;
  /** pressurised-suit metabolic penalty multiplier (ASSUMPTION) */
  kSuit: number;
  /** usable primary O2 (L, ASSUMPTION) */
  tankL: number;
  /** minutes of science work at the target */
  obsMin: number;
  /** mandatory return reserve fraction, 0.2 = 20 % */
  reserve: number;
  /** number of crew walking together */
  crew: number;
}

export const DEFAULT_EVA: EvaParams = {
  bodyMassKg: 75,
  suitMassKg: 65,
  loadKg: 15,
  speedMs: 0.8,
  kSuit: 1.2,
  tankL: 600,
  obsMin: 60,
  reserve: 0.2,
  crew: 2,
};

/** Metabolic rate (W) for one astronaut. gradePct may be negative. */
export function metabolicRateW(p: EvaParams, speedMs: number, gradePct: number, eta = 1): number {
  const W = p.bodyMassKg;
  const L = p.suitMassKg + p.loadKg;
  const G = Math.max(0, gradePct);
  const basal = 1.5 * W;
  const load = 2.0 * (W + L) * (L / W) ** 2;
  const walk = eta * (W + L) * (1.5 * speedMs * speedMs + 0.35 * speedMs * G);
  return (basal + G_RATIO * (load + walk)) * p.kSuit;
}

export function o2LitresPerMin(watts: number): number {
  return (watts * 60) / J_PER_L_O2;
}

export interface ProfileInput {
  /** horizontal step length (m) between consecutive points; length n-1 */
  stepM: number[];
  /** elevation of each point (m); length n */
  elevM: number[];
  /** terrain factor eta of each point; length n */
  eta: number[];
}

export interface EvaProfile {
  /** cumulative horizontal distance (m) */
  distM: number[];
  elevM: number[];
  /** grade (%) of the step arriving at each point (0 for first) */
  gradePct: number[];
  /** cumulative elapsed minutes */
  timeMin: number[];
  /** cumulative O2 used outbound (L) */
  o2UsedL: number[];
  /** O2 needed to walk back to the start from each point (L) */
  o2ReturnL: number[];
  /** O2 remaining at each point assuming tank full at start (L) */
  o2RemainingL: number[];
  /** index of first point where remaining <= (1+reserve) x return, or -1 */
  bingoIndex: number;
  totals: {
    distanceM: number;
    ascentM: number;
    descentM: number;
    maxGradePct: number;
    outboundMin: number;
    outboundO2L: number;
    obsO2L: number;
    returnO2L: number;
    /** outbound + observation + return */
    totalO2L: number;
    /** totalO2L as % of tank */
    tankPct: number;
    /** O2 left on return to base as % of tank */
    marginPct: number;
    /** true if the full EVA fits with the reserve */
    feasible: boolean;
    avgMetabolicW: number;
  };
}

function walkLeg(p: EvaParams, stepM: number, dz: number, eta: number) {
  const horiz = Math.max(stepM, 1e-6);
  const grade = (dz / horiz) * 100;
  const dist3d = Math.sqrt(horiz * horiz + dz * dz);
  const minutes = dist3d / p.speedMs / 60;
  const watts = metabolicRateW(p, p.speedMs, grade, eta);
  return { grade, minutes, litres: o2LitresPerMin(watts) * minutes, watts };
}

/** Simulates one astronaut walking the path out, working at the target, and returning the same way. */
export function simulateEva(p: EvaParams, input: ProfileInput): EvaProfile {
  const n = input.elevM.length;
  const distM = [0], gradePct = [0], timeMin = [0], o2UsedL = [0];
  let ascent = 0, descent = 0, maxGrade = 0, energyJ = 0, totalMin = 0;
  for (let k = 1; k < n; k++) {
    const dz = input.elevM[k] - input.elevM[k - 1];
    const leg = walkLeg(p, input.stepM[k - 1], dz, input.eta[k]);
    distM.push(distM[k - 1] + input.stepM[k - 1]);
    gradePct.push(leg.grade);
    timeMin.push(timeMin[k - 1] + leg.minutes);
    o2UsedL.push(o2UsedL[k - 1] + leg.litres);
    if (dz > 0) ascent += dz; else descent -= dz;
    maxGrade = Math.max(maxGrade, Math.abs(leg.grade));
    energyJ += leg.watts * leg.minutes * 60;
    totalMin += leg.minutes;
  }
  // return trip: walk from point k back to 0 along the same path (reversed grades)
  const o2ReturnL = new Array<number>(n).fill(0);
  for (let k = 1; k < n; k++) {
    const dz = input.elevM[k - 1] - input.elevM[k];
    o2ReturnL[k] = o2ReturnL[k - 1] + walkLeg(p, input.stepM[k - 1], dz, input.eta[k - 1]).litres;
  }
  const o2RemainingL = o2UsedL.map((u) => p.tankL - u);
  let bingoIndex = -1;
  for (let k = 0; k < n; k++) {
    if (o2RemainingL[k] <= (1 + p.reserve) * o2ReturnL[k]) { bingoIndex = k; break; }
  }
  const outboundO2L = o2UsedL[n - 1];
  const obsW = metabolicRateW(p, 0, 0, 1);
  const obsO2L = o2LitresPerMin(obsW) * p.obsMin;
  const returnO2L = o2ReturnL[n - 1];
  const totalO2L = outboundO2L + obsO2L + returnO2L;
  const margin = p.tankL - totalO2L;
  return {
    distM, elevM: input.elevM.slice(), gradePct, timeMin, o2UsedL, o2ReturnL, o2RemainingL, bingoIndex,
    totals: {
      distanceM: distM[n - 1],
      ascentM: ascent,
      descentM: descent,
      maxGradePct: maxGrade,
      outboundMin: timeMin[n - 1],
      outboundO2L,
      obsO2L,
      returnO2L,
      totalO2L,
      tankPct: (totalO2L / p.tankL) * 100,
      marginPct: (margin / p.tankL) * 100,
      feasible: margin >= p.reserve * p.tankL,
      avgMetabolicW: totalMin > 0 ? energyJ / (totalMin * 60) : 0,
    },
  };
}

export function gradeToDeg(gradePct: number): number {
  return (Math.atan(gradePct / 100) * 180) / Math.PI;
}
