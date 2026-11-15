"use client";
import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Region } from "@/lib/data/region";
import type { RoutePlan, ValidationRun } from "@/lib/plan";
import { TARGETS } from "@/lib/data/targets";
import { RouteKey, useMission } from "@/lib/store";
import { ROUTE_COLORS } from "./MapCanvas";

function status(r: RoutePlan) {
  const t = r.eva?.totals;
  if (!t) return { text: "No path", tone: "text-critical" };
  if (r.eva!.bingoIndex >= 0) return { text: "Bingo O₂ en route", tone: "text-critical" };
  if (!t.feasible) return { text: "Over O₂ budget", tone: "text-critical" };
  return { text: "Within budget", tone: "text-nominal" };
}

export function PlannerPanel({
  region, routes, computing, verification, verifying, onVerify,
}: {
  region: Region;
  routes: Record<RouteKey, RoutePlan> | null;
  computing: boolean;
  verification: ValidationRun[] | null;
  verifying: boolean;
  onVerify: () => void;
}) {
  const selected = useMission((s) => s.selectedRoute);
  const setRoute = useMission((s) => s.setRoute);
  const eva = useMission((s) => s.eva);
  const sMax = useMission((s) => s.sMax);
  const targetId = useMission((s) => s.targetId);
  const [showProfile, setShowProfile] = useState(true);
  const sel = routes?.[selected];
  const target = TARGETS.find((t) => t.id === targetId);

  const data = useMemo(() => {
    if (!sel?.eva) return [];
    const p = sel.eva;
    const n = p.distM.length;
    const step = Math.max(1, Math.floor(n / 300));
    const out = [];
    for (let k = 0; k < n; k += step) {
      const i = sel.search.path[k];
      out.push({
        km: +(p.distM[k] / 1000).toFixed(3),
        elev: +p.elevM[k].toFixed(1),
        slope: +(region.slope[i] || 0).toFixed(1),
        o2: +((p.o2RemainingL[k] / eva.tankL) * 100).toFixed(1),
        ret: +((((1 + eva.reserve) * p.o2ReturnL[k]) / eva.tankL) * 100).toFixed(1),
      });
    }
    return out;
  }, [sel, region, eva.tankL, eva.reserve]);

  const zMin = data.length ? Math.floor(Math.min(...data.map((d) => d.elev)) - 5) : 0;
  const zMax = data.length ? Math.ceil(Math.max(...data.map((d) => d.elev)) + 5) : 1;
  const axis = { fill: "#8b9098", fontSize: 10, fontFamily: "var(--font-plex-mono)" };

  return (
    <div className="panel flex max-h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <h2 className="font-semibold">Traverse planner</h2>
        <span className="text-muted">Base → {target?.name}</span>
        {computing && <span className="flex items-center gap-1 text-[11px] text-muted"><Loader2 size={12} className="animate-spin" /> recomputing</span>}
        <button onClick={() => setShowProfile((s) => !s)} className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-ink">
          Profile <ChevronDown size={12} className={showProfile ? "rotate-180" : ""} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-muted">
              <th className="px-3 py-1.5 font-medium">Route</th>
              <th className="px-2 font-medium">Distance</th>
              <th className="px-2 font-medium">Max slope</th>
              <th className="px-2 font-medium">Mean slope</th>
              <th className="px-2 font-medium">Ascent</th>
              <th className="px-2 font-medium">Walk out</th>
              <th className="px-2 font-medium">O₂ full EVA</th>
              <th className="px-2 font-medium">Left at base</th>
              <th className="px-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="num">
            {routes ? (["A", "B", "C"] as RouteKey[]).map((k) => {
              const r = routes[k], t = r.eva?.totals, st = status(r), on = k === selected;
              return (
                <tr key={k} onClick={() => setRoute(k)} className={`cursor-pointer border-t border-line/60 ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}>
                  <td className="px-3 py-1.5 font-sans">
                    <span className="mr-2 inline-block h-0.5 w-4 align-middle" style={{ background: ROUTE_COLORS[k] }} />
                    <span className={on ? "font-medium" : ""}>{k} · {r.name}</span>
                    {r.stops.length > 0 && <span className="text-muted"> via {r.stops.join(", ")}</span>}
                  </td>
                  <td className="px-2">{t ? `${(t.distanceM / 1000).toFixed(2)} km` : "—"}</td>
                  <td className="px-2">{t ? `${r.maxSlopeDeg.toFixed(1)}°` : "—"}</td>
                  <td className="px-2">{t ? `${r.meanSlopeDeg.toFixed(1)}°` : "—"}</td>
                  <td className="px-2">{t ? `${t.ascentM.toFixed(0)} m` : "—"}</td>
                  <td className="px-2">{t ? `${t.outboundMin.toFixed(0)} min` : "—"}</td>
                  <td className="px-2">{t ? `${t.totalO2L.toFixed(0)} L (${t.tankPct.toFixed(0)}%)` : "—"}</td>
                  <td className="px-2">{t ? `${t.marginPct.toFixed(0)}%` : "—"}</td>
                  <td className={`px-3 font-sans ${st.tone}`}>{st.text}</td>
                </tr>
              );
            }) : (
              <tr><td colSpan={9} className="px-3 py-3 text-muted">Computing routes on the HiRISE terrain…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showProfile && data.length > 0 && (
        <div className="border-t border-line px-3 pb-2 pt-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="text-ink">Route {selected} profile</span>
            <span><span className="mr-1 inline-block h-2 w-3 bg-[#8b9098]/40 align-middle" />elevation (m, left)</span>
            <span><span className="mr-1 inline-block h-0.5 w-3 bg-[#d3a24a] align-middle" />slope °</span>
            <span><span className="mr-1 inline-block h-0.5 w-3 bg-[#8fb8d8] align-middle" />O₂ remaining %</span>
            <span><span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-[#d0584c] align-middle" />O₂ needed to return + 20 % — Bingo where they cross</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="#2a2d33" vertical={false} />
                <XAxis dataKey="km" type="number" domain={[0, "dataMax"]} tick={axis} tickLine={false} axisLine={{ stroke: "#2a2d33" }} unit=" km" />
                <YAxis yAxisId="z" domain={[zMin, zMax]} tick={axis} tickLine={false} axisLine={false} width={52} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: "#1b1d21", border: "1px solid #2a2d33", borderRadius: 4, fontSize: 11 }}
                  labelFormatter={(v) => `${v} km`}
                />
                <Area yAxisId="z" dataKey="elev" name="Elevation (m)" stroke="#8b9098" strokeWidth={1} fill="#8b9098" fillOpacity={0.18} dot={false} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="slope" name="Slope (°)" stroke="#d3a24a" dot={false} strokeWidth={1} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="o2" name="O₂ remaining (%)" stroke="#8fb8d8" dot={false} strokeWidth={1.75} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="ret" name="O₂ to return +20% (%)" stroke="#d0584c" strokeDasharray="4 3" dot={false} strokeWidth={1.25} isAnimationActive={false} />
                <ReferenceLine yAxisId="p" y={sMax} stroke="#d3a24a" strokeOpacity={0.5} strokeDasharray="2 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 text-[11px] text-muted">
        <span>Optimality check (A* vs. Dijkstra, same cost surface):</span>
        {verification ? verification.map((v) => (
          <span key={v.key} className="num">
            {v.key}: A* {v.astar.expanded.toLocaleString()} nodes / {v.astar.ms.toFixed(0)} ms · Dijkstra {v.dijkstra.expanded.toLocaleString()} / {v.dijkstra.ms.toFixed(0)} ms ·{" "}
            <span className={v.sameCost ? "text-nominal" : "text-critical"}>{v.sameCost ? "same cost ✓" : "cost differs"}</span>
          </span>
        )) : (
          <button onClick={onVerify} disabled={verifying || !routes} className="rounded border border-line px-2 py-0.5 text-ink hover:bg-white/5 disabled:opacity-40">
            {verifying ? "Running…" : "Run"}
          </button>
        )}
        <span className="ml-auto text-faint">Return along the same route · η = 1 + 0.3·roughness (sand factor needs THEMIS)</span>
      </div>
    </div>
  );
}
