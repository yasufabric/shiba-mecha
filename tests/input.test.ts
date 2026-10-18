import { describe, expect, it } from "vitest";
import { deriveAim, deriveStick, STICK_RADIUS } from "../src/input";

describe("input", () => {
  it("puts the stick where the thumb lands and moves from that origin", () => {
    const idle = deriveStick(null);
    expect(idle.active).toBe(false);
    expect(idle.moveX).toBe(0);
    const held = deriveStick({ originX: 40, originY: 500, x: 40 + STICK_RADIUS, y: 500 });
    expect(held.active).toBe(true);
    expect(held.originX).toBe(40);
    expect(held.moveX).toBeCloseTo(1);
    expect(held.moveZ).toBeCloseTo(0);
    const forward = deriveStick({ originX: 40, originY: 500, x: 40, y: 500 - STICK_RADIUS });
    expect(forward.moveZ).toBeCloseTo(1);
  });

  it("aims from a drag on the right and rests near the center", () => {
    const rest = deriveAim(null, 390, 844);
    expect(rest.active).toBe(false);
    expect(rest.reticleX).toBeCloseTo(195);
    expect(rest.reticleY).toBeCloseTo(844 * 0.46);
    const dragged = deriveAim({ originX: 300, originY: 600, x: 340, y: 640 }, 390, 844);
    expect(dragged.active).toBe(true);
    expect(dragged.reticleX).toBeGreaterThan(195);
    expect(dragged.reticleY).toBeGreaterThan(844 * 0.46);
  });
});
