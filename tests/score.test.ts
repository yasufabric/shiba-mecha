import { describe, expect, it } from "vitest";
import { BEST_KEY, pointsFor, promoteBest, readBest, writeBest, type ScoreStore } from "../src/game/score";

function memory(): ScoreStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("score", () => {
  it("pays more for a large foe and multiplies by the current combo", () => {
    expect(pointsFor("grunt", 1)).toBe(100);
    expect(pointsFor("grunt", 4)).toBe(400);
    expect(pointsFor("large", 3)).toBe(2100);
  });

  it("keeps the higher best score", () => {
    expect(promoteBest(100, 40)).toBe(100);
    expect(promoteBest(100, 250)).toBe(250);
  });

  it("round-trips best score and ignores garbage", () => {
    const store = memory();
    expect(readBest(store)).toBe(0);
    writeBest(store, 1540);
    expect(store.values.get(BEST_KEY)).toBe("1540");
    expect(readBest(store)).toBe(1540);
    store.setItem(BEST_KEY, "nope");
    expect(readBest(store)).toBe(0);
    store.setItem(BEST_KEY, "-5");
    expect(readBest(store)).toBe(0);
  });

  it("survives a storage read failure", () => {
    const broken: ScoreStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    };
    expect(readBest(broken)).toBe(0);
  });
});
