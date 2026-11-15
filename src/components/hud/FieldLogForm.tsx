"use client";
import { useState } from "react";
import { useMission } from "@/lib/store";

export function FieldLogForm({ online, position, targetId }: { online: boolean; position: { lat: number; lon: number } | null; targetId: string }) {
  const addLog = useMission((s) => s.addLog);
  const syncQueued = useMission((s) => s.syncQueued);
  const logs = useMission((s) => s.logs);
  const commMode = useMission((s) => s.commMode);
  const setCommMode = useMission((s) => s.setCommMode);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [spec, setSpec] = useState("");
  const [tube, setTube] = useState("");
  const [author, setAuthor] = useState<"EVA-1" | "EVA-2">("EVA-1");
  const [flash, setFlash] = useState<string | null>(null);
  const queued = logs.filter((l) => l.status === "queued").length;

  const save = () => {
    if (!title.trim() || !position) return;
    addLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      targetId, title: title.trim(), description: desc.trim(), spectrometer: spec.trim(), sampleTube: tube.trim(),
      lat: position.lat, lon: position.lon, createdAt: new Date().toISOString(),
      status: online ? "synced" : "queued", syncedAt: online ? new Date().toISOString() : undefined, author,
    });
    setTitle(""); setDesc(""); setSpec(""); setTube("");
    setFlash(online ? "Sent to Mission Control" : "Saved to suit cache (offline)");
    setTimeout(() => setFlash(null), 2500);
  };

  const input = "w-full rounded border border-line bg-space/70 px-2 py-1 text-[12px] outline-none focus:border-muted";
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Scientific field log</span>
        <label className="flex items-center gap-1 text-[11px] text-muted">
          <input type="checkbox" checked={commMode === "forced-offline"} onChange={() => setCommMode(commMode === "auto" ? "forced-offline" : "auto")} className="h-3 w-3 accent-[#9aa0a8]" />
          force radio off
        </label>
      </div>
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <input className={input} placeholder="Observation title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={`${input} w-[76px]`} value={author} onChange={(e) => setAuthor(e.target.value as "EVA-1" | "EVA-2")}>
            <option>EVA-1</option><option>EVA-2</option>
          </select>
        </div>
        <textarea className={`${input} h-12 resize-none`} placeholder="Geological description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex gap-1.5">
          <input className={input} placeholder="Handheld spectrometer (simulated)" value={spec} onChange={(e) => setSpec(e.target.value)} />
          <input className={`${input} w-[84px]`} placeholder="Tube ID" value={tube} onChange={(e) => setTube(e.target.value)} />
        </div>
        <div className="num text-[10px] text-faint">{position ? `${position.lat.toFixed(5)}°N ${position.lon.toFixed(5)}°E · ${new Date().toLocaleTimeString()}` : "position unknown"}</div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!title.trim() || !position} className="rounded border border-ink/60 px-2 py-1 text-[12px] hover:bg-white/5 disabled:opacity-40">
            {online ? "Save & send" : "Save offline"}
          </button>
          <button
            onClick={() => { const n = syncQueued(); setFlash(`${n} log${n === 1 ? "" : "s"} synced to Mission Control`); setTimeout(() => setFlash(null), 2500); }}
            disabled={!online || queued === 0}
            className="rounded border border-line px-2 py-1 text-[12px] text-muted hover:text-ink disabled:opacity-40"
            title={online ? "" : "Needs radio line of sight"}
          >
            Sync {queued} queued
          </button>
        </div>
        {flash && <div className="text-[11px] text-nominal">{flash}</div>}
      </div>
    </div>
  );
}
