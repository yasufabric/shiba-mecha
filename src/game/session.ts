import { registerKill, shotScale, tickCombo, type ComboState, createCombo } from "./combo";
import {
  FIRE_INTERVAL,
  lockAim,
  moveEnemies,
  movePlayer,
  overlapsPlayer,
  pushOut,
  SHOT_DAMAGE,
  type ScreenPoint,
} from "./combat";
import { createHull, MAX_HITS, takeHit, tickHull, type Hull } from "./damage";
import { clamp } from "./math";
import { pointsFor, promoteBest } from "./score";
import { assertNever, type Enemy, type EnemyKind } from "./types";
import { createWave, isCombatPhase, tickWave, type WaveState } from "./wave";

export interface FrameInput {
  moveX: number;
  moveZ: number;
  aiming: boolean;
  reticleX: number;
  reticleY: number;
  aimReach: number;
  screens: readonly ScreenPoint[];
}

export interface AimPoint {
  x: number;
  y: number;
}

export type GameEvent =
  | { type: "shot"; enemyId: number; kind: EnemyKind; x: number; z: number; scale: number }
  | { type: "killed"; enemyId: number; kind: EnemyKind; x: number; z: number; scripted: boolean }
  | { type: "crash"; enemyId: number; kind: EnemyKind; x: number; z: number }
  | { type: "hit"; hits: number }
  | { type: "landed" }
  | { type: "flash" }
  | { type: "gameover"; score: number; maxCombo: number; best: number };

export interface Session {
  playerX: number;
  playerZ: number;
  hull: Hull;
  wave: WaveState;
  combo: ComboState;
  score: number;
  best: number;
  cooldown: number;
  over: boolean;
}

export function createSession(best: number): Session {
  return {
    playerX: 0,
    playerZ: 0,
    hull: createHull(),
    wave: createWave(),
    combo: createCombo(),
    score: 0,
    best: Math.max(0, Math.floor(best)),
    cooldown: 0,
    over: false,
  };
}

export function retrySession(session: Session): Session {
  return createSession(session.best);
}

export function tickSession(
  session: Session,
  input: FrameInput,
  dt: number,
): { session: Session; events: GameEvent[]; aim: AimPoint } {
  const step = clamp(dt, 0, 0.05);
  const rawAim = { x: input.reticleX, y: input.reticleY };
  if (session.over || step === 0) return { session, events: [], aim: rawAim };

  const events: GameEvent[] = [];
  let combo = tickCombo(session.combo, step);
  let hull = tickHull(session.hull, step);
  let cooldown = Math.max(0, session.cooldown - step);
  let score = session.score;
  let best = session.best;

  const waved = tickWave(session.wave, step);
  let wave = waved.state;
  for (const event of waved.events) {
    switch (event.type) {
      case "scripted-shot":
        events.push({
          type: "shot",
          enemyId: event.enemyId,
          kind: "grunt",
          x: event.x,
          z: event.z,
          scale: 1.2,
        });
        break;
      case "killed":
        events.push({
          type: "killed",
          enemyId: event.enemyId,
          kind: event.kind,
          x: event.x,
          z: event.z,
          scripted: true,
        });
        break;
      case "landed":
        events.push({ type: "landed" });
        break;
      case "flash":
        events.push({ type: "flash" });
        break;
      default:
        assertNever(event, "wave event");
    }
  }

  let playerX = session.playerX;
  let playerZ = session.playerZ;
  let aim = rawAim;

  if (isCombatPhase(wave.phase)) {
    const moved = movePlayer(playerX, playerZ, input.moveX, input.moveZ, step);
    playerX = moved.x;
    playerZ = moved.z;
    let enemies = moveEnemies(wave.enemies, playerX, playerZ, step);

    if (input.aiming) {
      const locked = lockAim(input.reticleX, input.reticleY, input.screens, input.aimReach);
      aim = { x: locked.x, y: locked.y };
      const target = locked.targetId === null || cooldown > 0
        ? undefined
        : enemies.find((enemy) => enemy.id === locked.targetId && enemy.alive);
      if (target) {
        cooldown = FIRE_INTERVAL;
        const scale = shotScale(combo.count);
        const hp = target.hp - SHOT_DAMAGE;
        enemies = enemies.map((enemy) =>
          enemy.id === target.id ? { ...enemy, hp, alive: hp > 0 } : enemy,
        );
        events.push({
          type: "shot",
          enemyId: target.id,
          kind: target.kind,
          x: target.x,
          z: target.z,
          scale,
        });
        if (hp <= 0) {
          combo = registerKill(combo);
          score += pointsFor(target.kind, combo.count);
          events.push({
            type: "killed",
            enemyId: target.id,
            kind: target.kind,
            x: target.x,
            z: target.z,
            scripted: false,
          });
        }
      }
    }

    const contact = resolveContact(enemies, playerX, playerZ, hull);
    enemies = contact.enemies;
    hull = contact.hull;
    if (contact.crashed) {
      events.push({
        type: "crash",
        enemyId: contact.crashed.id,
        kind: contact.crashed.kind,
        x: contact.crashed.x,
        z: contact.crashed.z,
      });
    }
    if (contact.applied) events.push({ type: "hit", hits: hull.hits });
    wave = { ...wave, enemies };

    if (contact.over) {
      best = promoteBest(best, score);
      events.push({ type: "gameover", score, maxCombo: combo.max, best });
      return {
        session: {
          playerX,
          playerZ,
          hull,
          wave: { ...wave, phase: "gameover", phaseTime: 0 },
          combo,
          score,
          best,
          cooldown,
          over: true,
        },
        events,
        aim,
      };
    }
  }

  return {
    session: { playerX, playerZ, hull, wave, combo, score, best, cooldown, over: false },
    events,
    aim,
  };
}

function resolveContact(
  enemies: readonly Enemy[],
  playerX: number,
  playerZ: number,
  hull: Hull,
): { enemies: Enemy[]; hull: Hull; crashed: Enemy | null; applied: boolean; over: boolean } {
  const overlapping = enemies.filter((enemy) => enemy.alive && overlapsPlayer(enemy, playerX, playerZ));
  if (overlapping.length === 0) {
    return { enemies: enemies.map((enemy) => enemy), hull, crashed: null, applied: false, over: false };
  }

  if (hull.iframes > 0 || hull.hits >= MAX_HITS) {
    return {
      enemies: enemies.map((enemy) =>
        overlapping.some((hit) => hit.id === enemy.id) ? pushOut(enemy, playerX, playerZ) : enemy,
      ),
      hull,
      crashed: null,
      applied: false,
      over: hull.hits >= MAX_HITS,
    };
  }

  const victim = overlapping[0];
  if (!victim) {
    return { enemies: enemies.map((enemy) => enemy), hull, crashed: null, applied: false, over: false };
  }
  const hit = takeHit(hull);
  return {
    enemies: enemies.map((enemy) => {
      if (enemy.id === victim.id) return { ...enemy, hp: 0, alive: false };
      if (overlapping.some((other) => other.id === enemy.id)) return pushOut(enemy, playerX, playerZ);
      return enemy;
    }),
    hull: hit.hull,
    crashed: victim,
    applied: hit.cracked,
    over: hit.over,
  };
}
