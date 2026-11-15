"use client";
import { Eye, EyeOff, Layers } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { TERRAIN_CLASS_LABEL } from "@/lib/core/terrain";
import { DEM_PROVENANCE, derivedProvenance, ORTHO_PROVENANCE, Provenance, ROVER_PROVENANCE } from "@/lib/data/targets";
import { CLASS_COLORS } from "@/lib/render";
import { LayerId, useMission } from "@/lib/store";

const LAYERS: { id: LayerId; name: string; group: string; prov: Provenance; legend?: string }[] = [
  { id: "ortho", name: "Optical — HiRISE orthoimage", group: "Science", prov: ORTHO_PROVENANCE },
  { id: "hillshade", name: "Topography — hillshade", group: "Science", prov: DEM_PROVENANCE },
  { id: "elevation", name: "Topography — elevation", group: "Science", prov: DEM_PROVENANCE, legend: "low → high" },
  { id: "slope", name: "Slope (Horn, 5 m)", group: "Safety", prov: derivedProvenance("Validated vs. rover tilt", "Horn 3x3 slope on HiRISE DTM"), legend: "0° → 30°" },
  { id: "roughness", name: "Roughness (plane-fit RMS)", group: "Safety", prov: derivedProvenance("Metre-scale bumps; 0.5 m RMS = 1", "3x3 plane-fit residual") },
  { id: "classes", name: "Traversability classes", group: "Safety", prov: derivedProvenance("Depends on suit slope limit", "Slope + roughness + uncertainty rules") },
  { id: "uncertainty", name: "Data coverage & uncertainty (U)", group: "Safety", prov: derivedProvenance("Native resolution + resampling + gaps", "U index 0..1") },
  { id: "rover", name: "Perseverance traverse", group: "Operations", prov: ROVER_PROVENANCE },
  { id: "routes", name: "Planned EVA routes A / B / C", group: "Operations", prov: derivedProvenance("Model output", "A* multi-criteria routing") },
];

export function LayerPanel({ classShare }: { classShare: number[] | null }) {
  const layers = useMission((s) => s.layers);
  const setLayer = useMission((s) => s.setLayer);
  const groups = [...new Set(LAYERS.map((l) => l.group))];
  return (
    <div className="panel flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Layers size={15} className="text-hud" /> Layers</div>
      {groups.map((g) => (
        <div key={g} className="space-y-2">
          <div className="label">{g}</div>
          {LAYERS.filter((l) => l.group === g).map((l) => {
            const st = layers[l.id];
            return (
              <div key={l.id} className="rounded-md border border-line/70 bg-space/40 p-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLayer(l.id, { visible: !st.visible })}
                    className={st.visible ? "text-hud" : "text-muted"}
                    aria-label={st.visible ? "Hide layer" : "Show layer"}
                  >
                    {st.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span className={`flex-1 text-xs ${st.visible ? "text-ink" : "text-muted"}`}>{l.name}</span>
                  <ProvenanceBadge p={l.prov} compact />
                </div>
                {st.visible && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="range" min={0} max={100} value={Math.round(st.opacity * 100)}
                      onChange={(e) => setLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                      aria-label={`${l.name} opacity`}
                    />
                    <span className="num w-9 text-right text-[10px] text-muted">{Math.round(st.opacity * 100)}%</span>
                  </div>
                )}
                {st.visible && l.id === "classes" && classShare && (
                  <div className="mt-2 space-y-0.5">
                    {classShare.map((v, k) => (
                      <div key={k} className="flex items-center gap-2 text-[10px]">
                        <span className="h-2.5 w-2.5 rounded-sm border border-line" style={{ background: `rgba(${CLASS_COLORS[k].slice(0, 3).join(",")},${k === 0 ? 0.25 : 0.9})` }} />
                        <span className="flex-1 text-muted">{TERRAIN_CLASS_LABEL[k as 0]}</span>
                        <span className="num">{v.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {st.visible && l.legend && <div className="mt-1 text-[10px] text-muted">{l.legend}</div>}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-[10px] leading-4 text-muted">
        Not loaded at this scale: THEMIS thermal inertia, USGS geologic units (would require a resampling warning: native resolution far coarser than 5 m).
      </p>
    </div>
  );
}
