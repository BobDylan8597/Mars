"""Curiosity at the Mount Sharp boxwork formations (2025): real traverse + real images.

Inputs : data-raw/MSL_waypoints.json (https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json)
         NASA MSL raw image API (https://mars.nasa.gov/api/v1/raw_image_items/)
Output : public/data/gale/boxwork.json
"""
import json
import re
import os
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
RAW = os.path.join(ROOT, "data-raw", "MSL_waypoints.json")
OUT = os.path.join(ROOT, "public", "data", "gale")
WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
API = ("https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20asc&per_page=100&page={page}"
       "&condition_1=msl:mission&condition_2={a}:sol:gte&condition_3={b}:sol:lte")

SOLS = (4540, 4800)          # boxwork campaign, mid-2025
IMAGE_SOLS = (4645, 4656)    # NASA blog "Sols 4649-4654: Ridges, Hollows, and Nodules"
WANT = [("MAST_LEFT", 3), ("MAST_RIGHT", 2), ("NAV_LEFT_B", 2), ("NAV_RIGHT_B", 2), ("MAHLI", 3), ("FHAZ_LEFT_B", 1), ("CHEMCAM_RMI", 1)]


def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(RAW):
        urllib.request.urlretrieve(WAYPOINTS_URL, RAW)
    feats = json.load(open(RAW))["features"]
    trav = [{"sol": f["properties"]["sol"], "lat": f["properties"]["lat"], "lon": f["properties"]["lon"],
             "elev": f["properties"]["elev_geoid"], "dist_total_m": f["properties"].get("dist_total_m")}
            for f in feats if SOLS[0] <= f["properties"]["sol"] <= SOLS[1]]
    trav.sort(key=lambda p: p["sol"])

    items = []
    for sol in range(IMAGE_SOLS[0], IMAGE_SOLS[1] + 1):
        for page in range(0, 3):
            req = urllib.request.Request(API.format(page=page, a=sol, b=sol), headers={"User-Agent": "mars-pathfinder-data-prep"})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.load(r)
            items += d.get("items", [])
            if len(d.get("items", [])) < 100:
                break
    def big(i):
        m = re.findall(r"\d+", i.get("subframe_rect") or "")
        return len(m) == 4 and int(m[2]) >= 1000
    full = [i for i in items if not i.get("is_thumbnail") and big(i)]
    picked = []
    for cam, n in WANT:
        c = [i for i in full if i.get("instrument") == cam]
        if c:
            stride = max(1, len(c) // n)
            picked += c[::stride][:n]
    images = [{"imageid": i["imageid"], "sol": i["sol"], "instrument": i["instrument"],
               "url": i.get("https_url") or i.get("url"), "date_taken": i.get("date_taken"),
               "title": i.get("title")} for i in picked]
    data = {
        "source": {"waypoints": WAYPOINTS_URL, "images": "NASA MSL raw image API"},
        "campaign_sols": SOLS,
        "traverse": trav,
        "images": images,
    }
    json.dump(data, open(os.path.join(OUT, "boxwork.json"), "w"), indent=1)
    print(len(trav), "waypoints;", len(items), "images in sols", IMAGE_SOLS, "->", len(images), "picked",
          sorted({i["instrument"] for i in images}))


if __name__ == "__main__":
    main()
