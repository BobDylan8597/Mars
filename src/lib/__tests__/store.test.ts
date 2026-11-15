import { describe, expect, it } from "vitest";
import { DEFAULT_LAYERS, mergeSaved, useMission } from "@/lib/store";

describe("saved state merge", () => {
  const current = useMission.getState();

  it("fills missing layers and fields from defaults", () => {
    const m = mergeSaved({ targetId: "JZ-T2", layers: { ortho: { visible: false, opacity: 0.4 } }, twin: { progress: 0.5 } }, current);
    expect(m.targetId).toBe("JZ-T2");
    expect(m.layers.ortho).toEqual({ visible: false, opacity: 0.4 });
    expect(m.layers.comm).toEqual(DEFAULT_LAYERS.comm);
    expect(m.layers.shelters).toEqual(DEFAULT_LAYERS.shelters);
    expect(m.twin.progress).toBe(0.5);
    expect(m.twin.playing).toBe(false);
    expect(typeof m.setTarget).toBe("function");
  });

  it("survives garbage", () => {
    for (const bad of [null, undefined, 42, "x", [], { layers: "nope", logs: "nope", eva: 3 }]) {
      const m = mergeSaved(bad, current);
      expect(m.layers.routes.visible).toBe(true);
      expect(Array.isArray(m.logs)).toBe(true);
      expect(m.eva.tankL).toBeGreaterThan(0);
    }
  });
});
