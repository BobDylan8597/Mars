"""Crop the USGS Mars 2020 TRN HiRISE DTM + orthomosaic around the Cheyava Falls work area.

Reads only the needed window remotely (HTTP range requests via GDAL /vsicurl/), so the
1.8 GB DTM and 7.4 GB orthomosaic are never fully downloaded.

Outputs (public/data/jezero/):
  dem.bin        Float32 little-endian, row-major, north->south, west->east; NaN = no data
  dem.meta.json  grid georeference + provenance
  ortho.webp     grayscale HiRISE orthoimage resampled to the same footprint

The source grid is Equirectangular (Mars 2000 sphere, lat_ts = 0). At latitude phi, one
projected metre in x equals cos(phi) ground metres, so the projected window is widened by
1/cos(phi) in x to give square ground cells. Rows are therefore true-scale in both axes.

Usage: python scripts/data-prep/crop_jezero.py
"""
import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from PIL import Image

BASE = "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/"
DTM_FILE = "JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif"
ORTHO_FILE = "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif"
R_MARS = 3396190.0  # Mars 2000 sphere radius (m), from the file CRS

# Work area: centred east of the Perseverance Cheyava Falls campaign position
# (sols 1185-1210, ~18.4975 N, 77.3052 E, from M20_waypoints.json) so that smoother
# crater floor for a base site is included.
CENTER_LAT = 18.490
CENTER_LON = 77.318
SIZE_M = 4000.0      # ground size of the square window
CELL_M = 5.0         # output ground cell size
ORTHO_CELL_M = 2.0   # output ortho pixel size

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "data", "jezero")


def proj_bounds():
    coslat = math.cos(math.radians(CENTER_LAT))
    cx = R_MARS * math.radians(CENTER_LON)
    cy = R_MARS * math.radians(CENTER_LAT)
    half_y = SIZE_M / 2
    half_x = SIZE_M / 2 / coslat
    return cx - half_x, cy - half_y, cx + half_x, cy + half_y


def main():
    os.makedirs(OUT, exist_ok=True)
    left, bottom, right, top = proj_bounds()
    n = int(round(SIZE_M / CELL_M))

    with rasterio.open("/vsicurl/" + BASE + DTM_FILE) as src:
        win = from_bounds(left, bottom, right, top, src.transform)
        arr = src.read(1, window=win, out_shape=(n, n), resampling=Resampling.average,
                       masked=True).astype(np.float32)
        nodata_src = src.nodata
    dem = arr.filled(np.nan)
    # guard against nodata leaking through averaging
    dem[(dem < -9000) | (dem > 30000)] = np.nan
    dem.astype("<f4").tofile(os.path.join(OUT, "dem.bin"))

    valid = np.isfinite(dem)
    lat_n = math.degrees(top / R_MARS)
    lat_s = math.degrees(bottom / R_MARS)
    lon_w = math.degrees(left / R_MARS)
    lon_e = math.degrees(right / R_MARS)
    meta = {
        "region": "jezero",
        "width": n, "height": n, "cell_size_m": CELL_M,
        "bounds": {"north": lat_n, "south": lat_s, "west": lon_w, "east": lon_e},
        "z_units": "m, relative to the MOLA areoid (per source product name)",
        "z_min": float(np.nanmin(dem)), "z_max": float(np.nanmax(dem)),
        "valid_fraction": float(valid.mean()),
        "layout": "Float32 LE, row-major, row 0 = north, col 0 = west, NaN = no data",
        "resampling": f"area average 1 m -> {CELL_M} m ground cells (x widened by 1/cos(lat))",
        "source": {
            "dataset": "Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic",
            "producer": "USGS Astrogeology Science Center (Fergason et al.)",
            "doi": "10.5066/P9REJ9JN",
            "file": DTM_FILE,
            "url": BASE + DTM_FILE,
            "native_resolution_m": 1.0,
            "license": "CC0-1.0",
            "source_nodata": nodata_src,
        },
        "ortho": {
            "file": "ortho.webp", "pixel_size_m": ORTHO_CELL_M,
            "dataset": "Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic",
            "producer": "USGS Astrogeology Science Center", "doi": "10.5066/P9QJDP48",
            "source_file": ORTHO_FILE, "native_resolution_m": 0.25,
            "resampling": "nearest-neighbour decimation (visual context only)",
        },
        "generated_by": "scripts/data-prep/crop_jezero.py",
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    with open(os.path.join(OUT, "dem.meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("DEM", dem.shape, "valid", round(valid.mean(), 4), "z", meta["z_min"], meta["z_max"])

    m = int(round(SIZE_M / ORTHO_CELL_M))
    with rasterio.open("/vsicurl/" + BASE + ORTHO_FILE) as src:
        win = from_bounds(left, bottom, right, top, src.transform)
        img = src.read(1, window=win, out_shape=(m, m), resampling=Resampling.nearest)
    Image.fromarray(img).save(os.path.join(OUT, "ortho.webp"), quality=82, method=6)
    print("ORTHO", img.shape)


if __name__ == "__main__":
    main()
