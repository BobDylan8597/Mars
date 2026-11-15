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
  region, route, snap, target, shelters, divertCells, marsTint,
}: {
  region: Region;
  route: RoutePlan | null;
  snap: TwinSnapshot | null;
  target: ScienceTarget;
  shelters: Shelter[];
  divertCells: [number, number][] | null;
  marsTint: boolean;
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

  // camera + AR overlays follow the crew
  useEffect(() => {
    const c = ctx.current;
    if (!c || !snap || !route || route.cells.length < 2) return;
    const { f, camera, overlay } = c;
    const n = route.cells.length;
    const eye = f.point(snap.col, snap.row, EYE_M);
    // look ~40 m ahead along the route (or along the last heading at the end)
    const kA = Math.min(n - 1, snap.k + 8);
    let look: THREE.Vector3;
    if (kA > snap.k) {
      look = f.point(route.cells[kA][0], route.cells[kA][1], EYE_M);
    } else {
      const h = (snap.headingDeg * Math.PI) / 180;
      look = new THREE.Vector3(eye.x + Math.sin(h) * 40, eye.y, eye.z - Math.cos(h) * 40);
    }
    look.y = eye.y + (look.y - eye.y) * 0.6 - 2; // gaze slightly down toward the ground ahead
    camera.position.copy(eye);
    camera.lookAt(look);

    disposeObject(overlay);
    overlay.clear();
    const ahead = route.cells.slice(snap.k);
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
    for (const { sh: s, d } of near) {
      const sp = pin(f, s.col, s.row, "#8fb8d8", 8);
      overlay.add(sp.group);
      const sl = labelSprite("Shelter", "#b8d2e6", 12, `${d.toFixed(0)} m`, 0.0019); sl.position.copy(sp.top); overlay.add(sl);
    }
    const el = wrap.current!;
    overlay.traverse((o) => { const m = (o as THREE.Mesh).material as LineMaterial | undefined; if (m && "resolution" in m) m.resolution.set(el.clientWidth, el.clientHeight); });
    c.render();
  }, [snap, route, target, shelters, divertCells, region]);

  return <div ref={wrap} className="absolute inset-0" />;
}
