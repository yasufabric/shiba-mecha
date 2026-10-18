import { clamp } from "./game/math";
import { assertNever } from "./game/types";

export const STICK_RADIUS = 58;
export const STICK_DEADZONE = 12;
export const AIM_SENSITIVITY = 1.35;

export type PointerKind = "mouse" | "touch" | "pen";

export interface PointerSample {
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface StickFrame {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  moveX: number;
  moveZ: number;
}

export interface AimFrame {
  active: boolean;
  reticleX: number;
  reticleY: number;
}

export function deriveStick(pointer: PointerSample | null): StickFrame {
  if (!pointer) {
    return { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0, moveX: 0, moveZ: 0 };
  }
  const dx = pointer.x - pointer.originX;
  const dy = pointer.y - pointer.originY;
  const length = Math.hypot(dx, dy);
  if (length < STICK_DEADZONE) {
    return {
      active: true,
      originX: pointer.originX,
      originY: pointer.originY,
      knobX: pointer.originX,
      knobY: pointer.originY,
      moveX: 0,
      moveZ: 0,
    };
  }
  const clamped = Math.min(length, STICK_RADIUS);
  const nx = dx / length;
  const ny = dy / length;
  const power = clamped / STICK_RADIUS;
  return {
    active: true,
    originX: pointer.originX,
    originY: pointer.originY,
    knobX: pointer.originX + nx * clamped,
    knobY: pointer.originY + ny * clamped,
    moveX: nx * power,
    moveZ: -ny * power,
  };
}

export function deriveAim(pointer: PointerSample | null, width: number, height: number): AimFrame {
  const centerX = width * 0.5;
  const centerY = height * 0.46;
  if (!pointer) return { active: false, reticleX: centerX, reticleY: centerY };
  const dx = (pointer.x - pointer.originX) * AIM_SENSITIVITY;
  const dy = (pointer.y - pointer.originY) * AIM_SENSITIVITY;
  return {
    active: true,
    reticleX: clamp(centerX + dx, 28, Math.max(28, width - 28)),
    reticleY: clamp(centerY + dy, 28, Math.max(28, height - 28)),
  };
}

export function pointerSide(x: number, width: number): "left" | "right" {
  return x < width * 0.5 ? "left" : "right";
}

export function placeAim(
  pointer: (PointerSample & { kind: PointerKind }) | null,
  width: number,
  height: number,
): AimFrame {
  const centerX = width * 0.5;
  const centerY = height * 0.46;
  if (!pointer) return { active: false, reticleX: centerX, reticleY: centerY };
  switch (pointer.kind) {
    case "touch":
      return deriveAim(pointer, width, height);
    case "mouse":
    case "pen":
      return {
        active: true,
        reticleX: clamp(pointer.x, 28, Math.max(28, width - 28)),
        reticleY: clamp(pointer.y, 28, Math.max(28, height - 28)),
      };
    default:
      return assertNever(pointer.kind, "pointer kind");
  }
}

function kindOf(value: string): PointerKind {
  switch (value) {
    case "touch":
      return "touch";
    case "pen":
      return "pen";
    case "mouse":
      return "mouse";
    default:
      return "mouse";
  }
}

interface Track extends PointerSample {
  id: number;
  side: "left" | "right";
  kind: PointerKind;
}

export class Pointers {
  private readonly tracks = new Map<number, Track>();
  private readonly onDown: (event: PointerEvent) => void;
  private readonly onMove: (event: PointerEvent) => void;
  private readonly onUp: (event: PointerEvent) => void;

  constructor(private readonly element: HTMLElement) {
    this.onDown = (event) => {
      event.preventDefault();
      const rect = this.element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const side = pointerSide(x, rect.width);
      if (this.bySide(side)) return;
      this.tracks.set(event.pointerId, {
        id: event.pointerId,
        side,
        kind: kindOf(event.pointerType),
        originX: x,
        originY: y,
        x,
        y,
      });
      this.element.setPointerCapture(event.pointerId);
    };
    this.onMove = (event) => {
      const track = this.tracks.get(event.pointerId);
      if (!track) return;
      const rect = this.element.getBoundingClientRect();
      track.x = event.clientX - rect.left;
      track.y = event.clientY - rect.top;
    };
    this.onUp = (event) => {
      this.tracks.delete(event.pointerId);
    };
  }

  attach(): void {
    this.element.addEventListener("pointerdown", this.onDown, { passive: false });
    this.element.addEventListener("pointermove", this.onMove);
    this.element.addEventListener("pointerup", this.onUp);
    this.element.addEventListener("pointercancel", this.onUp);
  }

  detach(): void {
    this.element.removeEventListener("pointerdown", this.onDown);
    this.element.removeEventListener("pointermove", this.onMove);
    this.element.removeEventListener("pointerup", this.onUp);
    this.element.removeEventListener("pointercancel", this.onUp);
    this.tracks.clear();
  }

  clear(): void {
    this.tracks.clear();
  }

  frame(width: number, height: number): { stick: StickFrame; aim: AimFrame } {
    return {
      stick: deriveStick(this.bySide("left")),
      aim: placeAim(this.bySide("right"), width, height),
    };
  }

  private bySide(side: "left" | "right"): Track | null {
    for (const track of this.tracks.values()) {
      if (track.side === side) return track;
    }
    return null;
  }
}
