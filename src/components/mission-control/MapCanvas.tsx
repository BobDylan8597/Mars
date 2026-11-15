"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { TERRAIN_CLASS_LABEL, TerrainClass } from "@/lib/core/terrain";
import { cellToLatLon, latLonToCell, Region } from "@/lib/data/region";
import { BASE_SITE, TARGETS } from "@/lib/data/targets";
import {
  classesImage, elevationImage, hillshade, roughnessImage, slopeImage, uncertaintyImage,
} from "@/lib/render";
import type { RoutePlan } from "@/lib/plan";
import { LayerId, RouteKey, useMission } from "@/lib/store";

export const ROUTE_COLORS: Record<RouteKey, string> = { A: "#FF5722", B: "#10B981", C: "#00F0FF" };

interface Props {
  region: Region;
  classes: Uint8Array | null;
  routes: Record<RouteKey, RoutePlan> | null;
  /** optional live marker (Mission Twin / HUD) in grid cells */
  marker?: { col: number; row: number; label: string } | null;
}

type View = { scale: number; x: number; y: number };

function makeCanvas(img: ImageData) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c;
}

export function MapCanvas({ region, classes, routes, marker }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ col: number; row: number; x: number; y: number } | null>(null);
  const [ortho, setOrtho] = useState<HTMLImageElement | null>(null);
  const [orthoMissing, setOrthoMissing] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const layers = useMission((s) => s.layers);
  const selectedRoute = useMission((s) => s.selectedRoute);
  const targetId = useMission((s) => s.targetId);
  const W = region.grid.width, H = region.grid.height;

  const rasters = useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      hillshade: makeCanvas(hillshade(region)),
      elevation: makeCanvas(elevationImage(region)),
      slope: makeCanvas(slopeImage(region)),
      roughness: makeCanvas(roughnessImage(region)),
      uncertainty: makeCanvas(uncertaintyImage(region)),
    };
  }, [region]);
  const classCanvas = useMemo(() => (classes ? makeCanvas(classesImage(W, H, classes)) : null), [classes, W, H]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setOrtho(img);
    img.onerror = () => setOrthoMissing(true);
    img.src = region.orthoUrl;
  }, [region.orthoUrl]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const scale = Math.min(size.w / W, size.h / H);
    setView({ scale, x: (size.w - W * scale) / 2, y: (size.h - H * scale) / 2 });
  }, [size, W, H]);
  useEffect(() => { if (!view && size.w > 0) fit(); }, [size, view, fit]);

  // draw
  useEffect(() => {
    const c = canvas.current;
    if (!c || !view || !rasters) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#07090E";
    g.fillRect(0, 0, size.w, size.h);
    g.save();
    g.translate(view.x, view.y);
    g.scale(view.scale, view.scale);
    g.imageSmoothingEnabled = view.scale < 2;

    const drawLayer = (id: LayerId, src: CanvasImageSource | null | undefined) => {
      const L = layers[id];
      if (!L?.visible || !src) return;
      g.globalAlpha = L.opacity;
      g.drawImage(src, 0, 0, W, H);
    };
    drawLayer("ortho", ortho);
    if (!ortho || !layers.ortho.visible) {
      g.globalAlpha = 1; g.drawImage(rasters.hillshade, 0, 0, W, H);
    }
    drawLayer("elevation", rasters.elevation);
    drawLayer("hillshade", rasters.hillshade);
    drawLayer("slope", rasters.slope);
    drawLayer("roughness", rasters.roughness);
    drawLayer("uncertainty", rasters.uncertainty);
    g.imageSmoothingEnabled = false;
    drawLayer("classes", classCanvas);
    g.globalAlpha = 1;

    const lw = (px: number) => px / view.scale;

    if (layers.rover.visible) {
      g.globalAlpha = layers.rover.opacity;
      g.strokeStyle = "#e2e8f0";
      g.lineWidth = lw(1.5);
      g.setLineDash([lw(4), lw(3)]);
      g.beginPath();
      region.rover.forEach((p, k) => (k === 0 ? g.moveTo(p.col + 0.5, p.row + 0.5) : g.lineTo(p.col + 0.5, p.row + 0.5)));
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }

    if (routes && layers.routes.visible) {
      g.globalAlpha = layers.routes.opacity;
      const order: RouteKey[] = (["A", "B", "C"] as RouteKey[]).filter((k) => k !== selectedRoute).concat(selectedRoute);
      for (const k of order) {
        const r = routes[k];
        if (!r.cells.length) continue;
        const sel = k === selectedRoute;
        g.strokeStyle = ROUTE_COLORS[k];
        g.lineWidth = lw(sel ? 4 : 2);
        g.globalAlpha = layers.routes.opacity * (sel ? 1 : 0.55);
        g.beginPath();
        r.cells.forEach(([cc, rr], i) => (i === 0 ? g.moveTo(cc + 0.5, rr + 0.5) : g.lineTo(cc + 0.5, rr + 0.5)));
        g.stroke();
        if (sel && r.eva && r.eva.bingoIndex > 0) {
          const [bc, br] = r.cells[r.eva.bingoIndex];
          g.fillStyle = "#EF4444";
          g.beginPath(); g.arc(bc + 0.5, br + 0.5, lw(7), 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1;
    }

    // markers
    const label = (text: string, x: number, y: number, color: string) => {
      g.font = `${lw(12)}px var(--font-geist-mono), monospace`;
      const m = g.measureText(text);
      g.fillStyle = "rgba(7,9,14,0.8)";
      g.fillRect(x + lw(8), y - lw(9), m.width + lw(8), lw(16));
      g.fillStyle = color;
      g.fillText(text, x + lw(12), y + lw(3));
    };
    const b = latLonToCell(region.meta, BASE_SITE.lat, BASE_SITE.lon);
    g.fillStyle = "#e2e8f0"; g.strokeStyle = "#07090E"; g.lineWidth = lw(2);
    g.fillRect(b.col - lw(6), b.row - lw(6), lw(12), lw(12));
    g.strokeRect(b.col - lw(6), b.row - lw(6), lw(12), lw(12));
    label("BASE-1", b.col, b.row, "#e2e8f0");
    for (const t of TARGETS.filter((x) => x.region === "jezero")) {
      const p = latLonToCell(region.meta, t.lat, t.lon);
      const sel = t.id === targetId;
      g.save();
      g.translate(p.col + 0.5, p.row + 0.5);
      g.rotate(Math.PI / 4);
      g.fillStyle = sel ? "#FF5722" : "#F59E0B";
      g.fillRect(-lw(7), -lw(7), lw(14), lw(14));
      g.strokeStyle = "#07090E"; g.lineWidth = lw(2);
      g.strokeRect(-lw(7), -lw(7), lw(14), lw(14));
      g.restore();
      label(`${t.id} ${t.name}`, p.col, p.row, sel ? "#FF5722" : "#F59E0B");
    }
    if (marker) {
      g.fillStyle = "#00F0FF";
      g.beginPath(); g.arc(marker.col + 0.5, marker.row + 0.5, lw(8), 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#07090E"; g.lineWidth = lw(2); g.stroke();
      label(marker.label, marker.col, marker.row, "#00F0FF");
    }
    g.restore();

    // scale bar
    const targetPx = 120;
    const metres = (targetPx / view.scale) * region.grid.cellSize;
    const nice = [50, 100, 200, 250, 500, 1000, 2000].reduce((a, v) => (Math.abs(v - metres) < Math.abs(a - metres) ? v : a));
    const px = (nice / region.grid.cellSize) * view.scale;
    g.fillStyle = "rgba(7,9,14,0.75)";
    g.fillRect(12, size.h - 34, px + 70, 24);
    g.fillStyle = "#e2e8f0";
    g.fillRect(20, size.h - 20, px, 3);
    g.font = "11px var(--font-geist-mono), monospace";
    g.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 26 + px, size.h - 16);
  }, [view, size, rasters, ortho, classCanvas, layers, routes, selectedRoute, targetId, region, marker, W, H]);

  const toCell = (x: number, y: number) => (view ? { col: Math.floor((x - view.x) / view.scale), row: Math.floor((y - view.y) / view.scale) } : null);

  const zoomAt = (factor: number, x: number, y: number) => {
    setView((v) => {
      if (!v) return v;
      const scale = Math.max(0.3, Math.min(40, v.scale * factor));
      const f = scale / v.scale;
      return { scale, x: x - (x - v.x) * f, y: y - (y - v.y) * f };
    });
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  const hoverInfo = useMemo(() => {
    if (!hover) return null;
    const { col, row } = hover;
    if (col < 0 || row < 0 || col >= W || row >= H) return null;
    const i = row * W + col;
    const { lat, lon } = cellToLatLon(region.meta, col, row);
    return {
      lat, lon, z: region.grid.z[i], s: region.slope[i], r: region.roughness[i], u: region.uncertainty[i],
      cls: classes ? (classes[i] as TerrainClass) : null,
    };
  }, [hover, region, classes, W, H]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden rounded-[10px] border border-line bg-space">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h, cursor: drag.current ? "grabbing" : "crosshair" }}
        onPointerDown={(e) => {
          if (!view) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          const x = e.clientX - r.left, y = e.clientY - r.top;
          if (drag.current && view) {
            const d = drag.current;
            setView({ ...view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
          }
          const cell = toCell(x, y);
          setHover(cell ? { ...cell, x, y } : null);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { setHover(null); }}
      />
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button className="panel p-1.5 hover:text-hud" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)} aria-label="Zoom in"><ZoomIn size={16} /></button>
        <button className="panel p-1.5 hover:text-hud" onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)} aria-label="Zoom out"><ZoomOut size={16} /></button>
        <button className="panel p-1.5 hover:text-hud" onClick={fit} aria-label="Fit map"><Maximize2 size={16} /></button>
      </div>
      {orthoMissing && (
        <div className="absolute left-3 top-3 rounded bg-space/80 px-2 py-1 text-[11px] text-caution">
          HiRISE orthoimage not available — showing DTM hillshade
        </div>
      )}
      {hoverInfo && (
        <div className="num pointer-events-none absolute bottom-3 right-3 rounded-lg border border-line bg-space/90 px-3 py-2 text-[11px] leading-5">
          <div>{hoverInfo.lat.toFixed(5)}°N {hoverInfo.lon.toFixed(5)}°E</div>
          <div>Elev {Number.isFinite(hoverInfo.z) ? hoverInfo.z.toFixed(1) : "—"} m · Slope {Number.isFinite(hoverInfo.s) ? hoverInfo.s.toFixed(1) : "—"}°</div>
          <div>Rough {Number.isFinite(hoverInfo.r) ? hoverInfo.r.toFixed(2) : "—"} · U {hoverInfo.u.toFixed(2)}</div>
          {hoverInfo.cls !== null && <div className="text-hud">{TERRAIN_CLASS_LABEL[hoverInfo.cls]}</div>}
        </div>
      )}
    </div>
  );
}
