"""Low-resolution context terrain around the work area (visual only, not used in any calculation).

Same USGS Mars 2020 TRN HiRISE DTM + orthomosaic as crop_jezero.py, over a 10 x 10 km window
centred on the work area, decimated (nearest neighbour) so only ~1 row in 20 is read remotely.

Outputs (public/data/jezero/):
  context.bin        Float32 LE, 500 x 500 cells of 20 m (row 0 = north)
  context.meta.json  georeference + provenance
  context_ortho.webp HiRISE orthoimage at 8 m/px over the same window
"""
import json
import math
import os

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from PIL import Image

from crop_jezero import BASE, DTM_FILE, ORTHO_FILE, R_MARS, CENTER_LAT, CENTER_LON, OUT

SIZE_M = 10000.0
CELL_M = 20.0
ORTHO_CELL_M = 8.0


def main():
    coslat = math.cos(math.radians(CENTER_LAT))
    cx, cy = R_MARS * math.radians(CENTER_LON), R_MARS * math.radians(CENTER_LAT)
    left, right = cx - SIZE_M / 2 / coslat, cx + SIZE_M / 2 / coslat
    bottom, top = cy - SIZE_M / 2, cy + SIZE_M / 2
    n = int(SIZE_M / CELL_M)
    with rasterio.open("/vsicurl/" + BASE + DTM_FILE) as src:
        win = from_bounds(left, bottom, right, top, src.transform)
        dem = src.read(1, window=win, out_shape=(n, n), resampling=Resampling.nearest).astype(np.float32)
    dem[(dem < -9000) | (dem > 30000)] = np.nan
    dem.astype("<f4").tofile(os.path.join(OUT, "context.bin"))
    meta = {
        "width": n, "height": n, "cell_size_m": CELL_M,
        "bounds": {"north": math.degrees(top / R_MARS), "south": math.degrees(bottom / R_MARS),
                   "west": math.degrees(left / R_MARS), "east": math.degrees(right / R_MARS)},
        "z_min": float(np.nanmin(dem)), "z_max": float(np.nanmax(dem)),
        "valid_fraction": float(np.isfinite(dem).mean()),
        "use": "visual context only; not used in any calculation",
        "source": {"doi": "10.5066/P9REJ9JN", "file": DTM_FILE, "resampling": "nearest 1 m -> 20 m"},
        "ortho": {"file": "context_ortho.webp", "pixel_size_m": ORTHO_CELL_M, "doi": "10.5066/P9QJDP48"},
    }
    json.dump(meta, open(os.path.join(OUT, "context.meta.json"), "w"), indent=2)
    print("context DEM", dem.shape, meta["z_min"], meta["z_max"], meta["valid_fraction"])
    m = int(SIZE_M / ORTHO_CELL_M)
    with rasterio.open("/vsicurl/" + BASE + ORTHO_FILE) as src:
        win = from_bounds(left, bottom, right, top, src.transform)
        img = src.read(1, window=win, out_shape=(m, m), resampling=Resampling.nearest)
    Image.fromarray(img).save(os.path.join(OUT, "context_ortho.webp"), quality=80, method=6)
    print("context ortho", img.shape)


if __name__ == "__main__":
    main()
