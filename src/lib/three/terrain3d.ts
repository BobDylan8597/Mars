/**
 * Shared 3D terrain helpers (Three.js). The mesh is the same HiRISE DTM grid used by every
 * calculation; heights are real metres times a declared vertical exaggeration.
 * World axes: x = east (m), z = south (m), y = up (m, relative to the map's mid elevation).
 */
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Region } from "@/lib/data/region";
import { ramp } from "@/lib/render";

type RGB = [number, number, number];

/** Classic hypsometric scale (MOLA-style): low = blue, then green, yellow, orange, high = red/white. */
export const HYPSO_RAMP: [number, RGB][] = [
  [0, [40, 70, 160]], [0.2, [40, 150, 190]], [0.4, [70, 175, 90]], [0.6, [225, 210, 80]],
  [0.8, [215, 120, 50]], [0.93, [170, 60, 40]], [1, [240, 235, 225]],
];

export class TerrainFrame {
  readonly W: number;
  readonly H: number;
  readonly cell: number;
  readonly zMid: number;
  constructor(public region: Region, public exaggeration: number) {
    this.W = region.grid.width;
    this.H = region.grid.height;
    this.cell = region.grid.cellSize;
    this.zMid = (region.meta.z_min + region.meta.z_max) / 2;
  }
  x(col: number) { return (col + 0.5 - this.W / 2) * this.cell; }
  zw(row: number) { return (row + 0.5 - this.H / 2) * this.cell; }
  y(elev: number) { return (elev - this.zMid) * this.exaggeration; }
  /** bilinear elevation (m) at fractional cell coordinates */
  elevAt(col: number, row: number) {
    const z = this.region.grid.z, W = this.W;
    const c0 = Math.max(0, Math.min(W - 2, Math.floor(col))), r0 = Math.max(0, Math.min(this.H - 2, Math.floor(row)));
    const fc = Math.min(1, Math.max(0, col - c0)), fr = Math.min(1, Math.max(0, row - r0));
    const i = r0 * W + c0;
    return (z[i] * (1 - fc) + z[i + 1] * fc) * (1 - fr) + (z[i + W] * (1 - fc) + z[i + W + 1] * fc) * fr;
  }
  point(col: number, row: number, lift = 0) {
    return new THREE.Vector3(this.x(col), this.y(this.elevAt(col, row)) + lift, this.zw(row));
  }
}

/** Indexed grid mesh; `step` decimates the DTM (1 = every cell). */
export function terrainGeometry(f: TerrainFrame, step: number): THREE.BufferGeometry {
  const cols = Math.floor((f.W - 1) / step) + 1, rows = Math.floor((f.H - 1) / step) + 1;
  const pos = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2);
  const z = f.region.grid.z;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const col = c * step, row = r * step, k = r * cols + c;
      const e = z[row * f.W + col];
      pos[k * 3] = f.x(col); pos[k * 3 + 1] = f.y(Number.isFinite(e) ? e : f.zMid); pos[k * 3 + 2] = f.zw(row);
      uv[k * 2] = (col + 0.5) / f.W; uv[k * 2 + 1] = 1 - (row + 0.5) / f.H;
    }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let n = 0;
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx[n++] = a; idx[n++] = d; idx[n++] = b; idx[n++] = b; idx[n++] = d; idx[n++] = e;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Elevation-coloured texture with baked hillshade, so relief stays readable. */
export function hypsometricCanvas(region: Region): HTMLCanvasElement {
  const { width: w, height: h, cellSize: d, z } = region.grid;
  const { z_min, z_max } = region.meta;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180;
  for (let r = 0; r < h; r++)
    for (let col = 0; col < w; col++) {
      const i = r * w + col;
      const [R, G, B] = ramp(HYPSO_RAMP, (z[i] - z_min) / (z_max - z_min));
      let shade = 1;
      if (r > 0 && col > 0 && r < h - 1 && col < w - 1) {
        const dzdx = ((z[i - w + 1] + 2 * z[i + 1] + z[i + w + 1]) - (z[i - w - 1] + 2 * z[i - 1] + z[i + w - 1])) / (8 * d) * 2;
        const dzdy = ((z[i + w - 1] + 2 * z[i + w] + z[i + w + 1]) - (z[i - w - 1] + 2 * z[i - w] + z[i - w + 1])) / (8 * d) * 2;
        const sl = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx);
        shade = 0.55 + 0.45 * Math.max(0, Math.cos(alt) * Math.cos(sl) + Math.sin(alt) * Math.sin(sl) * Math.cos(az - asp));
      }
      img.data[i * 4] = R * shade; img.data[i * 4 + 1] = G * shade; img.data[i * 4 + 2] = B * shade; img.data[i * 4 + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

export function canvasTexture(src: HTMLCanvasElement | HTMLImageElement, anisotropy = 8) {
  const t = new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Screen-space-width line draped on the terrain (`lift` metres above ground). */
export function drapedLine(f: TerrainFrame, cells: [number, number][], color: string, widthPx: number, lift: number, dashed = false, opacity = 1) {
  const pts: number[] = [];
  const stride = Math.max(1, Math.floor(cells.length / 1500));
  for (let k = 0; k < cells.length; k += stride) {
    const p = f.point(cells[k][0], cells[k][1], lift);
    pts.push(p.x, p.y, p.z);
  }
  const last = cells[cells.length - 1];
  const pl = f.point(last[0], last[1], lift);
  pts.push(pl.x, pl.y, pl.z);
  const geo = new LineGeometry();
  geo.setPositions(pts);
  const mat = new LineMaterial({
    color: new THREE.Color(color), linewidth: widthPx, dashed, dashSize: 25, gapSize: 18,
    transparent: opacity < 1, opacity, depthTest: true,
  });
  const line = new Line2(geo, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

/** Text label sprite that keeps a constant on-screen size. */
export function labelSprite(text: string, color = "#f2f2f2", px = 13, sub?: string, scale = 0.0009) {
  const c = document.createElement("canvas");
  const dpr = 2, pad = 6;
  const g = c.getContext("2d")!;
  const font = `600 ${px * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
  const subFont = `400 ${(px - 2) * dpr}px "IBM Plex Sans", system-ui, sans-serif`;
  g.font = font;
  const w1 = g.measureText(text).width;
  g.font = subFont;
  const w2 = sub ? g.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(w1, w2) + pad * 2 * dpr);
  c.height = Math.ceil((sub ? px * 2.4 : px * 1.5) * dpr + pad * dpr);
  const draw = (t: string, f: string, y: number, col: string) => {
    g.font = f; g.lineJoin = "round"; g.lineWidth = 4 * dpr; g.strokeStyle = "rgba(11,12,14,0.85)";
    g.strokeText(t, pad * dpr, y); g.fillStyle = col; g.fillText(t, pad * dpr, y);
  };
  draw(text, font, px * 1.15 * dpr, color);
  if (sub) draw(sub, subFont, px * 2.25 * dpr, "#c9ccd1");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set((c.width / dpr) * scale, (c.height / dpr) * scale, 1);
  s.center.set(0, 0);
  s.renderOrder = 10;
  return s;
}

/** Vertical pin with a dot on top: marks a point on the terrain. */
export function pin(f: TerrainFrame, col: number, row: number, color: string, heightM: number) {
  const group = new THREE.Group();
  const base = f.point(col, row, 0), top = f.point(col, row, heightM);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([base, top]);
  group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color })));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(heightM * 0.08, 12, 8), new THREE.MeshBasicMaterial({ color }));
  dot.position.copy(top);
  group.add(dot);
  return { group, top };
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((mm) => {
      (mm as THREE.MeshBasicMaterial).map?.dispose();
      mm.dispose();
    });
  });
}
