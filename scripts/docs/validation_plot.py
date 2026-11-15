"""SVG scatter: HiRISE DEM slope vs. Perseverance tilt at each rover stop (for the proposal PDF)."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
pts = json.load(open(os.path.join(ROOT, "public", "data", "jezero", "rover_traverse.json")))
val = json.load(open(os.path.join(ROOT, "public", "data", "jezero", "validation.json")))
xy = [(p["tilt_rover"], p["slope_dem"]) for p in pts if p["tilt_rover"] is not None and p["slope_dem"] is not None]

W, H, L, B, T, R = 420, 320, 48, 40, 14, 12
M = 22.0  # axis max (deg)
sx = lambda v: L + v / M * (W - L - R)
sy = lambda v: H - B - v / M * (H - B - T)


def svg(lang):
    xl = "Perseverance tilt (°)" if lang == "en" else "Inclinación de Perseverance (°)"
    yl = "DEM slope (°)" if lang == "en" else "Pendiente del DEM (°)"
    note = (f"n = {val['slope_deg']['n']} stops · MAE {val['slope_deg']['mae']:.2f}° · r = {val['slope_deg']['corr']:.2f}"
            if lang == "en" else
            f"n = {val['slope_deg']['n']} paradas · EAM {val['slope_deg']['mae']:.2f}° · r = {val['slope_deg']['corr']:.2f}")
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="IBM Plex Sans, Arial" font-size="11">']
    for v in range(0, 23, 5):
        o.append(f'<line x1="{sx(v)}" y1="{sy(0)}" x2="{sx(v)}" y2="{sy(M)}" stroke="#e5e7eb"/>')
        o.append(f'<line x1="{sx(0)}" y1="{sy(v)}" x2="{sx(M)}" y2="{sy(v)}" stroke="#e5e7eb"/>')
        o.append(f'<text x="{sx(v)}" y="{sy(0) + 14}" text-anchor="middle" fill="#555">{v}</text>')
        o.append(f'<text x="{sx(0) - 6}" y="{sy(v) + 4}" text-anchor="end" fill="#555">{v}</text>')
    o.append(f'<line x1="{sx(0)}" y1="{sy(0)}" x2="{sx(M)}" y2="{sy(M)}" stroke="#999" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{sx(M) - 4}" y="{sy(M) + 12}" text-anchor="end" fill="#888">1:1</text>')
    for x, y in xy:
        o.append(f'<circle cx="{sx(min(x, M)):.1f}" cy="{sy(min(y, M)):.1f}" r="2.6" fill="#c2561f" fill-opacity="0.65"/>')
    o.append(f'<text x="{(L + W - R) / 2}" y="{H - 6}" text-anchor="middle" fill="#222">{xl}</text>')
    o.append(f'<text transform="translate(13 {(T + H - B) / 2}) rotate(-90)" text-anchor="middle" fill="#222">{yl}</text>')
    o.append(f'<text x="{L + 6}" y="{T + 12}" fill="#222" font-weight="600">{note}</text>')
    o.append("</svg>")
    return "\n".join(o)


out = os.path.join(ROOT, "docs", "evidence")
os.makedirs(out, exist_ok=True)
for lang in ("es", "en"):
    open(os.path.join(out, f"validation-{lang}.svg"), "w", encoding="utf-8").write(svg(lang))
print(len(xy), "points")
