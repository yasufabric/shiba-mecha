import { describe, expect, it } from "vitest";
import { AIM_RADIUS } from "../src/game/combat";
import { createSession, retrySession, tickSession, type FrameInput, type GameEvent, type Session } from "../src/game/session";

const idle: FrameInput = {
  moveX: 0,
  moveZ: 0,
  aiming: false,
  reticleX: 200,
  reticleY: 400,
  screens: [],
};

function run(session: Session, frames: number, aiming: boolean): { session: Session; events: GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  for (let frame = 0; frame < frames && !current.over; frame += 1) {
    const screens = current.wave.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => ({ id: enemy.id, x: 200, y: 400, alive: true }));
    const result = tickSession(
      current,
      { ...idle, aiming, screens, reticleX: 200, reticleY: 400 },
      0.05,
    );
    current = result.session;
    events.push(...result.events);
  }
  return { session: current, events };
}

describe("session", () => {
  it("plays the opening without score or tutorial input", () => {
    const played = run(createSession(0), 80, false);
    const scripted = played.events.filter((event) => event.type === "killed" && event.scripted);
    expect(scripted).toHaveLength(3);
    expect(played.events.filter((event) => event.type === "shot")).toHaveLength(3);
    expect(played.session.score).toBe(0);
    expect(played.session.wave.phase).toBe("pack");
    expect(played.session.hull.hits).toBe(0);
  });

  it("mows a pack, thickens shots with combo, flashes the large, then starts the next pack", () => {
    let session = run(createSession(40), 80, false).session;
    const events: GameEvent[] = [];
    for (let frame = 0; frame < 220 && !(session.wave.phase === "pack" && session.wave.waveIndex >= 1); frame += 1) {
      const step = run(session, 1, true);
      session = step.session;
      events.push(...step.events);
    }
    const scales = events.filter((event) => event.type === "shot").map((event) => event.scale);
    expect(Math.max(...scales)).toBeGreaterThan(1);
    expect(session.combo.max).toBeGreaterThanOrEqual(6);
    expect(session.score).toBeGreaterThan(1000);
    expect(events.some((event) => event.type === "flash")).toBe(true);
    expect(session.wave.phase).toBe("pack");
    expect(session.wave.waveIndex).toBe(1);
    expect(session.wave.enemies.every((enemy) => enemy.kind === "grunt")).toBe(true);
    expect(session.best).toBe(40);
  });

  it("does not fire when the reticle misses or the thumb is up", () => {
    let session = run(createSession(0), 80, false).session;
    const missed = tickSession(
      session,
      {
        ...idle,
        aiming: true,
        reticleX: 0,
        reticleY: 0,
        screens: session.wave.enemies.map((enemy) => ({
          id: enemy.id,
          x: AIM_RADIUS + 40,
          y: 0,
          alive: enemy.alive,
        })),
      },
      0.05,
    );
    expect(missed.events.some((event) => event.type === "shot")).toBe(false);
    const held = tickSession(
      session,
      {
        ...idle,
        aiming: false,
        screens: session.wave.enemies.map((enemy) => ({ id: enemy.id, x: 200, y: 400, alive: true })),
      },
      0.05,
    );
    expect(held.session.score).toBe(0);
  });

  it("ends on the third hit, keeps best, and retries immediately", () => {
    let session = run(createSession(80), 80, false).session;
    let events: GameEvent[] = [];
    for (let frame = 0; frame < 400 && !session.over; frame += 1) {
      const result = tickSession(session, idle, 0.05);
      session = result.session;
      events = result.events;
    }
    expect(session.over).toBe(true);
    expect(session.hull.hits).toBe(3);
    expect(session.wave.phase).toBe("gameover");
    const over = events.find((event) => event.type === "gameover");
    expect(over).toMatchObject({ type: "gameover", best: 80, maxCombo: 0 });
    const again = retrySession(session);
    expect(again.over).toBe(false);
    expect(again.hull.hits).toBe(0);
    expect(again.score).toBe(0);
    expect(again.best).toBe(80);
    expect(again.wave.phase).toBe("landing");
  });

  it("raises best when the run scores higher", () => {
    let session = run(createSession(0), 80, false).session;
    session = run(session, 40, true).session;
    for (let frame = 0; frame < 400 && !session.over; frame += 1) {
      session = tickSession(session, idle, 0.05).session;
    }
    expect(session.over).toBe(true);
    expect(session.best).toBe(session.score);
    expect(session.score).toBeGreaterThan(0);
    expect(retrySession(session).best).toBe(session.score);
  });
});
