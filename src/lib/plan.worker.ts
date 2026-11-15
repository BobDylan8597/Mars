/// <reference lib="webworker" />
import type { EvaParams } from "@/lib/core/eva";
import { loadRegion, Region } from "@/lib/data/region";
import {
  buildEnvironment, buildTerrainModel, divert, EnvironmentModel, planRoutes, snapToTraversable, TerrainModel, verifyWithDijkstra,
} from "@/lib/plan";

export type WorkerRequest =
  | { type: "plan"; reqId: number; sMax: number; eva: EvaParams; targetId: string }
  | { type: "verify"; reqId: number; sMax: number; targetId: string }
  | { type: "env"; reqId: number; sMax: number; antennaH: number }
  | { type: "divert"; reqId: number; sMax: number; eva: EvaParams; from: [number, number]; to: [number, number] };

let regionP: Promise<Region> | null = null;
let cached: { sMax: number; model: TerrainModel } | null = null;
let envCache: { key: string; env: EnvironmentModel } | null = null;

async function model(sMax: number) {
  regionP ??= loadRegion();
  const region = await regionP;
  if (!cached || cached.sMax !== sMax) cached = { sMax, model: buildTerrainModel(region, sMax) };
  return { region, t: cached.model };
}

const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    const { region, t } = await model(msg.sMax);
    const w = region.grid.width;
    if (msg.type === "plan") {
      const routes = planRoutes(region, t, msg.targetId, msg.eva);
      const classes = t.classes.slice();
      post({ type: "plan", reqId: msg.reqId, routes, classes, classShare: t.classShare }, [classes.buffer]);
    } else if (msg.type === "verify") {
      post({ type: "verify", reqId: msg.reqId, runs: verifyWithDijkstra(region, t, msg.targetId) });
    } else if (msg.type === "env") {
      const key = `${msg.sMax}:${msg.antennaH}`;
      if (!envCache || envCache.key !== key) envCache = { key, env: buildEnvironment(region, t, msg.antennaH) };
      post({ type: "env", reqId: msg.reqId, env: envCache.env });
    } else if (msg.type === "divert") {
      const from = snapToTraversable(t, msg.from[0], msg.from[1]);
      const to = snapToTraversable(t, msg.to[0], msg.to[1]);
      const plan = divert(region, t, from, to, msg.eva);
      void w;
      post({ type: "divert", reqId: msg.reqId, plan });
    }
  } catch (err) {
    post({ type: "error", reqId: msg.reqId, message: String(err) });
  }
};
