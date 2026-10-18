import { describe, expect, it } from "vitest";
import { COMBO_WINDOW, createCombo, registerKill, shotScale, tickCombo } from "../src/game/combo";

describe("combo", () => {
  it("grows on kills and keeps the peak", () => {
    let combo = createCombo();
    combo = registerKill(combo);
    combo = registerKill(combo);
    expect(combo.count).toBe(2);
    expect(combo.max).toBe(2);
    expect(combo.timer).toBe(COMBO_WINDOW);
  });

  it("resets the streak when the window expires and keeps max", () => {
    let combo = registerKill(registerKill(createCombo()));
    combo = tickCombo(combo, COMBO_WINDOW + 0.01);
    expect(combo.count).toBe(0);
    expect(combo.max).toBe(2);
    expect(tickCombo(combo, 1).count).toBe(0);
  });

  it("makes shots thicker as the combo climbs, then stops growing", () => {
    expect(shotScale(0)).toBe(1);
    expect(shotScale(4)).toBeGreaterThan(shotScale(1));
    expect(shotScale(99)).toBe(shotScale(10));
  });
});
