import { describe, expect, it } from "vitest";
import { findEntry, KNOWLEDGE } from "@/lib/data/knowledge";

describe("science assistant knowledge base", () => {
  it("routes field questions to the right entry", () => {
    expect(findEntry("why did I lose the radio signal?")?.id).toBe("radio");
    expect(findEntry("how much oxygen until bingo")?.id).toBe("o2");
    expect(findEntry("tell me about the leopard spots")?.id).toBe("cheyava");
    expect(findEntry("what are the boxwork ridges")?.id).toBe("boxwork");
  });

  it("admits when it has no verified answer", () => {
    expect(findEntry("what is the capital of France")).toBeNull();
  });

  it("every answer has all three blocks", () => {
    const ctx = {
      targetName: "x", slopeDeg: 5, uncertainty: 0.2, roughness: 0.1, o2RemainingPct: 80, o2RateLmin: 1,
      bingoMarginL: 100, remainingKm: 1, comm: true, shelterM: 100, shelterBrg: 90, doseUSv: 20,
      atmosLevel: "GO" as const, atmosReasons: [], tau: 0.5, ls: 100,
    };
    for (const e of KNOWLEDGE) {
      const a = e.answer(ctx);
      expect(a.measured.length).toBeGreaterThan(0);
      expect(a.derived.length).toBeGreaterThan(0);
      expect(a.interpretation.length).toBeGreaterThan(0);
    }
  });
});
