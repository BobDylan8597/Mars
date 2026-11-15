"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { DEM_PROVENANCE } from "@/lib/data/targets";
import { usePlanner, useRegion } from "@/lib/useMissionData";
import { EvaConfig } from "./EvaConfig";
import { LayerPanel } from "./LayerPanel";
import { MapCanvas } from "./MapCanvas";
import { PlannerPanel } from "./PlannerPanel";
import { TargetPanel } from "./TargetPanel";

const TABS = [
  { id: "layers", label: "Layers" },
  { id: "targets", label: "Targets" },
  { id: "eva", label: "EVA" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HEADER_H = 44;
const SIDE_W = 340;
const GAP = 10;

export function MissionControl() {
  const { region, error } = useRegion();
  const planner = usePlanner();
  const [tab, setTab] = useState<Tab>("targets");
  const [sideOpen, setSideOpen] = useState(true);
  const plannerRef = useRef<HTMLDivElement>(null);
  const [plannerH, setPlannerH] = useState(260);

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
      <MapCanvas
        region={region}
        classes={planner.plan?.classes ?? null}
        routes={planner.plan?.routes ?? null}
        inset={{ top: HEADER_H + GAP, right: GAP, bottom: plannerH + GAP * 2, left }}
      />

      <header className="absolute inset-x-0 top-0 flex items-center gap-4 border-b border-line bg-space/92 px-4" style={{ height: HEADER_H }}>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tracking-wide">Mars Pathfinder</span>
          <span className="text-muted">EVA planning</span>
        </div>
        <span className="h-4 w-px bg-line" />
        <nav className="flex items-center gap-4 text-[12px]">
          <span className="border-b border-ink pb-0.5 text-ink">Mission Control</span>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-muted">
          <span>Jezero crater, western floor · 18.49°N 77.32°E</span>
          <ProvenanceBadge p={DEM_PROVENANCE} />
        </div>
      </header>

      {sideOpen ? (
        <aside className="panel absolute flex flex-col" style={{ top: HEADER_H + GAP, left: GAP, width: SIDE_W, bottom: GAP }}>
          <div className="flex items-center border-b border-line px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-[12px] ${tab === t.id ? "border-b border-ink text-ink" : "text-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
            <button onClick={() => setSideOpen(false)} className="ml-auto p-2 text-muted hover:text-ink" aria-label="Collapse panel"><PanelLeftClose size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {tab === "layers" && <LayerPanel region={region} classShare={planner.plan?.classShare ?? null} />}
            {tab === "targets" && <TargetPanel />}
            {tab === "eva" && <EvaConfig />}
          </div>
        </aside>
      ) : (
        <button
          onClick={() => setSideOpen(true)}
          className="panel absolute p-2 text-muted hover:text-ink"
          style={{ top: HEADER_H + GAP, left: GAP }}
          aria-label="Open panel"
        >
          <PanelLeftOpen size={15} />
        </button>
      )}

      <div ref={plannerRef} className="absolute" style={{ left, right: GAP, bottom: GAP, maxHeight: "48vh" }}>
        {planner.error && <div className="panel mb-2 px-3 py-1.5 text-[12px] text-critical">Planner error: {planner.error}</div>}
        <PlannerPanel
          region={region}
          routes={planner.plan?.routes ?? null}
          computing={planner.computing}
          verification={planner.verification}
          verifying={planner.verifying}
          onVerify={planner.verify}
        />
      </div>
    </div>
  );
}
