"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadRegion, Region } from "@/lib/data/region";
import type { RoutePlan, ValidationRun } from "@/lib/plan";
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
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [computing, setComputing] = useState(false);
  const [verification, setVerification] = useState<ValidationRun[] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const lastReq = useRef(0);

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

  const verify = useCallback(() => {
    if (!worker.current) return;
    setVerifying(true);
    worker.current.postMessage({ type: "verify", reqId: -1, sMax, targetId });
  }, [sMax, targetId]);

  return { plan, computing, error, verification, verifying, verify };
}
