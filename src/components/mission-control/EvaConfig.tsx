"use client";
import { Backpack, RotateCcw } from "lucide-react";
import { DEFAULT_EVA, EvaParams, metabolicRateW, o2LitresPerMin } from "@/lib/core/eva";
import { useMission } from "@/lib/store";

type Field = { key: keyof EvaParams; label: string; min: number; max: number; step: number; unit: string; tag?: "ASSUMPTION" };

const FIELDS: Field[] = [
  { key: "loadKg", label: "Carried tools & samples", min: 5, max: 40, step: 1, unit: "kg" },
  { key: "speedMs", label: "Walking speed", min: 0.3, max: 1.4, step: 0.05, unit: "m/s" },
  { key: "obsMin", label: "Science time at target", min: 10, max: 180, step: 5, unit: "min" },
  { key: "bodyMassKg", label: "Astronaut body mass", min: 50, max: 110, step: 1, unit: "kg" },
  { key: "suitMassKg", label: "Suit + PLSS mass", min: 30, max: 130, step: 1, unit: "kg", tag: "ASSUMPTION" },
  { key: "kSuit", label: "Pressurised-suit penalty", min: 1, max: 1.6, step: 0.05, unit: "×", tag: "ASSUMPTION" },
  { key: "tankL", label: "Usable O₂ per astronaut", min: 150, max: 900, step: 10, unit: "L", tag: "ASSUMPTION" },
];

export function EvaConfig() {
  const eva = useMission((s) => s.eva);
  const setEva = useMission((s) => s.setEva);
  const sMax = useMission((s) => s.sMax);
  const setSMax = useMission((s) => s.setSMax);
  const levelW = metabolicRateW(eva, eva.speedMs, 0);
  return (
    <div className="panel space-y-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><Backpack size={15} className="text-hud" /> EVA life-support configurator</div>
        <button className="flex items-center gap-1 text-[11px] text-muted hover:text-ink" onClick={() => { setEva(DEFAULT_EVA); setSMax(15); }}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>
      <label className="block text-[11px]">
        <div className="flex justify-between"><span className="text-muted">Max walkable slope (S<sub>max</sub>)</span><span className="num">{sMax}°</span></div>
        <input type="range" min={8} max={25} step={1} value={sMax} onChange={(e) => setSMax(Number(e.target.value))} />
      </label>
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted">{f.label} {f.tag && <span className="ml-1 rounded border border-caution/40 px-1 text-[9px] text-caution">{f.tag}</span>}</span>
            <span className="num">{Number(eva[f.key]).toFixed(f.step < 1 ? 2 : 0)} {f.unit}</span>
          </div>
          <input type="range" min={f.min} max={f.max} step={f.step} value={eva[f.key]} onChange={(e) => setEva({ [f.key]: Number(e.target.value) })} />
        </label>
      ))}
      <div className="num rounded-md border border-line bg-space/50 p-2 text-[11px] leading-5">
        Level walking: {levelW.toFixed(0)} W → {o2LitresPerMin(levelW).toFixed(2)} L O₂/min
        <div className="text-[10px] text-muted">Pandolf (1977) adapted to Mars gravity (g = 3.721 m/s²); basal term not gravity-scaled. MODELLED.</div>
      </div>
    </div>
  );
}
