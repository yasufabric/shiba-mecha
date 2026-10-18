import { describe, expect, it } from "vitest";
import { moveEnemies, movePlayer, overlapsPlayer } from "../src/game/combat";
import { createSession, tickSession, type FrameInput } from "../src/game/session";
import type { Enemy } from "../src/game/types";
import { EARLY_PACK_SIZE, EARLY_PACE, PACK_SIZE, wavePace } from "../src/game/wave";

const idle: FrameInput = {
  moveX: 0,
  moveZ: 0,
  aiming: false,
  reticleX: 0,
  reticleY: 0,
  aimReach: 88,
  screens: [],
};

function reachPack(waveIndex: number): Enemy[] {
  let session = createSession(0);
  for (let frame = 0; frame < 900 && !(session.wave.phase === "pack" && session.wave.waveIndex === waveIndex); frame += 1) {
    const screens = session.wave.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => ({ id: enemy.id, x: 200, y: 400, alive: true }));
    const hunting = session.wave.phase === "pack" || session.wave.phase === "large";
    session = tickSession(
      session,
      { ...idle, aiming: hunting, screens, reticleX: 200, reticleY: 400 },
      0.05,
    ).session;
  }
  expect(session.wave.phase).toBe("pack");
  expect(session.wave.waveIndex).toBe(waveIndex);
  return session.wave.enemies.map((enemy) => ({ ...enemy }));
}

function sidestepSeconds(enemies: Enemy[]): number {
  let x = 0;
  let z = 0;
  let elapsed = 0;
  const dt = 0.05;
  let pack = enemies.map((enemy) => ({ ...enemy }));
  while (elapsed < 20) {
    const moved = movePlayer(x, z, 1, 0, dt);
    x = moved.x;
    z = moved.z;
    pack = moveEnemies(pack, x, z, dt);
    if (pack.some((enemy) => enemy.alive && overlapsPlayer(enemy, x, z))) return elapsed;
    elapsed += dt;
  }
  return elapsed;
}

describe("early waves", () => {
  it("gives the first two waves fewer, slower foes and time to sidestep", () => {
    const first = reachPack(0);
    const second = reachPack(1);
    const third = reachPack(2);
    expect(first).toHaveLength(EARLY_PACK_SIZE);
    expect(second).toHaveLength(EARLY_PACK_SIZE);
    expect(third).toHaveLength(PACK_SIZE);
    expect(EARLY_PACK_SIZE).toBeLessThan(PACK_SIZE);
    expect(first.every((enemy) => enemy.pace === EARLY_PACE)).toBe(true);
    expect(second.every((enemy) => enemy.pace === EARLY_PACE)).toBe(true);
    expect(third.every((enemy) => enemy.pace === 1)).toBe(true);
    expect(wavePace(0)).toBeLessThan(1);
    expect(EARLY_PACE).toBeLessThan(0.6);

    const firstDodge = sidestepSeconds(first);
    const secondDodge = sidestepSeconds(second);
    const thirdDodge = sidestepSeconds(third);
    expect(firstDodge).toBeGreaterThan(4);
    expect(secondDodge).toBeGreaterThan(4);
    expect(firstDodge).toBeGreaterThan(thirdDodge);
    expect(secondDodge).toBeGreaterThan(thirdDodge);
    expect(thirdDodge).toBeLessThan(3.5);
  });
});
