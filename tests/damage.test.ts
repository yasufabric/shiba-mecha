import { describe, expect, it } from "vitest";
import { createHull, IFRAMES, MAX_HITS, takeHit, tickHull } from "../src/game/damage";

describe("damage", () => {
  it("cracks on each hit and ends the run on the third", () => {
    let hull = createHull();
    const first = takeHit(hull);
    hull = first.hull;
    expect(first.cracked).toBe(true);
    expect(first.over).toBe(false);
    expect(hull.hits).toBe(1);

    hull = tickHull(hull, IFRAMES + 0.01);
    const second = takeHit(hull);
    hull = tickHull(second.hull, IFRAMES + 0.01);
    const third = takeHit(hull);
    expect(third.over).toBe(true);
    expect(third.hull.hits).toBe(MAX_HITS);
  });

  it("ignores hits during iframes", () => {
    const first = takeHit(createHull());
    const blocked = takeHit(first.hull);
    expect(blocked.cracked).toBe(false);
    expect(blocked.hull.hits).toBe(1);
    const cooled = tickHull(first.hull, IFRAMES);
    expect(cooled.iframes).toBe(0);
    expect(takeHit(cooled).hull.hits).toBe(2);
  });
});
