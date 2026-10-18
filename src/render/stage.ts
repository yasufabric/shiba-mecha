import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { PALETTE } from "./palette";

export function createStage(): THREE.Group {
  const root = new THREE.Group();
  const buildings: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  const snow: THREE.BufferGeometry[] = [];
  const ground: THREE.BufferGeometry[] = [];
  const pinks: THREE.BufferGeometry[] = [];
  const cyans: THREE.BufferGeometry[] = [];
  const poles: THREE.BufferGeometry[] = [];
  const rand = mulberry32(11);

  addBox(ground, 64, 0.4, 120, 0, -0.2, 30);
  addBox(snow, 7.4, 0.08, 100, 0, 0.04, 28);
  addBox(roofs, 1.15, 0.22, 96, -4.25, 0.14, 28);
  addBox(roofs, 1.15, 0.22, 96, 4.25, 0.14, 28);
  addBox(pinks, 0.08, 0.04, 92, -3.45, 0.1, 28);
  addBox(pinks, 0.08, 0.04, 92, 3.45, 0.1, 28);
  for (let z = -6; z <= 72; z += 3.1) addBox(cyans, 0.1, 0.03, 1.05, 0, 0.1, z);

  for (let z = -8; z <= 66; z += 6.3) {
    for (const side of [-1, 1]) {
      const width = 2.7 + rand() * 2.1;
      const depth = 3.1 + rand() * 2.2;
      const height = 1.7 + rand() * 4.1;
      const x = side * (5.05 + width * 0.5);
      addBox(buildings, width, height, depth, x, height * 0.5, z);
      addBox(roofs, width * 0.92, 0.16, depth * 0.9, x, height + 0.08, z);
      const face = x - side * (width * 0.5 + 0.07);
      const signHeight = 0.42 + rand() * 0.85;
      const signWidth = 0.85 + rand() * 1.35;
      const signs = rand() > 0.48 ? pinks : cyans;
      addBox(signs, 0.1, signHeight, signWidth, face, 0.85 + rand() * Math.max(0.3, height - 1.5), z);
      const windows = rand() > 0.5 ? cyans : pinks;
      addBox(windows, 0.06, 0.16, 0.55, face, height * 0.62, z + depth * 0.18);
    }
  }

  for (let z = -2; z <= 56; z += 9) {
    for (const side of [-1, 1]) {
      const x = side * 3.55;
      addBox(poles, 0.08, 2.5, 0.08, x, 1.25, z);
      addBox(side > 0 ? cyans : pinks, 0.22, 0.14, 0.28, x, 2.55, z);
    }
  }

  arch(poles, pinks, 6);
  arch(poles, cyans, 28);

  const horizon = horizonSheet();
  horizon.position.set(0, 14, 62);
  root.add(horizon);

  root.add(merge(ground, lit(PALETTE.ground, 0.95)));
  root.add(merge(snow, lit(PALETTE.snow, 0.78)));
  root.add(merge(buildings, lit(PALETTE.building, 0.9)));
  root.add(merge(roofs, lit(PALETTE.roof, 0.95)));
  root.add(merge(poles, lit(PALETTE.metal, 0.55)));
  root.add(merge(pinks, glow(PALETTE.pink)));
  root.add(merge(cyans, glow(PALETTE.cyan)));
  return root;
}

function arch(poles: THREE.BufferGeometry[], glowParts: THREE.BufferGeometry[], z: number): void {
  addBox(poles, 0.1, 2.7, 0.1, -3.3, 1.35, z);
  addBox(poles, 0.1, 2.7, 0.1, 3.3, 1.35, z);
  addBox(glowParts, 6.8, 0.12, 0.14, 0, 2.75, z);
}

function horizonSheet(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(90, 36, 1, 6);
  const position = geometry.attributes.position;
  if (!position) throw new Error("horizon is missing positions");
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(0x070914);
  const mid = new THREE.Color(0x1a2040);
  const glowColor = new THREE.Color(0x3a2450);
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const mix = THREE.MathUtils.clamp((y + 18) / 36, 0, 1);
    const color = top.clone().lerp(mid, 1 - mix);
    if (mix < 0.35) color.lerp(glowColor, 0.45);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false }),
  );
  return mesh;
}

function lit(color: number, roughness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function glow(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x12060c,
    emissive: color,
    emissiveIntensity: 3.2,
    roughness: 1,
    metalness: 0,
  });
}

function addBox(
  list: THREE.BufferGeometry[],
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): void {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  list.push(geometry);
}

function merge(parts: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("city geometry failed to merge");
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
