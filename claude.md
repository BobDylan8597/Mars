# MARS PATHFINDER — Planificación de EVA humana sobre datos reales de la NASA

> *EXPLORE WITH PURPOSE. DISCOVER BEYOND THE KNOWN.* — *From Orbital Data to Human Discovery*
> NASA Space Apps Challenge 2026 · Sede Managua · 14–15 nov 2026
> Reto: **Guía de supervivencia interplanetaria: Mapa de Marte**

Este archivo es la fuente de verdad del proyecto. La versión anterior está en `claude.v1-original.md` solo como referencia histórica; **no se usa**.

---

## 0. Reglas no negociables

1. **Datos reales o etiquetados como no reales.** Todo número que aparezca en pantalla debe salir de un dataset NASA/USGS verificado, o de un cálculo sobre ese dataset, o llevar la etiqueta `MODELLED` / `ASSUMPTION` con su fuente o justificación. Nunca se inventan IDs de producto, coordenadas, soles ni valores medidos.
2. **Procedencia honesta.** Cada capa y cada dato tiene una insignia con `verification: VERIFIED | CONTEXTUAL | MODELLED`. Un ID solo es `VERIFIED` si está en la tabla de la §3 con estado ✅.
3. **Los resultados los produce el algoritmo.** Ninguna distancia, pendiente o porcentaje de O₂ de una ruta se fija a mano en la UI o en el guion de la demo. La demo muestra lo que calcule el motor.
4. **Advertencia de remuestreo.** Si una capa de baja resolución se muestra o se usa junto a una de alta resolución, se muestra la advertencia y se penaliza la incertidumbre `U` de esas celdas.
5. **Primero lo que puntúa.** Se construye por niveles (§7). No se empieza un nivel hasta que el anterior compila, está probado y se ve en pantalla.
6. **Interfaz en inglés.** Este documento, el pitch y el PDF en español se escriben en español; todo texto visible en la app va en inglés.

---

## 1. El reto y cómo nos evalúan

**Reto (resumen):** crear un mapa, herramienta o interfaz que un astronauta pueda usar en una exploración de superficie en Marte, combinando datos de varias misiones NASA (≥3 tipos: óptico, térmico, espectral, topográfico, atmosférico, radiación, químico…), priorizando la seguridad de la tripulación, con una ruta que evite obstáculos, considerando la movilidad con traje y carga, imágenes en primera persona de los rovers y apoyo robótico o trabajo en parejas. Los mapas existentes (Mars Trek, USGS) son regionales/globales; el vacío es la **escala hiperlocal de una caminata**.

**Recursos oficiales del reto:** Mars Trek · USGS Astrogeology (mapas interactivos de Marte) · Ruta propuesta de Curiosity en el Monte Sharp · NASA Worldview · Galería de imágenes sin procesar de Perseverance. Se pueden sumar otras fuentes solo si son NASA/USGS o publicaciones científicas revisadas.

**Rúbrica local (100 pts):**

| Criterio | Pts | Cómo lo atacamos |
|---|---|---|
| 1. Rigor y calidad de ejecución | 30 | Terreno real (DTM USGS), algoritmos probados con tests, A* validado contra Dijkstra, pendiente validada contra la inclinación real del rover |
| 2. Creatividad e innovación | 20 | Planificación EVA con presupuesto de O₂ y alerta *Bingo*, HUD sincronizado, bitácora sin conexión, procedencia por dato |
| 3. Relevancia y recursos NASA | 10 | Los 5 recursos oficiales usados con un papel concreto (§3) |
| 4. Impacto potencial | 10 | Tripulaciones Moon-to-Mars, campañas análogas en volcanes de Nicaragua (Worldview), educación |
| 5. Justificación e impacto (pitch) | 10 | Problema: mapas regionales vs. caminata de 3 km con O₂ limitado |
| 6. Contribución y pertinencia | 10 | Tabla requisito del reto → función de la app |
| 7. Claridad | 5 | Demo guiada de 6 pasos en 3 minutos |
| 8. Dominio y respuestas | 5 | Hoja de preguntas probables (§10) |

**Entregables obligatorios** (cierre: domingo 15 nov, 11:59 p. m.):
- PDF de propuesta en **español** y PDF equivalente en **inglés**, con las 8 secciones (§9).
- **Video de 30 s en inglés**: 0–5 s problema · 5–15 s solución · 15–25 s demo · 25–30 s aporte.
- **Enlace público** de la app (Vercel) y del repositorio (GitHub), accesibles sin pedir permiso.
- Página del proyecto en la plataforma Space Apps: título, resumen y descripción en inglés, uso de recursos espaciales y declaración de uso de IA.
- Defensa: domingo 1:00–4:00 p. m., pitch en español de 3 min + 3 min de preguntas.

---

## 2. Producto

**MARS PATHFINDER** es una aplicación web con dos vistas sincronizadas:

- **Mission Control** (`/mission-control`): planificación en el hábitat. Mapa del área con capas, objetivos científicos, cálculo de rutas, configuración de la EVA y simulación.
- **Astronaut Field HUD** (`/hud`): lo que lleva el astronauta. Navegación al siguiente waypoint, O₂ y *Bingo*, inclinómetro, imágenes reales de superficie y bitácora de campo que funciona sin señal.

**Región principal:** Cráter Jezero (Mars 2020 / Perseverance). Motivo: existe un DTM oficial de USGS a 1 m creado precisamente para evaluar peligros del terreno en el aterrizaje de Mars 2020.

**Región secundaria:** Cráter Gale / Monte Sharp, formaciones de retículas (*boxwork*) estudiadas por Curiosity en 2025, el ejemplo literal del reto. Se presenta como ficha científica con imágenes y ruta real del rover; el análisis de rutas completo solo si se confirma un DTM que cubra la zona (Nivel 3).

---

## 3. Fuentes de datos

Estado: ✅ verificado (existe y se revisó su contenido) · 🔎 por verificar antes de usar como `VERIFIED`.

| # | Dataset | Identificador / URL | Uso en la app | Estado |
|---|---|---|---|---|
| D1 | Mars 2020 TRN HiRISE DTM Mosaic (USGS, Fergason et al.) | DOI `10.5066/P9REJ9JN` — https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic | Elevación base de Jezero (1 m/post), CC0 | ✅ existe · 🔎 cobertura exacta del área de trabajo |
| D2 | Mars 2020 TRN HiRISE Orthorectified Image Mosaic (USGS) | DOI `10.5066/P9QJDP48` — https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first | Capa óptica 25 cm/px (GeoTIFF 3.2 GB) | ✅ |
| D3 | Waypoints de Perseverance (MMGIS) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | Ruta real del rover; `lat`, `lon`, `elev_geoid`, `sol`, `tilt` | ✅ existe · 🔎 si llega a julio 2024 (archivo etiquetado "sol2022") |
| D4 | Waypoints de Curiosity (MMGIS) | https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json | Ruta real en Gale; posición en la zona de retículas (2025) | ✅ existe · 🔎 soles 2025 |
| D5 | API de imágenes sin procesar de Mars 2020 | `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json` (parámetros `num`, `page`, `order`, filtros por sol) | Visor en primera persona; `imageid`, `sol`, `camera.instrument`, `extended.mastAz/mastEl`, `image_files` | ✅ |
| D6 | NASA Photojournal — retículas de Curiosity | PIA26552 ("Curiosity on the Road to Boxwork Formations"), PIA26560 ("Curiosity Views Boxwork Patterns at a Distance") | Ficha de Gale, imágenes de superficie | ✅ |
| D7 | Hurowitz et al., "Redox-driven Mineral and Organic Associations in Jezero Crater, Mars", *Nature* 645, 332 (2025) | Publicado 10 sep 2025 | Ficha de Cheyava Falls: formación Bright Angel, Neretva Vallis, vivianita + greigita (PIXL/SHERLOC), muestra *Sapphire Canyon*; posibles explicaciones abióticas | ✅ contenido · 🔎 sol y coordenadas exactas |
| D8 | NASA: "Curiosity sees Martian spiderwebs up close" (2025) | nasa.gov, misión MSL | Retículas: crestas de 1–2 m, red de 10–20 km, agua subterránea | ✅ |
| D9 | HiRISE DTM `DTEEC_009149_1750_009294_1750_U01` | https://www.uahirise.org/dtm/PSP_009149_1750 | Gale, 1.01 m/px, centro −4.79°, 137.4°, titulado "Inverted Riverbed in Gale Crater". **No usar como fuente de retículas** salvo que se confirme la cobertura | ✅ existe |
| D10 | Mars Trek WMTS | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars — plantilla `{endpoint}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png|jpg` | Contexto regional (CTX, MOLA, THEMIS) | 🔎 IDs de capa: copiarlos del GetCapabilities de cada producto |
| D11 | Ruta propuesta de Curiosity en el Monte Sharp | https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/ (HiRISE, CRISM, CTX, HRSC) | Referencia de diseño de la capa de ruta y del pitch | ✅ |
| D12 | NASA Worldview | https://worldview.earthdata.nasa.gov/ | **Solo Tierra**: análogo de Masaya / Cerro Negro (Nicaragua) para el criterio de impacto | ✅ |
| D13 | Curiosity RAD — Hassler et al., *Science* 343 (2014) | Dosis superficial ~0.21 mGy/día (≈0.64 mSv/día) | Presupuesto de dosis (medido en **Gale**, aplicado a Jezero como aproximación) | 🔎 confirmar cifras en el artículo |
| D14 | NASA DONKI | API pública en api.nasa.gov | Contexto de eventos solares (SEP/CME) | 🔎 |
| D15 | MEDA (Mars 2020) / REMS (MSL) | PDS Atmospheres Node | Presión, temperatura, viento, opacidad de referencia | 🔎 descargar valores reales para 1–2 soles |
| D16 | THEMIS inercia térmica | Mars Trek / JMARS | Arena suelta vs. roca (capa térmica) | 🔎 producto exacto |
| D17 | Mapa geológico global de Marte (USGS) | USGS Astrogeology | Unidades geológicas; demuestra la advertencia de remuestreo | 🔎 escala exacta |

**Prohibido** (no son IDs reales de PDS): `SOL_1215_CHEYAVA_FALLS`, `MSL_2025_MOUNT_SHARP_BOXWORK`, `RIMFAX_L2_PERSEVERANCE_MARGIN`, `SCAM_LIBS_MARGIN_2024`, `APXS_2025_RIDGE_CEMENT`, `ZCAM_SOL1215`, y los IDs de CRISM/HiRISE del documento anterior que no estén en esta tabla.

---

## 4. Preparación de datos (una sola vez, fuera de la app)

Los archivos fuente pesan entre 0.4 y 3 GB y **no entran en el repositorio**. Se procesan con Python a archivos pequeños que la app carga desde `public/data/`.

```
scripts/data-prep/
  requirements.txt        # numpy, rasterio, pillow, requests
  01_download.py          # descarga D1, D2 a data-raw/ (ignorado por git)
  02_inspect_coverage.py  # imprime extensión, CRS, resolución, nodata; verifica que el área de trabajo esté cubierta
  03_crop_dem.py          # recorta la ventana, reproyecta a metros locales, re-muestrea, exporta dem.bin + dem.meta.json
  04_crop_ortho.py        # mismo recorte para la ortoimagen → ortho.webp
  05_waypoints.py         # descarga D3/D4, filtra la ventana, exporta rover_traverse.geojson
  06_images.py            # consulta D5 por soles relevantes, guarda images.json (solo metadatos y URLs)
  README.md               # comandos exactos y versión de cada fuente
data-raw/                 # en .gitignore
public/data/jezero/       # salida que sí va al repositorio
```

**Ventana de trabajo (Jezero):**
1. Prioridad: región de Bright Angel / Neretva Vallis (Cheyava Falls), si `02_inspect_coverage.py` confirma que D1 la cubre.
2. Si no la cubre: buscar en https://www.uahirise.org/dtm un DTM HiRISE individual sobre Neretva Vallis y usarlo como D1.
3. Si ninguna opción funciona en 1 hora: usar el frente del delta, cubierto por D1, y presentar Cheyava Falls como ficha científica fuera del mapa.

**Tamaño:** ventana de ~2.5 × 2.5 km a ~5 m/celda → 512 × 512 celdas. Guardar como `Float32` binario (~1 MB), no como JSON.

**`dem.meta.json` (esquema):**
```json
{
  "region": "jezero",
  "source": { "dataset": "Mars 2020 TRN HiRISE DTM Mosaic", "doi": "10.5066/P9REJ9JN", "native_resolution_m": 1.0, "license": "CC0-1.0" },
  "crs": "...", "origin": { "lat": 0, "lon": 0 }, "cell_size_m": 5.0,
  "width": 512, "height": 512, "nodata": -32768, "z_units": "m (MOLA areoid)",
  "resampling": "average 1 m → 5 m", "generated_by": "scripts/data-prep/03_crop_dem.py"
}
```

**Validación de rigor:** comparar la pendiente calculada por la app en la ruta real del rover (D3) con el `tilt` registrado por Perseverance. Mostrar el error medio en la ficha de metodología y en el PDF.

---

## 5. Objetivos científicos

Las coordenadas y elevaciones se toman de D3/D4 o de la ventana DTM, **nunca a mano**. Los valores `M, G, T, Q` del SOI son **puntuaciones asignadas por el equipo** con una justificación de una línea cada una, no valores de la NASA, y así se etiquetan en la UI.

| ID | Objetivo | Región | Fuente principal | Rol |
|---|---|---|---|---|
| `JZ-T1` | Cheyava Falls (formación Bright Angel, Neretva Vallis) | Jezero | D7, D3, D5 | Objetivo principal: posible biofirma; incluir que las explicaciones abióticas siguen abiertas |
| `JZ-T2` | Frente del delta / unidad marginal (elegir según la ventana de datos) | Jezero | D1, D2, D3 | Objetivo secundario dentro del mapa, para la ruta de máxima ciencia |
| `GALE-T1` | Formaciones de retículas del Monte Sharp (2025) | Gale | D4, D6, D8 | Ficha científica con la cita textual del reto: *"aprender más sobre las formaciones de retículas, un fenómeno geológico que el rover Curiosity estudió en 2025 … como la región del Monte Sharp, donde Curiosity las observó."* |

---

## 6. Motor científico (`src/lib/core/`)

Funciones puras en TypeScript, sin dependencias de React, cada una con tests en `src/lib/core/__tests__/` (Vitest).

### 6.1 Terreno (`terrain.ts`)
- **Pendiente:** método de Horn (3×3) sobre el DEM en metros: `S = atan(√((dz/dx)² + (dz/dy)²)) · 180/π`.
- **Rugosidad `R`:** desviación estándar de la elevación sin tendencia en una ventana 3×3, normalizada a [0, 1].
- **Incertidumbre `U` ∈ [0, 1]:** depende de la resolución nativa de la fuente, de los huecos `nodata` y de la penalización por remuestreo. Las celdas sin dato tienen `U = 1`.
- **Clasificación** (umbrales configurables):
  `LOW_COST` (S ≤ 6°) · `MODERATE_COST` (6–12°) · `HIGH_COST` (12° – S_max) · `EXCLUDED` (S > S_max u obstáculo) · `INSUFFICIENT_DATA` (U > 0.6; **nunca se marca como seguro**).
- **Test:** sobre un plano inclinado sintético de 10° la función debe devolver 10° ± 0.1°.

### 6.2 Índice de oportunidad científica (`soi.ts`)
`SOI = αM + βG + γT + δQ`, con pesos normalizados a suma 1 mediante sliders. Se muestra una barra apilada con la contribución de cada término.

### 6.3 Rutas (`routing.ts`)
- Grilla de 8 vecinos. **A\*** con heurística admisible: distancia euclidiana × coste mínimo por metro. **Dijkstra = A\* con h = 0.**
- Coste por paso: `C = w_D·D + w_S·f(S) + w_R·R + w_U·U + w_L·L` (L = riesgo de deslizamiento por arena/rugosidad). Las celdas `EXCLUDED` son infranqueables.
- Tres perfiles de pesos:
  - **A — Shortest:** domina `w_D`.
  - **B — Safest / lowest O₂:** penaliza mucho `S`, `R`, `U` y `L`.
  - **C — Max science:** pasa por los objetivos o puntos de mayor SOI respetando `S_max` y el presupuesto de O₂ (orden de visita por fuerza bruta, son ≤ 4 puntos).
- Panel de validación: nodos expandidos y tiempo en ms de A* y de Dijkstra, y **comprobación de que el coste final es idéntico**.
- **Test:** en una grilla con obstáculo conocido, A* y Dijkstra devuelven el mismo coste; con `S_max` más bajo aumentan las celdas excluidas.

### 6.4 Soporte vital EVA (`eva.ts`)
**Tasa metabólica**: ecuación de Pandolf et al. (1977), adaptada a Marte. Toda la adaptación se etiqueta `MODELLED`:

```
W = masa corporal (kg), L = traje + PLSS + carga (kg), V = velocidad (m/s), G = pendiente (%), η = factor de terreno
g_r = 3.721 / 9.807 ≈ 0.379
M (W) = 1.5·W                                      ← basal, NO se escala con la gravedad
      + g_r · [ 2.0·(W+L)·(L/W)² + η·(W+L)·(1.5·V² + 0.35·V·G) ]
      × k_suit                                     ← penalización por traje presurizado (ASSUMPTION, por defecto 1.0, slider 1.0–1.5)
Pendiente negativa: no dejar que el término de pendiente baje M por debajo del valor en plano (G = 0).
```

- Valores por defecto (`ASSUMPTION`, editables): W = 75 kg, traje + PLSS = 65 kg, carga 5–40 kg, V = 0.8 m/s, η = 1.0 (roca) a 1.6 (arena).
- **O₂:** `V̇O₂ (L/min) = M · 60 / 20 100` (≈ 20.1 kJ por litro de O₂). Sin constante extra, porque el basal ya está en M.
- **Tanque:** capacidad configurable, etiquetada `ASSUMPTION` y no atribuida a un traje concreto.
- **Bingo O₂:** en cada waypoint, `O₂_retorno` = consumo de la ruta de vuelta más segura calculada desde ese punto. Alerta `BINGO O2 — RETURN NOW` si `O₂_restante ≤ 1.2 · O₂_retorno`.
- **Comprobación de sensatez:** mostrar en la ficha de metodología la tasa en plano y compararla con valores medidos en EVAs Apollo (cifra 🔎 por verificar antes de citarla).

### 6.5 Riesgo atmosférico pre-EVA (`atmosphere.ts`)
**Índice de riesgo por reglas**, no un "predictor" con probabilidades. Entradas: ΔP en 3 h, opacidad τ, estación Ls (temporada de polvo Ls 180°–330°), ΔT suelo-aire y ráfaga máxima. Salida: `GO` / `CAUTION` / `NO-GO`, con la lista de qué regla disparó cada estado. Los umbrales se documentan en el código con su origen; los valores de referencia de MEDA/REMS (D15) se muestran como `VERIFIED` solo si se descargaron.

### 6.6 Radiación, refugios y radio (`radiation.ts`, `los.ts`)
- **Dosis:** `dosis_abs (µGy) = 210 µGy/día × horas_EVA/24`. **Dosis equivalente (µSv)** con el factor de calidad del artículo D13 🔎. Multiplicador por evento solar como escenario `MODELLED`. Etiqueta fija: *"RAD measured at Gale crater; applied to Jezero as an approximation."*
- **Refugios topográficos:** para cada celda, fracción del horizonte bloqueada en 16 acimuts. Las celdas por encima del umbral se marcan como refugio, con distancia y rumbo desde la posición actual.
- **Línea de vista de radio:** trazado de rayos desde la antena de la base (altura configurable). Las celdas bloqueadas se marcan `COMM_BLACKOUT`.
- **Test:** con una cresta sintética, las celdas detrás de ella quedan bloqueadas y las de delante no.

---

## 7. Construcción por niveles

**Stack:** Next.js (App Router) + TypeScript + Tailwind + Zustand + Recharts + lucide-react + Vitest. Mapa en **Canvas 2D** (relieve sombreado + ortoimagen + capas); sin Three.js salvo en el Nivel 3. Sin base de datos: datos estáticos en `public/data/`. Sincronización entre vistas: Zustand + `BroadcastChannel` + `localStorage`. Despliegue: GitHub → Vercel.

**Estética:** fondo `#07090E`, paneles `#0F172A`, acento Marte `#FF5722`, cian HUD `#00F0FF`, nominal `#10B981`, precaución `#F59E0B`, crítico `#EF4444`; fuente monoespaciada para telemetría.

### Nivel 1 — Núcleo demostrable (sábado 3:30–6:00 p. m.)
1. Proyecto Next.js, scripts de datos (§4) ejecutados, `public/data/jezero/` generado.
2. `src/lib/core/` completo para 6.1–6.4, con tests pasando.
3. Mission Control: mapa con capas **Optical (D2), Topography (D1), Slope, Roughness, Data coverage/uncertainty, Rover traverse (D3), Planned EVA routes**; gestor de capas con opacidad e insignia de procedencia.
4. Planificador: origen y objetivo, rutas A/B/C, tarjetas comparativas, perfil de elevación, pendiente y O₂ (Recharts), validación A* vs. Dijkstra.
5. Configurador EVA (carga, S_max, velocidad, tanque, k_suit): al cambiar un valor se recalculan las celdas excluidas, las rutas y el *Bingo*.

### Nivel 2 — HUD y operación (sábado 8:00–11:59 p. m.)
6. HUD: cinta de brújula, distancia al waypoint, desviación lateral, O₂ con margen *Bingo*, inclinómetro y alerta de incertidumbre cartográfica (cita la resolución de la fuente).
7. Visor en primera persona: imágenes reales de D5 cerca del objetivo, con su `imageid` y sol; etiqueta *"georeference: exact"* o *"contextual"*.
8. Bitácora de campo con interruptor Online / Comm blackout: cola local que se sincroniza con Mission Control y actualiza el mapa y los indicadores.
9. Mission Twin: reproducir, pausar, velocidad 1×/5×/10× sobre la ruta elegida, con O₂, pendiente, estado de radio y alertas en vivo.
10. Línea de vista de radio y refugios (6.6); panel ambiental con el índice GO/CAUTION/NO-GO y la dosis.
11. Botón *Simulate emergency*: desvío automático al refugio más cercano.
12. Despliegue en Vercel y prueba del enlace en una ventana de incógnito.

### Nivel 3 — Solo si sobra tiempo (domingo antes de las 10:00 a. m.)
- Ficha de Gale/retículas con D4, D6 y D8 (este punto es casi obligatorio por la cita del reto: hacerlo como ficha simple aunque no haya mapa).
- Capas THEMIS (D16) y geología (D17) desde Trek, con advertencia de remuestreo.
- Asistente científico con **base de conocimiento curada** (no se presenta como IA ni como RAG): respuestas en 3 bloques — *NASA measured data* / *Derived products & models* / *Interpretation & limitations*.
- Minimapa del equipo (EVA-1, EVA-2, rover de apoyo) y rover explorador para inspeccionar zonas con `U` alta.
- Recorrido guiado de demo de 6 pasos (botón *Guided Demo*).

### Descartado
Asistente de 10 pasos, modal de rúbrica, 16 capas completas, terreno 3D, batería y estrés térmico del PLSS. Se mencionan en el PDF como trabajo futuro.

### Definición de "terminado"
`npm run test` y `npm run build` pasan sin errores; la app abre en el enlace público; toda cifra visible tiene insignia de procedencia; no queda ningún ID de la lista prohibida (§3).

---

## 8. Demo de 3 minutos (guion para el pitch)

1. **Problema (20 s):** los mapas de Marte son regionales; una caminata de 3 km con O₂ limitado necesita metros.
2. **Datos (30 s):** capas de Jezero con insignias de procedencia; DTM USGS de 1 m y ruta real de Perseverance.
3. **Ciencia (20 s):** Cheyava Falls y el SOI; mención a las retículas de Gale, el ejemplo del reto.
4. **Rutas (40 s):** A vs. B vs. C con las cifras que calcule el motor; A* = Dijkstra en coste, pendiente validada contra la inclinación del rover.
5. **Operación (40 s):** Mission Twin → HUD → imagen real de Perseverance → registro en zona sin señal → sincronización a Mission Control.
6. **Impacto (30 s):** Moon-to-Mars, análogo volcánico en Nicaragua (Worldview), código abierto.

---

## 9. Documentación (PDF ES + EN)

| Sección del PDF | Contenido desde el proyecto |
|---|---|
| 1. Identificación | Nombre, equipo, integrantes, reto, enlace a la app *(datos del equipo pendientes)* |
| 2. Resumen | Un párrafo: qué hace, qué problema resuelve, resultado principal |
| 3. Problema y objetivos | Vacío de escala hiperlocal; objetivo general y resultados esperados |
| 4. Solución | Arquitectura de las dos vistas, motor (§6) y qué la distingue |
| 5. Metodología y recursos | Tabla de fuentes (§3), preparación de datos (§4), supuestos `MODELLED` / `ASSUMPTION` |
| 6. Resultados y evidencias | Capturas, tabla de rutas A/B/C, validación A* vs. Dijkstra, error pendiente vs. `tilt` del rover |
| 7. Impacto y proyección | Beneficiarios, análogos terrestres, trabajo futuro (lo descartado en §7) |
| 8. Referencias y herramientas | Fuentes con enlace, librerías, **declaración de uso de IA** (Claude Code en diseño, código y redacción; datos y validaciones revisados por el equipo) |

Ir guardando capturas en `docs/evidence/` mientras se construye.

---

## 10. Preguntas probables del jurado

- *¿El terreno es real?* → Sí: DTM USGS de 1 m (DOI en pantalla), re-muestreado a 5 m; se muestra la incertidumbre.
- *¿Cómo saben que la pendiente es correcta?* → Se comparó con la inclinación real registrada por Perseverance en su ruta (error medio X°).
- *¿El modelo de O₂ está validado para trajes?* → No; es Pandolf adaptado a la gravedad de Marte, etiquetado como modelo, con el factor de traje como supuesto ajustable.
- *¿La radiación se midió en Jezero?* → No, en Gale (RAD); se aplica como aproximación y la app lo dice.
- *¿Hay IA en la app?* → No hay modelo en ejecución; el asistente usa una base de conocimiento curada. Se usó IA para desarrollar, y está declarado.

---

## 11. Pendientes de verificación

- [x] Cobertura de D1 sobre Bright Angel / Neretva Vallis → cubierta (D1: 18.30–18.67°N, 77.22–77.58°E). Ventana usada: 4×4 km a 5 m, `scripts/data-prep/crop_jezero.py`.
- [x] Sol y coordenadas de Cheyava Falls → sol ~1215 (21 jul 2024, derivado de la fecha); posición del rover soles 1206–1210: 18.4975°N, 77.3053°E.
- [x] D3 llega al sol 2022 e incluye 2024. 194 paradas dentro del mapa (soles 909–1343).
- [x] Segundo objetivo: Bunsen Peak, sol 1088 (11 mar 2024), rover en soles 1084–1092 (18.4918°N, 77.3272°E).
- [x] Validación: pendiente del DEM vs. `tilt` del rover → MAE 1.57°, r = 0.92 (`public/data/jezero/validation.json`).
- [x] Soles 2025 de Curiosity en las retículas (D4) → campaña soles ~4540–4790; sol 4653 en 4.807°S, 137.380°E, −3,608 m. (Las coordenadas originales 4.68°S / −3,820 m eran incorrectas.)
- [x] RAD: 210 µGy/día absorbida, 640 µSv/día equivalente (Hassler et al. 2014), usado en `src/lib/core/radiation.ts`.
- [ ] Identificadores de capas de Trek para THEMIS y CTX (D10, D16).
- [ ] Valores de referencia MEDA/REMS (D15) y endpoint de DONKI (D14).
- [ ] Tasa metabólica medida en EVAs Apollo para la comprobación de sensatez (6.4).
- [ ] Nombre del equipo e integrantes (PDF §1).

---

## 12. Estado de construcción (15 nov 2026, 00:00)

- **Nivel 1 — hecho:** datos reales de Jezero, motor con tests, Mission Control (mapa, capas, SOI, rutas A/B/C, A* vs. Dijkstra, configurador EVA).
- **Nivel 2 — hecho:** HUD (imágenes reales de Perseverance, brújula, O₂/Bingo, terreno, ambiente), Mission Twin sincronizado, línea de vista de radio con curvatura, refugios, bitácora sin conexión con sincronización, emergencias con desvío A*.
- **Nivel 3 — hecho:** ficha de Gale/retículas con traverse y fotos reales de Curiosity 2025 y cita textual del reto; asistente científico con base curada en 3 bloques; demo guiada de 6 pasos.
- **No hecho (trabajo futuro en el PDF):** capas THEMIS y geología USGS, terreno 3D, batería/estrés térmico PLSS, DTM y rutas para Gale.
- Mapa en color: tinte aproximado sobre la banda RED monocromática de HiRISE (etiquetado como no color verdadero).
