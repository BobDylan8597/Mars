"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadRegion, Region } from "@/lib/data/region";
import type { EnvironmentModel, RoutePlan, ValidationRun } from "@/lib/plan";
import { RouteKey, useMission } from "@/lib/store";

export interface PlanState {
  routes: Record<RouteKey, RoutePlan>;
  classes: Uint8Array;
  classShare: number[];
}

let regionPromise: Promise<Region> | null = null;
export function useRegion() {
  const [region, setRegion] = useState<Region | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    regionPromise ??= loadRegion();
    regionPromise.then(setRegion).catch((e) => setError(String(e)));
  }, []);
  return { region, error };
}

export function usePlanner() {
  const sMax = useMission((s) => s.sMax);
  const eva = useMission((s) => s.eva);
  const targetId = useMission((s) => s.targetId);
  const antennaH = useMission((s) => s.antennaHeightM);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [env, setEnv] = useState<EnvironmentModel | null>(null);
  const [computing, setComputing] = useState(false);
  const [verification, setVerification] = useState<ValidationRun[] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const lastReq = useRef(0);
  const pending = useRef(new Map<number, (p: RoutePlan) => void>());
  const nextDivert = useRef(1000);

  useEffect(() => {
    const w = new Worker(new URL("./plan.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "error") { setError(m.message); setComputing(false); setVerifying(false); return; }
      if (m.type === "plan" && m.reqId === lastReq.current) {
        setPlan({ routes: m.routes, classes: m.classes, classShare: m.classShare });
        setComputing(false);
        setError(null);
      }
      if (m.type === "verify") { setVerification(m.runs); setVerifying(false); }
      if (m.type === "env") setEnv(m.env);
      if (m.type === "divert") {
        const cb = pending.current.get(m.reqId);
        pending.current.delete(m.reqId);
        cb?.(m.plan);
      }
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!worker.current) return;
      const reqId = ++lastReq.current;
      setComputing(true);
      setVerification(null);
      worker.current.postMessage({ type: "plan", reqId, sMax, eva, targetId });
    }, 250);
    return () => clearTimeout(id);
  }, [sMax, eva, targetId]);

  useEffect(() => {
    const id = setTimeout(() => worker.current?.postMessage({ type: "env", reqId: 0, sMax, antennaH }), 300);
    return () => clearTimeout(id);
  }, [sMax, antennaH]);

  const verify = useCallback(() => {
    if (!worker.current) return;
    setVerifying(true);
    worker.current.postMessage({ type: "verify", reqId: -1, sMax, targetId });
  }, [sMax, targetId]);

  const divert = useCallback((from: [number, number], to: [number, number]) => new Promise<RoutePlan>((resolve) => {
    const reqId = nextDivert.current++;
    pending.current.set(reqId, resolve);
    worker.current?.postMessage({ type: "divert", reqId, sMax, eva, from, to });
  }), [sMax, eva]);

  return { plan, env, computing, error, verification, verifying, verify, divert };
}
