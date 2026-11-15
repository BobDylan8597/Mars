"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { TERRAIN_CLASS_LABEL, TerrainClass } from "@/lib/core/terrain";
import { cellToLatLon, latLonToCell, Region } from "@/lib/data/region";
import { BASE_SITE, TARGETS } from "@/lib/data/targets";
import {
  classesImage, elevationImage, hillshade, roughnessImage, slopeImage, tintImage, uncertaintyImage,
} from "@/lib/render";
import type { EnvironmentModel, RoutePlan } from "@/lib/plan";
import { LayerId, RouteKey, useMission } from "@/lib/store";

export const ROUTE_COLORS: Record<RouteKey, string> = { A: "#e0a23c", B: "#4fc1a6", C: "#8fb8d8" };

interface Props {
  region: Region;
  classes: Uint8Array | null;
  routes: Record<RouteKey, RoutePlan> | null;
  /** live markers (crew, rover, field logs) in grid cells */
  markers?: MapMarker[];
  env?: EnvironmentModel | null;
  /** emergency diversion path */
  divertCells?: [number, number][] | null;
  /** px reserved by floating UI, so "fit" frames the data inside the free area */
  inset?: { top: number; right: number; bottom: number; left: number };
}

export interface MapMarker {
  col: number;
  row: number;
  label?: string;
  color: string;
  shape: "crew" | "rover" | "log";
}

type View = { scale: number; x: number; y: number };

function makeCanvas(img: ImageData) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c;
}

const MAX_SCALE = 40;

export function MapCanvas({
  region, classes, routes, markers = [], env = null, divertCells = null, focusCell = null, compact = false,
  inset = { top: 0, right: 0, bottom: 0, left: 0 },
}: Props & { focusCell?: [number, number] | null; compact?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const [ortho, setOrtho] = useState<HTMLImageElement | null>(null);
  const [orthoMissing, setOrthoMissing] = useState(false);
  const [dragging, setDragging] = useState(false);
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
  const marsTint = useMission((s) => s.marsTint);
  const tinted = useMemo(() => (ortho ? tintImage(ortho) : null), [ortho]);
  const orthoSrc = ortho ? (marsTint ? tinted : ortho) : null;
  const commCanvas = useMemo(() => {
    if (!env || typeof document === "undefined") return null;
    const m = env.comm;
    const img = new ImageData(m.width, m.height);
    for (let i = 0; i < m.data.length; i++) {
      if (m.data[i]) continue;
      img.data[i * 4] = 70; img.data[i * 4 + 1] = 60; img.data[i * 4 + 2] = 140; img.data[i * 4 + 3] = 200;
    }
    return makeCanvas(img);
  }, [env]);

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

  /** smallest zoom at which the map still covers the whole viewport (no empty borders) */
  const minScale = size.w > 0 ? Math.max(size.w / W, size.h / H) : 1;

  const clamp = useCallback((v: View): View => {
    const scale = Math.max(minScale, Math.min(MAX_SCALE, v.scale));
    const x = Math.min(0, Math.max(size.w - W * scale, v.x));
    const y = Math.min(0, Math.max(size.h - H * scale, v.y));
    return { scale, x, y };
  }, [minScale, size, W, H]);

  /** mission area = base + targets, padded; framed inside the free space between floating panels */
  const focus = useMemo(() => {
    const pts = [BASE_SITE, ...TARGETS.filter((t) => t.region === "jezero")].map((p) => latLonToCell(region.meta, p.lat, p.lon));
    const pad = 60;
    const c0 = Math.min(...pts.map((p) => p.col)) - pad, c1 = Math.max(...pts.map((p) => p.col)) + pad;
    const r0 = Math.min(...pts.map((p) => p.row)) - pad, r1 = Math.max(...pts.map((p) => p.row)) + pad;
    return { cx: (c0 + c1) / 2, cy: (r0 + r1) / 2, w: c1 - c0, h: r1 - r0 };
  }, [region.meta]);

  // depend on primitive inset values: callers (and the default parameter) create a new object each render
  const { top: iT, right: iR, bottom: iB, left: iL } = inset;
  const fit = useCallback(() => {
    const fw = Math.max(100, size.w - iL - iR);
    const fh = Math.max(100, size.h - iT - iB);
    const scale = Math.max(minScale, Math.min(fw / focus.w, fh / focus.h));
    const sx = iL + fw / 2, sy = iT + fh / 2;
    setView(clamp({ scale, x: sx - focus.cx * scale, y: sy - focus.cy * scale }));
  }, [size, iT, iR, iB, iL, minScale, focus, clamp]);

  // first fit, then keep the view valid when the window is resized
  const fitted = useRef(false);
  const hasFocus = focusCell !== null;
  useEffect(() => {
    if (size.w === 0 || hasFocus) return;
    if (!fitted.current) { fitted.current = true; fit(); return; }
    setView((v) => {
      if (!v) return v;
      const c = clamp(v);
      return c.scale === v.scale && c.x === v.x && c.y === v.y ? v : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, clamp, hasFocus]);

  // tactical mode: keep the crew centred
  const fc = focusCell?.[0], fr = focusCell?.[1];
  useEffect(() => {
    if (fc === undefined || fr === undefined || size.w === 0) return;
    const scale = Math.max(minScale, size.w / 160);
    setView(clamp({ scale, x: size.w / 2 - (fc + 0.5) * scale, y: size.h / 2 - (fr + 0.5) * scale }));
  }, [fc, fr, size, minScale, clamp]);

  // draw
  useEffect(() => {
    const c = canvas.current;
    if (!c || !view || !rasters || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b0c0e";
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
    if (orthoSrc && layers.ortho.visible) drawLayer("ortho", orthoSrc);
    else { g.globalAlpha = 1; g.drawImage(rasters.hillshade, 0, 0, W, H); }
    drawLayer("elevation", rasters.elevation);
    // multiply keeps the colour of the layers underneath while adding relief
    g.globalCompositeOperation = "multiply";
    drawLayer("hillshade", rasters.hillshade);
    g.globalCompositeOperation = "source-over";
    drawLayer("slope", rasters.slope);
    drawLayer("roughness", rasters.roughness);
    drawLayer("uncertainty", rasters.uncertainty);
    g.imageSmoothingEnabled = false;
    drawLayer("classes", classCanvas);
    if (commCanvas && env && layers.comm.visible) {
      g.globalAlpha = layers.comm.opacity;
      g.drawImage(commCanvas, 0, 0, env.comm.width * env.comm.step, env.comm.height * env.comm.step);
    }
    g.globalAlpha = 1;

    const lw = (px: number) => px / view.scale;
    const polyline = (pts: [number, number][]) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + 0.5, y + 0.5) : g.lineTo(x + 0.5, y + 0.5)));
      g.stroke();
    };
    g.lineJoin = "round"; g.lineCap = "round";

    if (layers.rover.visible) {
      g.globalAlpha = layers.rover.opacity;
      g.strokeStyle = "rgba(11,12,14,0.45)"; g.lineWidth = lw(2.5);
      polyline(region.rover.map((p) => [p.col, p.row]));
      g.strokeStyle = "rgba(242,242,242,0.85)"; g.lineWidth = lw(1); g.setLineDash([lw(2), lw(3)]);
      polyline(region.rover.map((p) => [p.col, p.row]));
      g.setLineDash([]);
      g.globalAlpha = 1;
    }

    if (routes && layers.routes.visible) {
      const order: RouteKey[] = (["A", "B", "C"] as RouteKey[]).filter((k) => k !== selectedRoute).concat(selectedRoute);
      for (const k of order) {
        const r = routes[k];
        if (!r.cells.length) continue;
        const sel = k === selectedRoute;
        g.globalAlpha = layers.routes.opacity * (sel ? 1 : 0.7);
        g.strokeStyle = "rgba(11,12,14,0.75)"; g.lineWidth = lw(sel ? 6 : 3.5);
        polyline(r.cells);
        g.strokeStyle = ROUTE_COLORS[k]; g.lineWidth = lw(sel ? 3 : 1.5);
        if (!sel) g.setLineDash([lw(6), lw(4)]);
        polyline(r.cells);
        g.setLineDash([]);
        if (sel && r.eva && r.eva.bingoIndex > 0) {
          const [bc, br] = r.cells[r.eva.bingoIndex];
          g.strokeStyle = "#d0584c"; g.lineWidth = lw(2.5);
          g.beginPath(); g.arc(bc + 0.5, br + 0.5, lw(8), 0, Math.PI * 2); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }

    // cartographic labels with halo, no boxes
    const label = (text: string, x: number, y: number, color: string, weight = 500) => {
      g.font = `${weight} ${lw(12)}px "IBM Plex Sans", system-ui, sans-serif`;
      g.lineWidth = lw(3.5); g.strokeStyle = "rgba(11,12,14,0.85)"; g.lineJoin = "round";
      g.strokeText(text, x + lw(10), y + lw(4));
      g.fillStyle = color;
      g.fillText(text, x + lw(10), y + lw(4));
    };
    const b = latLonToCell(region.meta, BASE_SITE.lat, BASE_SITE.lon);
    g.fillStyle = "#f2f2f2"; g.strokeStyle = "#0b0c0e"; g.lineWidth = lw(1.5);
    g.beginPath(); g.moveTo(b.col + 0.5, b.row + 0.5 - lw(7)); g.lineTo(b.col + 0.5 + lw(6), b.row + 0.5 + lw(5)); g.lineTo(b.col + 0.5 - lw(6), b.row + 0.5 + lw(5)); g.closePath();
    g.fill(); g.stroke();
    label("Base", b.col, b.row, "#f2f2f2", 600);
    for (const t of TARGETS.filter((x) => x.region === "jezero")) {
      const p = latLonToCell(region.meta, t.lat, t.lon);
      const sel = t.id === targetId;
      const cx = p.col + 0.5, cy = p.row + 0.5;
      g.fillStyle = sel ? "#d0652f" : "#f2f2f2"; g.strokeStyle = "#0b0c0e"; g.lineWidth = lw(1.5);
      g.beginPath(); g.arc(cx, cy, lw(sel ? 5.5 : 4.5), 0, Math.PI * 2); g.fill(); g.stroke();
      if (sel) { g.strokeStyle = "#d0652f"; g.lineWidth = lw(1.25); g.beginPath(); g.arc(cx, cy, lw(10), 0, Math.PI * 2); g.stroke(); }
      label(t.name, p.col, p.row, sel ? "#f0a37a" : "#f2f2f2", sel ? 600 : 500);
    }
    if (env && layers.shelters.visible) {
      g.globalAlpha = layers.shelters.opacity;
      for (const s of env.shelters) {
        const cx = s.col + 0.5, cy = s.row + 0.5;
        g.fillStyle = "rgba(143,184,216,0.25)"; g.strokeStyle = "#8fb8d8"; g.lineWidth = lw(1.5);
        g.beginPath(); g.rect(cx - lw(5), cy - lw(5), lw(10), lw(10)); g.fill(); g.stroke();
        label(`Shelter ${(s.skyBlocked * 100).toFixed(0)}% sky blocked`, s.col, s.row, "#b8d2e6", 500);
      }
      g.globalAlpha = 1;
    }
    if (env) {
      const a = env.antenna;
      g.strokeStyle = "#f2f2f2"; g.lineWidth = lw(1);
      g.beginPath(); g.moveTo(a.col + 0.5, a.row + 0.5); g.lineTo(a.col + 0.5, a.row + 0.5 - lw(14)); g.stroke();
    }
    if (divertCells && divertCells.length > 1) {
      g.strokeStyle = "rgba(11,12,14,0.8)"; g.lineWidth = lw(6); polyline(divertCells);
      g.strokeStyle = "#d0584c"; g.lineWidth = lw(3); g.setLineDash([lw(5), lw(3)]); polyline(divertCells); g.setLineDash([]);
    }
    for (const m of markers) {
      const cx = m.col + 0.5, cy = m.row + 0.5;
      g.fillStyle = m.color; g.strokeStyle = "#0b0c0e"; g.lineWidth = lw(1.5);
      if (m.shape === "log") {
        g.beginPath(); g.rect(cx - lw(3.5), cy - lw(3.5), lw(7), lw(7)); g.fill(); g.stroke();
      } else if (m.shape === "rover") {
        g.beginPath(); g.rect(cx - lw(5), cy - lw(4), lw(10), lw(8)); g.fill(); g.stroke();
      } else {
        g.beginPath(); g.arc(cx, cy, lw(6), 0, Math.PI * 2); g.fill(); g.stroke();
      }
      if (m.label) label(m.label, m.col, m.row, m.color, 600);
    }
    g.restore();
  }, [view, size, rasters, orthoSrc, classCanvas, commCanvas, env, divertCells, layers, routes, selectedRoute, targetId, region, markers, W, H]);

  const toCell = (x: number, y: number) => (view ? { col: Math.floor((x - view.x) / view.scale), row: Math.floor((y - view.y) / view.scale) } : null);

  const zoomAt = useCallback((factor: number, x: number, y: number) => {
    setView((v) => {
      if (!v) return v;
      const scale = Math.max(minScale, Math.min(MAX_SCALE, v.scale * factor));
      const f = scale / v.scale;
      return clamp({ scale, x: x - (x - v.x) * f, y: y - (y - v.y) * f });
    });
  }, [minScale, clamp]);

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
  }, [zoomAt]);

  const info = useMemo(() => {
    if (!hover) return null;
    const { col, row } = hover;
    if (col < 0 || row < 0 || col >= W || row >= H) return null;
    const i = row * W + col;
    const { lat, lon } = cellToLatLon(region.meta, col, row);
    return { lat, lon, z: region.grid.z[i], s: region.slope[i], u: region.uncertainty[i], cls: classes ? (classes[i] as TerrainClass) : null };
  }, [hover, region, classes, W, H]);

  // scale bar
  const scaleBar = useMemo(() => {
    if (!view) return null;
    const metres = (110 / view.scale) * region.grid.cellSize;
    const nice = [10, 20, 50, 100, 200, 250, 500, 1000, 2000].reduce((a, v) => (Math.abs(v - metres) < Math.abs(a - metres) ? v : a));
    return { px: (nice / region.grid.cellSize) * view.scale, text: nice >= 1000 ? `${nice / 1000} km` : `${nice} m` };
  }, [view, region.grid.cellSize]);

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-space">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h, cursor: dragging ? "grabbing" : "default" }}
        onPointerDown={(e) => {
          if (!view) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          const x = e.clientX - r.left, y = e.clientY - r.top;
          if (drag.current && view) {
            const d = drag.current;
            setView(clamp({ ...view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
          }
          setHover(toCell(x, y));
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerLeave={() => setHover(null)}
      />

      <div className={`absolute flex-col overflow-hidden rounded border border-line bg-panel/95 ${compact ? "hidden" : "flex"}`} style={{ top: inset.top + 4, right: inset.right + 12 }}>
        <button className="p-1.5 text-muted hover:bg-white/5 hover:text-ink" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)} aria-label="Zoom in"><Plus size={15} /></button>
        <button className="border-t border-line p-1.5 text-muted hover:bg-white/5 hover:text-ink" onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="border-t border-line p-1.5 text-muted hover:bg-white/5 hover:text-ink" onClick={fit} aria-label="Reset view"><Maximize2 size={14} /></button>
      </div>

      <div className="num pointer-events-none absolute flex items-end gap-4 text-[11px] text-ink" style={{ right: inset.right + 12, bottom: inset.bottom + 10 }}>
        {info && !compact && (
          <div className="rounded bg-space/80 px-2 py-1 leading-4">
            {info.lat.toFixed(5)}°N {info.lon.toFixed(5)}°E · {Number.isFinite(info.z) ? info.z.toFixed(1) : "—"} m · slope {Number.isFinite(info.s) ? info.s.toFixed(1) : "—"}° · U {info.u.toFixed(2)}
            {info.cls !== null && <span className="text-muted"> · {TERRAIN_CLASS_LABEL[info.cls].toLowerCase()}</span>}
          </div>
        )}
        {scaleBar && (
          <div className="rounded bg-space/80 px-2 py-1">
            <div className="border-x border-b border-ink" style={{ width: scaleBar.px, height: 5 }} />
            <div className="mt-0.5 text-center text-[10px]">{scaleBar.text}</div>
          </div>
        )}
        <div className="rounded bg-space/80 px-1.5 py-1 text-center text-[10px] leading-3">▲<br />N</div>
      </div>

      {orthoMissing && (
        <div className="absolute rounded bg-space/85 px-2 py-1 text-[11px] text-caution" style={{ left: inset.left + 12, top: inset.top + 4 }}>
          HiRISE orthoimage unavailable — DTM hillshade shown
        </div>
      )}
    </div>
  );
}
