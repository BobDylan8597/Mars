"use client";
import { TARGETS } from "@/lib/data/targets";
import { useMission } from "@/lib/store";

export function FieldLogList() {
  const logs = useMission((s) => s.logs);
  if (logs.length === 0) {
    return (
      <p className="leading-[1.55] text-muted">
        No field logs yet. Observations recorded on the Astronaut HUD appear here as soon as the crew has radio line of sight; entries made in a radio shadow wait in the suit&apos;s local cache until they are synced.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="rounded border border-line p-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{l.title}</span>
            <span className={`text-[11px] ${l.status === "synced" ? "text-nominal" : "text-caution"}`}>{l.status === "synced" ? "synced" : "queued on suit"}</span>
          </div>
          <div className="num text-[11px] text-faint">
            {l.author} · {TARGETS.find((t) => t.id === l.targetId)?.name ?? l.targetId} · {new Date(l.createdAt).toLocaleTimeString()} · {l.lat.toFixed(5)}°N {l.lon.toFixed(5)}°E
          </div>
          {l.description && <p className="mt-1 text-[12px] leading-[1.45]">{l.description}</p>}
          <div className="num mt-1 text-[11px] text-muted">
            {l.spectrometer && <>Spectrometer: {l.spectrometer}</>}{l.sampleTube && <> · Tube {l.sampleTube}</>}
          </div>
        </li>
      ))}
    </ul>
  );
}
