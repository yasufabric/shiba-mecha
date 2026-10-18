import { MAX_ENEMIES } from "./budgets";
import { clamp } from "./math";
import { assertNever, type Enemy, type EnemyKind } from "./types";

export const AIM_RADIUS = 88;
export const FIRE_INTERVAL = 0.085;
export const SHOT_DAMAGE = 1;
export const PLAYER_SPEED = 6.4;
export const PLAYER_RADIUS = 0.62;
export const PLAY_X = 3.15;
export const PLAY_Z_MIN = -0.35;
export const PLAY_Z_MAX = 4.1;

export interface ScreenPoint {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

export function maxHp(kind: EnemyKind): number {
  switch (kind) {
    case "grunt":
      return 2;
    case "large":
      return 14;
    default:
      assertNever(kind, "enemy kind");
  }
}

export function radiusOf(kind: EnemyKind): number {
  switch (kind) {
    case "grunt":
      return 0.5;
    case "large":
      return 1.1;
    default:
      assertNever(kind, "enemy kind");
  }
}

export function speedOf(kind: EnemyKind): number {
  switch (kind) {
    case "grunt":
      return 3.45;
    case "large":
      return 1.4;
    default:
      assertNever(kind, "enemy kind");
  }
}

export function enemyHover(kind: EnemyKind): number {
  switch (kind) {
    case "grunt":
      return 0.86;
    case "large":
      return 1.2;
    default:
      assertNever(kind, "enemy kind");
  }
}

export function allowedSpawns(alive: number, requested: number): number {
  const room = MAX_ENEMIES - Math.max(0, Math.floor(alive));
  if (room <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(requested), room));
}

export function pickTarget(
  reticleX: number,
  reticleY: number,
  points: readonly ScreenPoint[],
  radius: number,
): number | null {
  let bestId: number | null = null;
  let bestDistance = radius;
  for (const point of points) {
    if (!point.alive) continue;
    const distance = Math.hypot(point.x - reticleX, point.y - reticleY);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestId = point.id;
    }
  }
  return bestId;
}

export function aimReach(width: number, height: number): number {
  const span = Math.min(Math.max(1, width), Math.max(1, height));
  return Math.max(AIM_RADIUS * 2, span * 0.42);
}

export function lockAim(
  reticleX: number,
  reticleY: number,
  points: readonly ScreenPoint[],
  reach: number,
): { x: number; y: number; targetId: number | null } {
  const targetId = pickTarget(reticleX, reticleY, points, reach);
  const point = targetId === null ? undefined : points.find((item) => item.id === targetId && item.alive);
  if (!point) return { x: reticleX, y: reticleY, targetId: null };
  return { x: point.x, y: point.y, targetId: point.id };
}

export function movePlayer(
  x: number,
  z: number,
  moveX: number,
  moveZ: number,
  dt: number,
): { x: number; z: number } {
  return {
    x: clamp(x + moveX * PLAYER_SPEED * dt, -PLAY_X, PLAY_X),
    z: clamp(z + moveZ * PLAYER_SPEED * dt, PLAY_Z_MIN, PLAY_Z_MAX),
  };
}

export function moveEnemies(
  enemies: readonly Enemy[],
  playerX: number,
  playerZ: number,
  dt: number,
): Enemy[] {
  return enemies.map((enemy) => {
    if (!enemy.alive) return enemy;
    const dx = playerX - enemy.x;
    const dz = playerZ - enemy.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.0001) return enemy;
    const step = Math.min(distance, speedOf(enemy.kind) * dt);
    return {
      ...enemy,
      x: enemy.x + (dx / distance) * step,
      z: enemy.z + (dz / distance) * step,
    };
  });
}

export function overlapsPlayer(enemy: Enemy, playerX: number, playerZ: number): boolean {
  const reach = PLAYER_RADIUS + enemy.radius * 0.65;
  return Math.hypot(enemy.x - playerX, enemy.z - playerZ) <= reach;
}

export function pushOut(enemy: Enemy, playerX: number, playerZ: number): Enemy {
  const dx = enemy.x - playerX;
  const dz = enemy.z - playerZ;
  const distance = Math.hypot(dx, dz) || 1;
  const need = PLAYER_RADIUS + enemy.radius + 0.45;
  return {
    ...enemy,
    x: playerX + (dx / distance) * need,
    z: playerZ + (dz / distance) * need + 0.55,
  };
}
