"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { DEM_PROVENANCE } from "@/lib/data/targets";
import { useMission } from "@/lib/store";

export const HEADER_H = 44;

export function AppHeader() {
  const path = usePathname();
  const logs = useMission((s) => s.logs);
  const synced = logs.filter((l) => l.status === "synced").length;
  const queued = logs.length - synced;
  const approved = useMission((s) => s.approvedPlan);
  const links = [
    { href: "/mission-control", label: "Mission Control" },
    { href: "/hud", label: "Astronaut HUD" },
  ];
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-4 border-b border-line bg-space/92 px-4" style={{ height: HEADER_H }}>
      <div className="flex items-baseline gap-2">
        <span className="font-semibold tracking-wide">Mars Pathfinder</span>
        <span className="hidden text-muted sm:inline">EVA planning</span>
      </div>
      <span className="h-4 w-px bg-line" />
      <nav className="flex items-center gap-4 text-[12px]">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "border-b border-ink pb-0.5 text-ink" : "pb-0.5 text-muted hover:text-ink"}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4 text-[12px] text-muted">
        <span className="hidden md:inline">
          Plan: {approved ? <span className="text-nominal">route {approved.route} sent to HUD</span> : <span>not yet approved</span>}
        </span>
        <span>Field logs: <span className="num text-ink">{synced}</span> synced{queued > 0 && <span className="text-caution"> · {queued} queued</span>}</span>
        <span className="hidden lg:inline">Jezero crater · 18.49°N 77.32°E</span>
        <ProvenanceBadge p={DEM_PROVENANCE} />
      </div>
    </header>
  );
}
