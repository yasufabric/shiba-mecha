import { describe, expect, it } from "vitest";
import { AIM_RADIUS, allowedSpawns, movePlayer, pickTarget, PLAY_X } from "../src/game/combat";
import { MAX_ENEMIES } from "../src/game/budgets";

describe("combat", () => {
  it("picks the nearest enemy inside a generous reticle and ignores the rest", () => {
    const points = [
      { id: 1, x: 100, y: 100, alive: true },
      { id: 2, x: 140, y: 110, alive: true },
      { id: 3, x: 400, y: 400, alive: true },
      { id: 4, x: 100, y: 100, alive: false },
    ];
    expect(pickTarget(100, 100, points, AIM_RADIUS)).toBe(1);
    expect(pickTarget(130, 108, points, AIM_RADIUS)).toBe(2);
    expect(pickTarget(400, 400, points, 20)).toBe(3);
    expect(pickTarget(0, 0, points, AIM_RADIUS)).toBeNull();
  });

  it("treats a near miss as a hit", () => {
    const points = [{ id: 7, x: 200, y: 300, alive: true }];
    expect(pickTarget(200 + AIM_RADIUS - 1, 300, points, AIM_RADIUS)).toBe(7);
    expect(pickTarget(200 + AIM_RADIUS + 8, 300, points, AIM_RADIUS)).toBeNull();
  });

  it("clamps movement to the street", () => {
    const moved = movePlayer(0, 0, 1, 1, 10);
    expect(moved.x).toBe(PLAY_X);
    expect(moved.z).toBeGreaterThan(0);
  });

  it("never asks to spawn past the enemy cap", () => {
    expect(allowedSpawns(0, 6)).toBe(6);
    expect(allowedSpawns(18, 6)).toBe(2);
    expect(allowedSpawns(MAX_ENEMIES, 6)).toBe(0);
  });
});
