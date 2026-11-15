"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_EVA, EvaParams } from "@/lib/core/eva";
import { DEFAULT_SOI_WEIGHTS, SoiWeights } from "@/lib/core/soi";

export type RouteKey = "A" | "B" | "C";
export type LayerId = "ortho" | "hillshade" | "elevation" | "slope" | "roughness" | "classes" | "uncertainty" | "rover" | "routes";

export interface LayerState { visible: boolean; opacity: number }

export interface MissionState {
  targetId: string;
  selectedRoute: RouteKey;
  sMax: number;
  eva: EvaParams;
  soiWeights: SoiWeights;
  layers: Record<LayerId, LayerState>;
  /** set when Mission Control approves a plan and sends it to the HUD */
  approvedPlan: { route: RouteKey; targetId: string; at: string } | null;
  setTarget: (id: string) => void;
  setRoute: (r: RouteKey) => void;
  setSMax: (v: number) => void;
  setEva: (p: Partial<EvaParams>) => void;
  setSoiWeights: (w: Partial<SoiWeights>) => void;
  setLayer: (id: LayerId, p: Partial<LayerState>) => void;
  approvePlan: () => void;
}

export const DEFAULT_LAYERS: Record<LayerId, LayerState> = {
  ortho: { visible: true, opacity: 1 },
  hillshade: { visible: true, opacity: 0.35 },
  elevation: { visible: false, opacity: 0.55 },
  slope: { visible: false, opacity: 0.6 },
  roughness: { visible: false, opacity: 0.6 },
  classes: { visible: true, opacity: 0.35 },
  uncertainty: { visible: false, opacity: 0.6 },
  rover: { visible: true, opacity: 1 },
  routes: { visible: true, opacity: 1 },
};

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
      approvedPlan: null,
      setTarget: (targetId) => set({ targetId }),
      setRoute: (selectedRoute) => set({ selectedRoute }),
      setSMax: (sMax) => set({ sMax }),
      setEva: (p) => set({ eva: { ...get().eva, ...p } }),
      setSoiWeights: (w) => set({ soiWeights: { ...get().soiWeights, ...w } }),
      setLayer: (id, p) => set({ layers: { ...get().layers, [id]: { ...get().layers[id], ...p } } }),
      approvePlan: () => set({ approvedPlan: { route: get().selectedRoute, targetId: get().targetId, at: new Date().toISOString() } }),
    }),
    { name: "mars-pathfinder-mission", version: 1 },
  ),
);

/** Cross-tab sync: Mission Control and the HUD stay identical in every open tab. */
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  const ch = new BroadcastChannel(CHANNEL);
  const pick = (s: MissionState) => ({
    targetId: s.targetId, selectedRoute: s.selectedRoute, sMax: s.sMax, eva: s.eva,
    soiWeights: s.soiWeights, layers: s.layers, approvedPlan: s.approvedPlan,
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
