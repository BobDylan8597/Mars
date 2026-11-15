/**
 * Science Opportunity Index: SOI = alpha M + beta G + gamma T + delta Q.
 * M, G, T, Q are 0..1 scores ASSIGNED BY THE TEAM (with a written rationale per target),
 * not NASA values. Weights are normalised to sum to 1.
 */

export interface SoiScores { M: number; G: number; T: number; Q: number }
export interface SoiWeights { alpha: number; beta: number; gamma: number; delta: number }

export const DEFAULT_SOI_WEIGHTS: SoiWeights = { alpha: 0.3, beta: 0.25, gamma: 0.3, delta: 0.15 };

export function normaliseWeights(w: SoiWeights): SoiWeights {
  const s = w.alpha + w.beta + w.gamma + w.delta;
  if (s <= 0) return { alpha: 0.25, beta: 0.25, gamma: 0.25, delta: 0.25 };
  return { alpha: w.alpha / s, beta: w.beta / s, gamma: w.gamma / s, delta: w.delta / s };
}

export function soiBreakdown(s: SoiScores, raw: SoiWeights) {
  const w = normaliseWeights(raw);
  const parts = {
    M: w.alpha * s.M,
    G: w.beta * s.G,
    T: w.gamma * s.T,
    Q: w.delta * s.Q,
  };
  return { ...parts, total: parts.M + parts.G + parts.T + parts.Q, weights: w };
}
