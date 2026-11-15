"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { latLonToCell, Region } from "@/lib/data/region";
import { BASE_SITE, TARGETS } from "@/lib/data/targets";
import type { RoutePlan } from "@/lib/plan";
import { tintImage, rgbCss } from "@/lib/render";
import { RouteKey, useMission } from "@/lib/store";
import {
  canvasTexture, ContextTerrain, contextGeometry, contextHypsoCanvas, disposeObject, drapedLine, HYPSO_RAMP, hypsometricCanvas,
  labelSprite, loadContextTerrain, marsSkyTexture, pin, TerrainFrame, terrainGeometry,
} from "@/lib/three/terrain3d";
import type { MapMarker } from "./MapCanvas";
import { ROUTE_COLORS } from "./MapCanvas";

export type Colouring = "ortho" | "hypso";

interface Props {
  region: Region;
  routes: Record<RouteKey, RoutePlan> | null;
  markers: MapMarker[];
  inset: { top: number; right: number; bottom: number; left: number };
}

export function Terrain3D({ region, routes, markers, inset }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [colouring, setColouring] = useState<Colouring>("ortho");
  const [exag, setExag] = useState(2);
  const [ortho, setOrtho] = useState<HTMLImageElement | null>(null);
  const marsTint = useMission((s) => s.marsTint);
  const selectedRoute = useMission((s) => s.selectedRoute);
  const targetId = useMission((s) => s.targetId);
  const showRover = useMission((s) => s.layers.rover.visible);
  const showRoutes = useMission((s) => s.layers.routes.visible);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    terrain: THREE.Mesh | null; context: THREE.Mesh | null; overlay: THREE.Group; frame: TerrainFrame | null; raf: number; dirty: boolean;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setOrtho(img);
    img.src = region.orthoUrl;
  }, [region.orthoUrl]);
  const [context, setContext] = useState<ContextTerrain | null>(null);
  useEffect(() => { loadContextTerrain().then(setContext); }, []);

  const textures = useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      hypso: canvasTexture(hypsometricCanvas(region)),
      ortho: ortho ? canvasTexture(ortho) : null,
      tinted: ortho ? canvasTexture(tintImage(ortho)) : null,
      ctxHypso: context ? canvasTexture(contextHypsoCanvas(context, region.meta.z_min, region.meta.z_max)) : null,
      ctxOrtho: context?.ortho ? canvasTexture(context.ortho) : null,
      ctxTinted: context?.ortho ? canvasTexture(tintImage(context.ortho)) : null,
    };
  }, [region, ortho, context]);

  // renderer, camera, controls (once)
  useEffect(() => {
    const el = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = marsSkyTexture();
    scene.fog = new THREE.Fog("#a8845f", 7000, 15000);
    const camera = new THREE.PerspectiveCamera(45, 1, 5, 40000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 150;
    controls.maxDistance = 6000;
    const overlay = new THREE.Group();
    scene.add(overlay);
    const c = { renderer, scene, camera, controls, terrain: null as THREE.Mesh | null, context: null as THREE.Mesh | null, overlay, frame: null as TerrainFrame | null, raf: 0, dirty: true };
    ctx.current = c;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      overlay.traverse((o) => { const m = (o as THREE.Mesh).material as LineMaterial | undefined; if (m && "resolution" in m) m.resolution.set(w, h); });
      c.dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    // render only when the camera moves or the scene changed (light on laptop GPUs)
    const loop = () => { const moved = controls.update(); if (moved || c.dirty) { renderer.render(scene, camera); c.dirty = false; } c.raf = requestAnimationFrame(loop); };
    loop();
    return () => {
      cancelAnimationFrame(c.raf); ro.disconnect(); controls.dispose();
      disposeObject(scene); renderer.dispose(); el.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  const resetView = () => {
    const c = ctx.current;
    if (!c?.frame) return;
    const f = c.frame;
    const pts = [BASE_SITE, ...TARGETS.filter((t) => t.region === "jezero")].map((p) => latLonToCell(region.meta, p.lat, p.lon));
    const cx = pts.reduce((s, p) => s + p.col, 0) / pts.length, cy = pts.reduce((s, p) => s + p.row, 0) / pts.length;
    const target = f.point(cx, cy);
    // shift the look-at point so the mission area sits in the free space between panels
    const el = wrap.current!;
    const dx = ((inset.left - inset.right) / el.clientWidth) * 1800;
    const dy = ((inset.bottom - inset.top) / el.clientHeight) * 1400;
    target.x -= dx; target.z += dy;
    c.controls.target.copy(target);
    c.camera.position.set(target.x + 900, target.y + 1900, target.z + 2600);
    c.controls.update();
    c.dirty = true;
  };

  // terrain mesh: rebuilt when exaggeration changes
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const f = new TerrainFrame(region, exag);
    c.frame = f;
    if (c.terrain) { c.scene.remove(c.terrain); c.terrain.geometry.dispose(); (c.terrain.material as THREE.Material).dispose(); }
    const mesh = new THREE.Mesh(terrainGeometry(f, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    c.terrain = mesh;
    c.scene.add(mesh);
    if (!c.controls.target.lengthSq()) resetView();
    c.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, exag]);

  // low-resolution context terrain around the work area (visual only)
  useEffect(() => {
    const c = ctx.current;
    if (!c?.frame || !context) return;
    if (c.context) { c.scene.remove(c.context); c.context.geometry.dispose(); (c.context.material as THREE.Material).dispose(); }
    const mesh = new THREE.Mesh(contextGeometry(c.frame, context), new THREE.MeshBasicMaterial({ color: 0xd8d8d8 }));
    c.context = mesh;
    c.scene.add(mesh);
    c.dirty = true;
  }, [context, exag]);

  // texture
  useEffect(() => {
    const c = ctx.current;
    if (!c?.terrain || !textures) return;
    const mat = c.terrain.material as THREE.MeshBasicMaterial;
    mat.map = colouring === "hypso" ? textures.hypso : (marsTint ? textures.tinted : textures.ortho) ?? textures.hypso;
    mat.needsUpdate = true;
    if (c.context) {
      const cm = c.context.material as THREE.MeshBasicMaterial;
      cm.map = colouring === "hypso" ? textures.ctxHypso : (marsTint ? textures.ctxTinted : textures.ctxOrtho) ?? textures.ctxHypso;
      cm.needsUpdate = true;
    }
    c.dirty = true;
  }, [textures, colouring, marsTint, exag, context]);

  // overlays: routes, rover traverse, base, targets, crew
  useEffect(() => {
    const c = ctx.current;
    if (!c?.frame) return;
    const f = c.frame;
    disposeObject(c.overlay);
    c.overlay.clear();
    const lift = 3;
    if (showRover) {
      c.overlay.add(drapedLine(f, region.rover.map((p) => [p.col, p.row]), "#f2f2f2", 1.5, lift, true, 0.85));
    }
    if (routes && showRoutes) {
      for (const k of ["A", "B", "C"] as RouteKey[]) {
        const r = routes[k];
        if (r.cells.length < 2) continue;
        const sel = k === selectedRoute;
        c.overlay.add(drapedLine(f, r.cells, ROUTE_COLORS[k], sel ? 4 : 2, lift + (sel ? 1 : 0), !sel, sel ? 1 : 0.75));
      }
    }
    const pinH = 60 * Math.max(1, exag / 2);
    const b = latLonToCell(region.meta, BASE_SITE.lat, BASE_SITE.lon);
    const bp = pin(f, b.col, b.row, "#f2f2f2", pinH);
    c.overlay.add(bp.group);
    const bl = labelSprite("Base"); bl.position.copy(bp.top); c.overlay.add(bl);
    for (const t of TARGETS.filter((x) => x.region === "jezero")) {
      const p = latLonToCell(region.meta, t.lat, t.lon);
      const col = t.id === targetId ? "#f0a37a" : "#f2f2f2";
      const tp = pin(f, p.col, p.row, col, pinH);
      c.overlay.add(tp.group);
      const s = labelSprite(t.name, col, 13, `${f.elevAt(p.col, p.row).toFixed(0)} m`);
      s.position.copy(tp.top);
      c.overlay.add(s);
    }
    for (const m of markers) {
      if (m.shape !== "crew" || !m.label) continue;
      const cp = pin(f, m.col, m.row, "#8fb8d8", pinH * 0.6);
      c.overlay.add(cp.group);
      const s = labelSprite(m.label, "#8fb8d8", 12); s.position.copy(cp.top); c.overlay.add(s);
    }
    const el = wrap.current!;
    c.overlay.traverse((o) => { const mm = (o as THREE.Mesh).material as LineMaterial | undefined; if (mm && "resolution" in mm) mm.resolution.set(el.clientWidth, el.clientHeight); });
    c.dirty = true;
  }, [region, routes, selectedRoute, targetId, markers, exag, showRover, showRoutes]);

  const zMin = region.meta.z_min, zMax = region.meta.z_max;
  return (
    <div className="absolute inset-0">
      <div ref={wrap} className="absolute inset-0" />
      <div className="absolute flex flex-col gap-1.5 rounded border border-line bg-panel/95 p-2 text-[11px]" style={{ top: inset.top + 4, right: inset.right + 12 }}>
        <div className="text-muted">Surface</div>
        <div className="flex overflow-hidden rounded border border-line">
          {(["ortho", "hypso"] as Colouring[]).map((k) => (
            <button key={k} onClick={() => setColouring(k)} className={`px-2 py-0.5 ${colouring === k ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>
              {k === "ortho" ? "HiRISE image" : "Elevation colours"}
            </button>
          ))}
        </div>
        <div className="mt-1 text-muted">Vertical exaggeration</div>
        <div className="flex overflow-hidden rounded border border-line">
          {[1, 2, 3].map((v) => (
            <button key={v} onClick={() => setExag(v)} className={`flex-1 px-2 py-0.5 ${exag === v ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>{v}×</button>
          ))}
        </div>
        <button onClick={resetView} className="mt-1 rounded border border-line px-2 py-0.5 text-muted hover:text-ink">Reset view</button>
      </div>
      <div className="pointer-events-none absolute rounded bg-space/85 px-2 py-1.5 text-[11px]" style={{ right: inset.right + 12, bottom: inset.bottom + 10 }}>
        <div className="font-medium text-ink">Relief ×{exag} {exag === 1 ? "(true scale)" : "(vertically exaggerated)"}</div>
        {colouring === "hypso" ? (
          <div className="mt-1 w-48">
            <div className="h-2 rounded-sm" style={{ background: `linear-gradient(90deg, ${HYPSO_RAMP.map(([t, c]) => `${rgbCss(c)} ${t * 100}%`).join(",")})` }} />
            <div className="num mt-0.5 flex justify-between text-[10px] text-muted"><span>{zMin.toFixed(0)} m</span><span>{zMax.toFixed(0)} m</span></div>
          </div>
        ) : (
          <div className="text-muted">HiRISE orthoimage draped on the HiRISE DTM{marsTint ? " · approximate colour" : ""}</div>
        )}
        <div className="text-muted">Inner 4 km: 5 m analysis grid · surroundings: 20 m context, visual only (slightly dimmed)</div>
        <div className="text-faint">Drag to rotate · right-drag to pan · wheel to zoom</div>
      </div>
    </div>
  );
}
