export const MAX_HITS = 3;
export const IFRAMES = 1.15;

export interface Hull {
  hits: number;
  iframes: number;
}

export interface HitResult {
  hull: Hull;
  cracked: boolean;
  over: boolean;
}

export function createHull(): Hull {
  return { hits: 0, iframes: 0 };
}

export function tickHull(hull: Hull, dt: number): Hull {
  if (hull.iframes <= 0) return hull;
  return { ...hull, iframes: Math.max(0, hull.iframes - dt) };
}

export function takeHit(hull: Hull): HitResult {
  if (hull.hits >= MAX_HITS || hull.iframes > 0) {
    return { hull, cracked: false, over: hull.hits >= MAX_HITS };
  }
  const hits = hull.hits + 1;
  return {
    hull: { hits, iframes: IFRAMES },
    cracked: true,
    over: hits >= MAX_HITS,
  };
}
