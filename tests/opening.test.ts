import { describe, expect, it } from "vitest";
import { AIM_RADIUS, type ScreenPoint } from "../src/game/combat";
import { createSession, tickSession, type FrameInput, type GameEvent, type Session } from "../src/game/session";
import { scriptedReticle } from "../src/game/wave";

const idle: FrameInput = {
  moveX: 0,
  moveZ: 0,
  aiming: false,
  reticleX: 12,
  reticleY: 12,
  aimReach: AIM_RADIUS,
  screens: [],
};

function openingScreens(session: Session): ScreenPoint[] {
  return session.wave.enemies.map((enemy, index) => ({
    id: enemy.id,
    x: 70 + index * 110,
    y: 340,
    alive: enemy.alive,
  }));
}

describe("opening", () => {
  it("kills the three in front with no input and aims at them from the first frame", () => {
    const started = createSession(0);
    const openingIds = started.wave.enemies.map((enemy) => enemy.id);
    expect(openingIds).toHaveLength(3);
    expect(started.wave.phase).toBe("landing");

    const firstScreens = openingScreens(started);
    const firstAim = scriptedReticle(started.wave.phase, started.wave.enemies, firstScreens);
    expect(firstAim).toEqual({ x: firstScreens[0]?.x, y: firstScreens[0]?.y, enemyId: openingIds[0] });

    let session = started;
    const events: GameEvent[] = [];
    let sawReticle = false;
    for (let frame = 0; frame < 80 && session.wave.phase !== "pack"; frame += 1) {
      const screens = openingScreens(session);
      const aim = scriptedReticle(session.wave.phase, session.wave.enemies, screens);
      if (session.wave.phase === "landing" || session.wave.phase === "intro") {
        const alive = session.wave.enemies.filter((enemy) => openingIds.includes(enemy.id) && enemy.alive);
        if (alive.length > 0) {
          expect(aim).not.toBeNull();
          expect(openingIds).toContain(aim?.enemyId);
          const living = alive.find((enemy) => enemy.id === aim?.enemyId);
          expect(living?.alive).toBe(true);
          const point = screens.find((item) => item.id === aim?.enemyId);
          expect(aim?.x).toBe(point?.x);
          expect(aim?.y).toBe(point?.y);
          sawReticle = true;
        }
      }
      const step = tickSession(session, { ...idle, aiming: false, screens }, 0.05);
      if (frame === 0) {
        expect(step.aim.x).toBe(firstScreens[0]?.x);
        expect(step.aim.y).toBe(firstScreens[0]?.y);
      }
      session = step.session;
      events.push(...step.events);
    }

    const killed = events.filter((event) => event.type === "killed" && event.scripted);
    expect(sawReticle).toBe(true);
    expect(killed.map((event) => (event.type === "killed" ? event.enemyId : -1))).toEqual(openingIds);
    expect(events.filter((event) => event.type === "shot")).toHaveLength(3);
    expect(session.score).toBe(0);
    expect(session.wave.phase).toBe("pack");
    expect(session.wave.enemies.some((enemy) => openingIds.includes(enemy.id) && enemy.alive)).toBe(false);
    expect(scriptedReticle("pack", session.wave.enemies, openingScreens(session))).toBeNull();
  });
});
