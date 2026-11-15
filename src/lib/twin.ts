"use client";
import { useEffect } from "react";
import { metabolicRateW, EvaParams } from "@/lib/core/eva";
import { cellToLatLon, Region } from "@/lib/data/region";
import { commAt, EnvironmentModel, RoutePlan } from "@/lib/plan";
import { TAB_ID, useMission } from "@/lib/store";

export interface TwinSnapshot {
  k: number;
  col: number;
  row: number;
  lat: number;
  lon: number;
  elapsedMin: number;
  totalMin: number;
  distM: number;
  remainingM: number;
  elevM: number;
  slopeDeg: number;
  gradePct: number;
  uncertainty: number;
  roughness: number;
  o2RemainingL: number;
  o2RemainingPct: number;
  o2ReturnL: number;
  bingoMarginL: number;
  o2RateLmin: number;
  metabolicW: number;
  comm: boolean;
  headingDeg: number;
  arrived: boolean;
  alerts: { level: "caution" | "critical"; text: string }[];
}

/** Snapshot of the crew at `progress` (0..1 of outbound walking time). */
export function twinAt(region: Region, route: RoutePlan, env: EnvironmentModel | null, eva: EvaParams, progress: number): TwinSnapshot | null {
  const p = route.eva;
  if (!p || route.cells.length < 2) return null;
  const n = p.timeMin.length;
  const total = p.timeMin[n - 1];
  const tMin = Math.max(0, Math.min(1, progress)) * total;
  let k = 0;
  while (k < n - 1 && p.timeMin[k + 1] <= tMin) k++;
  const [col, row] = route.cells[k];
  const i = route.search.path[k];
  const { lat, lon } = cellToLatLon(region.meta, col, row);
  const ahead = route.cells[Math.min(n - 1, k + 4)], behind = route.cells[Math.max(0, k - 1)];
  const [hc, hr] = k < n - 1 ? ahead : route.cells[k];
  const [bc, br] = k < n - 1 ? [col, row] : behind;
  // heading: 0 = north, clockwise; grid rows grow southward
  const headingDeg = (Math.atan2(hc - bc, -(hr - br)) * 180 / Math.PI + 360) % 360;
  const slopeDeg = region.slope[i] || 0;
  const u = region.uncertainty[i];
  const rough = region.roughness[i] || 0;
  const grade = p.gradePct[Math.min(n - 1, k + 1)] ?? 0;
  const metabolicW = metabolicRateW(eva, eva.speedMs, grade, region.eta[i]);
  const o2Rate = (metabolicW * 60) / 20100;
  const remaining = p.o2RemainingL[k];
  const ret = p.o2ReturnL[k];
  const comm = env ? commAt(env, col, row) : true;
  const alerts: TwinSnapshot["alerts"] = [];
  if (p.bingoIndex >= 0 && k >= p.bingoIndex) alerts.push({ level: "critical", text: "BINGO O₂ — return to base now" });
  if (slopeDeg > 12) alerts.push({ level: "caution", text: `Steep ground ${slopeDeg.toFixed(1)}°` });
  if (rough > 0.6) alerts.push({ level: "caution", text: "Rough ground: blocks / ridges, watch footing" });
  if (u > 0.4) alerts.push({ level: "caution", text: "Low map confidence on this cell" });
  if (!comm) alerts.push({ level: "caution", text: "Radio shadow — field log caching locally" });
  return {
    k, col, row, lat, lon,
    elapsedMin: p.timeMin[k], totalMin: total,
    distM: p.distM[k], remainingM: p.distM[n - 1] - p.distM[k],
    elevM: p.elevM[k], slopeDeg, gradePct: grade, uncertainty: u, roughness: rough,
    o2RemainingL: remaining, o2RemainingPct: (remaining / eva.tankL) * 100,
    o2ReturnL: ret, bingoMarginL: remaining - (1 + eva.reserve) * ret,
    o2RateLmin: o2Rate, metabolicW, comm, headingDeg, arrived: k >= n - 1, alerts,
  };
}

/**
 * Advances the shared Mission Twin clock. Only the tab that pressed Play drives it, so two
 * open tabs (Mission Control + HUD) do not double the speed. Speed = simulated minutes per second.
 */
export function useTwinClock(totalMin: number | null) {
  useEffect(() => {
    if (!totalMin) return;
    let last = performance.now();
    const id = setInterval(() => {
      const s = useMission.getState();
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!s.twin.playing || s.twin.driver !== TAB_ID) return;
      const next = s.twin.progress + (dt * s.twin.speed) / totalMin;
      s.setTwin(next >= 1 ? { progress: 1, playing: false } : { progress: next });
    }, 200);
    return () => clearInterval(id);
  }, [totalMin]);
}
