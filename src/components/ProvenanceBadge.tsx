"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Provenance } from "@/lib/data/targets";

const DOT: Record<Provenance["verification"], string> = {
  VERIFIED: "bg-nominal",
  CONTEXTUAL: "bg-caution",
  MODELLED: "bg-hud",
};
const TEXT: Record<Provenance["verification"], string> = {
  VERIFIED: "NASA data",
  CONTEXTUAL: "Context",
  MODELLED: "Derived",
};

export function ProvenanceBadge({ p, compact = false, align = "right" }: { p: Provenance; compact?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted hover:bg-white/5 hover:text-ink"
        title="Data provenance"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[p.verification]}`} />
        {!compact && TEXT[p.verification]}
        {compact && <span className="sr-only">{TEXT[p.verification]}</span>}
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-1 w-80 rounded border border-line bg-panel-2 p-3 text-left text-xs shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-ink">Provenance · {TEXT[p.verification]}</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close"><X size={13} /></button>
          </div>
          <dl className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-1 leading-4">
            {([
              ["Mission", p.mission], ["Instrument", p.instrument], ["Product", p.productId],
              ["Observed", p.observationDate], ["Resolution", p.spatialResolution], ["Coverage", p.coverage],
              ["Uncertainty", p.uncertainty], ["Temporal", p.temporalClass],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className={k === "Product" ? "num break-all text-[11px]" : ""}>{v}</dd>
              </div>
            ))}
          </dl>
          {p.sources.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-line pt-2">
              {p.sources.map((s) => (
                <li key={s.label}>
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-hud underline-offset-2 hover:underline">{s.label} ↗</a> : <span className="text-muted">{s.label}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
