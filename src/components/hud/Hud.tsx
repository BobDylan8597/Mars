"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Pause, Play, RadioTower, WifiOff } from "lucide-react";
import { AppHeader, HEADER_H } from "@/components/AppHeader";
import { MapCanvas } from "@/components/mission-control/MapCanvas";
import { assessAtmosphere } from "@/lib/core/atmosphere";
import { evaDose } from "@/lib/core/radiation";
import { cellToLatLon, latLonToCell } from "@/lib/data/region";
import { TARGETS } from "@/lib/data/targets";
import { EmergencyKind, TAB_ID, useMission } from "@/lib/store";
import { usePlanner, useRegion } from "@/lib/useMissionData";
import { useLive } from "@/lib/useLive";
import { FieldLogForm } from "./FieldLogForm";

interface RoverImage {
  imageid: string; sol: number; instrument: string; mastAz: string; mastEl: string;
  date_taken_utc: string; small: string; medium: string; large: string; full_res: string; credit: string; link: string; title: string;
}

const CAM_LABEL: Record<string, string> = {
  MCZ_LEFT: "Mastcam-Z (left)", NAVCAM_LEFT: "Navcam (left)", SHERLOC_WATSON: "SHERLOC WATSON",
  FRONT_HAZCAM_LEFT_A: "Front Hazcam", CACHECAM: "CacheCam (sample tube)", SUPERCAM_RMI: "SuperCam RMI",
};

function bearing(fromCol: number, fromRow: number, toCol: number, toRow: number) {
  return (Math.atan2(toCol - fromCol, -(toRow - fromRow)) * 180 / Math.PI + 360) % 360;
}
const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

function CompassTape({ heading, marks }: { heading: number; marks: { deg: number; label: string; color: string }[] }) {
  const span = 120; // degrees visible
  const ticks = [];
  for (let d = Math.floor((heading - span / 2) / 5) * 5; d <= heading + span / 2; d += 5) {
    const x = 50 + (angDiff(((d % 360) + 360) % 360, heading) / span) * 100;
    const norm = ((d % 360) + 360) % 360;
    const card = { 0: "N", 90: "E", 180: "S", 270: "W" }[norm as 0 | 90 | 180 | 270];
    ticks.push(
      <div key={d} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${x}%` }}>
        <div className={`mx-auto w-px bg-ink/70 ${norm % 15 === 0 ? "h-2.5" : "h-1.5"}`} />
        {norm % 15 === 0 && <div className={`num text-[10px] ${card ? "font-semibold text-ink" : "text-muted"}`}>{card ?? norm}</div>}
      </div>,
    );
  }
  return (
    <div className="relative mx-auto h-9 w-[min(560px,80vw)] overflow-hidden rounded bg-space/55">
      {ticks}
      {marks.map((m) => {
        const dd = angDiff(m.deg, heading);
        if (Math.abs(dd) > span / 2) return null;
        return <div key={m.label} className="absolute bottom-0 -translate-x-1/2 text-[10px] font-semibold" style={{ left: `${50 + (dd / span) * 100}%`, color: m.color }}>▼ {m.label}</div>;
      })}
      <div className="absolute left-1/2 top-0 h-full w-px bg-mars" />
      <div className="num absolute right-1 top-0.5 text-[11px] text-ink">{heading.toFixed(0).padStart(3, "0")}°</div>
    </div>
  );
}

function Gauge({ label, pct, text, tone }: { label: string; pct: number; text: string; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span className="text-muted">{label}</span><span className={`num ${tone}`}>{text}</span></div>
      <div className="mt-1 h-1.5 rounded-sm bg-line"><div className="h-full rounded-sm" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: "currentColor" }} /></div>
    </div>
  );
}

export function Hud() {
  const { region, error } = useRegion();
  const planner = usePlanner();
  const live = useLive(region, planner.plan?.routes ?? null, planner.env, planner.divert, true);
  const eva = useMission((s) => s.eva);
  const atmos = useMission((s) => s.atmos);
  const twin = useMission((s) => s.twin);
  const setTwin = useMission((s) => s.setTwin);
  const approved = useMission((s) => s.approvedPlan);
  const targetId = useMission((s) => s.targetId);
  const emergency = useMission((s) => s.emergency);
  const trigger = useMission((s) => s.triggerEmergency);
  const clearEmergency = useMission((s) => s.clearEmergency);
  const commMode = useMission((s) => s.commMode);
  const [images, setImages] = useState<Record<string, RoverImage[]>>({});
  const [imgIdx, setImgIdx] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    fetch("/data/jezero/images.json").then((r) => r.json()).then((d) => setImages(d.targets)).catch(() => setImages({}));
  }, []);

  const target = TARGETS.find((t) => t.id === (approved?.targetId ?? targetId)) ?? TARGETS[0];
  const imgs = images[target.id] ?? [];
  const img = imgs.length ? imgs[imgIdx % imgs.length] : null;
  const snap = live.snap;
  // until line of sight is computed, radio is unconfirmed: logs go to the local cache (safe default)
  const losReady = planner.env !== null;
  const online = commMode === "auto" ? losReady && (snap?.comm ?? false) : false;
  const atmo = assessAtmosphere(atmos);

  const nav = useMemo(() => {
    if (!region || !snap) return null;
    const tc = latLonToCell(region.meta, target.lat, target.lon);
    const distT = Math.hypot(tc.col - snap.col, tc.row - snap.row) * region.grid.cellSize;
    const brgT = bearing(snap.col, snap.row, tc.col, tc.row);
    let shelter = null;
    if (planner.env?.shelters.length) {
      const s = [...planner.env.shelters].sort((a, b) => Math.hypot(a.col - snap.col, a.row - snap.row) - Math.hypot(b.col - snap.col, b.row - snap.row))[0];
      shelter = { dist: Math.hypot(s.col - snap.col, s.row - snap.row) * region.grid.cellSize, brg: bearing(snap.col, snap.row, s.col, s.row), blocked: s.skyBlocked };
    }
    let divert = null;
    if (live.diversion?.plan.cells.length) {
      const end = live.diversion.plan.cells[live.diversion.plan.cells.length - 1];
      divert = { brg: bearing(snap.col, snap.row, end[0], end[1]), dist: live.diversion.plan.eva?.totals.distanceM ?? 0, dest: live.diversion.destination };
    }
    return { distT, brgT, shelter, divert };
  }, [region, snap, target, planner.env, live.diversion]);

  if (error) return <div className="p-8 text-critical">Failed to load terrain data: {error}</div>;
  if (!region) {
    return <div className="flex h-screen items-center justify-center gap-2 text-muted"><Loader2 className="animate-spin" size={16} /> Loading HUD…</div>;
  }

  const o2Tone = !snap ? "text-ink" : snap.bingoMarginL < 0 ? "text-critical" : snap.o2RemainingPct < 40 ? "text-caution" : "text-nominal";
  const doseSoFar = evaDose((snap?.elapsedMin ?? 0) / 60, atmos.solar === "sep" ? 10 : 1);
  const reticleOffset = nav && snap ? angDiff(nav.brgT, snap.headingDeg) : 999;
  const lowConfidence = snap && snap.uncertainty > 0.4;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-space">
      {/* first-person view: real rover image */}
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.large || img.medium} alt={img.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : <div className="absolute inset-0 flex items-center justify-center text-muted">Loading Perseverance imagery…</div>}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(11,12,14,0.75) 85%, rgba(11,12,14,0.95) 100%)" }} />

      <AppHeader />

      {/* top: compass + nav */}
      <div className="absolute inset-x-0 text-center" style={{ top: HEADER_H + 10 }}>
        {snap && nav && (
          <CompassTape heading={snap.headingDeg} marks={[
            { deg: nav.brgT, label: target.name, color: "#f0a37a" },
            ...(nav.shelter ? [{ deg: nav.shelter.brg, label: "Shelter", color: "#b8d2e6" }] : []),
          ]} />
        )}
        {snap && nav && (
          <div className="num mt-1 text-[12px] text-ink [text-shadow:0_1px_2px_#000]">
            {snap.arrived ? `At ${target.name}` : `${target.name} ${(nav.distT / 1000).toFixed(2)} km · bearing ${nav.brgT.toFixed(0)}°`} · route {live.routeKey} · {(snap.remainingM / 1000).toFixed(2)} km of route left · on approved track
          </div>
        )}
        {!approved && <div className="mt-1 text-[11px] text-caution [text-shadow:0_1px_2px_#000]">No plan approved by Mission Control yet — following the route selected there.</div>}
      </div>

      {/* AR reticle on the target when it is ahead */}
      {snap && Math.abs(reticleOffset) < 40 && (
        <button
          onClick={() => setShowChecklist((s) => !s)}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: `${50 + (reticleOffset / 40) * 30}%`, top: "46%" }}
        >
          <div className="mx-auto h-16 w-16 rounded-full border border-[#f0a37a]/90" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}>
            <div className="mx-auto mt-[31px] h-px w-4 bg-[#f0a37a]" />
          </div>
          <div className="mt-1 rounded bg-space/70 px-1.5 text-[11px] text-[#f0a37a]">{target.name} · tap for checklist</div>
        </button>
      )}
      {showChecklist && (
        <div className="panel absolute left-1/2 top-[56%] w-[360px] -translate-x-1/2 p-3 text-[12px]">
          <div className="flex justify-between"><span className="font-semibold">{target.name} — sampling checklist</span><button className="text-muted" onClick={() => setShowChecklist(false)}>close</button></div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">{target.samplingChecklist.map((c) => <li key={c}>{c}</li>)}</ol>
          <div className="label mt-2">Look for</div>
          <p className="text-muted">{target.findings[0]}</p>
          <div className="mt-1 text-[11px] text-faint">{target.provenance.productId}</div>
        </div>
      )}

      {/* left: suit & life support */}
      <div className="panel absolute w-[250px] space-y-2.5 p-3" style={{ top: HEADER_H + 70, left: 12 }}>
        <div className="label">Suit · EVA-1</div>
        <div className={o2Tone}>
          <div className="flex items-baseline justify-between"><span className="text-[11px] text-muted">O₂ tank</span><span className="num text-[26px] font-semibold leading-7">{snap ? snap.o2RemainingPct.toFixed(0) : "—"}%</span></div>
          <div className="mt-1 h-2 rounded-sm bg-line"><div className="h-full rounded-sm bg-current" style={{ width: `${snap?.o2RemainingPct ?? 0}%` }} /></div>
        </div>
        <div className="num space-y-0.5 text-[12px]">
          <div className="flex justify-between"><span className="font-sans text-muted">Consumption</span>{snap ? `${snap.o2RateLmin.toFixed(2)} L/min` : "—"}</div>
          <div className="flex justify-between"><span className="font-sans text-muted">Bingo margin</span><span className={snap && snap.bingoMarginL < 0 ? "text-critical" : ""}>{snap ? `${snap.bingoMarginL.toFixed(0)} L` : "—"}</span></div>
          <div className="flex justify-between"><span className="font-sans text-muted">Metabolic rate</span>{snap ? `${snap.metabolicW.toFixed(0)} W` : "—"}</div>
          <div className="flex justify-between"><span className="font-sans text-muted">Load carried</span>{eva.loadKg} kg</div>
          <div className="flex justify-between"><span className="font-sans text-muted">EVA time</span>{snap ? `${snap.elapsedMin.toFixed(0)} / ${(snap.totalMin * 2 + eva.obsMin).toFixed(0)} min` : "—"}</div>
        </div>
        {snap?.alerts.filter((a) => a.level === "critical").map((a) => <div key={a.text} className="rounded border border-critical/60 px-2 py-1 text-[12px] font-semibold text-critical">{a.text}</div>)}
        <div className="border-t border-line pt-2">
          <div className="label mb-1">Simulate emergency</div>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {([["solar", "Solar event"], ["dust", "Dust gust"], ["lowO2", "Low O₂"]] as [EmergencyKind, string][]).map(([k, l]) => (
              <button key={k} onClick={() => trigger(k)} className={`rounded border px-1 py-1 ${emergency?.kind === k ? "border-critical text-critical" : "border-line text-muted hover:text-ink"}`}>{l}</button>
            ))}
          </div>
          {emergency && (
            <div className="mt-2 text-[12px]">
              <div className="font-semibold text-critical">DIVERT {nav?.divert ? `→ ${nav.divert.dest}` : "…"}</div>
              {nav?.divert && <div className="num text-ink">{nav.divert.dist.toFixed(0)} m · bearing {nav.divert.brg.toFixed(0)}°</div>}
              <button onClick={clearEmergency} className="mt-1 text-[11px] text-muted underline">clear</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line pt-2 text-[12px]">
          <button
            onClick={() => setTwin(twin.playing ? { playing: false } : { playing: true, driver: TAB_ID, progress: twin.progress >= 1 ? 0 : twin.progress })}
            className="flex items-center gap-1 rounded border border-line px-2 py-0.5 hover:bg-white/5"
          >{twin.playing ? <Pause size={12} /> : <Play size={12} />}{twin.playing ? "Pause" : "Walk"}</button>
          <span className="text-faint">Mission Twin · {twin.speed}×</span>
        </div>
      </div>

      {/* right: terrain + environment */}
      <div className="panel absolute w-[250px] space-y-2.5 p-3" style={{ top: HEADER_H + 70, right: 12 }}>
        <div className="label">Terrain under foot</div>
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 rounded-full border border-line">
            <div className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 bg-ink" style={{ transform: `translate(-50%,0) rotate(${-(snap?.slopeDeg ?? 0)}deg)` }} />
          </div>
          <div>
            <div className="num text-[22px] font-semibold leading-6">{snap ? snap.slopeDeg.toFixed(1) : "—"}°</div>
            <div className="text-[11px] text-muted">slope · grade {snap ? snap.gradePct.toFixed(0) : "—"}%</div>
          </div>
        </div>
        <Gauge label="Footing / slip risk" pct={(snap?.roughness ?? 0) * 100} text={snap ? (snap.roughness > 0.6 ? "high" : snap.roughness > 0.3 ? "moderate" : "low") : "—"} tone={snap && snap.roughness > 0.6 ? "text-caution" : "text-ink"} />
        {lowConfidence ? (
          <div className="rounded border border-caution/60 px-2 py-1 text-[11px] text-caution">Map confidence low here (U {snap!.uncertainty.toFixed(2)}): obstacles under 5 m may be missing.</div>
        ) : (
          <div className="text-[11px] text-faint">Terrain from HiRISE DTM: 1 m native, 5 m grid (U {snap ? snap.uncertainty.toFixed(2) : "—"})</div>
        )}

        <div className="label border-t border-line pt-2">Environment</div>
        <div className="num space-y-0.5 text-[12px]">
          <div className="flex justify-between"><span className="font-sans text-muted">Go / no-go</span><span className={atmo.level === "GO" ? "text-nominal" : atmo.level === "CAUTION" ? "text-caution" : "text-critical"}>{atmo.level}</span></div>
          <div className="flex justify-between"><span className="font-sans text-muted">Dust opacity τ</span>{atmos.tau.toFixed(2)}</div>
          <div className="flex justify-between"><span className="font-sans text-muted">ΔP vs. tide</span>−{atmos.pressureDropPa} Pa</div>
          <div className="flex justify-between"><span className="font-sans text-muted">Peak gust</span>{atmos.gustMs} m/s</div>
          <div className="flex justify-between"><span className="font-sans text-muted">Space weather</span>{atmos.solar === "sep" ? "SEP event" : atmos.solar}</div>
          <div className="flex justify-between"><span className="font-sans text-muted">Dose this EVA</span>{doseSoFar.equivalentUSv.toFixed(0)} µSv</div>
          {nav?.shelter && <div className="flex justify-between"><span className="font-sans text-muted">Nearest shelter</span>{nav.shelter.dist.toFixed(0)} m · {nav.shelter.brg.toFixed(0)}°</div>}
        </div>
        <div className={`flex items-center gap-1.5 border-t border-line pt-2 text-[12px] ${online ? "text-nominal" : "text-caution"}`}>
          {online ? <RadioTower size={13} /> : <WifiOff size={13} />}
          {online ? "Radio line of sight to base" : commMode === "forced-offline" ? "Radio off (manual)" : !losReady ? "Checking radio line of sight…" : "Radio shadow — terrain blocks base"}
        </div>
      </div>

      {/* bottom-left: tactical map */}
      <div className="panel absolute overflow-hidden" style={{ left: 12, bottom: 12, width: 300, height: 230 }}>
        <div className="relative h-full w-full">
          <MapCanvas
            region={region}
            classes={null}
            routes={planner.plan?.routes ?? null}
            env={planner.env}
            markers={live.markers}
            divertCells={live.diversion?.plan.cells ?? null}
            focusCell={snap ? [snap.col, snap.row] : null}
            compact
          />
        </div>
      </div>

      {/* bottom-centre: image strip */}
      {imgs.length > 0 && (
        <div className="absolute bottom-3 left-1/2 w-[min(560px,40vw)] -translate-x-1/2">
          <div className="mb-1 rounded bg-space/75 px-2 py-1 text-[11px] leading-4">
            <span className="text-ink">{img ? CAM_LABEL[img.instrument] ?? img.instrument : ""}</span>
            <span className="text-muted"> · Perseverance sol {img?.sol} · {img?.mastAz !== "UNK" ? `az ${Number(img?.mastAz).toFixed(0)}°, el ${Number(img?.mastEl).toFixed(0)}°` : "arm/body camera"}</span>
            <div className="text-faint">
              Georeference: exact rover position at this target stop (not the astronaut&apos;s simulated position) · <a href={img?.link} target="_blank" rel="noreferrer" className="underline">{img?.imageid.slice(0, 26)}… ↗</a> · NASA/JPL-Caltech
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {imgs.map((im, i) => (
              <button key={im.imageid} onClick={() => setImgIdx(i)} className={`h-11 w-14 shrink-0 overflow-hidden rounded border ${i === imgIdx % imgs.length ? "border-ink" : "border-line opacity-70 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.small} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* bottom-right: field log */}
      <div className="panel absolute w-[300px]" style={{ right: 12, bottom: 12 }}>
        <FieldLogForm
          online={online}
          position={snap ? cellToLatLon(region.meta, snap.col, snap.row) : null}
          targetId={target.id}
        />
      </div>
    </div>
  );
}
