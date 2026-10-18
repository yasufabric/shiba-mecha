export const COMBO_WINDOW = 2.6;
export const SHOT_SCALE_STEP = 0.16;
export const SHOT_SCALE_CAP = 10;

export interface ComboState {
  count: number;
  max: number;
  timer: number;
}

export function createCombo(): ComboState {
  return { count: 0, max: 0, timer: 0 };
}

export function tickCombo(state: ComboState, dt: number): ComboState {
  if (state.count <= 0) return state;
  const timer = state.timer - dt;
  if (timer <= 0) return { count: 0, max: state.max, timer: 0 };
  return { ...state, timer };
}

export function registerKill(state: ComboState): ComboState {
  const count = state.count + 1;
  return { count, max: Math.max(state.max, count), timer: COMBO_WINDOW };
}

export function shotScale(combo: number): number {
  const steps = Math.max(0, Math.min(SHOT_SCALE_CAP, Math.floor(combo)));
  return 1 + steps * SHOT_SCALE_STEP;
}
