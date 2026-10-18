import { allowedSpawns, maxHp, radiusOf } from "./combat";
import { clamp } from "./math";
import { assertNever, type Enemy, type EnemyKind, type PhaseName } from "./types";

export const LANDING_TIME = 0.9;
export const INTRO_SHOT_TIMES = [0.2, 0.62, 1.04] as const;
export const INTRO_BEAT = 0.4;
export const FLASH_TIME = 0.34;
export const PACK_SIZE = 6;
export const LANDING_DROP = 6.2;

export type WaveEvent =
  | { type: "scripted-shot"; enemyId: number; x: number; z: number }
  | { type: "killed"; enemyId: number; kind: EnemyKind; x: number; z: number; scripted: true }
  | { type: "flash" }
  | { type: "landed" };

export interface WaveState {
  phase: PhaseName;
  phaseTime: number;
  waveIndex: number;
  introShots: number;
  enemies: Enemy[];
  nextId: number;
}

export function createWave(): WaveState {
  const enemies = [-1.7, 0, 1.7].map((x, index) => makeEnemy(index, "grunt", x, 5.5));
  return {
    phase: "landing",
    phaseTime: 0,
    waveIndex: 0,
    introShots: 0,
    enemies,
    nextId: enemies.length,
  };
}

export function isCombatPhase(phase: PhaseName): boolean {
  switch (phase) {
    case "pack":
    case "large":
      return true;
    case "landing":
    case "intro":
    case "flash":
    case "gameover":
      return false;
    default:
      assertNever(phase, "phase");
  }
}

export function mechAltitude(phase: PhaseName, phaseTime: number): number {
  switch (phase) {
    case "landing": {
      const t = clamp(phaseTime / LANDING_TIME, 0, 1);
      const eased = 1 - (1 - t) ** 3;
      return (1 - eased) * LANDING_DROP;
    }
    case "intro":
    case "pack":
    case "large":
    case "flash":
    case "gameover":
      return 0;
    default:
      assertNever(phase, "phase");
  }
}

export function tickWave(state: WaveState, dt: number): { state: WaveState; events: WaveEvent[] } {
  const events: WaveEvent[] = [];
  let wave: WaveState = {
    ...state,
    phaseTime: state.phaseTime + dt,
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
  };

  switch (wave.phase) {
    case "landing": {
      if (wave.phaseTime >= LANDING_TIME) {
        wave = { ...wave, phase: "intro", phaseTime: 0 };
        events.push({ type: "landed" });
      }
      break;
    }
    case "intro": {
      while (wave.introShots < INTRO_SHOT_TIMES.length) {
        const shotTime = INTRO_SHOT_TIMES[wave.introShots];
        if (shotTime === undefined || wave.phaseTime < shotTime) break;
        const target = wave.enemies.find((enemy) => enemy.alive);
        if (!target) break;
        wave = {
          ...wave,
          introShots: wave.introShots + 1,
          enemies: wave.enemies.map((enemy) =>
            enemy.id === target.id ? { ...enemy, hp: 0, alive: false } : enemy,
          ),
        };
        events.push({ type: "scripted-shot", enemyId: target.id, x: target.x, z: target.z });
        events.push({
          type: "killed",
          enemyId: target.id,
          kind: target.kind,
          x: target.x,
          z: target.z,
          scripted: true,
        });
      }
      const lastShot = INTRO_SHOT_TIMES[INTRO_SHOT_TIMES.length - 1] ?? 0;
      if (wave.introShots >= INTRO_SHOT_TIMES.length && wave.phaseTime >= lastShot + INTRO_BEAT) {
        wave = beginPack(wave, wave.waveIndex);
      }
      break;
    }
    case "pack": {
      if (!wave.enemies.some((enemy) => enemy.alive)) {
        const large = makeEnemy(wave.nextId, "large", wave.waveIndex % 2 === 0 ? -0.35 : 0.35, 9.4);
        wave = {
          ...wave,
          phase: "large",
          phaseTime: 0,
          enemies: [large],
          nextId: wave.nextId + 1,
        };
      }
      break;
    }
    case "large": {
      if (!wave.enemies.some((enemy) => enemy.alive)) {
        wave = { ...wave, phase: "flash", phaseTime: 0, enemies: [] };
        events.push({ type: "flash" });
      }
      break;
    }
    case "flash": {
      if (wave.phaseTime >= FLASH_TIME) {
        wave = beginPack(wave, wave.waveIndex + 1);
      }
      break;
    }
    case "gameover":
      break;
    default:
      assertNever(wave.phase, "phase");
  }

  return { state: wave, events };
}

function beginPack(wave: WaveState, waveIndex: number): WaveState {
  const count = allowedSpawns(0, PACK_SIZE);
  const enemies: Enemy[] = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = -2.2 + col * 2.2 + (waveIndex % 2) * 0.4;
    const z = 8.6 + row * 1.7;
    enemies.push(makeEnemy(wave.nextId + index, "grunt", x, z));
  }
  return {
    ...wave,
    phase: "pack",
    phaseTime: 0,
    waveIndex,
    enemies,
    nextId: wave.nextId + enemies.length,
  };
}

function makeEnemy(id: number, kind: EnemyKind, x: number, z: number): Enemy {
  return { id, kind, x, z, hp: maxHp(kind), alive: true, radius: radiusOf(kind) };
}
