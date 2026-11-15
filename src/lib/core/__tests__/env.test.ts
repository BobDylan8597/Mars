import { describe, expect, it } from "vitest";
import { assessAtmosphere, DEFAULT_ATMOS } from "../atmosphere";
import { findShelters, radioLineOfSight, skyBlockage } from "../los";
import { evaDose } from "../radiation";
import type { Grid } from "../terrain";

function flat(w: number, h: number): Grid {
  return { width: w, height: h, cellSize: 5, z: new Float32Array(w * h) };
}

describe("radio line of sight", () => {
  it("a ridge blocks cells behind it but not in front", () => {
    const g = flat(80, 20);
    for (let r = 0; r < 20; r++) g.z[r * 80 + 40] = 30; // 30 m ridge at column 40
    const m = radioLineOfSight(g, 5, 10, 5, 2, 1);
    expect(m.data[10 * m.width + 30]).toBe(1);
    expect(m.data[10 * m.width + 45]).toBe(0);
    expect(m.data[10 * m.width + 79]).toBe(1 - 1); // still in the ridge shadow
  });

  it("flat terrain is fully visible at short range", () => {
    const m = radioLineOfSight(flat(50, 50), 25, 25, 10, 2, 1);
    expect([...m.data].every((v) => v === 1)).toBe(true);
  });
});

describe("shelters", () => {
  it("a cell at the foot of a cliff has more sky blocked than open plain", () => {
    const g = flat(120, 120);
    for (let r = 0; r < 120; r++) for (let c = 70; c < 120; c++) g.z[r * 120 + c] = 60;
    expect(skyBlockage(g, 66, 60)).toBeGreaterThan(skyBlockage(g, 20, 60) + 0.05);
    const s = findShelters(g, (i) => g.z[i] === 0, { step: 4, minBlocked: 0.05 });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].col).toBeGreaterThan(55);
  });
});

describe("atmosphere", () => {
  it("defaults are GO; storm opacity is NO-GO; SEP is NO-GO", () => {
    expect(assessAtmosphere(DEFAULT_ATMOS).level).toBe("GO");
    expect(assessAtmosphere({ ...DEFAULT_ATMOS, tau: 3 }).level).toBe("NO-GO");
    expect(assessAtmosphere({ ...DEFAULT_ATMOS, solar: "sep" }).level).toBe("NO-GO");
    expect(assessAtmosphere({ ...DEFAULT_ATMOS, ls: 250, tau: 0.9 }).level).toBe("CAUTION");
  });
});

describe("radiation", () => {
  it("one sol of open sky equals the RAD baseline", () => {
    const d = evaDose(24);
    expect(d.absorbedUGy).toBeCloseTo(210);
    expect(d.equivalentUSv).toBeCloseTo(640);
    expect(evaDose(4, 1, 0.8).absorbedUGy).toBeCloseTo(28);
  });
});
