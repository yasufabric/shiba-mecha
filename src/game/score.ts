import { assertNever, type EnemyKind } from "./types";

export const BEST_KEY = "shiba-mecha-best";

export interface ScoreStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function pointsFor(kind: EnemyKind, combo: number): number {
  return basePoints(kind) * Math.max(1, Math.floor(combo));
}

export function readBest(storage: ScoreStore): number {
  try {
    const raw = storage.getItem(BEST_KEY);
    if (raw === null) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  } catch {
    return 0;
  }
}

export function writeBest(storage: ScoreStore, score: number): void {
  const safe = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  storage.setItem(BEST_KEY, String(safe));
}

export function promoteBest(best: number, score: number): number {
  return Math.max(Math.max(0, Math.floor(best)), Math.max(0, Math.floor(score)));
}

function basePoints(kind: EnemyKind): number {
  switch (kind) {
    case "grunt":
      return 100;
    case "large":
      return 700;
    default: {
      assertNever(kind, "enemy kind");
    }
  }
}
