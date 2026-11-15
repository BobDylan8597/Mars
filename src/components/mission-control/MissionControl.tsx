"use client";
import { useState } from "react";
import { Activity, Compass, Loader2, Satellite } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { DEM_PROVENANCE, ROVER_PROVENANCE } from "@/lib/data/targets";
import { usePlanner, useRegion } from "@/lib/useMissionData";
import { useMission } from "@/lib/store";
import { EvaConfig } from "./EvaConfig";
import { LayerPanel } from "./LayerPanel";
import { MapCanvas } from "./MapCanvas";
import { PlannerPanel } from "./PlannerPanel";
import { TargetPanel } from "./TargetPanel";

function Kpi({ label, value, sub, tone = "text-ink" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel min-w-0 px-3 py-2">
      <div className="label truncate">{label}</div>
      <div className={`num text-lg font-semibold leading-6 ${tone}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

export function MissionControl() {
  const { region, error } = useRegion();
  const planner = usePlanner();
  const selected = useMission((s) => s.selectedRoute);
  const [tab, setTab] = useState<"science" | "eva">("science");

  if (error) return <div className="p-8 text-critical">Failed to load terrain data: {error}</div>;
  if (!region) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted">
        <Loader2 className="animate-spin" size={18} /> Loading HiRISE terrain for Jezero crater…
      </div>
    );
  }

  const v = region.validation;
  const sel = planner.plan?.routes[selected];
  const t = sel?.eva?.totals;
  const areaKm2 = ((region.grid.width * region.grid.cellSize) / 1000) * ((region.grid.height * region.grid.cellSize) / 1000);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Compass className="text-mars" size={22} />
          <div>
            <div className="text-sm font-bold tracking-[0.18em]">MARS PATHFINDER</div>
            <div className="text-[10px] tracking-[0.2em] text-muted">EXPLORE WITH PURPOSE · FROM ORBITAL DATA TO HUMAN DISCOVERY</div>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-xs">
          <span className="rounded-md bg-mars/15 px-3 py-1 font-semibold text-mars">Mission Control</span>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted">
          <Satellite size={14} className="text-hud" />
          <span>Jezero crater · 18.49°N 77.32°E · HiRISE DTM 1 m → 5 m grid</span>
          <ProvenanceBadge p={DEM_PROVENANCE} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 px-3 pt-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Map area (HiRISE 1 m)" value={`${areaKm2.toFixed(0)} km²`} sub={`${(region.meta.valid_fraction * 100).toFixed(1)}% data coverage`} />
        <Kpi label="Slope vs. rover tilt" value={`±${v.slope_deg.mae.toFixed(2)}°`} sub={`MAE · r = ${v.slope_deg.corr.toFixed(2)} · ${v.slope_deg.n} stops`} tone="text-nominal" />
        <Kpi label="Rover sols on map" value={`${v.sol_range[0]}–${v.sol_range[1]}`} sub="Perseverance waypoints" />
        <Kpi label="Route distance" value={t ? `${(t.distanceM / 1000).toFixed(2)} km` : "—"} sub={`Route ${selected}, one way`} />
        <Kpi label="Max slope on route" value={sel ? `${sel.maxSlopeDeg.toFixed(1)}°` : "—"} sub={`Mean ${sel ? sel.meanSlopeDeg.toFixed(1) : "—"}°`} />
        <Kpi label="Ascent" value={t ? `${t.ascentM.toFixed(0)} m` : "—"} sub="Cumulative, outbound" />
        <Kpi label="O₂ full EVA" value={t ? `${t.tankPct.toFixed(1)}%` : "—"} sub="Out + science + return" tone={t && !t.feasible ? "text-critical" : "text-hud"} />
        <Kpi label="Avg metabolic rate" value={t ? `${t.avgMetabolicW.toFixed(0)} W` : "—"} sub="Per astronaut, walking" />
      </div>

      <main className="grid flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="order-2 max-h-[calc(100vh-170px)] overflow-y-auto xl:order-1">
          <LayerPanel classShare={planner.plan?.classShare ?? null} />
        </aside>

        <section className="order-1 flex min-w-0 flex-col gap-3 xl:order-2">
          <div className="h-[58vh] min-h-[380px]">
            <MapCanvas region={region} classes={planner.plan?.classes ?? null} routes={planner.plan?.routes ?? null} />
          </div>
          {planner.error && <div className="panel p-2 text-xs text-critical">Planner error: {planner.error}</div>}
          <PlannerPanel
            region={region}
            routes={planner.plan?.routes ?? null}
            computing={planner.computing}
            verification={planner.verification}
            verifying={planner.verifying}
            onVerify={planner.verify}
          />
          <div className="panel p-3 text-[11px] leading-5 text-muted">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink"><Activity size={14} className="text-nominal" /> Terrain validation against Perseverance</div>
            DEM slope at {v.slope_deg.n} rover stops (sols {v.sol_range[0]}–{v.sol_range[1]}) vs. the tilt recorded by the rover:
            mean absolute error <span className="num text-ink">{v.slope_deg.mae.toFixed(2)}°</span>, correlation <span className="num text-ink">{v.slope_deg.corr.toFixed(2)}</span>.
            Rover tilt includes rocks under the wheels, so perfect agreement is not expected. Elevation differs by
            <span className="num text-ink"> {v.elevation_m.mae.toFixed(2)} m</span> on average, but rover localisation is itself tied to HiRISE terrain, so that figure is not an independent check.
            <span className="ml-1 inline-block align-middle"><ProvenanceBadge p={ROVER_PROVENANCE} compact /></span>
          </div>
        </section>

        <aside className="order-3 max-h-[calc(100vh-170px)] space-y-3 overflow-y-auto">
          <div className="flex gap-1 rounded-lg border border-line p-1 text-xs">
            {(["science", "eva"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-md py-1.5 ${tab === k ? "bg-mars/15 font-semibold text-mars" : "text-muted hover:text-ink"}`}>
                {k === "science" ? "Science targets" : "EVA configuration"}
              </button>
            ))}
          </div>
          {tab === "science" ? <TargetPanel /> : <EvaConfig />}
        </aside>
      </main>
    </div>
  );
}
