import * as THREE from "three";
import { MAX_ENEMIES } from "../game/budgets";
import { enemyHover } from "../game/combat";
import type { ScreenPoint } from "../game/combat";
import type { Enemy, EnemyKind } from "../game/types";
import { PALETTE } from "./palette";

interface Slot {
  id: number | null;
  kind: EnemyKind;
  root: THREE.Group;
  grunt: THREE.Group;
  large: THREE.Group;
  gruntEye: THREE.MeshStandardMaterial;
  largeCore: THREE.MeshStandardMaterial;
  flash: number;
}

export class Foes {
  private readonly slots: Slot[] = [];
  private readonly projected = new THREE.Vector3();

  constructor(parent: THREE.Object3D) {
    for (let index = 0; index < MAX_ENEMIES; index += 1) {
      const root = new THREE.Group();
      root.visible = false;
      const gruntEye = glow(PALETTE.pink, 3.1);
      const largeCore = glow(PALETTE.cyan, 3.4);
      const grunt = new THREE.Group();
      const large = new THREE.Group();
      box(grunt, 0.64, 0.36, 0.7, 0, 0, 0, standard(PALETTE.enemy, 0.55));
      box(grunt, 0.38, 0.08, 0.08, 0, 0.02, 0.38, gruntEye);
      box(grunt, 0.12, 0.2, 0.28, -0.34, 0.08, -0.05, standard(PALETTE.metal, 0.4));
      box(grunt, 0.12, 0.2, 0.28, 0.34, 0.08, -0.05, standard(PALETTE.metal, 0.4));
      box(large, 1.45, 1.02, 1.15, 0, 0, 0, standard(PALETTE.enemy, 0.48));
      box(large, 0.46, 0.46, 0.2, 0, 0.05, 0.58, largeCore);
      box(large, 0.34, 0.5, 0.7, -0.84, 0.1, 0, standard(PALETTE.metal, 0.35));
      box(large, 0.34, 0.5, 0.7, 0.84, 0.1, 0, standard(PALETTE.metal, 0.35));
      grunt.scale.setScalar(1.28);
      large.scale.setScalar(1.15);
      large.visible = false;
      root.add(grunt, large);
      parent.add(root);
      this.slots.push({
        id: null,
        kind: "grunt",
        root,
        grunt,
        large,
        gruntEye,
        largeCore,
        flash: 0,
      });
    }
  }

  sync(enemies: readonly Enemy[], time: number, playerX: number, playerZ: number): void {
    const used = new Set<number>();
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (used.size >= MAX_ENEMIES) break;
      let slot = this.slots.find((item) => item.id === enemy.id);
      if (!slot) slot = this.slots.find((item) => item.id === null);
      if (!slot) break;
      slot.id = enemy.id;
      slot.kind = enemy.kind;
      used.add(enemy.id);
      slot.root.visible = true;
      slot.grunt.visible = enemy.kind === "grunt";
      slot.large.visible = enemy.kind === "large";
      const hover = enemyHover(enemy.kind) + Math.sin(time * 3 + enemy.id) * 0.05;
      slot.root.position.set(enemy.x, hover, enemy.z);
      slot.root.lookAt(playerX, hover, playerZ);
      this.paint(slot, time);
    }
    for (const slot of this.slots) {
      if (slot.id !== null && !used.has(slot.id)) {
        slot.id = null;
        slot.root.visible = false;
        slot.flash = 0;
      }
    }
  }

  flash(id: number): void {
    const slot = this.slots.find((item) => item.id === id);
    if (slot) slot.flash = 1;
  }

  project(camera: THREE.Camera, width: number, height: number): ScreenPoint[] {
    const points: ScreenPoint[] = [];
    for (const slot of this.slots) {
      if (slot.id === null || !slot.root.visible) continue;
      slot.root.updateWorldMatrix(true, false);
      this.projected.setFromMatrixPosition(slot.root.matrixWorld);
      this.projected.project(camera);
      if (this.projected.z > 1) continue;
      points.push({
        id: slot.id,
        x: (this.projected.x * 0.5 + 0.5) * width,
        y: (-this.projected.y * 0.5 + 0.5) * height,
        alive: true,
      });
    }
    return points;
  }

  private paint(slot: Slot, time: number): void {
    const flash = slot.flash;
    slot.flash = Math.max(0, flash - 0.08);
    const hot = flash > 0;
    slot.gruntEye.emissive.setHex(hot ? 0xffffff : PALETTE.pink);
    slot.largeCore.emissive.setHex(hot ? 0xffffff : PALETTE.cyan);
    slot.gruntEye.emissiveIntensity = hot ? 6 : 3.1 + Math.sin(time * 8) * 0.3;
    slot.largeCore.emissiveIntensity = hot ? 6 : 3.4;
  }
}

function standard(color: number, roughness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.12 });
}

function glow(color: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x10060c,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0,
  });
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
}
