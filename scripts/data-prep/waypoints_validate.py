"""Extract Perseverance waypoints inside the Jezero work area and validate the DEM against them.

Inputs : data-raw/M20_waypoints.json (https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json)
         public/data/jezero/dem.bin + dem.meta.json (from crop_jezero.py)
Outputs: public/data/jezero/rover_traverse.json  (waypoints in grid coordinates)
         public/data/jezero/validation.json      (DEM elevation and slope vs. rover telemetry)

Slope here uses the same Horn 3x3 method as src/lib/core/terrain.ts.
Rover 'tilt' is the vehicle attitude, which also reflects rocks under the wheels and
5 m vs. ~3 m footprint differences, so agreement is expected to be approximate.
"""
import json
import math
import os
import urllib.request

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
RAW = os.path.join(ROOT, "data-raw", "M20_waypoints.json")
OUT = os.path.join(ROOT, "public", "data", "jezero")
URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json"


def horn(z, d):
    s = np.full(z.shape, np.nan, dtype=np.float64)
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    dd, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = (c + 2 * f + i - (a + 2 * dd + g)) / (8 * d)
    dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * d)
    s[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    return s


def bilinear(a, col, row):
    c0, r0 = int(math.floor(col)), int(math.floor(row))
    if c0 < 0 or r0 < 0 or c0 >= a.shape[1] - 1 or r0 >= a.shape[0] - 1:
        return float("nan")
    fc, fr = col - c0, row - r0
    return float((a[r0, c0] * (1 - fc) + a[r0, c0 + 1] * fc) * (1 - fr)
                 + (a[r0 + 1, c0] * (1 - fc) + a[r0 + 1, c0 + 1] * fc) * fr)


def main():
    if not os.path.exists(RAW):
        os.makedirs(os.path.dirname(RAW), exist_ok=True)
        urllib.request.urlretrieve(URL, RAW)
    meta = json.load(open(os.path.join(OUT, "dem.meta.json")))
    n, d, b = meta["width"], meta["cell_size_m"], meta["bounds"]
    dem = np.fromfile(os.path.join(OUT, "dem.bin"), dtype="<f4").reshape(n, n).astype(np.float64)
    slope = horn(dem, d)

    feats = json.load(open(RAW))["features"]
    pts = []
    for f in feats:
        p = f["properties"]
        lat, lon = p["lat"], p["lon"]
        if not (b["south"] <= lat <= b["north"] and b["west"] <= lon <= b["east"]):
            continue
        col = (lon - b["west"]) / (b["east"] - b["west"]) * n - 0.5
        row = (b["north"] - lat) / (b["north"] - b["south"]) * n - 0.5
        z_dem = bilinear(dem, col, row)
        s_dem = bilinear(slope, col, row)
        pts.append({
            "sol": p["sol"], "site": p.get("site"), "drive": p.get("drive"),
            "lat": lat, "lon": lon, "col": round(col, 2), "row": round(row, 2),
            "elev_rover": p.get("elev_geoid"), "tilt_rover": p.get("tilt"),
            "elev_dem": None if math.isnan(z_dem) else round(z_dem, 2),
            "slope_dem": None if math.isnan(s_dem) else round(s_dem, 2),
        })
    pts.sort(key=lambda x: (x["sol"], x["drive"] or 0))

    dz = np.array([p["elev_dem"] - p["elev_rover"] for p in pts if p["elev_dem"] is not None and p["elev_rover"] is not None])
    ds = np.array([p["slope_dem"] - p["tilt_rover"] for p in pts if p["slope_dem"] is not None and p["tilt_rover"] is not None])
    val = {
        "n_waypoints": len(pts),
        "sol_range": [pts[0]["sol"], pts[-1]["sol"]] if pts else None,
        "elevation_m": {"mean_diff_dem_minus_rover": float(dz.mean()), "mae": float(np.abs(dz).mean()),
                         "std": float(dz.std()), "n": int(dz.size)},
        "slope_deg": {"mean_diff_dem_minus_tilt": float(ds.mean()), "mae": float(np.abs(ds).mean()),
                      "corr": float(np.corrcoef([p["slope_dem"] for p in pts if p["slope_dem"] is not None and p["tilt_rover"] is not None],
                                                [p["tilt_rover"] for p in pts if p["slope_dem"] is not None and p["tilt_rover"] is not None])[0, 1]),
                      "n": int(ds.size)},
        "source": {"waypoints": URL, "dem": meta["source"]["doi"]},
        "note": "Rover tilt is vehicle attitude (includes rocks under wheels); DEM slope is a 5 m-cell Horn estimate.",
    }
    json.dump(pts, open(os.path.join(OUT, "rover_traverse.json"), "w"))
    json.dump(val, open(os.path.join(OUT, "validation.json"), "w"), indent=2)
    print(json.dumps(val, indent=2))


if __name__ == "__main__":
    main()
