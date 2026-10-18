export type EnemyKind = "grunt" | "large";

export type PhaseName = "landing" | "intro" | "pack" | "large" | "flash" | "gameover";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  radius: number;
}

export function assertNever(value: never, label: string): never {
  throw new Error(`unexpected ${label}: ${String(value)}`);
}
