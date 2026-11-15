"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { soiBreakdown } from "@/lib/core/soi";
import { TARGETS } from "@/lib/data/targets";
import { useMission } from "@/lib/store";

const PART_COLORS = { M: "#c98b5b", G: "#b9a46a", T: "#7fa6c4", Q: "#7aa88d" } as const;
const WEIGHT_LABEL = {
  alpha: ["α", "Mineral evidence (M)"],
  beta: ["β", "Geological relevance (G)"],
  gamma: ["γ", "Fit to science question (T)"],
  delta: ["δ", "Data quality (Q)"],
} as const;

export function TargetPanel() {
  const targetId = useMission((s) => s.targetId);
  const setTarget = useMission((s) => s.setTarget);
  const weights = useMission((s) => s.soiWeights);
  const setW = useMission((s) => s.setSoiWeights);
  const [showWeights, setShowWeights] = useState(false);
  const ranked = TARGETS.filter((t) => t.region === "jezero")
    .map((t) => ({ t, b: soiBreakdown(t.scores, weights) }))
    .sort((a, b) => b.b.total - a.b.total);
  const sel = TARGETS.find((t) => t.id === targetId) ?? TARGETS[0];
  const norm = ranked[0]?.b.weights;

  return (
    <div className="space-y-4">
      <section>
        <h3 className="label mb-1.5">Targets ranked by Science Opportunity Index</h3>
        <ul className="space-y-1">
          {ranked.map(({ t, b }) => (
            <li key={t.id}>
              <button
                onClick={() => setTarget(t.id)}
                className={`w-full rounded border px-2 py-1.5 text-left ${t.id === targetId ? "border-mars/70 bg-mars/5" : "border-transparent hover:bg-white/[0.03]"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className={t.id === targetId ? "font-medium text-ink" : "text-ink"}>{t.name}</span>
                  <span className="num text-[12px]">{b.total.toFixed(3)}</span>
                </div>
                <div className="mt-1 flex h-1 overflow-hidden rounded-sm bg-line">
                  {(["M", "G", "T", "Q"] as const).map((p) => (
                    <div key={p} style={{ width: `${b[p] * 100}%`, background: PART_COLORS[p] }} title={`${p} ${b[p].toFixed(3)}`} />
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => setShowWeights((s) => !s)} className="mt-2 flex items-center gap-1 text-[11px] text-muted hover:text-ink">
          <ChevronDown size={12} className={showWeights ? "rotate-180" : ""} /> SOI = αM + βG + γT + δQ · adjust weights
        </button>
        {showWeights && (
          <div className="mt-2 space-y-1.5">
            {(Object.keys(WEIGHT_LABEL) as (keyof typeof WEIGHT_LABEL)[]).map((k) => (
              <label key={k} className="block text-[11px]">
                <div className="flex justify-between text-muted">
                  <span><span className="num text-ink">{WEIGHT_LABEL[k][0]}</span> {WEIGHT_LABEL[k][1]}</span>
                  <span className="num">{norm?.[k].toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={100} value={Math.round(weights[k] * 100)} onChange={(e) => setW({ [k]: Number(e.target.value) / 100 })} />
              </label>
            ))}
            <p className="text-[11px] text-faint">Weights are normalised to sum to 1. M, G, T, Q are scores assigned by the team, not NASA values.</p>
          </div>
        )}
      </section>

      <section className="border-t border-line pt-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold leading-5">{sel.name}</h2>
            <div className="num text-[11px] text-faint">{sel.lat.toFixed(5)}°N, {sel.lon.toFixed(5)}°E</div>
          </div>
          <ProvenanceBadge p={sel.provenance} />
        </div>
        <p className="mt-2 leading-[1.55]">{sel.summary}</p>

        <h3 className="label mt-3">What the rover found</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 leading-[1.5]">{sel.findings.map((f) => <li key={f}>{f}</li>)}</ul>

        <h3 className="label mt-3">Limitations</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 leading-[1.5] text-muted">{sel.limitations.map((f) => <li key={f}>{f}</li>)}</ul>

        <h3 className="label mt-3">Field sampling checklist</h3>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 leading-[1.5]">{sel.samplingChecklist.map((f) => <li key={f}>{f}</li>)}</ol>

        <h3 className="label mt-3">Score rationale</h3>
        <dl className="mt-1 grid grid-cols-[52px_1fr] gap-x-2 gap-y-1 text-[12px] leading-[1.45]">
          {(["M", "G", "T", "Q"] as const).map((p) => (
            <div key={p} className="contents">
              <dt className="num" style={{ color: PART_COLORS[p] }}>{p} {sel.scores[p].toFixed(2)}</dt>
              <dd className="text-muted">{sel.scoreRationale[p]}</dd>
            </div>
          ))}
        </dl>

        <h3 className="label mt-3">How the position was obtained</h3>
        <p className="mt-1 text-[12px] leading-[1.5] text-muted">{sel.locationNote}</p>
      </section>
    </div>
  );
}
