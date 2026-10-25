import * as THREE from 'three';
import { LIGHTS, PLAYER, FOG, PALETTE } from './config.js';
import { U } from './world/shared.js';
import { Collision } from './player/collision.js';
import { Player } from './player/controller.js';
import { Flashlight } from './player/flashlight.js';
import { buildWorld } from './world/world.js';
import { parseShotParams } from './debug/screenshot.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHTS.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.fog);
scene.fog = new THREE.FogExp2(PALETTE.fog, FOG.density);

const camera = new THREE.PerspectiveCamera(PLAYER.fov, innerWidth / innerHeight, 0.05, 500);
camera.position.set(...PLAYER.start);

scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1));

const collision = new Collision();
const world = buildWorld(scene, collision);
const player = new Player(camera, renderer.domElement, collision);
const flashlight = new Flashlight(scene, camera);
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));
addEventListener('keydown', (e) => { if (e.code === 'KeyF') flashlight.toggle(); });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const shot = parseShotParams();
if (shot) {
  overlay.classList.add('hidden');
  if (shot.inspect) scene.add(new THREE.AmbientLight(0xffffff, 2.5));
  if (shot.pos) player.setView(shot.pos, shot.yaw, shot.pitch);
  flashlight.setOn(shot.flash);
  flashlight.snap();
  let n = 0;
  renderer.setAnimationLoop(() => {
    U.time.value = shot.time;
    world.update(shot.time, 0, camera);
    renderer.render(scene, camera);
    if (++n === shot.frames) window.__READY = true;
  });
}
const timer = new THREE.Timer();
if (!shot) renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  U.time.value += dt;
  player.update(dt);
  flashlight.update(dt);
  world.update(U.time.value, dt, camera);
  renderer.render(scene, camera);
});
