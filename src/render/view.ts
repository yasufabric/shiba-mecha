import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import * as THREE from "three";
import { BLOOM_RESOLUTION, MAX_LIGHTS, MAX_PIXEL_RATIO } from "../game/budgets";
import { PALETTE } from "./palette";

export interface View {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  resize(width: number, height: number): void;
}

export function createView(canvas: HTMLCanvasElement): View {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(PALETTE.night, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.night);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.032);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 90);
  const sky = new THREE.HemisphereLight(0xa9bddc, 0x1a1024, 0.78);
  const moon = new THREE.DirectionalLight(0xe7f0ff, 1.2);
  moon.position.set(-5, 11, -4);
  const lights: THREE.Light[] = [sky, moon];
  if (lights.length > MAX_LIGHTS) throw new Error(`light budget exceeded: ${lights.length}`);
  scene.add(sky, moon);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(BLOOM_RESOLUTION, BLOOM_RESOLUTION), 0.5, 0.58, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    scene,
    camera,
    composer,
    resize(width: number, height: number) {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      bloom.setSize(BLOOM_RESOLUTION * 2, BLOOM_RESOLUTION * 2);
    },
  };
}
