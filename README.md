# Mars Pathfinder — EVA planning on real NASA data

**NASA Space Apps Challenge 2026 · Managua · Challenge: "Interplanetary survival guide: Map of Mars"**

*Explore with purpose. From orbital data to human discovery.*

Mars Pathfinder is a hyperlocal planning and field tool for the first human explorers on Mars. It turns NASA orbital and rover data into a walkable plan for a 3 km EVA at Jezero crater, and gives the crew a helmet HUD that follows that plan on the surface.

- **Mission Control** (`/mission-control`): HiRISE terrain map (2D and 3D), safety layers, science targets ranked by a Science Opportunity Index, A* traverse planning with an O₂ life-support budget, radio line-of-sight, shelters, pre-EVA go/no-go and a Mission Twin simulation.
- **Astronaut HUD** (`/hud`): simulated visor view of the real terrain at true scale, compass and AR cues, O₂ and Bingo margin, terrain and environment alerts, an offline-first field log that syncs back to Mission Control, emergency diversion, real Perseverance reference photos and an onboard science assistant.

> En español: herramienta de planificación hiperlocal para caminatas (EVA) en el cráter Jezero, construida sobre datos reales de NASA/USGS. Mission Control planifica la ruta y el presupuesto de oxígeno; el HUD del astronauta la sigue en la superficie.

## Why it matters

Global and regional tools (Mars Trek, USGS maps) are not built for the metre-scale decisions of a suited astronaut walking a few kilometres with limited oxygen. Mars Pathfinder works at that scale and keeps measured data, derived products and models clearly separated.

## Data (all real, all cited)

| Data | Source | Used for |
|---|---|---|
| HiRISE DTM mosaic, 1 m | USGS, Mars 2020 TRN, DOI [10.5066/P9REJ9JN](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic) (CC0) | Terrain, slope, roughness, routing, line of sight, shelters, 3D |
| HiRISE orthomosaic, 25 cm | USGS, DOI [10.5066/P9QJDP48](https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first) | Imagery layer and 3D texture |
| Perseverance waypoints | [NASA MMGIS M20 waypoints](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json) | Rover traverse, target positions, slope validation (rover tilt) |
| Perseverance raw images | [Mars 2020 raw image API](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Reference photos at each target |
| Curiosity waypoints and raw images | [NASA MMGIS MSL waypoints](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json), [MSL raw images](https://mars.nasa.gov/msl/multimedia/raw-images/) | Mount Sharp boxwork dossier (2025) |
| Cheyava Falls findings | Hurowitz et al., *Nature* 645, 332 (2025) | Target dossier |
| Bunsen Peak findings | NASA, April 2024 | Target dossier |
| Surface radiation | Curiosity RAD, Hassler et al., *Science* 343 (2014) | Dose budget (measured at Gale, applied to Jezero as an approximation) |

**Validation.** DEM slope at 194 Perseverance stops (sols 909–1343) vs. the tilt the rover recorded: mean absolute error 1.57°, r = 0.92 (`public/data/jezero/validation.json`).

**Labelled as models or assumptions in the app:** the Pandolf-based metabolic/O₂ model, suit mass and tank size, the rule-based weather go/no-go, solar-event dose multiplier, Science Opportunity Index scores, the approximate Mars colour tint (HiRISE RED is monochrome) and 3D vertical exaggeration.

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 22 unit tests (terrain, routing, EVA, environment, assistant, real-data checks)
npm run build
```

Processed data is already in `public/data/`. To regenerate it from the NASA/USGS sources (Python 3.10+):

```bash
pip install -r scripts/data-prep/requirements.txt
python scripts/data-prep/crop_jezero.py          # reads the USGS DTM/orthomosaic window remotely
python scripts/data-prep/waypoints_validate.py   # Perseverance waypoints + slope validation
python scripts/data-prep/rover_images.py         # Perseverance reference images
python scripts/data-prep/gale_boxwork.py         # Curiosity boxwork traverse and images
```

## How it works

- `src/lib/core/` — science engine (pure TypeScript, tested): Horn slope, roughness, uncertainty and traversability classes; A* and Dijkstra routing on 640,000 cells; Pandolf metabolic model adapted to Mars gravity with O₂ and Bingo; radio line of sight with Mars curvature; topographic shelters; dose budget; rule-based pre-EVA go/no-go.
- `src/lib/plan.ts` + `plan.worker.ts` — route planning runs in a Web Worker.
- `src/lib/store.ts` — shared state; Mission Control and HUD stay in sync across browser tabs (BroadcastChannel + localStorage).
- `src/components/` — Mission Control, HUD, 2D canvas map and Three.js 3D terrain.

## Limitations and future work

Single 4 × 4 km work area at Jezero; boulders smaller than the 5 m grid are not detected; THEMIS thermal and USGS geologic layers not loaded; metabolic model not validated for pressurised suits; suit telemetry and weather inputs are simulated; no route planning at Gale (no DTM loaded there).

## Use of AI

The team used Claude Code (Anthropic) to help design, write code, check data sources and draft documentation. Data choices, verifications and results were reviewed by the team. The app itself does not run any AI model: the science assistant is a curated, offline knowledge base.

## Credits

NASA/JPL-Caltech, University of Arizona (HiRISE), USGS Astrogeology Science Center, MSSS. Imagery and data courtesy of NASA; NASA does not endorse this project.
