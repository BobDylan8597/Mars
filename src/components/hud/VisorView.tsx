"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { latLonToCell, Region } from "@/lib/data/region";
import type { ScienceTarget } from "@/lib/data/targets";
import { BASE_SITE } from "@/lib/data/targets";
import type { Shelter } from "@/lib/core/los";
import type { RoutePlan } from "@/lib/plan";
import { tintImage } from "@/lib/render";
import type { TwinSnapshot } from "@/lib/twin";
import { useMission } from "@/lib/store";
import {
  canvasTexture, ContextTerrain, contextGeometry, disposeObject, drapedLine, hypsometricCanvas, labelSprite, loadContextTerrain, pin, TerrainFrame, terrainGeometry,
} from "@/lib/three/terrain3d";

const EYE_M = 1.7;

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#5b4636");
  grd.addColorStop(0.55, "#a7825f");
  grd.addColorStop(1, "#d8b48c");
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Simulated visor view: the HiRISE terrain rendered at true scale from the astronaut's eye
 * (1.7 m) at the Mission Twin position, looking along the route. AR cues are drawn in place:
 * route ahead, target, shelters, base, diversion. Re-renders only when the position changes.
 */
export function VisorView({
  region, route, snap, target, shelters, divertCells, marsTint, onViewHeading, lookResetToken = 0,
}: {
  region: Region;
  route: RoutePlan | null;
  snap: TwinSnapshot | null;
  target: ScienceTarget;
  shelters: Shelter[];
  divertCells: [number, number][] | null;
  marsTint: boolean;
  /** called with the gaze heading (deg, 0 = north) so the compass follows the head */
  onViewHeading?: (deg: number) => void;
  /** change to re-centre the gaze on the route */
  lookResetToken?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ortho, setOrtho] = useState<HTMLImageElement | null>(null);
  const [context, setContext] = useState<ContextTerrain | null>(null);
  useEffect(() => { loadContextTerrain().then(setContext); }, []);
  const ctx = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; terrain: THREE.Mesh; overlay: THREE.Group; f: TerrainFrame; render: () => void } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setOrtho(img);
    img.src = region.orthoUrl;
  }, [region.orthoUrl]);

  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    if (!ortho) return canvasTexture(hypsometricCanvas(region), 16);
    return canvasTexture(marsTint ? tintImage(ortho) : ortho, 16);
  }, [region, ortho, marsTint]);

  useEffect(() => {
    const el = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = skyTexture();
    scene.fog = new THREE.Fog("#b48d68", 800, 9000);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 30000);
    const f = new TerrainFrame(region, 1); // first person: TRUE vertical scale
    const terrain = new THREE.Mesh(terrainGeometry(f, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
    scene.add(terrain);
    const overlay = new THREE.Group();
    scene.add(overlay);
    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      overlay.traverse((o) => { const m = (o as THREE.Mesh).material as LineMaterial | undefined; if (m && "resolution" in m) m.resolution.set(w, h); });
      render();
    };
    ctx.current = { renderer, scene, camera, terrain, overlay, f, render };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => { ro.disconnect(); disposeObject(scene); renderer.dispose(); el.removeChild(renderer.domElement); ctx.current = null; };
  }, [region]);

  // context terrain to the horizon (visual only, true scale)
  useEffect(() => {
    const c = ctx.current;
    if (!c || !context) return;
    const map = context.ortho ? canvasTexture(marsTint ? tintImage(context.ortho) : context.ortho, 8) : null;
    const mesh = new THREE.Mesh(contextGeometry(c.f, context), new THREE.MeshBasicMaterial({ color: 0xdddddd, map, fog: true }));
    c.scene.add(mesh);
    c.render();
    return () => { c.scene.remove(mesh); mesh.geometry.dispose(); map?.dispose(); (mesh.material as THREE.Material).dispose(); };
  }, [context, marsTint, region]);

  useEffect(() => {
    const c = ctx.current;
    if (!c || !tex) return;
    const m = c.terrain.material as THREE.MeshBasicMaterial;
    m.map = tex; m.needsUpdate = true;
    c.render();
  }, [tex]);

  // ---------------------------------------------------------------- smooth walk + free look
  const progress = useMission((st) => st.twin.progress);
  const st = useRef({ p: progress, target: progress, yaw: 0, pitch: 0, dirty: true, lastEmit: 0, lastHeading: -1, route: route as RoutePlan | null });
  st.current.target = progress;
  st.current.route = route;
  useEffect(() => { st.current.yaw = 0; st.current.pitch = 0; st.current.dirty = true; }, [lookResetToken]);
  useEffect(() => { st.current.dirty = true; }, [route]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const s = st.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const r = s.route;
      if (r?.eva && r.cells.length > 1) {
        // ease the displayed position toward the twin clock so walking is continuous
        const diff = s.target - s.p;
        if (Math.abs(diff) > 1e-6) { s.p += diff * (1 - Math.exp(-dt * 4)); if (Math.abs(s.target - s.p) < 1e-5) s.p = s.target; s.dirty = true; }
        if (s.dirty) {
          const pose = poseAlong(c.f, r, s.p);
          c.camera.position.copy(pose.eye);
          c.camera.rotation.order = "YXZ";
          const heading = pose.headingRad + s.yaw;
          c.camera.rotation.y = -heading;
          c.camera.rotation.x = Math.max(-1.2, Math.min(1.2, pose.pitchRad + s.pitch));
          c.camera.rotation.z = 0;
          c.render();
          s.dirty = false;
          const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
          if (onViewHeading && now - s.lastEmit > 100 && Math.abs(deg - s.lastHeading) > 0.5) {
            s.lastEmit = now; s.lastHeading = deg; onViewHeading(deg);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [region, onViewHeading]);

  // drag = turn your head
  useEffect(() => {
    const el = wrap.current!;
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const s = st.current;
      s.yaw += ((e.clientX - drag.x) * 0.25 * Math.PI) / 180;
      s.pitch = Math.max(-1, Math.min(1, s.pitch + ((drag.y - e.clientY) * 0.2 * Math.PI) / 180));
      drag = { x: e.clientX, y: e.clientY };
      s.dirty = true;
    };
    const up = () => { drag = null; el.style.cursor = "grab"; };
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
  }, []);

  // AR overlays: rebuilt every ~50 m of progress (labels carry distances), not every frame
  const kBucket = snap ? Math.floor(snap.k / 10) : -1;
  useEffect(() => {
    const c = ctx.current;
    if (!c || !snap || !route || route.cells.length < 2) return;
    const { f, overlay } = c;
    disposeObject(overlay);
    overlay.clear();
    const ahead = route.cells.slice(Math.max(0, snap.k - 2));
    if (ahead.length > 1) overlay.add(drapedLine(f, ahead, "#4fc1a6", 5, 0.25, false, 0.95));
    if (divertCells && divertCells.length > 1) overlay.add(drapedLine(f, divertCells, "#d0584c", 6, 0.35, true, 1));
    const tc = latLonToCell(region.meta, target.lat, target.lon);
    const dist = Math.hypot(tc.col - snap.col, tc.row - snap.row) * f.cell;
    const tp = pin(f, tc.col, tc.row, "#f0a37a", 12);
    overlay.add(tp.group);
    const tl = labelSprite(target.name, "#f0a37a", 14, `${dist < 1000 ? dist.toFixed(0) + " m" : (dist / 1000).toFixed(2) + " km"}`, 0.0022);
    tl.position.copy(tp.top); overlay.add(tl);
    const b = latLonToCell(region.meta, BASE_SITE.lat, BASE_SITE.lon);
    const bp = pin(f, b.col, b.row, "#f2f2f2", 25);
    overlay.add(bp.group);
    const bl = labelSprite("Base", "#f2f2f2", 13, undefined, 0.002); bl.position.copy(bp.top); overlay.add(bl);
    // only the two nearest shelters within 800 m: the ones that matter in an emergency
    const near = shelters
      .map((sh) => ({ sh, d: Math.hypot(sh.col - snap.col, sh.row - snap.row) * f.cell }))
      .filter((x) => x.d <= 800).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const { sh: sv, d } of near) {
      const sp = pin(f, sv.col, sv.row, "#8fb8d8", 8);
      overlay.add(sp.group);
      const sl = labelSprite("Shelter", "#b8d2e6", 12, `${d.toFixed(0)} m`, 0.0019); sl.position.copy(sp.top); overlay.add(sl);
    }
    const el = wrap.current!;
    overlay.traverse((o) => { const m = (o as THREE.Mesh).material as LineMaterial | undefined; if (m && "resolution" in m) m.resolution.set(el.clientWidth, el.clientHeight); });
    st.current.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kBucket, route, target, shelters, divertCells, region]);

  return <div ref={wrap} className="absolute inset-0" />;
}

/** Eye position and gaze along the route at fractional progress p (0..1 of walking time). */
function poseAlong(f: TerrainFrame, r: RoutePlan, p: number) {
  const tm = r.eva!.timeMin, cells = r.cells, dist = r.eva!.distM, n = cells.length;
  const t = Math.max(0, Math.min(1, p)) * tm[n - 1];
  let k = 0;
  while (k < n - 2 && tm[k + 1] <= t) k++;
  const span = tm[k + 1] - tm[k] || 1;
  const fr = Math.max(0, Math.min(1, (t - tm[k]) / span));
  const col = cells[k][0] + (cells[k + 1][0] - cells[k][0]) * fr;
  const row = cells[k][1] + (cells[k + 1][1] - cells[k][1]) * fr;
  const here = dist[k] + (dist[k + 1] - dist[k]) * fr;
  let j = k + 1;
  while (j < n - 1 && dist[j] < here + 40) j++;
  let dc = cells[j][0] - col, dr = cells[j][1] - row;
  if (Math.hypot(dc, dr) < 0.5) { dc = cells[n - 1][0] - cells[Math.max(0, n - 6)][0]; dr = cells[n - 1][1] - cells[Math.max(0, n - 6)][1]; }
  const eye = f.point(col, row, EYE_M);
  const ahead = f.point(cells[j][0], cells[j][1], EYE_M);
  const horiz = Math.max(1, Math.hypot(ahead.x - eye.x, ahead.z - eye.z));
  return {
    eye,
    headingRad: Math.atan2(dc, -dr), // 0 = north, clockwise; rows grow southward
    pitchRad: Math.atan2((ahead.y - eye.y) * 0.6 - 2, horiz),
  };
}
