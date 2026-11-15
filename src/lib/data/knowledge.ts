/**
 * Onboard science assistant: a CURATED knowledge base (no language model, no network).
 * Every answer has three blocks:
 *   [1] measured: what NASA instruments measured, with the source
 *   [2] derived:  products computed by MARS PATHFINDER, filled with live mission values
 *   [3] interpretation: current hypotheses and their limitations
 */
import { RAD_GCR_UGY_PER_DAY, RAD_GCR_USV_PER_DAY } from "@/lib/core/radiation";
import type { GoLevel } from "@/lib/core/atmosphere";

export interface AssistantContext {
  targetName: string;
  slopeDeg: number | null;
  uncertainty: number | null;
  roughness: number | null;
  o2RemainingPct: number | null;
  o2RateLmin: number | null;
  bingoMarginL: number | null;
  remainingKm: number | null;
  comm: boolean | null;
  shelterM: number | null;
  shelterBrg: number | null;
  doseUSv: number | null;
  atmosLevel: GoLevel;
  atmosReasons: string[];
  tau: number;
  ls: number;
}

export interface Answer {
  measured: { text: string; source: string }[];
  derived: string[];
  interpretation: string[];
}

interface Entry {
  id: string;
  question: string;
  keywords: string[];
  answer: (c: AssistantContext) => Answer;
}

const f = (v: number | null, d = 1, u = "") => (v === null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}${u}`);

export const KNOWLEDGE: Entry[] = [
  {
    id: "cheyava",
    question: "What is Cheyava Falls and why sample it?",
    keywords: ["cheyava", "falls", "arrowhead", "leopard", "spots", "sapphire", "bright angel", "neretva", "vivianite", "greigite"],
    answer: () => ({
      measured: [
        { text: "PIXL and SHERLOC found mm-scale 'leopard spots' with iron-phosphate (vivianite) and iron-sulfide (greigite) signatures next to organic carbon.", source: "Hurowitz et al., Nature 645 (2025)" },
        { text: "White calcium-sulfate veins cross the rock.", source: "Mars 2020 science team" },
        { text: "Core 'Sapphire Canyon' was collected here on 21 July 2024.", source: "NASA / Mars 2020" },
      ],
      derived: [
        "Target position = Perseverance position at sols 1206–1210 (M20 waypoints), metre-level accuracy.",
        "Ranked first by the Science Opportunity Index with the default weights (team-assigned scores).",
      ],
      interpretation: [
        "Redox reactions that make these minerals can be driven by microbes on Earth: a potential biosignature.",
        "Limitation: abiotic chemistry can also produce them. Only laboratory analysis on Earth can decide.",
      ],
    }),
  },
  {
    id: "life",
    question: "Is this evidence of life?",
    keywords: ["life", "biosignature", "biotic", "abiotic", "microbe", "alive", "organic"],
    answer: () => ({
      measured: [
        { text: "Organic carbon co-located with vivianite and greigite reaction fronts in Cheyava Falls.", source: "Hurowitz et al., Nature 645 (2025)" },
        { text: "Bunsen Peak: ~75% carbonate grains cemented by almost pure microcrystalline silica.", source: "NASA, April 2024" },
      ],
      derived: ["None: this question cannot be answered by terrain or life-support models."],
      interpretation: [
        "NASA calls Cheyava Falls a POTENTIAL biosignature, the strongest found so far, not evidence of life.",
        "Microcrystalline silica and carbonate are good at preserving signs of past life if any existed.",
        "Limitation: abiotic explanations remain possible; returned samples are needed.",
      ],
    }),
  },
  {
    id: "bunsen",
    question: "What is Bunsen Peak?",
    keywords: ["bunsen", "margin", "carbonate", "silica", "shore", "lake"],
    answer: () => ({
      measured: [
        { text: "Perseverance's 24th sample, cored on sol 1088 (11 March 2024), 3rd from the Margin Unit.", source: "NASA, April 2024" },
        { text: "About 75% carbonate grains cemented by almost pure silica.", source: "NASA, April 2024" },
      ],
      derived: ["Position = rover stop at sols 1084–1092 (M20 waypoints). Route C visits it on the way to Cheyava Falls."],
      interpretation: [
        "Working hypothesis: formed along the shore of Jezero's ancient lake.",
        "Limitation: other carbonate/silica origins are still being considered.",
      ],
    }),
  },
  {
    id: "slope",
    question: "Is the ground here safe to walk?",
    keywords: ["slope", "safe", "ground", "terrain", "walk", "steep", "footing", "rock", "fall", "slip"],
    answer: (c) => ({
      measured: [
        { text: "Elevation from the HiRISE stereo DTM mosaic (1 m posts).", source: "USGS, DOI 10.5066/P9REJ9JN" },
      ],
      derived: [
        `Slope under you: ${f(c.slopeDeg, 1, "°")} (Horn method, 5 m cells). Validated against Perseverance tilt: mean error 1.57°.`,
        `Roughness index ${f(c.roughness, 2)} (0 smooth – 1 blocks/ridges). Map uncertainty U ${f(c.uncertainty, 2)}.`,
      ],
      interpretation: [
        (c.slopeDeg ?? 0) > 12 ? "Steep for a suited crew carrying load: shorten steps, keep 3 points of contact on outcrops." : "Within the comfortable range for suited walking.",
        "Limitation: obstacles smaller than ~5 m (single boulders, small scarps) are not resolved by the grid; look ahead.",
      ],
    }),
  },
  {
    id: "o2",
    question: "Do I have enough oxygen to get back?",
    keywords: ["oxygen", "o2", "bingo", "tank", "return", "back", "air", "consumption"],
    answer: (c) => ({
      measured: [{ text: "None: suit telemetry is simulated in this prototype.", source: "—" }],
      derived: [
        `O₂ remaining ${f(c.o2RemainingPct, 0, "%")} · current consumption ${f(c.o2RateLmin, 2, " L/min")}.`,
        `Margin over (return O₂ + 20% reserve): ${f(c.bingoMarginL, 0, " L")}. ${c.bingoMarginL !== null && c.bingoMarginL < 0 ? "BINGO: start return now." : "Above Bingo."}`,
      ],
      interpretation: [
        "Model: Pandolf (1977) load-carriage equation adapted to Mars gravity; return assumed along the same route.",
        "Limitation: not validated for pressurised suits; suit penalty and tank size are assumptions.",
      ],
    }),
  },
  {
    id: "radio",
    question: "Why did I lose radio?",
    keywords: ["radio", "comm", "signal", "blackout", "contact", "offline", "shadow"],
    answer: (c) => ({
      measured: [{ text: "Terrain heights from the HiRISE DTM mosaic.", source: "USGS, DOI 10.5066/P9REJ9JN" }],
      derived: [
        `Radio line of sight here: ${c.comm === null ? "—" : c.comm ? "YES" : "NO (terrain blocks the base antenna)"}.`,
        "Computed by ray tracing from the base mast over the DTM, including Mars curvature (d²/2R).",
      ],
      interpretation: [
        "Channels such as Neretva Vallis sit below the line from the base mast, so the walls block the signal.",
        "Field logs are cached on the suit and sync when line of sight returns. A rover or mast relay would remove the shadow.",
        "Limitation: terrain-only model; no multipath, antenna pattern or relay satellites.",
      ],
    }),
  },
  {
    id: "radiation",
    question: "How much radiation am I getting?",
    keywords: ["radiation", "dose", "sievert", "gray", "cosmic", "sep", "solar", "shelter"],
    answer: (c) => ({
      measured: [
        { text: `Surface dose at Gale: ~${RAD_GCR_UGY_PER_DAY} µGy/day absorbed, ~${RAD_GCR_USV_PER_DAY} µSv/day dose equivalent.`, source: "Curiosity RAD, Hassler et al., Science 2014" },
      ],
      derived: [
        `Dose so far this EVA: ${f(c.doseUSv, 0, " µSv")}.`,
        c.shelterM !== null ? `Nearest topographic shelter: ${f(c.shelterM, 0, " m")} at bearing ${f(c.shelterBrg, 0, "°")}.` : "Shelters not computed yet.",
      ],
      interpretation: [
        "Terrain that blocks part of the sky reduces exposure to cosmic rays arriving from that direction.",
        "Limitation: RAD measured at Gale, not Jezero; solar-event doses in the app are scenarios.",
      ],
    }),
  },
  {
    id: "dust",
    question: "Is a dust storm coming?",
    keywords: ["dust", "storm", "wind", "weather", "devil", "tau", "opacity", "pressure", "no-go", "forecast"],
    answer: (c) => ({
      measured: [{ text: "Inputs come from the latest MEDA weather report and NASA DONKI as entered by Mission Control.", source: "Mars 2020 MEDA / NASA DONKI" }],
      derived: [
        `Pre-EVA status: ${c.atmosLevel}. τ = ${c.tau.toFixed(2)}, Ls = ${c.ls.toFixed(0)}°${c.ls >= 180 && c.ls <= 330 ? " (dust season)" : ""}.`,
        ...c.atmosReasons.map((r) => `Rule: ${r}`),
      ],
      interpretation: [
        "Regional storms are most frequent in southern spring–summer (Ls 180°–330°).",
        "Limitation: rule-based index, not a forecast; thresholds are team choices.",
      ],
    }),
  },
  {
    id: "boxwork",
    question: "What are the boxwork ridges on Mount Sharp?",
    keywords: ["boxwork", "gale", "sharp", "curiosity", "ridges", "spiderweb", "reticul", "nodule", "groundwater"],
    answer: () => ({
      measured: [
        { text: "Ridges ~1–2 m tall with sandy hollows; the network spans 10–20 km of Mount Sharp.", source: "NASA, 2025" },
        { text: "Pea-sized nodules imaged in ridges and hollows (sols 4649–4654).", source: "NASA Curiosity blog" },
      ],
      derived: ["Curiosity's 2025 path through the boxwork is drawn from MSL waypoints (sols 4540–4790)."],
      interpretation: [
        "Groundwater cemented fractures; the hardened walls survived wind erosion while softer rock wore away.",
        "Limitation: how such a large network formed is still an open question.",
      ],
    }),
  },
];

/** Simple keyword match; returns null when the onboard base has no verified answer. */
export function findEntry(q: string): Entry | null {
  const t = q.toLowerCase();
  let best: Entry | null = null, score = 0;
  for (const e of KNOWLEDGE) {
    const s = e.keywords.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
    if (s > score) { score = s; best = e; }
  }
  return best;
}
