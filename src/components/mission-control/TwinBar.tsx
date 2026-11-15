"use client";
import Link from "next/link";
import { Pause, Play, RotateCcw, Send } from "lucide-react";
import type { TwinSnapshot } from "@/lib/twin";
import { TAB_ID, useMission } from "@/lib/store";

const SPEEDS = [1, 5, 10, 30] as const;

export function TwinBar({ snap }: { snap: TwinSnapshot | null }) {
  const twin = useMission((s) => s.twin);
  const setTwin = useMission((s) => s.setTwin);
  const approve = useMission((s) => s.approvePlan);
  const approved = useMission((s) => s.approvedPlan);
  const route = useMission((s) => s.selectedRoute);
  const targetId = useMission((s) => s.targetId);
  const isCurrent = approved && approved.route === route && approved.targetId === targetId;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2 text-[12px]">
      <span className="font-semibold">Mission Twin</span>
      <button
        onClick={() => setTwin(twin.playing ? { playing: false } : { playing: true, driver: TAB_ID, progress: twin.progress >= 1 ? 0 : twin.progress })}
        className="flex items-center gap-1 rounded border border-line px-2 py-0.5 hover:bg-white/5"
        disabled={!snap}
      >
        {twin.playing ? <Pause size={12} /> : <Play size={12} />} {twin.playing ? "Pause" : "Play"}
      </button>
      <button onClick={() => setTwin({ progress: 0, playing: false })} className="text-muted hover:text-ink" aria-label="Restart"><RotateCcw size={13} /></button>
      <div className="flex overflow-hidden rounded border border-line">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setTwin({ speed: s })} className={`px-1.5 py-0.5 text-[11px] ${twin.speed === s ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>
            {s}×
          </button>
        ))}
      </div>
      <input
        type="range" min={0} max={1000} value={Math.round(twin.progress * 1000)}
        onChange={(e) => setTwin({ progress: Number(e.target.value) / 1000, playing: false })}
        className="w-40 min-w-24 flex-1" aria-label="Twin timeline"
      />
      {snap && (
        <span className="num text-muted">
          T+{snap.elapsedMin.toFixed(0)}/{snap.totalMin.toFixed(0)} min · {(snap.remainingM / 1000).toFixed(2)} km to go · O₂ {snap.o2RemainingPct.toFixed(0)}% ·{" "}
          <span className={snap.comm ? "text-nominal" : "text-caution"}>{snap.comm ? "radio OK" : "radio shadow"}</span>
          {snap.alerts.some((a) => a.level === "critical") && <span className="text-critical"> · BINGO</span>}
        </span>
      )}
      <span className="text-faint">1× = 1 simulated min/s</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={approve}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${isCurrent ? "border-nominal/60 text-nominal" : "border-ink/60 text-ink hover:bg-white/5"}`}
        >
          <Send size={12} /> {isCurrent ? "Plan sent to HUD" : `Approve route ${route} & send to HUD`}
        </button>
        <Link href="/hud" target="_blank" className="text-muted underline-offset-2 hover:text-ink hover:underline">Open HUD ↗</Link>
      </div>
    </div>
  );
}
