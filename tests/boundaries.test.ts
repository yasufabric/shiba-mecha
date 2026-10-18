import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOOM_RESOLUTION, EFFECT_POOL, MAX_ENEMIES, MAX_LIGHTS, MAX_PIXEL_RATIO } from "../src/game/budgets";

describe("boundaries", () => {
  it("keeps the rules modules free of three", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/game");
    const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(3);
    for (const name of files) {
      const source = readFileSync(join(dir, name), "utf8");
      expect(source).not.toMatch(/from\s+["']three/);
    }
  });

  it("locks the draw budgets from the spec", () => {
    expect(MAX_ENEMIES).toBe(20);
    expect(EFFECT_POOL).toBe(300);
    expect(MAX_LIGHTS).toBe(2);
    expect(MAX_PIXEL_RATIO).toBeLessThanOrEqual(1.5);
    expect(BLOOM_RESOLUTION).toBeLessThanOrEqual(256);
  });
});
