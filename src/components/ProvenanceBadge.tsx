"use client";
import { useState } from "react";
import { BadgeCheck, FlaskConical, Info, X } from "lucide-react";
import type { Provenance } from "@/lib/data/targets";

const STYLE: Record<Provenance["verification"], string> = {
  VERIFIED: "border-nominal/50 text-nominal",
  CONTEXTUAL: "border-caution/50 text-caution",
  MODELLED: "border-hud/50 text-hud",
};

export function ProvenanceBadge({ p, compact = false }: { p: Provenance; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = p.verification === "MODELLED" ? FlaskConical : p.verification === "VERIFIED" ? BadgeCheck : Info;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${STYLE[p.verification]} hover:bg-white/5`}
        title="Show NASA provenance"
      >
        <Icon size={11} />
        {compact ? p.verification[0] : p.verification}
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-80 rounded-lg border border-line bg-panel-2 p-3 text-left text-xs shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Provenance</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close"><X size={14} /></button>
          </div>
          <dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-1">
            {([
              ["Mission", p.mission], ["Instrument", p.instrument], ["Product ID", p.productId],
              ["Observed", p.observationDate], ["Resolution", p.spatialResolution], ["Coverage", p.coverage],
              ["Uncertainty", p.uncertainty], ["Temporal", p.temporalClass], ["Status", p.verification],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className={k === "Product ID" ? "num break-all text-ink" : "text-ink"}>{v}</dd>
              </div>
            ))}
          </dl>
          {p.sources.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-line pt-2">
              {p.sources.map((s) => (
                <li key={s.label}>
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-hud hover:underline">{s.label}</a> : <span className="text-muted">{s.label}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
