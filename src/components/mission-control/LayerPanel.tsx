"use client";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { TERRAIN_CLASS_LABEL } from "@/lib/core/terrain";
import { DEM_PROVENANCE, derivedProvenance, ORTHO_PROVENANCE, Provenance, ROVER_PROVENANCE } from "@/lib/data/targets";
import { CLASS_COLORS, ELEVATION_RAMP, rgbCss, SLOPE_RAMP } from "@/lib/render";
import type { Region } from "@/lib/data/region";
import { LayerId, useMission } from "@/lib/store";

type LayerDef = { id: LayerId; name: string; detail: string; prov: Provenance };

const GROUPS: { title: string; layers: LayerDef[] }[] = [
  {
    title: "Imagery & terrain",
    layers: [
      { id: "ortho", name: "HiRISE orthoimage", detail: "0.25 m, shown at 2 m", prov: ORTHO_PROVENANCE },
      { id: "hillshade", name: "Hillshade", detail: "HiRISE DTM, 5 m", prov: DEM_PROVENANCE },
      { id: "elevation", name: "Elevation", detail: "m, MOLA areoid", prov: DEM_PROVENANCE },
    ],
  },
  {
    title: "Traverse safety",
    layers: [
      { id: "slope", name: "Slope", detail: "Horn 3×3, degrees", prov: derivedProvenance("Validated vs. rover tilt", "Horn 3x3 slope on HiRISE DTM") },
      { id: "roughness", name: "Roughness", detail: "plane-fit RMS, 0.5 m = 1", prov: derivedProvenance("Metre-scale bumps", "3x3 plane-fit residual") },
      { id: "classes", name: "Traversability", detail: "slope + roughness + U", prov: derivedProvenance("Depends on suit slope limit", "Rule-based classes") },
      { id: "uncertainty", name: "Data uncertainty U", detail: "resolution, gaps, resampling", prov: derivedProvenance("Native resolution + resampling + gaps", "U index 0..1") },
    ],
  },
  {
    title: "Operations",
    layers: [
      { id: "rover", name: "Perseverance traverse", detail: "sols 909–1343", prov: ROVER_PROVENANCE },
      { id: "routes", name: "Planned EVA routes", detail: "A* on the cost surface", prov: derivedProvenance("Model output", "A* multi-criteria routing") },
    ],
  },
];

function Ramp({ stops, from, to, max }: { stops: [number, [number, number, number]][]; from: string; to: string; max: number }) {
  const grad = stops.map(([t, c]) => `${rgbCss(c)} ${(t / max) * 100}%`).join(",");
  return (
    <div className="mt-1.5">
      <div className="h-1.5 rounded-sm" style={{ background: `linear-gradient(90deg, ${grad})` }} />
      <div className="num mt-0.5 flex justify-between text-[10px] text-faint"><span>{from}</span><span>{to}</span></div>
    </div>
  );
}

export function LayerPanel({ region, classShare }: { region: Region; classShare: number[] | null }) {
  const layers = useMission((s) => s.layers);
  const setLayer = useMission((s) => s.setLayer);
  const v = region.validation;
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="label mb-1">{g.title}</h3>
          <ul className="divide-y divide-line/60">
            {g.layers.map((l) => {
              const st = layers[l.id];
              return (
                <li key={l.id} className="py-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      id={`layer-${l.id}`} type="checkbox" checked={st.visible}
                      onChange={() => setLayer(l.id, { visible: !st.visible })}
                      className="h-3.5 w-3.5 accent-[#9aa0a8]"
                    />
                    <label htmlFor={`layer-${l.id}`} className="flex-1 cursor-pointer leading-4">
                      <span className={st.visible ? "text-ink" : "text-muted"}>{l.name}</span>
                      <span className="block text-[11px] text-faint">{l.detail}</span>
                    </label>
                    <ProvenanceBadge p={l.prov} compact />
                  </div>
                  {st.visible && (
                    <div className="ml-5.5 mt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={0} max={100} value={Math.round(st.opacity * 100)}
                          onChange={(e) => setLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                          aria-label={`${l.name} opacity`}
                        />
                        <span className="num w-8 text-right text-[10px] text-faint">{Math.round(st.opacity * 100)}%</span>
                      </div>
                      {l.id === "elevation" && <Ramp stops={ELEVATION_RAMP} from={`${region.meta.z_min.toFixed(0)} m`} to={`${region.meta.z_max.toFixed(0)} m`} max={1} />}
                      {l.id === "slope" && <Ramp stops={SLOPE_RAMP} from="0°" to="30°" max={30} />}
                      {l.id === "classes" && classShare && (
                        <div className="mt-1 space-y-0.5">
                          {classShare.map((share, k) => (
                            <div key={k} className="flex items-center gap-2 text-[11px]">
                              <span className="h-2 w-2 rounded-[1px] border border-line" style={{ background: k === 0 ? "transparent" : `rgb(${CLASS_COLORS[k].slice(0, 3).join(",")})` }} />
                              <span className="flex-1 text-muted">{TERRAIN_CLASS_LABEL[k as 0]}</span>
                              <span className="num text-faint">{share.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="border-t border-line pt-3 text-[11px] leading-[1.55] text-muted">
        <h3 className="label mb-1 text-ink">Terrain check against Perseverance</h3>
        DEM slope at <span className="num text-ink">{v.slope_deg.n}</span> rover stops vs. the tilt the rover recorded:
        mean error <span className="num text-ink">{v.slope_deg.mae.toFixed(2)}°</span>, r = <span className="num text-ink">{v.slope_deg.corr.toFixed(2)}</span>.
        Tilt also reflects rocks under the wheels, so exact agreement is not expected.
      </section>
      <p className="text-[11px] leading-[1.55] text-faint">
        Not shown at this scale: THEMIS thermal inertia and USGS geologic units. Their native resolution is far coarser than the 5 m grid and would need a resampling warning.
      </p>
    </div>
  );
}
