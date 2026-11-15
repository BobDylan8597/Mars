/**
 * Pre-EVA atmospheric & space-weather go/no-go: a transparent RULE-BASED index, not a
 * statistical predictor. Every rule reports why it fired; thresholds marked "team" are
 * operational choices by the team, not NASA flight rules.
 */

export type GoLevel = "GO" | "CAUTION" | "NO-GO";
export type SolarState = "quiet" | "elevated" | "sep";

export interface AtmosInputs {
  /** departure of the 3-hour pressure change from the normal diurnal tide (Pa, drop positive) */
  pressureDropPa: number;
  /** column dust optical depth tau */
  tau: number;
  /** solar longitude (deg) */
  ls: number;
  /** ground minus air temperature near local noon (K) */
  dT: number;
  /** peak gust (m/s) */
  gustMs: number;
  /** space-weather state from DONKI (SEP = solar energetic particle event in progress) */
  solar: SolarState;
}

export const DEFAULT_ATMOS: AtmosInputs = { pressureDropPa: 3, tau: 0.5, ls: 150, dT: 15, gustMs: 8, solar: "quiet" };

export interface RuleHit { level: GoLevel; rule: string; basis: string }

const rank: Record<GoLevel, number> = { GO: 0, CAUTION: 1, "NO-GO": 2 };

export function dustSeason(ls: number) {
  return ls >= 180 && ls <= 330;
}

export function assessAtmosphere(a: AtmosInputs): { level: GoLevel; hits: RuleHit[] } {
  const hits: RuleHit[] = [];
  const add = (level: GoLevel, rule: string, basis: string) => hits.push({ level, rule, basis });

  if (a.tau >= 2.5) add("NO-GO", `Dust optical depth τ = ${a.tau.toFixed(2)} ≥ 2.5 (regional storm conditions)`, "team threshold");
  else if (a.tau >= 1.0) add("CAUTION", `τ = ${a.tau.toFixed(2)} ≥ 1.0: reduced visibility and solar power`, "team threshold");

  if (dustSeason(a.ls)) {
    const lvl: GoLevel = a.tau >= 0.8 ? "CAUTION" : "GO";
    add(lvl, `Ls = ${a.ls.toFixed(0)}° is inside the dust-storm season (Ls 180°–330°, perihelion)`, "Mars climatology");
  }

  if (a.pressureDropPa >= 20) add("NO-GO", `Pressure ${a.pressureDropPa.toFixed(0)} Pa below the diurnal tide in 3 h: frontal / storm system`, "team threshold");
  else if (a.pressureDropPa >= 10) add("CAUTION", `Pressure ${a.pressureDropPa.toFixed(0)} Pa below the diurnal tide in 3 h`, "team threshold");

  if (a.dT >= 20 && a.gustMs >= 6) add("CAUTION", `Strong surface heating (ΔT ${a.dT.toFixed(0)} K) with gusts: dust-devil activity likely`, "convective vortex physics; team threshold");

  if (a.gustMs >= 30) add("NO-GO", `Gusts ${a.gustMs.toFixed(0)} m/s ≥ 30 m/s`, "team threshold");
  else if (a.gustMs >= 20) add("CAUTION", `Gusts ${a.gustMs.toFixed(0)} m/s ≥ 20 m/s`, "team threshold");

  if (a.solar === "sep") add("NO-GO", "Solar energetic particle event in progress (DONKI)", "radiation exposure rule");
  else if (a.solar === "elevated") add("CAUTION", "Elevated solar activity / Earth-facing CME (DONKI): stay within reach of shelter", "team threshold");

  const level = hits.reduce<GoLevel>((m, h) => (rank[h.level] > rank[m] ? h.level : m), "GO");
  return { level, hits };
}
