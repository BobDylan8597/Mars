"use client";
import { Crosshair, Microscope } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { soiBreakdown } from "@/lib/core/soi";
import { TARGETS } from "@/lib/data/targets";
import { useMission } from "@/lib/store";

const PART_COLORS = { M: "#FF5722", G: "#F59E0B", T: "#00F0FF", Q: "#10B981" } as const;
const WEIGHT_LABEL = {
  alpha: "α Mineralogical evidence (M)",
  beta: "β Geological relevance (G)",
  gamma: "γ Science question fit (T)",
  delta: "δ Data quality (Q)",
} as const;

export function TargetPanel() {
  const targetId = useMission((s) => s.targetId);
  const setTarget = useMission((s) => s.setTarget);
  const weights = useMission((s) => s.soiWeights);
  const setW = useMission((s) => s.setSoiWeights);
  const ranked = TARGETS.filter((t) => t.region === "jezero")
    .map((t) => ({ t, b: soiBreakdown(t.scores, weights) }))
    .sort((a, b) => b.b.total - a.b.total);
  const sel = TARGETS.find((t) => t.id === targetId) ?? TARGETS[0];

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Microscope size={15} className="text-hud" /> Science Opportunity Index</div>
        <div className="space-y-1.5">
          {(Object.keys(WEIGHT_LABEL) as (keyof typeof WEIGHT_LABEL)[]).map((k) => (
            <label key={k} className="block text-[11px]">
              <div className="flex justify-between text-muted"><span>{WEIGHT_LABEL[k]}</span><span className="num text-ink">{ranked[0]?.b.weights[k].toFixed(2)}</span></div>
              <input type="range" min={0} max={100} value={Math.round(weights[k] * 100)} onChange={(e) => setW({ [k]: Number(e.target.value) / 100 })} />
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {ranked.map(({ t, b }, rank) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className={`w-full rounded-md border p-2 text-left ${t.id === targetId ? "border-mars bg-mars/10" : "border-line hover:border-muted"}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span><span className="num text-muted">#{rank + 1}</span> {t.name}</span>
                <span className="num text-sm font-semibold">{b.total.toFixed(3)}</span>
              </div>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded bg-space">
                {(["M", "G", "T", "Q"] as const).map((p) => (
                  <div key={p} style={{ width: `${b[p] * 100}%`, background: PART_COLORS[p] }} title={`${p}: ${b[p].toFixed(3)}`} />
                ))}
              </div>
              <div className="num mt-1 flex gap-3 text-[10px] text-muted">
                {(["M", "G", "T", "Q"] as const).map((p) => <span key={p} style={{ color: PART_COLORS[p] }}>{p} {t.scores[p].toFixed(2)}</span>)}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted">M, G, T, Q are team-assigned scores (rationale below), not NASA values.</p>
      </div>

      <div className="panel p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Crosshair size={15} className="text-mars" /> {sel.name}</div>
            <div className="num text-[11px] text-muted">{sel.id} · {sel.lat.toFixed(5)}°N {sel.lon.toFixed(5)}°E</div>
          </div>
          <ProvenanceBadge p={sel.provenance} />
        </div>
        <p className="mt-2 text-xs leading-5">{sel.summary}</p>
        <div className="label mt-3">NASA findings</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5">{sel.findings.map((f) => <li key={f}>{f}</li>)}</ul>
        <div className="label mt-3">Limitations</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-caution/90">{sel.limitations.map((f) => <li key={f}>{f}</li>)}</ul>
        <div className="label mt-3">Score rationale</div>
        <ul className="mt-1 space-y-1 text-[11px] leading-4 text-muted">
          {(["M", "G", "T", "Q"] as const).map((p) => <li key={p}><span className="num" style={{ color: PART_COLORS[p] }}>{p}</span> {sel.scoreRationale[p]}</li>)}
        </ul>
        <div className="label mt-3">Location</div>
        <p className="mt-1 text-[11px] leading-4 text-muted">{sel.locationNote}</p>
      </div>
    </div>
  );
}
