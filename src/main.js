import * as THREE from 'three';
import { LIGHTS, PLAYER, FOG, PALETTE, QUALITY } from './config.js';
import { U } from './world/shared.js';
import { Collision } from './player/collision.js';
import { Player } from './player/controller.js';
import { Flashlight } from './player/flashlight.js';
import { buildWorld } from './world/world.js';
import { buildFx } from './world/fx.js';
import { Post } from './post/composer.js';
import { AudioSystem } from './audio/audio.js';
import { parseShotParams } from './debug/screenshot.js';

const shot = parseShotParams();

// 렌더러
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

// 월드
const collision = new Collision();
await new Promise((r) => setTimeout(r, 30)); // 로딩 문구가 먼저 그려지도록
const world = buildWorld(scene, collision, renderer);
document.getElementById('loading').textContent = '';
const player = new Player(camera, renderer.domElement, collision);
const flashlight = new Flashlight(scene, camera);
const fx = buildFx(scene, world.ctx, flashlight);
const post = new Post(renderer, scene, camera);
const lights = world.ctx.lights;
const audio = new AudioSystem(camera, scene);
audio.addLedBuzz(world.ctx.entrance.signPos);
audio.addLedBuzz(world.ctx.sur.sign.group.position);
for (const l of lights.yardLamps) audio.addLampBuzz(l);
player.onStep = (surface, running) => audio.step(surface, running);

const state = { quality: 'high', inspect: false, fog: FOG.density };

function applyQuality(name) {
  state.quality = name;
  const q = QUALITY[name];
  const pr = Math.min(devicePixelRatio, q.pixelRatio);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  post.setQuality(q);
  post.setSize(innerWidth, innerHeight);
  lights.setShadows(q.shadows);
  flashlight.spot.castShadow = q.shadows;
  fx.setLevel(q.fx);
  fx.setPixelRatio(pr);
}

function setFog(d) {
  state.fog = Math.min(FOG.max, Math.max(FOG.min, d));
  scene.fog.density = state.fog;
  fx.setFogDensity(state.fog);
}

const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.style.opacity = 0), 1400);
}
const onOff = (v) => (v ? '켜짐' : '꺼짐');

// 조작 키
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  audio.start();
  player.controls.lock();
});
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyF': toast(`손전등 ${onOff(flashlight.toggle())}`); break;
    case 'KeyB': toast(`블룸 ${onOff(post.toggle('bloom'))}`); break;
    case 'KeyG': toast(`그레인 ${onOff(post.toggle('grain'))}`); break;
    case 'KeyV': toast(`비네팅 ${onOff(post.toggle('vignette'))}`); break;
    case 'BracketLeft': setFog(state.fog - FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); break;
    case 'BracketRight': setFog(state.fog + FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); break;
    case 'KeyL': state.inspect = !state.inspect; lights.setInspect(state.inspect); toast(`점검 모드 ${onOff(state.inspect)}`); break;
    case 'Digit1': applyQuality('low'); toast('품질 Low'); break;
    case 'Digit2': applyQuality('mid'); toast('품질 Mid'); break;
    case 'Digit3': applyQuality('high'); toast('품질 High'); break;
    case 'KeyM': toast(audio.toggleMute() ? '음소거' : '소리 켜짐'); break;
    case 'KeyH': toast(`헤드밥 ${Math.round(player.bob.cycleLevel() * 100)}%`); break;
    default:
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

applyQuality(shot ? shot.quality : 'high');
setFog(FOG.density);

function step(t, dt) {
  U.time.value = t;
  if (dt > 0) player.update(dt);
  flashlight.update(dt);
  world.update(t, dt, camera);
  fx.update(camera);
  audio.update();
  post.render(t);
}

if (shot) {
  // ?shot=1 : 시간 고정, 포인터락 없음, HUD 숨김, 안정된 프레임 후 __READY
  overlay.classList.add('hidden');
  lights.setInspect(shot.inspect);
  if (shot.pos) player.setView(shot.pos, shot.yaw, shot.pitch);
  flashlight.setOn(shot.flash);
  flashlight.snap();
  let n = 0;
  renderer.setAnimationLoop(() => {
    step(shot.time, 0);
    if (++n === shot.frames) window.__READY = true;
  });
} else {
  const timer = new THREE.Timer();
  let t = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    t += dt;
    step(t, dt);
  });
}
