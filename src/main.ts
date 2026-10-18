import "./style.css";
import * as THREE from "three";
import { Sfx } from "./audio";
import { enemyHover } from "./game/combat";
import { readBest, writeBest } from "./game/score";
import { createSession, retrySession, tickSession, type GameEvent } from "./game/session";
import { assertNever } from "./game/types";
import { mechAltitude } from "./game/wave";
import { Pointers } from "./input";
import { Foes } from "./render/foes";
import { Effects } from "./render/fx";
import { createMech } from "./render/mech";
import { createStage } from "./render/stage";
import { createView } from "./render/view";

const app = must("#app");
const canvas = must<HTMLCanvasElement>("#view");
const hud = must("#hud");
const scoreNode = must("#score");
const comboNode = must("#combo");
const cracks = must<SVGElement>("#cracks");
const flashNode = must("#flash");
const stick = must("#stick");
const stickKnob = must("#stick-knob");
const reticle = must("#reticle");
const end = must("#end");
const endScore = must("#end-score");
const endCombo = must("#end-combo");
const endBest = must("#end-best");
const touch = must("#touch");

const view = createView(canvas);
const stage = createStage();
const mech = createMech();
const foes = new Foes(view.scene);
const effects = new Effects(view.scene);
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.72, 18),
  new THREE.MeshBasicMaterial({ color: 0x05070e, transparent: true, opacity: 0.38, depthWrite: false }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.03;
view.scene.add(stage, mech.group, blob);

const sfx = new Sfx();
const pointers = new Pointers(touch);
pointers.attach();
touch.addEventListener("pointerdown", () => sfx.unlock(), { capture: true });

let session = createSession(safeBest());
let screens: ReturnType<Foes["project"]> = [];
let recoil = 0;
let shake = 0;
let flash = 0;
let leanX = 0;
let leanZ = 0;
let muzzle = 0;
let last = performance.now();
const shotFrom = new THREE.Vector3();
const shotTo = new THREE.Vector3();
const desired = new THREE.Vector3();
const look = new THREE.Vector3();

end.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  sfx.unlock();
  if (!session.over) return;
  session = retrySession(session);
  end.hidden = true;
  cracks.dataset.hits = "0";
  flash = 0;
  recoil = 0;
  shake = 0;
  effects.clear();
  pointers.clear();
});

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(frame);

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const width = app.clientWidth || window.innerWidth;
  const height = app.clientHeight || window.innerHeight;
  const pointer = pointers.frame(width, height);
  const combat = session.wave.phase === "pack" || session.wave.phase === "large";
  const stepped = tickSession(session, {
    moveX: combat ? pointer.stick.moveX : 0,
    moveZ: combat ? pointer.stick.moveZ : 0,
    aiming: combat && pointer.aim.active,
    reticleX: pointer.aim.reticleX,
    reticleY: pointer.aim.reticleY,
    screens,
  }, dt);
  session = stepped.session;
  for (const event of stepped.events) applyEvent(event);

  recoil = Math.max(0, recoil - dt * 5.5);
  shake = Math.max(0, shake - dt * 1.7);
  flash = Math.max(0, flash - dt / 0.32);
  const stickX = pointer.stick.active ? pointer.stick.moveX : 0;
  const stickZ = pointer.stick.active ? pointer.stick.moveZ : 0;
  leanX += (stickX - leanX) * Math.min(1, dt * 8);
  leanZ += (stickZ - leanZ) * Math.min(1, dt * 8);

  const time = now / 1000;
  const altitude = mechAltitude(session.wave.phase, session.wave.phaseTime);
  mech.group.position.x = session.playerX;
  mech.group.position.z = session.playerZ;
  mech.update(time, recoil, altitude, leanX, leanZ);
  blob.position.x = session.playerX;
  blob.position.z = session.playerZ;
  blob.scale.setScalar(altitude > 0.2 ? 0.45 : 1);
  foes.sync(session.wave.enemies, time, session.playerX, session.playerZ);
  effects.tick(dt, view.camera);
  followCamera(dt, altitude);
  view.camera.updateMatrixWorld(true);
  view.scene.updateMatrixWorld(true);
  screens = foes.project(view.camera, width, height);
  paintHud(pointer.stick, pointer.aim, combat);
  view.composer.render();
  requestAnimationFrame(frame);
}

function applyEvent(event: GameEvent): void {
  switch (event.type) {
    case "shot": {
      recoil = Math.min(1, recoil + 0.62);
      const muzzlePoint = muzzle % 2 === 0 ? mech.muzzleL : mech.muzzleR;
      muzzle += 1;
      muzzlePoint.getWorldPosition(shotFrom);
      shotTo.set(event.x, enemyHover(event.kind), event.z);
      effects.beam(shotFrom, shotTo, event.scale);
      effects.burst(event.x, enemyHover(event.kind), event.z, 3 + Math.round(event.scale * 2), false);
      foes.flash(event.enemyId);
      sfx.shot(event.scale);
      break;
    }
    case "killed":
    case "crash": {
      const y = enemyHover(event.kind);
      const big = event.kind === "large";
      effects.explode(event.x, y, event.z, big);
      shake = Math.max(shake, big ? 0.62 : 0.24);
      sfx.explode(big);
      break;
    }
    case "hit":
      sfx.hurt();
      shake = Math.max(shake, 0.55);
      cracks.dataset.hits = String(event.hits);
      break;
    case "landed":
      sfx.land();
      effects.burst(session.playerX, 0.25, session.playerZ, 18, true);
      break;
    case "flash":
      flash = 0.92;
      break;
    case "gameover":
      safeWrite(event.best);
      endScore.textContent = String(event.score);
      endCombo.textContent = String(event.maxCombo);
      endBest.textContent = String(event.best);
      end.hidden = false;
      pointers.clear();
      break;
    default:
      assertNever(event, "game event");
  }
}

function followCamera(dt: number, altitude: number): void {
  desired.set(session.playerX + 0.55, 2.35 + altitude * 0.62, session.playerZ - 3.9);
  look.set(session.playerX, 0.9 + altitude * 0.78, session.playerZ + 5.8);
  const blend = 1 - Math.pow(0.001, Math.max(dt, 0.001));
  view.camera.position.lerp(desired, blend);
  if (shake > 0) {
    view.camera.position.x += (Math.random() - 0.5) * shake * 0.22;
    view.camera.position.y += (Math.random() - 0.5) * shake * 0.12;
  }
  view.camera.lookAt(look);
}

function paintHud(
  stickFrame: ReturnType<Pointers["frame"]>["stick"],
  aimFrame: ReturnType<Pointers["frame"]>["aim"],
  combat: boolean,
): void {
  scoreNode.textContent = String(session.score);
  comboNode.textContent = session.combo.count > 0 ? `×${session.combo.count}` : "";
  cracks.dataset.hits = String(session.hull.hits);
  flashNode.style.opacity = flash.toFixed(3);
  hud.hidden = session.over;
  const showStick = stickFrame.active && !session.over;
  stick.hidden = !showStick;
  if (showStick) {
    stick.style.left = `${stickFrame.originX}px`;
    stick.style.top = `${stickFrame.originY}px`;
    stickKnob.style.left = `${60 + (stickFrame.knobX - stickFrame.originX)}px`;
    stickKnob.style.top = `${60 + (stickFrame.knobY - stickFrame.originY)}px`;
  }
  const showAim = aimFrame.active && combat && !session.over;
  reticle.hidden = !showAim;
  if (showAim) {
    reticle.style.left = `${aimFrame.reticleX}px`;
    reticle.style.top = `${aimFrame.reticleY}px`;
    const thickness = 64 + Math.min(28, session.combo.count * 3);
    reticle.style.width = `${thickness}px`;
    reticle.style.height = `${thickness}px`;
    reticle.style.marginLeft = `${-thickness / 2}px`;
    reticle.style.marginTop = `${-thickness / 2}px`;
  }
}

function resize(): void {
  view.resize(app.clientWidth || window.innerWidth, app.clientHeight || window.innerHeight);
}

function safeBest(): number {
  try {
    return readBest(localStorage);
  } catch {
    return 0;
  }
}

function safeWrite(score: number): void {
  try {
    writeBest(localStorage, score);
  } catch {
    // Private mode can reject storage. The run still ends on screen.
  }
}

function must<T extends Element = HTMLElement>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node as T;
}
