import { describe, expect, it } from "vitest";
import { AIM_RADIUS, aimReach, type ScreenPoint } from "../src/game/combat";
import { createSession, tickSession, type FrameInput, type GameEvent, type Session } from "../src/game/session";
import { deriveAim, placeAim, pointerSide, type PointerKind } from "../src/input";

const idle: FrameInput = {
  moveX: 0,
  moveZ: 0,
  aiming: false,
  reticleX: 0,
  reticleY: 0,
  aimReach: AIM_RADIUS,
  screens: [],
};

function openPack(): Session {
  let session = createSession(0);
  for (let frame = 0; frame < 80 && session.wave.phase !== "pack"; frame += 1) {
    session = tickSession(session, idle, 0.05).session;
  }
  return session;
}

function screensFor(session: Session, id: number, x: number, y: number): ScreenPoint[] {
  return session.wave.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({
      id: enemy.id,
      x: enemy.id === id ? x : -5000,
      y: enemy.id === id ? y : -5000,
      alive: true,
    }));
}

function holdAim(
  session: Session,
  reticleX: number,
  reticleY: number,
  screens: readonly ScreenPoint[],
  reach: number,
): { session: Session; events: GameEvent[]; aimX: number; aimY: number } {
  let current = session;
  const events: GameEvent[] = [];
  let aimX = reticleX;
  let aimY = reticleY;
  for (let frame = 0; frame < 8 && !current.over; frame += 1) {
    const step = tickSession(
      current,
      { moveX: 0, moveZ: 0, aiming: true, reticleX, reticleY, aimReach: reach, screens },
      0.05,
    );
    current = step.session;
    aimX = step.aim.x;
    aimY = step.aim.y;
    events.push(...step.events);
  }
  return { session: current, events, aimX, aimY };
}

function expectKill(events: GameEvent[], session: Session, enemyId: number): void {
  expect(events.some((event) => event.type === "shot" && event.enemyId === enemyId)).toBe(true);
  expect(events.some((event) => event.type === "killed" && event.scripted === false && event.enemyId === enemyId)).toBe(true);
  expect(session.wave.enemies.find((enemy) => enemy.id === enemyId)?.alive).toBe(false);
  expect(session.score).toBeGreaterThan(0);
}

describe("aim fire path", () => {
  it("fires, kills, and scores when the mouse cursor is on an enemy", () => {
    const width = 1280;
    const height = 800;
    const enemyX = 1000;
    const enemyY = 220;
    const session = openPack();
    const enemy = session.wave.enemies.find((item) => item.alive);
    expect(enemy).toBeDefined();
    if (!enemy) return;
    expect(pointerSide(enemyX, width)).toBe("right");

    const cursor = { originX: enemyX, originY: enemyY, x: enemyX, y: enemyY, kind: "mouse" as const };
    const dragged = deriveAim(cursor, width, height);
    const placed = placeAim(cursor, width, height);
    expect(Math.hypot(dragged.reticleX - enemyX, dragged.reticleY - enemyY)).toBeGreaterThan(AIM_RADIUS);
    expect(placed.reticleX).toBeCloseTo(enemyX);
    expect(placed.reticleY).toBeCloseTo(enemyY);

    const fired = holdAim(
      session,
      placed.reticleX,
      placed.reticleY,
      screensFor(session, enemy.id, enemyX, enemyY),
      aimReach(width, height),
    );
    expect(fired.aimX).toBeCloseTo(enemyX);
    expect(fired.aimY).toBeCloseTo(enemyY);
    expectKill(fired.events, fired.session, enemy.id);
  });

  it("fires, kills, and scores when a dragged mouse cursor reaches an enemy", () => {
    const width = 1280;
    const height = 800;
    const enemyX = 480;
    const enemyY = 370;
    const session = openPack();
    const enemy = session.wave.enemies.find((item) => item.alive);
    expect(enemy).toBeDefined();
    if (!enemy) return;
    const cursor = { originX: 1000, originY: 640, x: enemyX, y: enemyY, kind: "mouse" as const };
    expect(pointerSide(cursor.originX, width)).toBe("right");
    const dragged = deriveAim(cursor, width, height);
    const placed = placeAim(cursor, width, height);
    expect(Math.hypot(dragged.reticleX - enemyX, dragged.reticleY - enemyY)).toBeGreaterThan(AIM_RADIUS);
    expect(placed.reticleX).toBeCloseTo(enemyX);
    expect(placed.reticleY).toBeCloseTo(enemyY);

    const fired = holdAim(
      session,
      placed.reticleX,
      placed.reticleY,
      screensFor(session, enemy.id, enemyX, enemyY),
      aimReach(width, height),
    );
    expect(fired.aimX).toBeCloseTo(enemyX);
    expect(fired.aimY).toBeCloseTo(enemyY);
    expectKill(fired.events, fired.session, enemy.id);
  });

  it("snaps a near touch aim onto the enemy, then fires, kills, and scores", () => {
    const width = 390;
    const height = 844;
    const enemyX = 150;
    const enemyY = 460;
    const gap = 130;
    const reticleX = enemyX + gap;
    const reticleY = enemyY;
    const centerX = width * 0.5;
    const centerY = height * 0.46;
    const originX = 300;
    const originY = 680;
    const finger = {
      originX,
      originY,
      x: originX + (reticleX - centerX) / 1.35,
      y: originY + (reticleY - centerY) / 1.35,
      kind: "touch" as const satisfies PointerKind,
    };
    expect(pointerSide(originX, width)).toBe("right");
    const placed = placeAim(finger, width, height);
    const miss = Math.hypot(placed.reticleX - enemyX, placed.reticleY - enemyY);
    expect(miss).toBeGreaterThan(AIM_RADIUS);
    expect(miss).toBeLessThan(aimReach(width, height));

    const session = openPack();
    const enemy = session.wave.enemies.find((item) => item.alive);
    expect(enemy).toBeDefined();
    if (!enemy) return;
    const fired = holdAim(
      session,
      placed.reticleX,
      placed.reticleY,
      screensFor(session, enemy.id, enemyX, enemyY),
      aimReach(width, height),
    );
    expect(fired.aimX).toBeCloseTo(enemyX);
    expect(fired.aimY).toBeCloseTo(enemyY);
    expectKill(fired.events, fired.session, enemy.id);
  });
});
