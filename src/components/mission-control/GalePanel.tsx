"use client";
import { useEffect, useMemo, useState } from "react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { CHALLENGE_QUOTE, GALE_BOXWORK as T } from "@/lib/data/targets";

interface Boxwork {
  traverse: { sol: number; lat: number; lon: number; elev: number }[];
  images: { imageid: string; sol: number; instrument: string; url: string }[];
}

const CAM: Record<string, string> = {
  NAV_LEFT_B: "Navcam: terrain around the rover",
  NAV_RIGHT_B: "Navcam: terrain around the rover",
  FHAZ_LEFT_B: "Front Hazcam: ground ahead",
  CHEMCAM_RMI: "ChemCam RMI: telescopic close-up of a laser target",
  MAHLI: "MAHLI: rock close-up",
  MAST_LEFT: "Mastcam: outcrop view",
  MAST_RIGHT: "Mastcam: outcrop view",
};

/** Curiosity's real 2025 path through the boxwork, drawn to scale. */
function TraverseSketch({ pts }: { pts: Boxwork["traverse"] }) {
  const g = useMemo(() => {
    const R = 3396190, d2r = Math.PI / 180;
    const lat0 = pts[0].lat;
    const xy = pts.map((p) => [p.lon * d2r * R * Math.cos(lat0 * d2r), -p.lat * d2r * R]);
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1);
    const W = 300, H = 160, pad = 14, k = (Math.min(W, H) - 2 * pad) / span;
    const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${(pad + (x - x0) * k).toFixed(1)},${(pad + (y - y0) * k).toFixed(1)}`).join(" ");
    const bar = 100; // metres
    return { path, W, H, pad, barPx: bar * k, bar, end: xy.length - 1, k, x0, y0, xy };
  }, [pts]);
  const last = g.xy[g.end];
  return (
    <svg viewBox={`0 0 ${g.W} ${g.H}`} className="w-full rounded border border-line bg-space">
      <path d={g.path} fill="none" stroke="#e0a23c" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={g.pad + (last[0] - g.x0) * g.k} cy={g.pad + (last[1] - g.y0) * g.k} r="3" fill="#f2f2f2" />
      <line x1={g.W - g.pad - g.barPx} x2={g.W - g.pad} y1={g.H - 8} y2={g.H - 8} stroke="#d9dbdf" />
      <text x={g.W - g.pad} y={g.H - 12} textAnchor="end" fontSize="9" fill="#8b9098">{g.bar} m</text>
      <text x={g.pad} y={g.H - 6} fontSize="9" fill="#8b9098">sols {pts[0].sol}–{pts[pts.length - 1].sol} · N up</text>
    </svg>
  );
}

export function GalePanel() {
  const [data, setData] = useState<Boxwork | null>(null);
  const [sel, setSel] = useState(0);
  useEffect(() => { fetch("/data/gale/boxwork.json").then((r) => r.json()).then(setData).catch(() => setData(null)); }, []);
  const img = data?.images[sel];
  const climb = data ? data.traverse[data.traverse.length - 1].elev - data.traverse[0].elev : 0;
  const dist = data ? (data.traverse[data.traverse.length - 1] as { dist_total_m?: number }).dist_total_m! - (data.traverse[0] as { dist_total_m?: number }).dist_total_m! : 0;

  return (
    <section className="border-t border-line pt-3">
      <div className="label">Gale crater · the challenge&apos;s own example</div>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">{T.name}</h2>
          <div className="num text-[11px] text-faint">{Math.abs(T.lat).toFixed(5)}°S, {T.lon.toFixed(5)}°E · −3,608 m</div>
        </div>
        <ProvenanceBadge p={T.provenance} />
      </div>
      <div className="mt-2 text-[11px] text-faint">Challenge statement (Spanish edition, verbatim):</div>
      <blockquote className="mt-0.5 border-l-2 border-mars/60 pl-2 text-[12px] italic leading-[1.5] text-muted" lang="es">“…{CHALLENGE_QUOTE}”</blockquote>
      <p className="mt-2 leading-[1.55]">{T.summary}</p>

      {data && (
        <>
          <h3 className="label mt-3">Curiosity&apos;s 2025 path through the boxwork</h3>
          <div className="mt-1"><TraverseSketch pts={data.traverse} /></div>
          <div className="num mt-1 text-[11px] text-muted">{data.traverse.length} stops · {(dist / 1000).toFixed(2)} km driven · {climb >= 0 ? "+" : ""}{climb.toFixed(0)} m elevation</div>

          {data.images.length > 0 && (
            <>
              <h3 className="label mt-3">Real Curiosity photos from inside the boxwork</h3>
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={CAM[img.instrument] ?? img.instrument} className="mt-1 w-full rounded border border-line" />
              )}
              <div className="mt-1 text-[11px] text-muted">{img && <>{CAM[img.instrument] ?? img.instrument} · sol {img.sol} · NASA/JPL-Caltech</>}</div>
              <div className="mt-1 flex gap-1 overflow-x-auto">
                {data.images.map((im, i) => (
                  <button key={im.imageid} onClick={() => setSel(i)} className={`h-10 w-14 shrink-0 overflow-hidden rounded border ${i === sel ? "border-ink" : "border-line opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <h3 className="label mt-3">What Curiosity found</h3>
      <ul className="mt-1 list-disc space-y-1 pl-4 leading-[1.5]">{T.findings.map((f) => <li key={f}>{f}</li>)}</ul>
      <h3 className="label mt-3">Limitations</h3>
      <ul className="mt-1 list-disc space-y-1 pl-4 leading-[1.5] text-muted">{T.limitations.map((f) => <li key={f}>{f}</li>)}</ul>
      <h3 className="label mt-3">Field checklist for a crew</h3>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4 leading-[1.5]">{T.samplingChecklist.map((f) => <li key={f}>{f}</li>)}</ol>
    </section>
  );
}
