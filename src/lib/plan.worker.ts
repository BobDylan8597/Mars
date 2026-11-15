/// <reference lib="webworker" />
import type { EvaParams } from "@/lib/core/eva";
import { loadRegion, Region } from "@/lib/data/region";
import { buildTerrainModel, planRoutes, TerrainModel, verifyWithDijkstra } from "@/lib/plan";

export type WorkerRequest =
  | { type: "plan"; reqId: number; sMax: number; eva: EvaParams; targetId: string }
  | { type: "verify"; reqId: number; sMax: number; targetId: string };

let regionP: Promise<Region> | null = null;
let cached: { sMax: number; model: TerrainModel } | null = null;

async function model(sMax: number) {
  regionP ??= loadRegion();
  const region = await regionP;
  if (!cached || cached.sMax !== sMax) cached = { sMax, model: buildTerrainModel(region, sMax) };
  return { region, t: cached.model };
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    const { region, t } = await model(msg.sMax);
    if (msg.type === "plan") {
      const routes = planRoutes(region, t, msg.targetId, msg.eva);
      const classes = t.classes.slice();
      (self as unknown as Worker).postMessage(
        { type: "plan", reqId: msg.reqId, routes, classes, classShare: t.classShare },
        [classes.buffer],
      );
    } else {
      const runs = verifyWithDijkstra(region, t, msg.targetId);
      (self as unknown as Worker).postMessage({ type: "verify", reqId: msg.reqId, runs });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: "error", reqId: msg.reqId, message: String(err) });
  }
};
