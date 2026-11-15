"use client";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Route, ShieldCheck } from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Region } from "@/lib/data/region";
import type { RoutePlan, ValidationRun } from "@/lib/plan";
import { RouteKey, useMission } from "@/lib/store";
import { ROUTE_COLORS } from "./MapCanvas";

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted">{k}</span>
      <span className={`num ${warn ? "text-critical" : ""}`}>{v}</span>
    </div>
  );
}

function RouteCard({ r, selected, onClick }: { r: RoutePlan; selected: boolean; onClick: () => void }) {
  const t = r.eva?.totals;
  const ok = !!t && t.feasible && r.eva!.bingoIndex === -1;
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border p-2.5 text-left transition ${selected ? "bg-white/5" : "border-line hover:border-muted"}`}
      style={selected ? { borderColor: ROUTE_COLORS[r.key] } : undefined}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: ROUTE_COLORS[r.key] }}>Route {r.key} · {r.name}</span>
        {t ? (ok ? <CheckCircle2 size={14} className="text-nominal" /> : <AlertTriangle size={14} className="text-critical" />) : null}
      </div>
      {t ? (
        <div className="space-y-0.5">
          <Stat k="Distance (one way)" v={`${(t.distanceM / 1000).toFixed(2)} km`} />
          <Stat k="Max / mean slope" v={`${r.maxSlopeDeg.toFixed(1)}° / ${r.meanSlopeDeg.toFixed(1)}°`} />
          <Stat k="Ascent / descent" v={`${t.ascentM.toFixed(0)} / ${t.descentM.toFixed(0)} m`} />
          <Stat k="Walk out" v={`${t.outboundMin.toFixed(0)} min`} />
          <Stat k="O₂ full EVA" v={`${t.totalO2L.toFixed(0)} L · ${t.tankPct.toFixed(1)}%`} warn={!t.feasible} />
          <Stat k="O₂ margin at base" v={`${t.marginPct.toFixed(1)}%`} warn={!t.feasible} />
          {r.stops.length > 0 && <Stat k="Science stops" v={r.stops.join(", ")} />}
          <div className={`mt-1 text-[10px] font-semibold ${ok ? "text-nominal" : "text-critical"}`}>
            {ok ? "WITHIN O₂ BUDGET (20% RESERVE)" : r.eva!.bingoIndex >= 0 ? "BINGO O₂ REACHED EN ROUTE" : "EXCEEDS O₂ BUDGET"}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-critical">No traversable route with current slope limit</div>
      )}
    </button>
  );
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
  const sel = routes?.[selected];

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
        ret: +(((1 + eva.reserve) * p.o2ReturnL[k]) / eva.tankL * 100).toFixed(1),
      });
    }
    return out;
  }, [sel, region, eva.tankL, eva.reserve]);

  const zMin = data.length ? Math.floor(Math.min(...data.map((d) => d.elev)) - 5) : 0;
  const zMax = data.length ? Math.ceil(Math.max(...data.map((d) => d.elev)) + 5) : 1;

  return (
    <div className="panel space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><Route size={15} className="text-hud" /> Smart traverse planner · BASE-1 → target</div>
        {computing && <span className="flex items-center gap-1 text-[11px] text-hud"><Loader2 size={12} className="animate-spin" /> computing A* on 640,000 cells…</span>}
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        {routes ? (["A", "B", "C"] as RouteKey[]).map((k) => (
          <RouteCard key={k} r={routes[k]} selected={k === selected} onClick={() => setRoute(k)} />
        )) : <div className="py-6 text-center text-xs text-muted">Loading terrain and computing routes…</div>}
      </div>

      {data.length > 0 && (
        <div>
          <div className="label mb-1">Route {selected} profile · elevation, slope and O₂ remaining (outbound)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="km" type="number" domain={[0, "dataMax"]} tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" km" />
                <YAxis yAxisId="z" domain={[zMin, zMax]} tick={{ fill: "#94a3b8", fontSize: 10 }} unit=" m" width={62} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} width={34} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid #1e293b", fontSize: 11 }}
                  labelFormatter={(v) => `${v} km`}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area yAxisId="z" dataKey="elev" name="Elevation (m)" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} dot={false} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="slope" name="Slope (°)" stroke="#F59E0B" dot={false} strokeWidth={1} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="o2" name="O₂ remaining (%)" stroke="#00F0FF" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="ret" name="O₂ to return +20% (%)" stroke="#EF4444" strokeDasharray="4 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <ReferenceLine yAxisId="p" y={sMax} stroke="#F59E0B" strokeDasharray="2 4" label={{ value: `Smax ${sMax}°`, fill: "#F59E0B", fontSize: 9, position: "insideTopLeft" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted">
            Bingo O₂ triggers where the cyan line meets the red line. Return assumed along the same route. Terrain factor η = 1 + 0.3·roughness (proxy; loose-sand factor needs THEMIS).
          </p>
        </div>
      )}

      <div className="rounded-md border border-line bg-space/50 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14} className="text-nominal" /> Optimality check: A* vs. Dijkstra</div>
          <button
            onClick={onVerify}
            disabled={verifying || !routes}
            className="rounded border border-hud/50 px-2 py-0.5 text-[11px] text-hud hover:bg-hud/10 disabled:opacity-40"
          >
            {verifying ? "Running…" : "Run check"}
          </button>
        </div>
        {verification && (
          <table className="num mt-2 w-full text-[11px]">
            <thead className="text-muted"><tr><th className="text-left">Route</th><th>A* nodes</th><th>A* ms</th><th>Dijkstra nodes</th><th>Dijkstra ms</th><th>Same cost</th></tr></thead>
            <tbody>
              {verification.map((v) => (
                <tr key={v.key} className="text-center">
                  <td className="text-left" style={{ color: ROUTE_COLORS[v.key] }}>{v.key}</td>
                  <td>{v.astar.expanded.toLocaleString()}</td>
                  <td>{v.astar.ms.toFixed(0)}</td>
                  <td>{v.dijkstra.expanded.toLocaleString()}</td>
                  <td>{v.dijkstra.ms.toFixed(0)}</td>
                  <td className={v.sameCost ? "text-nominal" : "text-critical"}>{v.sameCost ? "✓ optimal" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
