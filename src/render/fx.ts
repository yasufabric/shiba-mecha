import * as THREE from "three";
import { EFFECT_POOL } from "../game/budgets";

const SNOW_COUNT = 420;

const pointVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const pointFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = dot(centered, centered);
    if (dist > 0.25) discard;
    float falloff = smoothstep(0.25, 0.02, dist);
    gl_FragColor = vec4(vColor, falloff * vAlpha);
  }
`;

export class Effects {
  private readonly positions = new Float32Array(EFFECT_POOL * 3);
  private readonly colors = new Float32Array(EFFECT_POOL * 3);
  private readonly sizes = new Float32Array(EFFECT_POOL);
  private readonly alphas = new Float32Array(EFFECT_POOL);
  private readonly life = new Float32Array(EFFECT_POOL);
  private readonly maxLife = new Float32Array(EFFECT_POOL);
  private readonly velocity = new Float32Array(EFFECT_POOL * 3);
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  private cursor = 0;
  private readonly beams: THREE.Mesh[] = [];
  private readonly beamLife: number[] = [];
  private beamCursor = 0;
  private readonly flashes: THREE.Mesh[] = [];
  private readonly flashLife: number[] = [];
  private readonly flashMax: number[] = [];
  private flashCursor = 0;
  private readonly snowPositions = new Float32Array(SNOW_COUNT * 3);
  private readonly snowSizes = new Float32Array(SNOW_COUNT);
  private readonly snowAttr: THREE.BufferAttribute;
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 0, 1);
  private readonly pink = new THREE.Color(0xff4b96);
  private readonly cyan = new THREE.Color(0x7dfff8);
  private readonly white = new THREE.Color(0xfff4e4);

  constructor(parent: THREE.Object3D) {
    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(this.sizes, 1);
    this.alphaAttr = new THREE.BufferAttribute(this.alphas, 1);
    geometry.setAttribute("position", this.positionAttr);
    geometry.setAttribute("aColor", this.colorAttr);
    geometry.setAttribute("aSize", this.sizeAttr);
    geometry.setAttribute("aAlpha", this.alphaAttr);
    const points = new THREE.Points(geometry, pointMaterial(THREE.AdditiveBlending));
    points.frustumCulled = false;
    parent.add(points);

    const snowGeometry = new THREE.BufferGeometry();
    const snowColors = new Float32Array(SNOW_COUNT * 3);
    const snowAlpha = new Float32Array(SNOW_COUNT);
    for (let index = 0; index < SNOW_COUNT; index += 1) {
      this.snowPositions[index * 3] = (Math.random() - 0.5) * 16;
      this.snowPositions[index * 3 + 1] = Math.random() * 10;
      this.snowPositions[index * 3 + 2] = (Math.random() - 0.5) * 24;
      this.snowSizes[index] = 0.16 + Math.random() * 0.28;
      snowColors[index * 3] = 0.82;
      snowColors[index * 3 + 1] = 0.88;
      snowColors[index * 3 + 2] = 0.95;
      snowAlpha[index] = 0.45 + Math.random() * 0.5;
    }
    snowGeometry.setAttribute("position", new THREE.BufferAttribute(this.snowPositions, 3));
    snowGeometry.setAttribute("aColor", new THREE.BufferAttribute(snowColors, 3));
    snowGeometry.setAttribute("aSize", new THREE.BufferAttribute(this.snowSizes, 1));
    snowGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(snowAlpha, 1));
    this.snowAttr = snowGeometry.getAttribute("position") as THREE.BufferAttribute;
    const snow = new THREE.Points(snowGeometry, pointMaterial(THREE.NormalBlending));
    snow.frustumCulled = false;
    parent.add(snow);

    const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
    for (let index = 0; index < 12; index += 1) {
      const mesh = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
        color: 0xbffff8,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      mesh.visible = false;
      mesh.frustumCulled = false;
      parent.add(mesh);
      this.beams.push(mesh);
      this.beamLife.push(0);
    }

    const flashGeometry = new THREE.SphereGeometry(1, 10, 8);
    for (let index = 0; index < 8; index += 1) {
      const mesh = new THREE.Mesh(flashGeometry, new THREE.MeshBasicMaterial({
        color: 0xffd0ea,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      mesh.visible = false;
      parent.add(mesh);
      this.flashes.push(mesh);
      this.flashLife.push(0);
      this.flashMax.push(1);
    }
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, scale: number): void {
    const index = this.beamCursor;
    this.beamCursor = (this.beamCursor + 1) % this.beams.length;
    const mesh = this.beams[index];
    if (!mesh) return;
    this.direction.copy(to).sub(from);
    const length = Math.max(0.2, this.direction.length());
    this.direction.multiplyScalar(1 / length);
    const thickness = 0.08 * Math.max(1, scale);
    mesh.visible = true;
    mesh.scale.set(thickness, thickness, length);
    mesh.position.copy(from).addScaledVector(this.direction, length * 0.5);
    mesh.quaternion.setFromUnitVectors(this.up, this.direction);
    const material = mesh.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.color.set(scale > 1.7 ? 0xff8ec4 : 0xc8fff8);
      material.opacity = 0.95;
    }
    this.beamLife[index] = 0.12;
  }

  burst(x: number, y: number, z: number, count: number, rising: boolean): void {
    const color = Math.random() > 0.5 ? this.cyan : this.pink;
    this.spawn(x, y, z, color, count, rising ? 1.4 : 3.2, rising ? 0.45 : 0.28, rising ? 0.35 : 0.42);
  }

  explode(x: number, y: number, z: number, big: boolean): void {
    this.spawn(x, y, z, this.white, big ? 28 : 16, big ? 4.5 : 3.2, big ? 0.48 : 0.32, big ? 0.7 : 0.45);
    this.spawn(x, y, z, this.pink, big ? 18 : 8, 2.2, 0.4, 0.32);
    this.pop(x, y, z, big);
  }

  clear(): void {
    this.life.fill(0);
    this.alphas.fill(0);
    this.alphaAttr.needsUpdate = true;
    for (const mesh of this.beams) mesh.visible = false;
    for (const mesh of this.flashes) mesh.visible = false;
    this.beamLife.fill(0);
    this.flashLife.fill(0);
  }

  tick(dt: number, camera: THREE.Camera): void {
    for (let index = 0; index < EFFECT_POOL; index += 1) {
      if (this.life[index] <= 0) continue;
      this.life[index] -= dt;
      const base = index * 3;
      this.velocity[base + 1] -= dt * 1.6;
      this.positions[base] += this.velocity[base] * dt;
      this.positions[base + 1] += this.velocity[base + 1] * dt;
      this.positions[base + 2] += this.velocity[base + 2] * dt;
      const max = this.maxLife[index] || 1;
      this.alphas[index] = Math.max(0, this.life[index] / max);
    }
    this.positionAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;

    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    for (let index = 0; index < SNOW_COUNT; index += 1) {
      const base = index * 3;
      this.snowPositions[base + 1] -= dt * (1.7 + (index % 5) * 0.25);
      this.snowPositions[base] += Math.sin(this.snowPositions[base + 1] * 0.7 + index) * dt * 0.35;
      const dx = this.snowPositions[base] - cx;
      const dy = this.snowPositions[base + 1] - cy;
      const dz = this.snowPositions[base + 2] - cz;
      if (dy < -4 || Math.abs(dx) > 10 || Math.abs(dz) > 14) {
        this.snowPositions[base] = cx + (Math.random() - 0.5) * 16;
        this.snowPositions[base + 1] = cy + 4 + Math.random() * 6;
        this.snowPositions[base + 2] = cz + (Math.random() - 0.5) * 22;
      }
    }
    this.snowAttr.needsUpdate = true;

    for (let index = 0; index < this.beams.length; index += 1) {
      const mesh = this.beams[index];
      if (!mesh || this.beamLife[index] <= 0) continue;
      this.beamLife[index] -= dt;
      if (this.beamLife[index] <= 0) mesh.visible = false;
    }
    for (let index = 0; index < this.flashes.length; index += 1) {
      const mesh = this.flashes[index];
      if (!mesh || this.flashLife[index] <= 0) continue;
      this.flashLife[index] -= dt;
      const k = Math.max(0, this.flashLife[index] / (this.flashMax[index] || 1));
      mesh.scale.setScalar((1.15 - k) * (this.flashMax[index] > 0.2 ? 1.6 : 0.7));
      const material = mesh.material;
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = k;
      if (k <= 0) mesh.visible = false;
    }
  }

  private spawn(
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    count: number,
    speed: number,
    life: number,
    size: number,
  ): void {
    const amount = Math.max(0, Math.min(EFFECT_POOL, count));
    for (let n = 0; n < amount; n += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % EFFECT_POOL;
      const span = life * (0.65 + Math.random() * 0.5);
      this.life[index] = span;
      this.maxLife[index] = span;
      const base = index * 3;
      this.positions[base] = x;
      this.positions[base + 1] = y;
      this.positions[base + 2] = z;
      const theta = Math.random() * Math.PI * 2;
      const lift = Math.random();
      const velocity = speed * (0.35 + Math.random() * 0.75);
      this.velocity[base] = Math.cos(theta) * velocity;
      this.velocity[base + 1] = lift * velocity;
      this.velocity[base + 2] = Math.sin(theta) * velocity;
      this.colors[base] = color.r;
      this.colors[base + 1] = color.g;
      this.colors[base + 2] = color.b;
      this.sizes[index] = size * (0.65 + Math.random());
      this.alphas[index] = 1;
    }
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  private pop(x: number, y: number, z: number, big: boolean): void {
    const index = this.flashCursor;
    this.flashCursor = (this.flashCursor + 1) % this.flashes.length;
    const mesh = this.flashes[index];
    if (!mesh) return;
    mesh.visible = true;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(big ? 0.9 : 0.42);
    this.flashLife[index] = big ? 0.3 : 0.16;
    this.flashMax[index] = this.flashLife[index];
    const material = mesh.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.color.setHex(big ? 0xfff6d8 : 0xff8ab8);
      material.opacity = 0.9;
    }
  }
}

function pointMaterial(blending: THREE.Blending): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending,
    toneMapped: false,
  });
}
