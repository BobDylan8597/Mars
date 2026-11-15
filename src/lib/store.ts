"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_EVA, EvaParams } from "@/lib/core/eva";
import { DEFAULT_SOI_WEIGHTS, SoiWeights } from "@/lib/core/soi";
import { AtmosInputs, DEFAULT_ATMOS } from "@/lib/core/atmosphere";

export type RouteKey = "A" | "B" | "C";
export type LayerId =
  | "ortho" | "hillshade" | "elevation" | "slope" | "roughness" | "classes" | "uncertainty"
  | "comm" | "shelters" | "rover" | "routes";

export interface LayerState { visible: boolean; opacity: number }

export interface FieldLog {
  id: string;
  targetId: string;
  title: string;
  description: string;
  /** simulated handheld spectrometer reading (free text, e.g. "Fe 18 %, P 2.1 %") */
  spectrometer: string;
  sampleTube: string;
  lat: number;
  lon: number;
  createdAt: string;
  /** "queued" = saved in the local offline cache while out of radio line-of-sight */
  status: "queued" | "synced";
  syncedAt?: string;
  author: "EVA-1" | "EVA-2";
}

export type EmergencyKind = "solar" | "dust" | "lowO2";

export interface TwinState {
  progress: number; // 0..1 along the outbound route
  playing: boolean;
  speed: 1 | 5 | 10 | 30;
  /** tab that drives the clock, so two open tabs do not double the speed */
  driver: string | null;
}

export interface MissionState {
  targetId: string;
  selectedRoute: RouteKey;
  sMax: number;
  eva: EvaParams;
  soiWeights: SoiWeights;
  layers: Record<LayerId, LayerState>;
  marsTint: boolean;
  antennaHeightM: number;
  atmos: AtmosInputs;
  approvedPlan: { route: RouteKey; targetId: string; at: string } | null;
  twin: TwinState;
  emergency: { kind: EmergencyKind; at: string } | null;
  /** manual radio override on the HUD: "auto" follows line-of-sight */
  commMode: "auto" | "forced-offline";
  logs: FieldLog[];
  setTarget: (id: string) => void;
  setRoute: (r: RouteKey) => void;
  setSMax: (v: number) => void;
  setEva: (p: Partial<EvaParams>) => void;
  setSoiWeights: (w: Partial<SoiWeights>) => void;
  setLayer: (id: LayerId, p: Partial<LayerState>) => void;
  setMarsTint: (v: boolean) => void;
  setAntennaHeight: (v: number) => void;
  setAtmos: (p: Partial<AtmosInputs>) => void;
  approvePlan: () => void;
  setTwin: (p: Partial<TwinState>) => void;
  triggerEmergency: (k: EmergencyKind) => void;
  clearEmergency: () => void;
  setCommMode: (m: "auto" | "forced-offline") => void;
  addLog: (l: FieldLog) => void;
  syncQueued: () => number;
}

export const DEFAULT_LAYERS: Record<LayerId, LayerState> = {
  ortho: { visible: true, opacity: 1 },
  hillshade: { visible: true, opacity: 0.35 },
  elevation: { visible: false, opacity: 0.55 },
  slope: { visible: false, opacity: 0.6 },
  roughness: { visible: false, opacity: 0.6 },
  classes: { visible: false, opacity: 0.5 },
  uncertainty: { visible: false, opacity: 0.6 },
  comm: { visible: false, opacity: 0.55 },
  shelters: { visible: false, opacity: 0.8 },
  rover: { visible: true, opacity: 1 },
  routes: { visible: true, opacity: 1 },
};

export const TAB_ID = typeof window !== "undefined" ? Math.random().toString(36).slice(2) : "server";
const CHANNEL = "mars-pathfinder-sync";
let applyingRemote = false;

export const useMission = create<MissionState>()(
  persist(
    (set, get) => ({
      targetId: "JZ-T1",
      selectedRoute: "B",
      sMax: 15,
      eva: DEFAULT_EVA,
      soiWeights: DEFAULT_SOI_WEIGHTS,
      layers: DEFAULT_LAYERS,
      marsTint: true,
      antennaHeightM: 10,
      atmos: DEFAULT_ATMOS,
      approvedPlan: null,
      twin: { progress: 0, playing: false, speed: 10, driver: null },
      emergency: null,
      commMode: "auto",
      logs: [],
      setTarget: (targetId) => set({ targetId }),
      setRoute: (selectedRoute) => set({ selectedRoute }),
      setSMax: (sMax) => set({ sMax }),
      setEva: (p) => set({ eva: { ...get().eva, ...p } }),
      setSoiWeights: (w) => set({ soiWeights: { ...get().soiWeights, ...w } }),
      setLayer: (id, p) => set({ layers: { ...get().layers, [id]: { ...get().layers[id], ...p } } }),
      setMarsTint: (marsTint) => set({ marsTint }),
      setAntennaHeight: (antennaHeightM) => set({ antennaHeightM }),
      setAtmos: (p) => set({ atmos: { ...get().atmos, ...p } }),
      approvePlan: () => set({
        approvedPlan: { route: get().selectedRoute, targetId: get().targetId, at: new Date().toISOString() },
        twin: { ...get().twin, progress: 0, playing: false },
      }),
      setTwin: (p) => set({ twin: { ...get().twin, ...p } }),
      triggerEmergency: (kind) => set({ emergency: { kind, at: new Date().toISOString() } }),
      clearEmergency: () => set({ emergency: null }),
      setCommMode: (commMode) => set({ commMode }),
      addLog: (l) => set({ logs: [l, ...get().logs] }),
      syncQueued: () => {
        const now = new Date().toISOString();
        let n = 0;
        const logs = get().logs.map((l) => (l.status === "queued" ? (n++, { ...l, status: "synced" as const, syncedAt: now }) : l));
        set({ logs });
        return n;
      },
    }),
    { name: "mars-pathfinder-mission-v3", version: 3 },
  ),
);

/** Cross-tab sync: Mission Control and the HUD stay identical in every open tab. */
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  const ch = new BroadcastChannel(CHANNEL);
  const pick = (s: MissionState) => ({
    targetId: s.targetId, selectedRoute: s.selectedRoute, sMax: s.sMax, eva: s.eva,
    soiWeights: s.soiWeights, layers: s.layers, marsTint: s.marsTint, antennaHeightM: s.antennaHeightM,
    atmos: s.atmos, approvedPlan: s.approvedPlan, twin: s.twin, emergency: s.emergency,
    commMode: s.commMode, logs: s.logs,
  });
  useMission.subscribe((s) => {
    if (applyingRemote) return;
    ch.postMessage(pick(s));
  });
  ch.onmessage = (e) => {
    applyingRemote = true;
    useMission.setState(e.data);
    applyingRemote = false;
  };
}
