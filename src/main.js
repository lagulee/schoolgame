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
import { Director } from './events/director.js';
import { parseShotParams, requestScreenshot, captureIfRequested } from './debug/screenshot.js';
import { Hud } from './debug/hud.js';
import { isTouchDevice, setupTouch, enterImmersive } from './player/touch.js';

// 시작 화면 버전 표시 (배포가 반영됐는지 확인용). 월드 생성 전에 먼저 보이도록 맨 앞에 둔다
{
  const ver = document.getElementById('version');
  ver.querySelector('.ver-main').textContent = __APP_VERSION__.label;
  ver.querySelector('.ver-sub').textContent = __APP_VERSION__.build;
  ver.title = `빌드 ${__APP_VERSION__.time}`;
}

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
renderer.info.autoReset = false; // 후처리 패스까지 합산해 HUD 에 표시
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
const fx = buildFx(scene, world.ctx, flashlight, collision);
const post = new Post(renderer, scene, camera);
const lights = world.ctx.lights;
const audio = new AudioSystem(camera, scene);
audio.addLedBuzz(world.ctx.entrance.signPos);
audio.addLedBuzz(world.ctx.sur.sign.group.position);
for (const l of lights.yardLamps) audio.addLampBuzz(l);
player.onStep = (surface, running) => audio.step(surface, running);
const director = new Director({
  scene, camera, lights, audio,
  signs: [world.ctx.entrance.sign, world.ctx.sur.sign],
  litInfo: world.ctx.bld.litInfo,
});

const hud = new Hud(renderer);
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

// 기능 (키보드와 터치 메뉴가 같이 쓴다)
const act = {
  flash: () => toast(`손전등 ${onOff(flashlight.toggle())}`),
  bloom: () => toast(`블룸 ${onOff(post.toggle('bloom'))}`),
  grain: () => toast(`그레인 ${onOff(post.toggle('grain'))}`),
  vignette: () => toast(`비네팅 ${onOff(post.toggle('vignette'))}`),
  fogLess: () => { setFog(state.fog - FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  fogMore: () => { setFog(state.fog + FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  inspect: () => { state.inspect = !state.inspect; lights.setInspect(state.inspect); toast(`점검 모드 ${onOff(state.inspect)}`); },
  quality: (name) => { applyQuality(name); toast(`품질 ${name[0].toUpperCase()}${name.slice(1)}`); },
  event: () => { director.force(); toast(`이벤트: ${director.status}`); },
  mute: () => toast(audio.toggleMute() ? '음소거' : '소리 켜짐'),
  hud: () => hud.toggle(),
  shot: () => { requestScreenshot(); toast('스크린샷 저장'); },
  bob: () => toast(`헤드밥 ${Math.round(player.bob.cycleLevel() * 100)}%`),
};
const KEYS = {
  KeyF: act.flash, KeyB: act.bloom, KeyG: act.grain, KeyV: act.vignette, BracketLeft: act.fogLess, BracketRight: act.fogMore,
  KeyL: act.inspect, Digit1: () => act.quality('low'), Digit2: () => act.quality('mid'), Digit3: () => act.quality('high'),
  KeyE: act.event, KeyM: act.mute, Backquote: act.hud, KeyP: act.shot, KeyH: act.bob,
};
addEventListener('keydown', (e) => {
  if (!e.repeat) KEYS[e.code]?.();
});

// 시작 화면: 터치 기기는 탭으로 시작(포인터락 없음), 그 외에는 클릭 후 포인터락
const overlay = document.getElementById('overlay');
const touchMode = isTouchDevice();
if (touchMode) {
  overlay.querySelector('.start').textContent = '화면을 터치하여 시작';
  const nextQuality = { low: 'mid', mid: 'high', high: 'low' };
  const qlabel = { low: 'Low', mid: 'Mid', high: 'High' };
  const flag = (name, label) => ({ label: () => `${label} ${post.flags[name] ? '켜짐' : '꺼짐'}`, run: act[name] });
  const touch = setupTouch({
    player,
    flashlight,
    menuItems: [
      { id: 'flash', run: act.flash },
      { label: '이벤트 발동', run: act.event },
      { label: () => (audio.muted ? '소리 켜기' : '음소거'), run: act.mute },
      { label: () => `품질 ${qlabel[state.quality]}`, run: () => act.quality(nextQuality[state.quality]) },
      { label: () => `헤드밥 ${Math.round(player.bob.level * 100)}%`, run: act.bob },
      flag('bloom', '블룸'),
      flag('grain', '그레인'),
      flag('vignette', '비네팅'),
      { label: '안개 −', run: act.fogLess },
      { label: '안개 +', run: act.fogMore },
      { label: () => `점검 ${state.inspect ? '켜짐' : '꺼짐'}`, run: act.inspect },
      { label: 'HUD', run: act.hud },
      { label: '전체화면', run: enterImmersive },
    ],
  });
  addEventListener('keydown', (e) => e.code === 'KeyF' && touch.syncFlash());
  overlay.addEventListener('click', () => {
    audio.start();
    overlay.classList.add('hidden');
    enterImmersive();
  });
} else {
  overlay.addEventListener('click', () => {
    audio.start();
    player.controls.lock();
  });
  player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
  player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

applyQuality(shot ? shot.quality : touchMode ? 'mid' : 'high'); // 터치 기기는 Mid 로 시작 (메뉴에서 변경)
setFog(FOG.density);

function step(t, dt) {
  renderer.info.reset();
  U.time.value = t;
  if (dt > 0) player.update(dt);
  flashlight.update(dt);
  if (!shot) director.update(t, dt);
  world.update(t, dt, camera);
  fx.update(camera);
  audio.update();
  post.render(t);
  captureIfRequested(renderer.domElement);
  if (!shot) {
    hud.update({
      quality: state.quality, pos: camera.position, surface: collision.surfaceAt(camera.position.x, camera.position.z),
      fog: state.fog, bob: player.bob.level, flags: post.flags, flash: flashlight.on, inspect: state.inspect,
      muted: audio.muted, events: director.log,
    });
  }
}
window.__DEBUG = { pos: () => camera.position.toArray().map((v) => +v.toFixed(2)), director, world, player };

if (shot) {
  // ?shot=1 : 시간 고정, 포인터락 없음, HUD 숨김, 안정된 프레임 후 __READY
  overlay.classList.add('hidden');
  lights.setInspect(shot.inspect);
  if (shot.noShadow) { lights.setShadows(false); flashlight.spot.castShadow = false; }
  if (shot.noPost) post.enabled = false;
  if (shot.pos) player.setView(shot.pos, shot.yaw, shot.pitch);
  flashlight.setOn(shot.flash);
  flashlight.snap();
  if (shot.event) {
    director.t = shot.time;
    director.trigger(shot.event);
  }
  let n = 0;
  renderer.setAnimationLoop(() => {
    step(shot.time, 0);
    if (++n === shot.frames) {
      renderer.setAnimationLoop(null); // 마지막 프레임을 고정한 채 멈춤
      requestAnimationFrame(() => (window.__READY = true));
    }
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
