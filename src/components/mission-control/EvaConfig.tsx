"use client";
import { DEFAULT_EVA, EvaParams, metabolicRateW, o2LitresPerMin } from "@/lib/core/eva";
import { useMission } from "@/lib/store";

type Field = { key: keyof EvaParams; label: string; min: number; max: number; step: number; unit: string; assumption?: boolean };

const FIELDS: Field[] = [
  { key: "loadKg", label: "Tools and samples carried", min: 5, max: 40, step: 1, unit: "kg" },
  { key: "speedMs", label: "Walking speed", min: 0.3, max: 1.4, step: 0.05, unit: "m/s" },
  { key: "obsMin", label: "Science time at target", min: 10, max: 180, step: 5, unit: "min" },
  { key: "bodyMassKg", label: "Body mass", min: 50, max: 110, step: 1, unit: "kg" },
  { key: "suitMassKg", label: "Suit + life-support pack", min: 30, max: 130, step: 1, unit: "kg", assumption: true },
  { key: "kSuit", label: "Pressurised-suit penalty", min: 1, max: 1.6, step: 0.05, unit: "×", assumption: true },
  { key: "tankL", label: "Usable O₂ per astronaut", min: 150, max: 900, step: 10, unit: "L", assumption: true },
];

function Slider({ label, value, unit, min, max, step, onChange, assumption }: {
  label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; assumption?: boolean;
}) {
  return (
    <label className="block py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">{label}{assumption && <span className="ml-1 text-[10px] text-caution" title="Assumption: not a NASA specification">assumed</span>}</span>
        <span className="num text-[12px]">{value.toFixed(step < 1 ? 2 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function EvaConfig() {
  const eva = useMission((s) => s.eva);
  const setEva = useMission((s) => s.setEva);
  const sMax = useMission((s) => s.sMax);
  const setSMax = useMission((s) => s.setSMax);
  const levelW = metabolicRateW(eva, eva.speedMs, 0);
  return (
    <div className="space-y-4">
      <section>
        <h3 className="label mb-1">Mobility limit</h3>
        <Slider label="Maximum walkable slope" value={sMax} unit="°" min={8} max={25} step={1} onChange={setSMax} />
        <p className="text-[11px] leading-[1.5] text-faint">Cells steeper than this are excluded and every route is recomputed.</p>
      </section>
      <section>
        <h3 className="label mb-1">Crew and load</h3>
        {FIELDS.map((f) => (
          <Slider key={f.key} label={f.label} value={Number(eva[f.key])} unit={f.unit} min={f.min} max={f.max} step={f.step}
            onChange={(v) => setEva({ [f.key]: v })} assumption={f.assumption} />
        ))}
        <button className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => { setEva(DEFAULT_EVA); setSMax(15); }}>
          Reset to defaults
        </button>
      </section>
      <section className="border-t border-line pt-3 text-[12px] leading-[1.55]">
        <h3 className="label mb-1">Metabolic model</h3>
        <div className="num">Level walking: {levelW.toFixed(0)} W → {o2LitresPerMin(levelW).toFixed(2)} L O₂/min</div>
        <p className="mt-1 text-muted">
          Pandolf et al. (1977) load-carriage equation with the load and walking terms scaled to Mars gravity (3.721 m/s²); the resting term is not scaled. O₂ from 20.1 kJ per litre. Fitted to unsuited walking on Earth, so treat it as a model.
        </p>
      </section>
    </div>
  );
}
