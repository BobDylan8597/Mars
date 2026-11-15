"use client";
import { useEffect, useMemo, useState } from "react";
import { latLonToCell, Region } from "@/lib/data/region";
import { BASE_SITE } from "@/lib/data/targets";
import type { EnvironmentModel, RoutePlan } from "@/lib/plan";
import { RouteKey, useMission } from "@/lib/store";
import { twinAt, useTwinClock } from "@/lib/twin";
import type { MapMarker } from "@/components/mission-control/MapCanvas";

export interface Diversion {
  key: string;
  kind: "solar" | "dust" | "lowO2";
  destination: string;
  plan: RoutePlan;
}

export function useLive(
  region: Region | null,
  routes: Record<RouteKey, RoutePlan> | null,
  env: EnvironmentModel | null,
  divertFn: (from: [number, number], to: [number, number]) => Promise<RoutePlan>,
  followApproved: boolean,
) {
  const eva = useMission((s) => s.eva);
  const twin = useMission((s) => s.twin);
  const selected = useMission((s) => s.selectedRoute);
  const approved = useMission((s) => s.approvedPlan);
  const emergency = useMission((s) => s.emergency);
  const logs = useMission((s) => s.logs);
  const routeKey: RouteKey = followApproved && approved ? approved.route : selected;
  const route = routes?.[routeKey] ?? null;

  const snap = useMemo(
    () => (region && route ? twinAt(region, route, env, eva, twin.progress) : null),
    [region, route, env, eva, twin.progress],
  );
  useTwinClock(route?.eva?.totals.outboundMin ?? null);

  // emergency diversion: solar / dust -> nearest topographic shelter, low O2 -> base
  const [diversion, setDiversion] = useState<Diversion | null>(null);
  const snapCell = snap ? `${snap.col},${snap.row}` : null;
  useEffect(() => {
    if (!emergency || !region || !snap) { setDiversion(null); return; }
    const key = `${emergency.at}`;
    if (diversion?.key === key) return;
    const base = latLonToCell(region.meta, BASE_SITE.lat, BASE_SITE.lon);
    let to: [number, number] = [base.col, base.row];
    let destination = "Base (return immediately)";
    if (emergency.kind !== "lowO2" && env && env.shelters.length) {
      const near = [...env.shelters].sort((a, b) => Math.hypot(a.col - snap.col, a.row - snap.row) - Math.hypot(b.col - snap.col, b.row - snap.row))[0];
      const dShelter = Math.hypot(near.col - snap.col, near.row - snap.row);
      const dBase = Math.hypot(base.col - snap.col, base.row - snap.row);
      if (dShelter < dBase) {
        to = [near.col, near.row];
        destination = `Topographic shelter (${(near.skyBlocked * 100).toFixed(0)}% sky blocked)`;
      }
    }
    let cancelled = false;
    divertFn([snap.col, snap.row], to).then((plan) => {
      if (!cancelled) setDiversion({ key, kind: emergency.kind, destination, plan });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergency?.at, region, env, snapCell === null]);

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    if (region) {
      for (const l of logs) {
        const c = latLonToCell(region.meta, l.lat, l.lon);
        out.push({ col: c.col, row: c.row, color: l.status === "synced" ? "#6fae8b" : "#d3a24a", shape: "log" });
      }
    }
    if (route && snap && route.cells.length > 1) {
      const n = route.cells.length;
      const ahead = route.cells[Math.min(n - 1, snap.k + 30)];
      const behind = route.cells[Math.max(0, snap.k - 3)];
      out.push({ col: ahead[0], row: ahead[1], label: "Rover scout", color: "#c9c9c9", shape: "rover" });
      out.push({ col: behind[0], row: behind[1], color: "#e0a23c", shape: "crew" });
      out.push({ col: snap.col, row: snap.row, label: "EVA-1 · EVA-2", color: "#8fb8d8", shape: "crew" });
    }
    return out;
  }, [region, logs, route, snap]);

  return { routeKey, route, snap, diversion, markers };
}
