"""Builds the proposal document (ES + EN) as HTML; print to PDF with scripts/docs/print_pdf.mjs.

Team identification fields are placeholders until the team provides them (TEAM below).
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
DOCS = os.path.join(ROOT, "docs")
val = json.load(open(os.path.join(ROOT, "public", "data", "jezero", "validation.json")))
env = json.load(open(os.path.join(DOCS, "evidence", "env.json"))) if os.path.exists(os.path.join(DOCS, "evidence", "env.json")) else {"blackout": None, "shelters": None}

TEAM = {
    "name": "[Team name / Nombre del equipo]",
    "members": "[Members / Integrantes]",
    "video": "[Video link / Enlace al video]",
}
APP = "https://mars-beta-fawn.vercel.app"
REPO = "https://github.com/BobDylan8597/Mars"
MAE = f"{val['slope_deg']['mae']:.2f}"
R = f"{val['slope_deg']['corr']:.2f}"
N = val["slope_deg"]["n"]
SOLS = f"{val['sol_range'][0]}–{val['sol_range'][1]}"
BLACK = f"{env['blackout']}" if env.get("blackout") else "—"
SHEL = f"{env['shelters']}" if env.get("shelters") else "—"

ROUTES = [  # default scenario: 15 kg load, 0.8 m/s, 60 min science, Smax 15 deg, 600 L usable O2 (assumption)
    ("A", {"es": "Más corta", "en": "Shortest"}, "3.00", "15.0", "6.2", "136", "63", "219 (37%)", "63%"),
    ("B", {"es": "Más segura", "en": "Safest"}, "3.19", "12.9", "3.5", "113", "67", "220 (37%)", "63%"),
    ("C", {"es": "Máxima ciencia (vía Bunsen Peak)", "en": "Max science (via Bunsen Peak)"}, "3.07", "12.9", "4.1", "119", "64", "217 (36%)", "64%"),
]

ARCH = """<svg viewBox="0 0 760 250" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, Arial" font-size="11">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#666"/></marker></defs>
<g fill="#f6f3ef" stroke="#c9b9a8">
<rect x="8" y="14" width="190" height="222" rx="6"/><rect x="232" y="14" width="190" height="222" rx="6"/><rect x="456" y="14" width="296" height="104" rx="6"/><rect x="456" y="132" width="296" height="104" rx="6"/></g>
<g fill="#222"><text x="18" y="34" font-weight="600">{d}</text>
<text x="18" y="56">USGS HiRISE DTM 1 m (DOI)</text><text x="18" y="74">USGS HiRISE orthoimage 25 cm</text><text x="18" y="92">Perseverance waypoints (MMGIS)</text><text x="18" y="110">Perseverance raw images (API)</text><text x="18" y="128">Curiosity waypoints + images</text><text x="18" y="146">RAD dose (Hassler 2014)</text><text x="18" y="164">Nature 2025 / NASA releases</text>
<text x="18" y="196" fill="#666">{prep}</text><text x="18" y="212" fill="#666">scripts/data-prep/*.py</text>
<text x="242" y="34" font-weight="600">{eng}</text>
<text x="242" y="56">Horn slope · roughness · U</text><text x="242" y="74">Traversability classes</text><text x="242" y="92">A* + Dijkstra check</text><text x="242" y="110">Pandolf → O₂ + Bingo</text><text x="242" y="128">Radio line of sight</text><text x="242" y="146">Shelters (sky blockage)</text><text x="242" y="164">Go/no-go rules · dose</text>
<text x="242" y="196" fill="#666">{tests}</text><text x="242" y="212" fill="#666">src/lib/core · Web Worker</text>
<text x="466" y="34" font-weight="600">Mission Control</text>
<text x="466" y="56">{mc1}</text><text x="466" y="74">{mc2}</text><text x="466" y="92">{mc3}</text>
<text x="466" y="152" font-weight="600">Astronaut HUD</text>
<text x="466" y="174">{h1}</text><text x="466" y="192">{h2}</text><text x="466" y="210">{h3}</text></g>
<g stroke="#666" stroke-width="1.4" fill="none" marker-end="url(#a)"><path d="M198 125 H230"/><path d="M422 70 H454"/><path d="M422 185 H454"/></g>
<g stroke="#2e8b72" stroke-width="1.4" fill="none" marker-end="url(#a)"><path d="M600 118 V130"/><path d="M620 132 V120"/></g>
<text x="628" y="128" font-size="10" fill="#2e8b72">{sync}</text>
</svg>"""


def arch(lang):
    t = {
        "es": dict(d="Datos NASA / USGS", prep="Preparación (Python, 1 vez)", eng="Motor científico", tests="24 pruebas automáticas",
                   mc1="Mapa 2D/3D y capas con procedencia", mc2="Objetivos, SOI, rutas A/B/C", mc3="Twin, clima, radio, refugios",
                   h1="Visor 3D a escala real + RA", h2="O₂, Bingo, terreno, ambiente", h3="Bitácora offline, emergencias", sync="sincronización entre pestañas"),
        "en": dict(d="NASA / USGS data", prep="Preparation (Python, once)", eng="Science engine", tests="24 automated tests",
                   mc1="2D/3D map and layers with provenance", mc2="Targets, SOI, routes A/B/C", mc3="Twin, weather, radio, shelters",
                   h1="True-scale 3D visor + AR cues", h2="O₂, Bingo, terrain, environment", h3="Offline field log, emergencies", sync="cross-tab sync"),
    }[lang]
    return ARCH.format(**t)


def fig(src, cap, cls=""):
    return f'<figure class="{cls}"><img src="evidence/{src}"/><figcaption>{cap}</figcaption></figure>'


def route_table(lang):
    h = {"es": ["Ruta", "Distancia (km)", "Pendiente máx.", "Pendiente media", "Ascenso (m)", "Ida (min)", "O₂ EVA completa (L)", "O₂ al volver"],
         "en": ["Route", "Distance (km)", "Max slope", "Mean slope", "Ascent (m)", "Walk out (min)", "O₂ full EVA (L)", "O₂ left at base"]}[lang]
    rows = "".join(f"<tr><td>{k} · {n[lang]}</td><td>{d}</td><td>{mx}°</td><td>{mn}°</td><td>{a}</td><td>{t}</td><td>{o}</td><td>{l}</td></tr>"
                   for k, n, d, mx, mn, a, t, o, l in ROUTES)
    return "<table><thead><tr>" + "".join(f"<th>{x}</th>" for x in h) + f"</tr></thead><tbody>{rows}</tbody></table>"


def data_table(lang):
    rows = {
        "es": [
            ("Modelo digital de terreno HiRISE, 1 m", "USGS, Mars 2020 TRN, DOI 10.5066/P9REJ9JN (CC0)", "Topografía, pendiente, rugosidad, rutas, línea de vista, refugios, 3D"),
            ("Ortomosaico HiRISE, 25 cm", "USGS, DOI 10.5066/P9QJDP48", "Capa óptica y textura 3D"),
            ("Waypoints de Perseverance", "NASA MMGIS (M20_waypoints.json)", "Ruta real del rover, posición de objetivos, validación con inclinación"),
            ("Imágenes sin procesar de Perseverance", "API Mars 2020 raw images (recurso oficial del reto)", "Fotos de referencia en cada objetivo"),
            ("Waypoints e imágenes de Curiosity", "NASA MMGIS (MSL) + API de imágenes MSL", "Ficha de las retículas del Monte Sharp (2025)"),
            ("Hallazgos de Cheyava Falls", "Hurowitz et al., Nature 645, 332 (2025)", "Ficha científica"),
            ("Hallazgos de Bunsen Peak", "NASA, abril 2024", "Ficha científica"),
            ("Radiación en superficie", "Curiosity RAD, Hassler et al., Science 343 (2014)", "Presupuesto de dosis (medido en Gale)"),
            ("Mars Trek, USGS, ruta de Curiosity, Worldview", "Recursos oficiales del reto", "Referencia de diseño y contexto; Worldview para el análogo terrestre"),
        ],
        "en": [
            ("HiRISE digital terrain model, 1 m", "USGS, Mars 2020 TRN, DOI 10.5066/P9REJ9JN (CC0)", "Topography, slope, roughness, routes, line of sight, shelters, 3D"),
            ("HiRISE orthomosaic, 25 cm", "USGS, DOI 10.5066/P9QJDP48", "Optical layer and 3D texture"),
            ("Perseverance waypoints", "NASA MMGIS (M20_waypoints.json)", "Real rover traverse, target positions, tilt validation"),
            ("Perseverance raw images", "Mars 2020 raw image API (official challenge resource)", "Reference photos at each target"),
            ("Curiosity waypoints and images", "NASA MMGIS (MSL) + MSL raw image API", "Mount Sharp boxwork dossier (2025)"),
            ("Cheyava Falls findings", "Hurowitz et al., Nature 645, 332 (2025)", "Science dossier"),
            ("Bunsen Peak findings", "NASA, April 2024", "Science dossier"),
            ("Surface radiation", "Curiosity RAD, Hassler et al., Science 343 (2014)", "Dose budget (measured at Gale)"),
            ("Mars Trek, USGS, Curiosity path, Worldview", "Official challenge resources", "Design reference and context; Worldview for the Earth analogue"),
        ],
    }[lang]
    h = {"es": ["Dato", "Fuente", "Uso"], "en": ["Data", "Source", "Used for"]}[lang]
    return "<table class='small'><thead><tr>" + "".join(f"<th>{x}</th>" for x in h) + "</tr></thead><tbody>" + \
        "".join(f"<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>" for a, b, c in rows) + "</tbody></table>"


def body(lang):
    es = lang == "es"
    S = lambda e, n: e if es else n
    return f"""
<header class="cover">
  <div class="kicker">NASA Space Apps Challenge 2026 · Managua</div>
  <h1>Mars Pathfinder</h1>
  <div class="sub">{S("Planificación de caminatas (EVA) para exploradores humanos en Marte, sobre datos reales de la NASA", "EVA planning for human explorers on Mars, built on real NASA data")}</div>
  <div class="motto">Explore with purpose · From orbital data to human discovery</div>
</header>

<h2>1. {S("Identificación del proyecto", "Project identification")}</h2>
<table class="kv">
<tr><td>{S("Proyecto", "Project")}</td><td>Mars Pathfinder</td></tr>
<tr><td>{S("Equipo", "Team")}</td><td>{TEAM['name']}</td></tr>
<tr><td>{S("Integrantes", "Members")}</td><td>{TEAM['members']}</td></tr>
<tr><td>{S("Reto oficial", "Official challenge")}</td><td>{S("Guía de supervivencia interplanetaria: Mapa de Marte", "Interplanetary survival guide: Map of Mars")}</td></tr>
<tr><td>{S("Solución", "Solution")}</td><td>{S("Aplicación web con dos vistas sincronizadas: Mission Control (planificación) y Astronaut HUD (visor del casco)", "Web application with two synchronised views: Mission Control (planning) and Astronaut HUD (helmet visor)")}</td></tr>
<tr><td>{S("Enlaces", "Links")}</td><td>App: <a href="{APP}">{APP}</a><br/>{S("Código", "Code")}: <a href="{REPO}">{REPO}</a><br/>Video: {TEAM['video']}</td></tr>
</table>

<h2>2. {S("Resumen de la propuesta", "Summary")}</h2>
<p>{S(
"Mars Pathfinder convierte datos orbitales y de rovers de la NASA en un plan caminable para una EVA de unos 3 km en el cráter Jezero, y en un visor de casco que guía a la tripulación en la superficie. Sobre el modelo de terreno HiRISE de 1 m del USGS calcula pendientes, zonas transitables, tres rutas alternativas con A*, el consumo de oxígeno y el punto de no retorno (<i>Bingo O₂</i>), la cobertura de radio y los refugios topográficos. Su resultado principal es verificable: la pendiente que calcula coincide con la inclinación que registró el propio Perseverance en "
f"{N} paradas (error medio {MAE}°, r = {R}).",
"Mars Pathfinder turns NASA orbital and rover data into a walkable plan for a ~3 km EVA at Jezero crater, and into a helmet visor that guides the crew on the surface. On the USGS 1 m HiRISE terrain model it computes slopes, traversable ground, three alternative routes with A*, oxygen use and the point of no return (<i>Bingo O₂</i>), radio coverage and topographic shelters. Its main result is verifiable: its computed slope matches the tilt Perseverance itself recorded at "
f"{N} stops (mean error {MAE}°, r = {R}).")}</p>

<h2>3. {S("Problema y objetivos", "Problem and objectives")}</h2>
<p>{S(
"Las herramientas existentes (Mars Trek, mapas del USGS) combinan capas a escala regional o global. Un astronauta con traje presurizado, carga y oxígeno limitado necesita decisiones a escala de metros: ¿qué pendiente puedo subir?, ¿me alcanza el oxígeno para volver?, ¿dónde pierdo la radio?, ¿dónde me refugio si llega un evento solar?",
"Existing tools (Mars Trek, USGS maps) combine layers at regional or global scale. An astronaut in a pressurised suit, carrying load with limited oxygen, needs metre-scale decisions: which slope can I climb? do I have the oxygen to return? where do I lose radio? where do I shelter from a solar event?")}</p>
<p><b>{S("Objetivo general", "General objective")}:</b> {S(
"crear una herramienta hiperlocal que una datos de varias misiones de la NASA para planificar y ejecutar una EVA segura y científicamente productiva.",
"build a hyperlocal tool that joins data from several NASA missions to plan and carry out a safe, scientifically productive EVA.")}</p>
<ul>
<li>{S("Usar solo datos reales y citados; separar siempre lo medido de lo modelado.", "Use only real, cited data; always separate what was measured from what is modelled.")}</li>
<li>{S("Planificar rutas que respeten la movilidad con traje y el presupuesto de O₂.", "Plan routes that respect suited mobility and the O₂ budget.")}</li>
<li>{S("Dar a la tripulación en campo la información crítica, también sin señal de radio.", "Give the crew in the field the critical information, also without radio.")}</li>
<li>{S("Validar el modelo de terreno contra mediciones independientes.", "Validate the terrain model against independent measurements.")}</li>
</ul>

<h2>4. {S("Solución desarrollada", "Developed solution")}</h2>
<figure>{arch(lang)}<figcaption>{S("Arquitectura: datos NASA/USGS → preparación → motor científico → dos vistas sincronizadas.", "Architecture: NASA/USGS data → preparation → science engine → two synchronised views.")}</figcaption></figure>
<p><b>Mission Control</b> {S(
"(planificación en el hábitat): mapa del área de 4×4 km en 2D y 3D con capas de imagen, topografía, pendiente, rugosidad, transitabilidad, incertidumbre, sombra de radio y refugios, cada una con su insignia de procedencia; objetivos científicos ordenados por un Índice de Oportunidad Científica (SOI) ajustable; tres rutas (más corta, más segura, máxima ciencia) con perfil de elevación, pendiente y O₂; configurador de la EVA (carga, velocidad, pendiente máxima, tanque); reglas de clima previas a la EVA; y un Mission Twin que simula la caminata.",
"(planning in the habitat): 2D and 3D map of the 4×4 km area with imagery, topography, slope, roughness, traversability, uncertainty, radio shadow and shelter layers, each with a provenance badge; science targets ranked by an adjustable Science Opportunity Index (SOI); three routes (shortest, safest, max science) with elevation, slope and O₂ profile; EVA configurator (load, speed, maximum slope, tank); pre-EVA weather rules; and a Mission Twin that simulates the walk.")}</p>
<p><b>Astronaut HUD</b> {S(
"(visor del casco): el terreno real a escala verdadera visto desde 1.7 m en la posición del astronauta, con la ruta, el objetivo y los refugios superpuestos en su lugar; brújula que sigue la mirada; O₂, margen Bingo, inclinómetro y alertas; fotos reales de Perseverance como referencia al llegar; bitácora científica que guarda los registros en el traje cuando no hay radio y los sincroniza al recuperar la línea de vista; simulación de emergencias con desvío automático; y un asistente científico sin conexión que separa datos medidos, productos derivados e interpretación.",
"(helmet visor): the real terrain at true scale seen from 1.7 m at the astronaut's position, with route, target and shelters overlaid in place; a compass that follows the gaze; O₂, Bingo margin, inclinometer and alerts; real Perseverance photos as reference on arrival; a science field log that stores entries on the suit when there is no radio and syncs when line of sight returns; emergency simulation with automatic diversion; and an offline science assistant that separates measured data, derived products and interpretation.")}</p>
<p><b>{S("Lo que la distingue", "What sets it apart")}:</b> {S(
"cada número en pantalla lleva su fuente o la etiqueta de modelo/supuesto; la pendiente está validada contra el rover; y la planificación (Mission Control) y la ejecución (HUD) comparten el mismo estado, incluso sin conexión.",
"every on-screen number carries its source or a model/assumption label; slope is validated against the rover; and planning (Mission Control) and execution (HUD) share the same state, even offline.")}</p>

<h2>5. {S("Metodología y recursos científicos", "Methodology and scientific resources")}</h2>
{data_table(lang)}
<p><b>{S("Preparación de datos", "Data preparation")}.</b> {S(
"El DTM (1.8 GB) y el ortomosaico (7.4 GB) del USGS se leen a distancia solo en la ventana de trabajo y se remuestrean a celdas de 5 m (800×800 = 640 000 celdas), corrigiendo la escala de la proyección equirectangular a 18.5° de latitud. Un área de contexto de 10 km a 20 m se usa solo para visualización.",
"The USGS DTM (1.8 GB) and orthomosaic (7.4 GB) are read remotely only over the work window and resampled to 5 m cells (800×800 = 640,000 cells), correcting the equirectangular scale at 18.5° latitude. A 10 km context area at 20 m is used for display only.")}</p>
<p><b>{S("Métodos", "Methods")}.</b> {S(
"Pendiente por el método de Horn; rugosidad como residuo de un plano ajustado 3×3; índice de incertidumbre U según resolución, huecos y remuestreo (las celdas sin datos nunca se clasifican como seguras); rutas con A* sobre una función de costo multicriterio, verificadas con Dijkstra; consumo metabólico con la ecuación de Pandolf (1977) escalada a la gravedad de Marte (3.721 m/s², sin escalar el término basal) y O₂ a 20.1 kJ por litro; Bingo O₂ = O₂ restante ≤ 1.2 × O₂ necesario para volver; línea de vista de radio por trazado de rayos con curvatura de Marte; refugios por fracción de cielo bloqueada en 16 direcciones; y reglas de clima transparentes (no un pronóstico).",
"Slope by Horn's method; roughness as the residual of a 3×3 fitted plane; uncertainty index U from resolution, gaps and resampling (no-data cells are never classified as safe); routes with A* on a multi-criteria cost function, verified with Dijkstra; metabolic cost with the Pandolf (1977) equation scaled to Mars gravity (3.721 m/s², basal term not scaled) and O₂ at 20.1 kJ per litre; Bingo O₂ = O₂ remaining ≤ 1.2 × O₂ needed to return; radio line of sight by ray tracing with Mars curvature; shelters by fraction of sky blocked in 16 directions; and transparent weather rules (not a forecast).")}</p>
<p><b>{S("Supuestos declarados", "Declared assumptions")}:</b> {S(
"masa del traje, penalización por traje presurizado y tamaño del tanque; puntajes del SOI asignados por el equipo; dosis RAD medida en Gale y aplicada a Jezero; base de operaciones elegida por el equipo sobre el DTM (no es un sitio de la NASA); tinte de color aproximado (la banda RED de HiRISE es monocromática); exageración vertical del 3D indicada en pantalla.",
"suit mass, pressurised-suit penalty and tank size; SOI scores assigned by the team; RAD dose measured at Gale and applied to Jezero; operations base chosen by the team on the DTM (not a NASA site); approximate colour tint (the HiRISE RED band is monochrome); 3D vertical exaggeration shown on screen.")}</p>

<h2>6. {S("Desarrollo, resultados y evidencias", "Development, results and evidence")}</h2>
<div class="two">
<figure><img src="evidence/validation-{lang}.svg"/><figcaption>{S(f"Validación: pendiente del DEM frente a la inclinación registrada por Perseverance en {N} paradas (soles {SOLS}). Es una comparación independiente: la inclinación viene de la unidad inercial del rover.", f"Validation: DEM slope vs. the tilt recorded by Perseverance at {N} stops (sols {SOLS}). It is an independent check: tilt comes from the rover's inertial unit.")}</figcaption></figure>
<div>
<p><b>{S("Validación del terreno", "Terrain validation")}.</b> {S(
f"En {N} paradas reales de Perseverance (soles {SOLS}) comparamos la pendiente calculada sobre el DTM con la inclinación que midió el propio rover: el error medio es de {MAE}° y la correlación r = {R}. La inclinación del rover también refleja rocas bajo las ruedas, por lo que no se espera un acuerdo perfecto. La elevación coincide en centímetros, pero esa cifra no es independiente porque la localización del rover se apoya en el mismo terreno HiRISE.",
f"At {N} real Perseverance stops (sols {SOLS}) we compared the slope computed on the DTM with the tilt the rover itself measured: mean error {MAE}°, correlation r = {R}. Rover tilt also reflects rocks under the wheels, so perfect agreement is not expected. Elevation agrees to centimetres, but that figure is not independent because rover localisation relies on the same HiRISE terrain.")}</p>
</div></div>
<p><b>{S("Rutas a Cheyava Falls", "Routes to Cheyava Falls")}</b> {S("(escenario por defecto: 15 kg de carga, 0.8 m/s, 60 min de trabajo científico, pendiente máxima 15°, 600 L de O₂ utilizable — supuesto):", "(default scenario: 15 kg load, 0.8 m/s, 60 min science, 15° maximum slope, 600 L usable O₂ — assumption):")}</p>
{route_table(lang)}
<p class="note">{S(
"La ruta segura es solo un 6% más larga y baja la pendiente media de 6.2° a 3.5° con casi el mismo oxígeno: la planificación mejora la seguridad sin costo de O₂. A* encontró el mismo costo óptimo que Dijkstra expandiendo 5 veces menos nodos en la ruta A (74 408 frente a 380 593).",
"The safe route is only 6% longer and lowers mean slope from 6.2° to 3.5° for almost the same oxygen: planning improves safety at no O₂ cost. A* found the same optimal cost as Dijkstra while expanding 5× fewer nodes on route A (74,408 vs. 380,593).")}</p>
<ul>
<li>{S(f"Radio: {BLACK}% del área queda en sombra de radio respecto a la antena de la base; Cheyava Falls, dentro del cañón de Neretva Vallis, está en sombra. Se identificaron {SHEL} refugios topográficos.", f"Radio: {BLACK}% of the area is in radio shadow from the base antenna; Cheyava Falls, inside the Neretva Vallis canyon, is in shadow. {SHEL} topographic shelters were identified.")}</li>
<li>{S("Flujo sin conexión probado de punta a punta en la versión publicada: un registro hecho en sombra de radio queda en cola y aparece en Mission Control al recuperar la señal.", "Offline flow tested end to end on the published version: a log made in radio shadow is queued and appears in Mission Control once signal returns.")}</li>
<li>{S("24 pruebas automáticas del motor (terreno, rutas, EVA, radio, refugios, asistente y datos reales).", "24 automated engine tests (terrain, routing, EVA, radio, shelters, assistant and real data).")}</li>
</ul>
{fig("mc-2d.jpg", S("Mission Control: HiRISE (tinte aproximado), ruta real de Perseverance (punteada), rutas A/B/C, objetivos y tabla comparativa.", "Mission Control: HiRISE (approximate tint), real Perseverance traverse (dotted), routes A/B/C, targets and comparison table."))}
<div class="two">
{fig("mc-3d.jpg", S("Vista 3D sobre el DTM HiRISE (relieve ×2, indicado en pantalla).", "3D view on the HiRISE DTM (relief ×2, shown on screen)."))}
{fig("mc-3d-hypso.jpg", S("Colores por elevación (escala hipsométrica).", "Elevation colours (hypsometric scale)."))}
</div>
<div class="two">
{fig("hud-visor.jpg", S("HUD: visor simulado a escala real en Neretva Vallis, con la ruta y los refugios superpuestos.", "HUD: true-scale simulated visor in Neretva Vallis, with route and shelters overlaid."))}
{fig("hud-target.jpg", S("Al llegar: fotos reales de Perseverance en ese lugar como referencia; radio en sombra.", "On arrival: real Perseverance photos of that spot as reference; radio in shadow."))}
</div>
<div class="two">
{fig("hud-assistant.jpg", S("Asistente científico: datos medidos, productos derivados e interpretación, en bloques separados.", "Science assistant: measured data, derived products and interpretation in separate blocks."))}
{fig("hud-emergency.jpg", S("Emergencia solar: desvío automático al refugio más cercano.", "Solar emergency: automatic diversion to the nearest shelter."))}
</div>
<div class="two">
{fig("mc-comm.jpg", S("Sombra de radio (morado) y refugios topográficos.", "Radio shadow (purple) and topographic shelters."))}
{fig("gale.jpg", S("Ficha del ejemplo del reto: retículas del Monte Sharp con la ruta y fotos reales de Curiosity (2025).", "Dossier for the challenge example: Mount Sharp boxwork with Curiosity's real 2025 path and photos."), "narrow")}
</div>

<h2>7. {S("Impacto y proyección", "Impact and outlook")}</h2>
<ul>
<li><b>{S("Exploración humana", "Human exploration")}:</b> {S("planificación de EVAs y gestión de riesgos de soporte vital para Moon-to-Mars; el mismo método aplica a la Luna con sus DTM.", "EVA planning and life-support risk management for Moon-to-Mars; the same method applies to the Moon with its DTMs.")}</li>
<li><b>{S("Análogos terrestres", "Earth analogues")}:</b> {S("campañas geológicas en terrenos volcánicos como Masaya o Cerro Negro (Nicaragua), con DTM locales y contexto de NASA Worldview.", "geology campaigns on volcanic terrain such as Masaya or Cerro Negro (Nicaragua), with local DTMs and NASA Worldview context.")}</li>
<li><b>{S("Educación e investigación", "Education and research")}:</b> {S("une en una sola vista datos dispersos del PDS y muestra cómo distinguir medición, modelo e interpretación. Código abierto.", "brings scattered PDS data into one view and shows how to tell measurement, model and interpretation apart. Open source.")}</li>
</ul>
<p><b>{S("Limitaciones y trabajo futuro", "Limitations and future work")}:</b> {S(
"un área de 4×4 km; rocas menores que la celda de 5 m no se detectan (próximo paso: detección sobre la ortoimagen de 25 cm); capas THEMIS y de geología del USGS no cargadas; modelo metabólico no validado para trajes presurizados; telemetría del traje y clima simulados; sin rutas en Gale por falta de DTM cargado; generalizar a cualquier sitio con DTM de HiRISE.",
"a 4×4 km area; boulders smaller than the 5 m cell are not detected (next step: detection on the 25 cm orthoimage); THEMIS and USGS geology layers not loaded; metabolic model not validated for pressurised suits; suit telemetry and weather simulated; no routes at Gale (no DTM loaded); generalise to any site with a HiRISE DTM.")}</p>

<h2>8. {S("Referencias y herramientas utilizadas", "References and tools")}</h2>
<ol class="refs">
<li>Fergason, R. L. et al. (2020). Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic. USGS. doi:10.5066/P9REJ9JN</li>
<li>USGS (2020). Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic. doi:10.5066/P9QJDP48</li>
<li>NASA/JPL-Caltech. Mars 2020 and MSL rover waypoints (MMGIS): mars.nasa.gov/mmgis-maps/M20/…, …/MSL/…</li>
<li>NASA/JPL-Caltech. Mars 2020 raw images: mars.nasa.gov/mars2020/multimedia/raw-images/ · MSL raw images: mars.nasa.gov/msl/multimedia/raw-images/</li>
<li>Hurowitz, J. A. et al. (2025). Redox-driven mineral and organic associations in Jezero Crater, Mars. <i>Nature</i> 645, 332.</li>
<li>NASA (2024). Rock sampled by Perseverance embodies why rover came to Mars (Bunsen Peak).</li>
<li>NASA (2025). Curiosity rover sees Martian “spiderwebs” up close; Curiosity blog, sols 4649–4654.</li>
<li>Hassler, D. M. et al. (2014). Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover. <i>Science</i> 343.</li>
<li>Pandolf, K. B., Givoni, B., Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. <i>J. Appl. Physiol.</i> 43(4).</li>
<li>Horn, B. K. P. (1981). Hill shading and the reflectance map. <i>Proc. IEEE</i> 69(1).</li>
<li>{S("Recursos oficiales del reto", "Official challenge resources")}: NASA Mars Trek; USGS Astrogeology interactive maps; NASA “Curiosity's proposed path up Mount Sharp”; NASA Worldview; Mars Perseverance raw image gallery.</li>
</ol>
<p><b>{S("Herramientas", "Tools")}:</b> Next.js, React, TypeScript, Tailwind CSS, Three.js, Recharts, Zustand, Vitest; Python (NumPy, rasterio/GDAL, Pillow); Vercel; GitHub.</p>
<p><b>{S("Uso de inteligencia artificial", "Use of artificial intelligence")}:</b> {S(
"el equipo usó Claude Code (Anthropic) como asistente para diseñar, escribir código, revisar fuentes de datos y redactar la documentación. Las decisiones, la verificación de datos y los resultados fueron revisados por el equipo. La aplicación no ejecuta ningún modelo de IA: el asistente científico es una base de conocimiento curada que funciona sin conexión.",
"the team used Claude Code (Anthropic) as an assistant to design, write code, check data sources and draft documentation. Decisions, data verification and results were reviewed by the team. The application does not run any AI model: the science assistant is a curated knowledge base that works offline.")}</p>
<p class="credit">{S("Imágenes y datos: NASA/JPL-Caltech, Universidad de Arizona (HiRISE), USGS Astrogeology, MSSS. La NASA no respalda este proyecto.", "Imagery and data: NASA/JPL-Caltech, University of Arizona (HiRISE), USGS Astrogeology, MSSS. NASA does not endorse this project.")}</p>
"""


CSS = """
@page { size: A4; margin: 16mm 15mm 16mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 10.2pt; line-height: 1.45; color: #1d1d1f; margin: 0; }
.cover { border-bottom: 3px solid #c2561f; padding-bottom: 10px; margin-bottom: 8px; }
.kicker { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #8a4a26; }
h1 { font-size: 28pt; margin: 4px 0 2px; letter-spacing: .01em; }
.sub { font-size: 12pt; color: #333; }
.motto { font-size: 9pt; color: #777; margin-top: 4px; font-style: italic; }
h2 { font-size: 13.5pt; color: #8a3d16; border-bottom: 1px solid #e6d9cc; padding-bottom: 2px; margin: 16px 0 6px; break-after: avoid; }
p { margin: 5px 0; } ul { margin: 4px 0 6px 18px; padding: 0; } li { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9pt; break-inside: avoid; }
th, td { border-bottom: 1px solid #e5e5e5; padding: 3px 5px; text-align: left; vertical-align: top; }
th { background: #f6efe8; font-weight: 600; }
table.small { font-size: 8.4pt; }
table.kv td:first-child { width: 24%; color: #666; }
figure { margin: 8px 0; break-inside: avoid; }
figure img, figure svg { width: 100%; border: 1px solid #ddd; border-radius: 3px; display: block; }
figcaption { font-size: 8.4pt; color: #555; margin-top: 3px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; break-inside: avoid; }
figure.narrow img { max-height: 120mm; width: auto; max-width: 100%; margin: 0 auto; }
.note { font-size: 9pt; color: #333; }
.refs { font-size: 8.8pt; margin-left: 18px; }
.credit { font-size: 8pt; color: #777; }
a { color: #8a3d16; }
"""


def page(lang):
    title = "Mars Pathfinder — Propuesta" if lang == "es" else "Mars Pathfinder — Proposal"
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{body(lang)}</body></html>"""


for lang in ("es", "en"):
    open(os.path.join(DOCS, f"proposal-{lang}.html"), "w", encoding="utf-8").write(page(lang))
print("ok")
