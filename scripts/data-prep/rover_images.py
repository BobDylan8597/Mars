"""Select real Perseverance raw images taken at each science target's rover stop.

Source: NASA Mars 2020 raw image API (https://mars.nasa.gov/mars2020/multimedia/raw-images/)
Output: public/data/jezero/images.json  (metadata + NASA-hosted URLs; images are not copied)
"""
import json
import os
import urllib.request

API = ("https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json"
       "&num=100&page={page}&order=sol%20desc&condition_2={a}:sol:gte&condition_3={b}:sol:lte")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "data", "jezero", "images.json")

TARGETS = {
    "JZ-T1": (1206, 1215),   # Cheyava Falls campaign (rover parked sols 1206-1210, core sol ~1215)
    "JZ-T2": (1084, 1092),   # Bunsen Peak stop (core sol 1088)
}
# preferred cameras, in display order, with how many to keep
WANT = [("MCZ_LEFT", 4), ("NAVCAM_LEFT", 3), ("SHERLOC_WATSON", 2), ("FRONT_HAZCAM_LEFT_A", 1), ("CACHECAM", 2), ("SUPERCAM_RMI", 1)]


def fetch(a, b):
    out = []
    for page in range(0, 12):
        req = urllib.request.Request(API.format(page=page, a=a, b=b), headers={"User-Agent": "mars-pathfinder-data-prep"})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
        imgs = d.get("images", [])
        out += imgs
        if len(imgs) < 100:
            break
    return out


def main():
    result = {}
    for tid, (a, b) in TARGETS.items():
        imgs = [i for i in fetch(a, b) if i.get("sample_type") == "Full"]
        picked = []
        for cam, n in WANT:
            cands = [i for i in imgs if i["camera"]["instrument"] == cam]
            # spread over the sol range
            cands.sort(key=lambda i: (i["sol"], i["date_taken_utc"]))
            if cands:
                stride = max(1, len(cands) // n)
                picked += cands[::stride][:n]
        result[tid] = [{
            "imageid": i["imageid"],
            "sol": i["sol"],
            "instrument": i["camera"]["instrument"],
            "mastAz": i["extended"].get("mastAz"),
            "mastEl": i["extended"].get("mastEl"),
            "date_taken_utc": i["date_taken_utc"],
            "small": i["image_files"].get("small"),
            "medium": i["image_files"].get("medium"),
            "large": i["image_files"].get("large"),
            "full_res": i["image_files"].get("full_res"),
            "credit": i.get("credit"),
            "link": i.get("link"),
            "title": i.get("title"),
        } for i in picked]
        print(tid, len(imgs), "full-frame images ->", len(result[tid]), "picked", sorted({p["instrument"] for p in result[tid]}))
    with open(OUT, "w") as f:
        json.dump({"source": "NASA Mars 2020 raw image API", "api": API.split("&num")[0], "targets": result}, f, indent=1)


if __name__ == "__main__":
    main()
