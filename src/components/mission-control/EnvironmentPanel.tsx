"use client";
import { assessAtmosphere, dustSeason, SolarState } from "@/lib/core/atmosphere";
import { evaDose, RAD_GCR_UGY_PER_DAY, RAD_GCR_USV_PER_DAY } from "@/lib/core/radiation";
import type { EnvironmentModel, RoutePlan } from "@/lib/plan";
import { useMission } from "@/lib/store";

const LEVEL_TONE = { GO: "text-nominal", CAUTION: "text-caution", "NO-GO": "text-critical" } as const;

function Num({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block py-1">
      <div className="flex justify-between"><span className="text-muted">{label}</span><span className="num text-[12px]">{value.toFixed(step < 1 ? 2 : 0)} {unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function EnvironmentPanel({ env, route }: { env: EnvironmentModel | null; route: RoutePlan | null }) {
  const atmos = useMission((s) => s.atmos);
  const setAtmos = useMission((s) => s.setAtmos);
  const eva = useMission((s) => s.eva);
  const antennaH = useMission((s) => s.antennaHeightM);
  const setAntenna = useMission((s) => s.setAntennaHeight);
  const a = assessAtmosphere(atmos);
  const t = route?.eva?.totals;
  const evaHours = t ? (t.outboundMin * 2 + eva.obsMin) / 60 : 0;
  const spMult = atmos.solar === "sep" ? 10 : 1;
  const dose = evaDose(evaHours, spMult);

  return (
    <div className="space-y-4">
      <section>
        <h3 className="label mb-1">Pre-EVA go / no-go</h3>
        <div className={`text-[20px] font-semibold ${LEVEL_TONE[a.level]}`}>{a.level}</div>
        <ul className="mt-1 space-y-1 text-[12px] leading-[1.45]">
          {a.hits.length === 0 && <li className="text-muted">No rule triggered.</li>}
          {a.hits.map((h) => (
            <li key={h.rule}><span className={LEVEL_TONE[h.level]}>{h.level}</span> · {h.rule} <span className="text-faint">({h.basis})</span></li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-faint">Rule-based index, not a statistical forecast. Inputs are a scenario: set them from the latest MEDA weather report and DONKI.</p>
      </section>

      <section>
        <h3 className="label mb-1">Weather and space-weather inputs</h3>
        <Num label="Pressure drop vs. diurnal tide (3 h)" value={atmos.pressureDropPa} unit="Pa" min={0} max={40} step={1} onChange={(v) => setAtmos({ pressureDropPa: v })} />
        <Num label="Dust optical depth τ" value={atmos.tau} unit="" min={0.2} max={4} step={0.05} onChange={(v) => setAtmos({ tau: v })} />
        <Num label={`Solar longitude Ls${dustSeason(atmos.ls) ? " · dust season" : ""}`} value={atmos.ls} unit="°" min={0} max={359} step={1} onChange={(v) => setAtmos({ ls: v })} />
        <Num label="Ground − air temperature (noon)" value={atmos.dT} unit="K" min={0} max={40} step={1} onChange={(v) => setAtmos({ dT: v })} />
        <Num label="Peak gust" value={atmos.gustMs} unit="m/s" min={0} max={40} step={1} onChange={(v) => setAtmos({ gustMs: v })} />
        <div className="py-1">
          <div className="text-muted">Space weather (NASA DONKI)</div>
          <div className="mt-1 flex gap-1">
            {(["quiet", "elevated", "sep"] as SolarState[]).map((s) => (
              <button key={s} onClick={() => setAtmos({ solar: s })}
                className={`flex-1 rounded border px-2 py-1 text-[11px] ${atmos.solar === s ? "border-ink text-ink" : "border-line text-muted hover:text-ink"}`}>
                {s === "sep" ? "SEP event" : s === "elevated" ? "Elevated / CME" : "Quiet"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line pt-3 text-[12px] leading-[1.5]">
        <h3 className="label mb-1">Radiation for this EVA</h3>
        <div className="num">{evaHours.toFixed(1)} h outside · {dose.absorbedUGy.toFixed(0)} µGy · {dose.equivalentUSv.toFixed(0)} µSv{spMult > 1 && <span className="text-critical"> (SEP scenario ×{spMult})</span>}</div>
        <p className="mt-1 text-muted">
          Baseline from Curiosity RAD at Gale crater: {RAD_GCR_UGY_PER_DAY} µGy/day absorbed, {RAD_GCR_USV_PER_DAY} µSv/day dose equivalent (Hassler et al., Science 2014). Measured at Gale, applied to Jezero as an approximation. The SEP multiplier is a scenario, not a measurement.
        </p>
      </section>

      <section className="border-t border-line pt-3 text-[12px] leading-[1.5]">
        <h3 className="label mb-1">Radio line of sight and shelters</h3>
        <Num label="Base antenna mast height" value={antennaH} unit="m" min={2} max={30} step={1} onChange={setAntenna} />
        {env ? (
          <>
            <div className="num">{env.blackoutPct.toFixed(1)}% of the map in radio shadow · {env.shelters.length} topographic shelters</div>
            <p className="mt-1 text-muted">
              Ray-traced from the antenna over the HiRISE DTM, including Mars curvature (d²/2R). Shelters are walkable cells where surrounding terrain blocks the most sky within 400 m; less open sky means less cosmic-ray and wind exposure.
            </p>
          </>
        ) : <div className="text-muted">Computing line of sight…</div>}
      </section>
    </div>
  );
}
