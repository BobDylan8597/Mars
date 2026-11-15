"use client";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_ATMOS } from "@/lib/core/atmosphere";
import { TAB_ID, useMission } from "@/lib/store";

interface Step {
  title: string;
  page: "/mission-control" | "/hud";
  say: string;
  run: () => void;
}

const S = () => useMission.getState();

/** Six-step, three-minute pitch walkthrough. Each step sets the app state; the text is what to say. */
export const STEPS: Step[] = [
  {
    title: "Choose the science targets",
    page: "/mission-control",
    say: "Cheyava Falls, Perseverance's potential biosignature, is our primary target. Below it, the challenge's own example: Curiosity's 2025 boxwork ridges on Mount Sharp.",
    run: () => { S().setTarget("JZ-T1"); S().setMcTab("targets"); S().setLayer("slope", { visible: false }); },
  },
  {
    title: "Real NASA layers and the Science Opportunity Index",
    page: "/mission-control",
    say: "Every layer comes from a NASA or USGS product: HiRISE 1 m terrain, the orthoimage, Perseverance's real path. Our slope agrees with the rover's own tilt to 1.6°.",
    run: () => { S().setMcTab("layers"); S().setLayer("slope", { visible: true, opacity: 0.55 }); },
  },
  {
    title: "Pre-EVA weather check and suit load",
    page: "/mission-control",
    say: "Before leaving the habitat the crew runs the go/no-go rules on MEDA weather and NASA space-weather alerts, and sets the load they will carry.",
    run: () => { S().setLayer("slope", { visible: false }); S().setAtmos(DEFAULT_ATMOS); S().setMcTab("env"); },
  },
  {
    title: "Compare routes A, B and C",
    page: "/mission-control",
    say: "A* searches 640,000 terrain cells. The shortest route climbs steeper ground; the safe route keeps the slope low for about the same oxygen. Dijkstra confirms A* is optimal.",
    run: () => { S().setMcTab("eva"); S().setRoute("B"); },
  },
  {
    title: "Approve the plan and run the Mission Twin",
    page: "/mission-control",
    say: "Mission Control approves route B and sends it to the suit. The twin walks the crew out, updating oxygen, slope and radio coverage live.",
    run: () => { S().setMcTab("targets"); S().approvePlan(); S().setTwin({ progress: 0, playing: true, speed: 30, driver: TAB_ID }); },
  },
  {
    title: "On the surface: the Astronaut HUD",
    page: "/hud",
    say: "At Cheyava Falls the canyon walls block the radio. The geologist logs a sample anyway, it waits on the suit, and syncs to Mission Control once line of sight returns. The assistant separates NASA data from models.",
    run: () => { S().setTwin({ progress: 1, playing: false }); },
  },
];

export function GuidedDemo() {
  const step = useMission((s) => s.demoStep);
  const setStep = useMission((s) => s.setDemoStep);
  const router = useRouter();
  const path = usePathname();

  const go = (i: number) => {
    const st = STEPS[i];
    setStep(i);
    st.run();
    if (path !== st.page) router.push(st.page);
  };

  if (step === null) {
    return (
      <button onClick={() => go(0)} className="rounded border border-ink/50 px-2 py-0.5 text-[12px] text-ink hover:bg-white/5">
        Guided demo
      </button>
    );
  }
  const st = STEPS[step];
  return (
    <div className="fixed top-[52px] left-1/2 z-50 w-[min(640px,92vw)] -translate-x-1/2 rounded border border-ink/40 bg-panel-2/97 p-3 shadow-2xl">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted">Guided demo · step {step + 1} of {STEPS.length}</span>
        <button onClick={() => setStep(null)} className="text-[11px] text-muted hover:text-ink">exit</button>
      </div>
      <div className="mt-0.5 text-[14px] font-semibold">{st.title}</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted">{st.say}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-sm ${i <= step ? "bg-ink" : "bg-line"}`} />)}
        </div>
        <button onClick={() => go(step - 1)} disabled={step === 0} className="rounded border border-line px-2 py-0.5 text-[12px] disabled:opacity-30">Back</button>
        {step < STEPS.length - 1
          ? <button onClick={() => go(step + 1)} className="rounded border border-ink/60 px-2 py-0.5 text-[12px] hover:bg-white/5">Next</button>
          : <button onClick={() => setStep(null)} className="rounded border border-ink/60 px-2 py-0.5 text-[12px] hover:bg-white/5">Finish</button>}
      </div>
    </div>
  );
}
