import { describe, expect, it } from "vitest";
import { maxHp } from "../src/game/combat";
import { MAX_ENEMIES } from "../src/game/budgets";
import {
  createWave,
  FLASH_TIME,
  INTRO_SHOT_TIMES,
  LANDING_TIME,
  mechAltitude,
  EARLY_PACK_SIZE,
  tickWave,
} from "../src/game/wave";

describe("wave", () => {
  it("drops the mech, then shoots the three opening enemies", () => {
    let wave = createWave();
    expect(wave.phase).toBe("landing");
    expect(wave.enemies.filter((enemy) => enemy.alive)).toHaveLength(3);
    expect(mechAltitude("landing", 0)).toBeGreaterThan(5);
    expect(mechAltitude("landing", LANDING_TIME)).toBe(0);

    let landed = false;
    let shots = 0;
    for (let i = 0; i < 80 && wave.phase !== "pack"; i += 1) {
      const step = tickWave(wave, 0.05);
      wave = step.state;
      if (step.events.some((event) => event.type === "landed")) landed = true;
      shots += step.events.filter((event) => event.type === "scripted-shot").length;
    }
    expect(landed).toBe(true);
    expect(shots).toBe(INTRO_SHOT_TIMES.length);
    expect(wave.phase).toBe("pack");
    expect(wave.enemies.filter((enemy) => enemy.alive)).toHaveLength(EARLY_PACK_SIZE);
    expect(wave.enemies.every((enemy) => enemy.kind === "grunt")).toBe(true);
  });

  it("starts the pack when the opening enemies are already gone", () => {
    let wave = createWave();
    while (wave.phase === "landing") wave = tickWave(wave, 0.05).state;
    expect(wave.phase).toBe("intro");
    wave = {
      ...wave,
      enemies: wave.enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })),
    };
    for (let i = 0; i < 20 && wave.phase === "intro"; i += 1) wave = tickWave(wave, 0.05).state;
    expect(wave.phase).toBe("pack");
  });

  it("sends one large foe after the pack, flashes, then starts the next pack", () => {
    let wave = createWave();
    for (let i = 0; i < 80 && wave.phase !== "pack"; i += 1) wave = tickWave(wave, 0.05).state;
    wave = { ...wave, enemies: wave.enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })) };
    const toLarge = tickWave(wave, 0.05);
    expect(toLarge.state.phase).toBe("large");
    expect(toLarge.state.enemies).toHaveLength(1);
    expect(toLarge.state.enemies[0]?.kind).toBe("large");
    expect(toLarge.state.enemies[0]?.hp).toBe(maxHp("large"));

    const cleared = {
      ...toLarge.state,
      enemies: toLarge.state.enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })),
    };
    const flashed = tickWave(cleared, 0.05);
    expect(flashed.state.phase).toBe("flash");
    expect(flashed.events.some((event) => event.type === "flash")).toBe(true);

    const next = tickWave(flashed.state, FLASH_TIME);
    expect(next.state.phase).toBe("pack");
    expect(next.state.waveIndex).toBe(1);
    expect(next.state.enemies.filter((enemy) => enemy.alive)).toHaveLength(EARLY_PACK_SIZE);
    expect(next.state.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
  });
});
