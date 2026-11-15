import type { SoiScores } from "@/lib/core/soi";

export type Verification = "VERIFIED" | "CONTEXTUAL" | "MODELLED";

export interface SourceRef {
  label: string;
  url?: string;
}

export interface Provenance {
  mission: string;
  instrument: string;
  productId: string;
  observationDate: string;
  spatialResolution: string;
  coverage: string;
  uncertainty: string;
  temporalClass: "Static / relatively stable" | "Historical observation" | "Derived product" | "Modelled / operational";
  verification: Verification;
  sources: SourceRef[];
}

export interface ScienceTarget {
  id: string;
  name: string;
  region: "jezero" | "gale";
  lat: number;
  lon: number;
  locationNote: string;
  summary: string;
  findings: string[];
  limitations: string[];
  samplingChecklist: string[];
  scores: SoiScores;
  scoreRationale: Record<keyof SoiScores, string>;
  provenance: Provenance;
}

export interface BaseSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note: string;
}

/** Selected on the DEM: 80 m x 80 m block with mean slope 1.9 deg, 95th percentile < 4.1 deg. */
export const BASE_SITE: BaseSite = {
  id: "BASE-1",
  name: "Habitat / Lander (study site)",
  lat: 18.47714,
  lon: 77.34971,
  note: "Hypothetical base chosen by the team on the HiRISE DTM: flattest 80 m block 2.2-3 km from Cheyava Falls (mean slope 1.9°). Not a NASA landing site.",
};

export const TARGETS: ScienceTarget[] = [
  {
    id: "JZ-T1",
    name: "Cheyava Falls",
    region: "jezero",
    lat: 18.4975,
    lon: 77.30527,
    locationNote:
      "Perseverance position at sols 1206-1210 (M20 waypoints). The 'Sapphire Canyon' core was collected on 21 July 2024 (sol ~1215, derived from the date) before the next drive on sol 1219, so the rock is within arm's reach of this point.",
    summary:
      "Arrowhead-shaped mudstone in the Bright Angel formation, Neretva Vallis. Mm-scale 'leopard spots' with iron-phosphate (vivianite) and iron-sulfide (greigite) signatures next to organic matter: a potential biosignature.",
    findings: [
      "PIXL + SHERLOC: reaction-front 'leopard spots' rich in vivianite and greigite, associated with organic carbon (Hurowitz et al., Nature 645, 2025).",
      "Calcium-sulfate veins crossing the rock indicate later water circulation.",
      "Core sample 'Sapphire Canyon' cached by Perseverance for possible return to Earth.",
    ],
    limitations: [
      "NASA and the authors call it a POTENTIAL biosignature; abiotic explanations are still possible.",
      "Definitive tests require laboratory analysis on Earth.",
      "Target position is the rover position, not a surveyed rock coordinate (metre-level offset).",
    ],
    samplingChecklist: [
      "Photograph the arrowhead face and the vein network with scale bar",
      "Map leopard-spot density along a 20 cm transect",
      "Handheld XRF/Raman on spot rims vs. cores (Fe, P, S)",
      "Collect paired sample: spotted vs. unspotted mudstone",
      "Log stratigraphic position relative to the Neretva Vallis channel floor",
    ],
    scores: { M: 0.95, G: 0.9, T: 1.0, Q: 0.9 },
    scoreRationale: {
      M: "In-situ PIXL/SHERLOC detections of vivianite, greigite and organics.",
      G: "Fluvial channel deposit with clear relationship to Jezero's water history.",
      T: "Directly tests the astrobiology question (biotic vs. abiotic redox).",
      Q: "1 m HiRISE DTM + 25 cm orthoimage + rover proximity data.",
    },
    provenance: {
      mission: "Mars 2020 (Perseverance)",
      instrument: "PIXL, SHERLOC, Mastcam-Z; MRO HiRISE (terrain)",
      productId: "Nature 645, 332 (2025); M20 waypoints sols 1206-1210",
      observationDate: "July 2024 (sol ~1215)",
      spatialResolution: "Sub-mm (PIXL) / 1 m (DTM)",
      coverage: "Point target",
      uncertainty: "Position: rover location, metre-level",
      temporalClass: "Historical observation",
      verification: "VERIFIED",
      sources: [
        { label: "Hurowitz et al., Nature 645 (2025)", url: "https://www.nature.com/search?q=Redox-driven+mineral+and+organic+associations+in+Jezero+crater" },
        { label: "M20 waypoints (MMGIS)", url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json" },
      ],
    },
  },
  {
    id: "JZ-T2",
    name: "Bunsen Peak (Margin Unit)",
    region: "jezero",
    lat: 18.49183,
    lon: 77.3272,
    locationNote:
      "Perseverance position at sols 1084-1092 (M20 waypoints). NASA dates the Bunsen Peak coring to sol 1088 (11 March 2024).",
    summary:
      "Margin Unit outcrop along the inner edge of Jezero's rim, one of the most carbonate-rich areas on Mars seen from orbit. Bunsen Peak was Perseverance's 24th sample and the 3rd from the Margin Unit.",
    findings: [
      "About 75% carbonate grains cemented by almost pure silica (abrasion patch + proximity spectrometers).",
      "Microcrystalline silica and carbonate are good at trapping and preserving potential biosignatures.",
      "Working hypothesis: formed along the shore of the ancient lake; other origins are still considered.",
    ],
    limitations: [
      "Lakeshore origin is a hypothesis, not confirmed.",
      "Target position is the rover position at the sampling stop.",
    ],
    samplingChecklist: [
      "Context image of the outcrop and layering orientation",
      "Abrade and image the carbonate grains vs. silica cement",
      "Measure dip of layers (shoreline vs. other origin)",
      "Collect hand sample of cement-rich and grain-rich parts",
    ],
    scores: { M: 0.9, G: 0.85, T: 0.85, Q: 0.9 },
    scoreRationale: {
      M: "Carbonate + silica confirmed in situ; strong orbital carbonate signature.",
      G: "Possible ancient lakeshore deposit.",
      T: "Preservation potential for biosignatures; supports the habitability question.",
      Q: "1 m HiRISE DTM + 25 cm orthoimage + rover data.",
    },
    provenance: {
      mission: "Mars 2020 (Perseverance)",
      instrument: "PIXL, SHERLOC, SuperCam; MRO HiRISE (terrain)",
      productId: "NASA release Apr 2024 (Bunsen Peak, sample 24); M20 waypoints sols 1084-1092",
      observationDate: "11 March 2024 (sol 1088)",
      spatialResolution: "Sub-mm (PIXL) / 1 m (DTM)",
      coverage: "Point target",
      uncertainty: "Position: rover location, metre-level",
      temporalClass: "Historical observation",
      verification: "VERIFIED",
      sources: [
        { label: "NASA / phys.org: Rock sampled by Perseverance embodies why rover came to Mars (Apr 2024)", url: "https://phys.org/news/2024-04-sampled-nasa-perseverance-embodies-rover.amp" },
        { label: "M20 waypoints (MMGIS)", url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json" },
      ],
    },
  },
];

export const DEM_PROVENANCE: Provenance = {
  mission: "Mars Reconnaissance Orbiter",
  instrument: "HiRISE (stereo DTM mosaic, USGS)",
  productId: "JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m (DOI 10.5066/P9REJ9JN)",
  observationDate: "HiRISE stereo pairs 2007-2019; mosaic released 2020",
  spatialResolution: "1 m native, resampled to 5 m",
  coverage: "Jezero crater floor and western rim (18.30-18.67 N, 77.22-77.58 E)",
  uncertainty: "Validated: DEM slope vs. Perseverance tilt",
  temporalClass: "Static / relatively stable",
  verification: "VERIFIED",
  sources: [{ label: "USGS data release", url: "https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic" }],
};

export const ORTHO_PROVENANCE: Provenance = {
  mission: "Mars Reconnaissance Orbiter",
  instrument: "HiRISE (orthorectified mosaic, USGS)",
  productId: "JEZ_hirise_soc_006_orthoMosaic_25cm (DOI 10.5066/P9QJDP48)",
  observationDate: "HiRISE images 2007-2019; mosaic released 2020",
  spatialResolution: "0.25 m native, shown at 2 m",
  coverage: "Jezero crater floor and western rim",
  uncertainty: "Visual context only (nearest-neighbour decimation)",
  temporalClass: "Static / relatively stable",
  verification: "VERIFIED",
  sources: [{ label: "USGS Astrogeology", url: "https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first" }],
};

export const ROVER_PROVENANCE: Provenance = {
  mission: "Mars 2020 (Perseverance)",
  instrument: "Rover localisation (MMGIS waypoints)",
  productId: "M20_waypoints.json",
  observationDate: "Sols 909-1343 inside this map",
  spatialResolution: "Point positions",
  coverage: "Rover traverse",
  uncertainty: "Localisation, metre-level",
  temporalClass: "Historical observation",
  verification: "VERIFIED",
  sources: [{ label: "NASA MMGIS", url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json" }],
};

export function derivedProvenance(what: string, method: string): Provenance {
  return {
    mission: "Derived from MRO HiRISE DTM",
    instrument: "MARS PATHFINDER core engine",
    productId: method,
    observationDate: "Computed in the browser",
    spatialResolution: "5 m cells",
    coverage: "Map window (4 x 4 km)",
    uncertainty: what,
    temporalClass: "Derived product",
    verification: "MODELLED",
    sources: [{ label: "src/lib/core/terrain.ts" }],
  };
}
