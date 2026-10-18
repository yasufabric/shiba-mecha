import * as THREE from "three";
import { PALETTE } from "./palette";

export interface MechRig {
  group: THREE.Group;
  muzzleL: THREE.Object3D;
  muzzleR: THREE.Object3D;
  update(time: number, recoil: number, altitude: number, leanX: number, leanZ: number): void;
}

export function createMech(): MechRig {
  const group = new THREE.Group();
  const brown = standard(PALETTE.brown, 0.62);
  const brownDark = standard(PALETTE.brownDark, 0.7);
  const cream = standard(PALETTE.cream, 0.48);
  const creamDeep = standard(PALETTE.creamDeep, 0.55);
  const metal = standard(PALETTE.metal, 0.38);
  const nose = standard(PALETTE.nose, 0.5);
  const eye = glow(PALETTE.cyan, 3.4);
  const accent = glow(PALETTE.pink, 2.4);

  part(group, 0.22, 0.36, 0.24, -0.34, 0.22, 0.18, brown);
  part(group, 0.22, 0.36, 0.24, 0.34, 0.22, 0.18, brown);
  part(group, 0.22, 0.34, 0.24, -0.32, 0.2, -0.22, brownDark);
  part(group, 0.22, 0.34, 0.24, 0.32, 0.2, -0.22, brownDark);
  part(group, 0.28, 0.1, 0.34, -0.34, 0.06, 0.22, cream);
  part(group, 0.28, 0.1, 0.34, 0.34, 0.06, 0.22, cream);
  part(group, 0.26, 0.1, 0.3, -0.32, 0.05, -0.24, creamDeep);
  part(group, 0.26, 0.1, 0.3, 0.32, 0.05, -0.24, creamDeep);

  part(group, 0.96, 0.58, 0.78, 0, 0.74, 0.02, brown);
  part(group, 0.72, 0.36, 0.2, 0, 0.66, 0.28, cream);
  part(group, 0.46, 0.42, 0.1, 0, 0.86, -0.38, cream);
  part(group, 0.16, 0.46, 0.08, 0, 0.92, -0.46, accent);

  part(group, 0.74, 0.5, 0.58, 0, 1.28, 0.08, brown);
  part(group, 0.52, 0.32, 0.1, 0, 1.26, -0.24, cream);
  part(group, 0.42, 0.26, 0.32, 0, 1.18, 0.36, cream);
  part(group, 0.12, 0.1, 0.1, 0, 1.14, 0.54, nose);
  part(group, 0.1, 0.1, 0.06, -0.14, 1.32, 0.5, eye);
  part(group, 0.1, 0.1, 0.06, 0.14, 1.32, 0.5, eye);

  const earL = pivot(-0.24, 1.56, -0.02);
  const earR = pivot(0.24, 1.56, -0.02);
  part(earL, 0.16, 0.34, 0.12, 0, 0.16, 0, brown);
  part(earR, 0.16, 0.34, 0.12, 0, 0.16, 0, brown);
  part(earL, 0.1, 0.16, 0.06, 0, 0.18, 0.05, creamDeep);
  part(earR, 0.1, 0.16, 0.06, 0, 0.18, 0.05, creamDeep);
  group.add(earL, earR);

  const tail = pivot(0, 0.7, -0.42);
  part(tail, 0.16, 0.16, 0.28, 0, 0.02, -0.16, brown);
  part(tail, 0.14, 0.14, 0.22, 0, 0.1, -0.36, brownDark);
  part(tail, 0.18, 0.18, 0.18, 0, 0.18, -0.54, cream);
  group.add(tail);

  const cannonL = part(group, 0.16, 0.16, 0.64, -0.58, 0.78, 0.34, metal);
  const cannonR = part(group, 0.16, 0.16, 0.64, 0.58, 0.78, 0.34, metal);
  const muzzleL = marker(cannonL, 0.36);
  const muzzleR = marker(cannonR, 0.36);
  part(cannonL, 0.2, 0.2, 0.08, 0, 0, 0.36, glow(PALETTE.cyan, 3));
  part(cannonR, 0.2, 0.2, 0.08, 0, 0, 0.36, glow(PALETTE.cyan, 3));
  const cannonLz = cannonL.position.z;
  const cannonRz = cannonR.position.z;

  let landedAt = -10;
  let previousAltitude = 6;

  return {
    group,
    muzzleL,
    muzzleR,
    update(time, recoil, altitude, leanX, leanZ) {
      if (previousAltitude > 0.35 && altitude < 0.05) landedAt = time;
      previousAltitude = altitude;
      const sinceLand = time - landedAt;
      const squash = sinceLand >= 0 && sinceLand < 0.16 ? 1 - Math.sin((sinceLand / 0.16) * Math.PI) * 0.14 : 1;
      const bob = altitude > 0.2 ? 0 : Math.sin(time * 6.2) * 0.025;
      group.position.y = altitude + bob;
      group.scale.set(1 + (1 - squash) * 0.35, squash, 1 + (1 - squash) * 0.35);
      group.rotation.z = -leanX * 0.12;
      group.rotation.x = leanZ * 0.08 - recoil * 0.05;
      earL.rotation.z = 0.18 + Math.sin(time * 3.5) * 0.24;
      earR.rotation.z = -0.18 - Math.sin(time * 3.5) * 0.24;
      earL.rotation.x = Math.sin(time * 2.2) * 0.14;
      earR.rotation.x = Math.sin(time * 2.2 + 0.5) * 0.14;
      tail.rotation.y = Math.sin(time * 4.6) * 0.55;
      tail.rotation.x = 0.42 + Math.sin(time * 3.2) * 0.16;
      const kick = recoil * 0.18;
      cannonL.position.z = cannonLz - kick;
      cannonR.position.z = cannonRz - kick;
    },
  };
}

function standard(color: number, roughness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 });
}

function glow(color: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x041016,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  });
}

function part(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function pivot(x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  return group;
}

function marker(parent: THREE.Object3D, z: number): THREE.Object3D {
  const point = new THREE.Object3D();
  point.position.set(0, 0, z);
  parent.add(point);
  return point;
}
