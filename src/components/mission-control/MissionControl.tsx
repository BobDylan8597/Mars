"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AppHeader, HEADER_H } from "@/components/AppHeader";
import { usePlanner, useRegion } from "@/lib/useMissionData";
import { useLive } from "@/lib/useLive";
import { useMission } from "@/lib/store";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { EvaConfig } from "./EvaConfig";
import { LayerPanel } from "./LayerPanel";
import { MapCanvas } from "./MapCanvas";
import { PlannerPanel } from "./PlannerPanel";
import { TargetPanel } from "./TargetPanel";
import { TwinBar } from "./TwinBar";
import { FieldLogList } from "./FieldLogList";
import dynamic from "next/dynamic";

const Terrain3D = dynamic(() => import("./Terrain3D").then((m) => m.Terrain3D), { ssr: false });

const TABS = [
  { id: "layers", label: "Layers" },
  { id: "targets", label: "Targets" },
  { id: "eva", label: "EVA" },
  { id: "env", label: "Environment" },
  { id: "logs", label: "Field logs" },
] as const;

const SIDE_W = 350;
const GAP = 10;

export function MissionControl() {
  const { region, error } = useRegion();
  const planner = usePlanner();
  const tab = useMission((s) => s.mcTab);
  const setTab = useMission((s) => s.setMcTab);
  const [sideOpen, setSideOpen] = useState(true);
  const [view3d, setView3d] = useState(false);
  const plannerRef = useRef<HTMLDivElement>(null);
  const [plannerH, setPlannerH] = useState(260);
  const live = useLive(region, planner.plan?.routes ?? null, planner.env, planner.divert, false);
  const emergency = useMission((s) => s.emergency);
  const clearEmergency = useMission((s) => s.clearEmergency);
  const logCount = useMission((s) => s.logs.length);

  useEffect(() => {
    const el = plannerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPlannerH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [region]);

  if (error) return <div className="p-8 text-critical">Failed to load terrain data: {error}</div>;
  if (!region) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted">
        <Loader2 className="animate-spin" size={16} /> Loading HiRISE terrain for Jezero crater…
      </div>
    );
  }

  const left = sideOpen ? SIDE_W + GAP * 2 : GAP;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {view3d ? (
        <Terrain3D
          region={region}
          routes={planner.plan?.routes ?? null}
          markers={live.markers}
          inset={{ top: HEADER_H + GAP, right: GAP, bottom: plannerH + GAP * 2, left }}
        />
      ) : (
        <MapCanvas
          region={region}
          classes={planner.plan?.classes ?? null}
          routes={planner.plan?.routes ?? null}
          env={planner.env}
          markers={live.markers}
          divertCells={live.diversion?.plan.cells ?? null}
          inset={{ top: HEADER_H + GAP, right: GAP, bottom: plannerH + GAP * 2, left }}
        />
      )}

      <div className="absolute z-10 flex overflow-hidden rounded border border-line bg-panel/95 text-[12px]" style={{ top: HEADER_H + GAP, left: left + 2 }}>
        {([false, true] as const).map((v) => (
          <button key={String(v)} onClick={() => setView3d(v)} className={`px-3 py-1 ${view3d === v ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>
            {v ? "3D" : "2D map"}
          </button>
        ))}
      </div>

      <AppHeader />

      {emergency && (
        <div className="absolute left-1/2 z-10 -translate-x-1/2 rounded border border-critical/60 bg-space/95 px-3 py-1.5 text-[12px]" style={{ top: HEADER_H + GAP }}>
          <span className="font-semibold text-critical">EMERGENCY · {emergency.kind === "solar" ? "solar particle event" : emergency.kind === "dust" ? "dust gust front" : "low O₂"}</span>
          <span className="text-muted"> — crew diverting to {live.diversion ? `${live.diversion.destination}, ${(live.diversion.plan.eva?.totals.distanceM ?? 0).toFixed(0)} m` : "…"}</span>
          <button onClick={clearEmergency} className="ml-3 text-muted underline-offset-2 hover:text-ink hover:underline">Clear</button>
        </div>
      )}

      {sideOpen ? (
        <aside className="panel absolute flex flex-col" style={{ top: HEADER_H + GAP, left: GAP, width: SIDE_W, bottom: GAP }}>
          <div className="flex items-center overflow-x-auto border-b border-line px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-2.5 py-2 text-[12px] ${tab === t.id ? "border-b border-ink text-ink" : "text-muted hover:text-ink"}`}
              >
                {t.label}{t.id === "logs" && logCount > 0 && <span className="num ml-1 text-faint">{logCount}</span>}
              </button>
            ))}
            <button onClick={() => setSideOpen(false)} className="ml-auto p-2 text-muted hover:text-ink" aria-label="Collapse panel"><PanelLeftClose size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {tab === "layers" && <LayerPanel region={region} classShare={planner.plan?.classShare ?? null} />}
            {tab === "targets" && <TargetPanel />}
            {tab === "eva" && <EvaConfig />}
            {tab === "env" && <EnvironmentPanel env={planner.env} route={live.route} />}
            {tab === "logs" && <FieldLogList />}
          </div>
        </aside>
      ) : (
        <button onClick={() => setSideOpen(true)} className="panel absolute p-2 text-muted hover:text-ink" style={{ top: HEADER_H + GAP, left: GAP }} aria-label="Open panel">
          <PanelLeftOpen size={15} />
        </button>
      )}

      <div ref={plannerRef} className="absolute" style={{ left, right: GAP, bottom: GAP, maxHeight: "50vh" }}>
        {planner.error && <div className="panel mb-2 px-3 py-1.5 text-[12px] text-critical">Planner error: {planner.error}</div>}
        <PlannerPanel
          region={region}
          routes={planner.plan?.routes ?? null}
          computing={planner.computing}
          verification={planner.verification}
          verifying={planner.verifying}
          onVerify={planner.verify}
          twinBar={<TwinBar snap={live.snap} />}
        />
      </div>
    </div>
  );
}
