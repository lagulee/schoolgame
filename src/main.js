import * as THREE from 'three';
import { LIGHTS, PLAYER, FOG, PALETTE, QUALITY, STAMINA } from './config.js';
import { U } from './world/shared.js';
import { Collision } from './player/collision.js';
import { Player } from './player/controller.js';
import { buildWorld } from './world/world.js';
import { buildFx } from './world/fx.js';
import { Post } from './post/composer.js';
import { AudioSystem } from './audio/audio.js';
import { Director } from './events/director.js';
import { parseShotParams, requestScreenshot, captureIfRequested } from './debug/screenshot.js';
import { Hud } from './debug/hud.js';
import { isTouchDevice, setupTouch, enterImmersive, toggleImmersive } from './player/touch.js';
import { setupStory } from './story/setup.js';
import { setupPhone } from './phone/setup.js';
import { StaminaBar } from './ui/staminaBar.js';
import { setupChase } from './chase/setup.js';
import { setupPuzzle } from './puzzle/setup.js';

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

const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.style.opacity = 0), 1400);
}
const onOff = (v) => (v ? '켜짐' : '꺼짐');
const touchMode = isTouchDevice();
const story = setupStory({ player, touch: touchMode, toast });
const phone = setupPhone({ scene, camera, story, touch: touchMode, toast }); // 손전등 대신 핸드폰 라이트 (결정 D6)
player.phoneOpen = () => phone.phone.screenOpen; // 화면이 열린 동안 이동 ×0.7·달리기 불가
const staminaBar = new StaminaBar(STAMINA);
// 스태미나는 체크포인트 시점의 값으로 되돌린다 (단계 0b-3: 추격에서 잡히면 추격 시작 때의 값. 마지막 추격은 시작 때 가득)
story.runner.checkpoints.register('stamina', { save: () => player.stamina.save(), load: (v) => player.stamina.load(v) });
const chase = setupChase({ story, player, toast }); // 추격 gap 모델 (디버그: C 키로 시작/중지, HUD 줄)
const puzzle = setupPuzzle({ story, toast }); // 퍼즐 실행기 (디버그 시험 퍼즐: I 시작/중지, O 단서, Z 정답, X 오답, HUD 줄)
const fx = buildFx(scene, world.ctx, phone.light, collision);
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
  phone.light.spot.castShadow = q.shadows;
  fx.setLevel(q.fx);
  fx.setPixelRatio(pr);
}

function setFog(d) {
  state.fog = Math.min(FOG.max, Math.max(FOG.min, d));
  scene.fog.density = state.fog;
  fx.setFogDensity(state.fog);
}

// 기능 (키보드와 터치 메뉴가 같이 쓴다)
const act = {
  phone: () => phone.toggleScreen(),
  light: () => phone.toggleLight(),
  bank: () => phone.debugBank(player.pos, camera.getWorldDirection(new THREE.Vector3())),
  bloom: () => toast(`블룸 ${onOff(post.toggle('bloom'))}`),
  grain: () => toast(`그레인 ${onOff(post.toggle('grain'))}`),
  vignette: () => toast(`비네팅 ${onOff(post.toggle('vignette'))}`),
  fogLess: () => { setFog(state.fog - FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  fogMore: () => { setFog(state.fog + FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  inspect: () => { state.inspect = !state.inspect; lights.setInspect(state.inspect); toast(`점검 모드 ${onOff(state.inspect)}`); },
  quality: (name) => { applyQuality(name); toast(`품질 ${name[0].toUpperCase()}${name.slice(1)}`); },
  event: () => { director.force(); toast(`이상 현상: ${director.status}`); },
  storyNext: () => story.next(),
  storyReset: () => { chase.reset(); puzzle.reset(); story.reset(); phone.reset(); player.stamina.reset(); },
  chase: () => chase.debugToggle(),
  puzzle: () => puzzle.debugToggle(),
  puzzleClue: () => puzzle.debugClue(),
  puzzleRight: () => puzzle.debugRight(),
  puzzleWrong: () => puzzle.debugWrong(),
  storyBook: () => story.book(),
  mute: () => toast(audio.toggleMute() ? '음소거' : '소리 켜짐'),
  hud: () => hud.toggle(),
  shot: () => { requestScreenshot(); toast('스크린샷 저장'); },
  bob: () => toast(`헤드밥 ${Math.round(player.bob.cycleLevel() * 100)}%`),
};
const KEYS = {
  KeyE: act.phone, KeyR: act.light, KeyU: act.bank, KeyB: act.bloom, KeyG: act.grain, KeyV: act.vignette, BracketLeft: act.fogLess, BracketRight: act.fogMore,
  KeyL: act.inspect, Digit1: () => act.quality('low'), Digit2: () => act.quality('mid'), Digit3: () => act.quality('high'),
  KeyY: act.event, KeyC: act.chase, KeyI: act.puzzle, KeyO: act.puzzleClue, KeyZ: act.puzzleRight, KeyX: act.puzzleWrong, KeyN: act.storyNext, KeyJ: act.storyBook, KeyK: act.storyReset, KeyM: act.mute, Backquote: act.hud, KeyP: act.shot, KeyH: act.bob,
};
// E 우선순위: ① 대화·선택지 ② 근처 상호작용 대상 ③ 핸드폰 화면 열기/닫기. 앞의 둘(story.key)이 소비하지 않은 키만 단축키로 넘긴다
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (story.key(e.code)) return;
  KEYS[e.code]?.();
});

// 시작 화면: 터치 기기는 탭으로 시작(포인터락 없음), 그 외에는 클릭 후 포인터락
const overlay = document.getElementById('overlay');
let touchSync = null; // 터치 📱·💡 버튼 켜짐 표시
if (touchMode) {
  overlay.querySelector('.start').textContent = '화면을 터치하여 시작';
  const nextQuality = { low: 'mid', mid: 'high', high: 'low' };
  const qlabel = { low: 'Low', mid: 'Mid', high: 'High' };
  const flag = (name, label) => ({ label: () => `${label} ${post.flags[name] ? '켜짐' : '꺼짐'}`, run: act[name] });
  const touch = setupTouch({
    player,
    phone: { screen: act.phone, light: act.light, state: phone.phone },
    menuItems: [
      { label: '이상 현상 발동', run: act.event },
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
      { label: () => (document.fullscreenElement ? '전체화면 해제' : '전체화면'), run: toggleImmersive },
      { label: '다음 사건 (디버그)', run: act.storyNext },
      { label: '책 줍기 (디버그)', run: act.storyBook },
      { label: '보조배터리 놓기 (디버그)', run: act.bank },
      { label: () => (chase.session.active ? '추격 중지 (디버그)' : '추격 시작 (디버그)'), run: act.chase },
      { label: () => (puzzle.session.active ? '시험 퍼즐 중지 (디버그)' : '시험 퍼즐 시작 (디버그)'), run: act.puzzle },
      { label: '단서 얻기 (디버그)', run: act.puzzleClue },
      { label: '정답 입력 (디버그)', run: act.puzzleRight },
      { label: '오답 입력 (디버그)', run: act.puzzleWrong },
      { label: '스토리 초기화', run: act.storyReset },
    ],
  });
  touchSync = touch.sync;
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

const staminaHud = () => {
  const s = player.stamina;
  return `스태미나 ${s.value.toFixed(1)}${s.exhausted ? ' 탈진' : ''}${s.draining ? ' 소모' : s.recovering ? ' 회복' : ''}  속도 ${player.speed.toFixed(2)}${player.running ? ' 달리기' : ''}`;
};

function step(t, dt) {
  renderer.info.reset();
  U.time.value = t;
  if (dt > 0) player.update(dt);
  if (!shot) director.update(t, dt);
  story.update(dt);
  chase.update(dt);
  phone.update(dt);
  staminaBar.update(dt, player.stamina);
  audio.setBreath(audio.muted ? 0 : player.tired);
  touchSync?.();
  world.update(t, dt, camera);
  fx.update(camera);
  audio.update();
  post.render(t);
  captureIfRequested(renderer.domElement);
  if (!shot) {
    hud.update({
      quality: state.quality, pos: camera.position, surface: collision.surfaceAt(camera.position.x, camera.position.z),
      fog: state.fog, bob: player.bob.level, flags: post.flags, phone: phone.hudLine(), stamina: staminaHud(), chase: chase.hudLine(), puzzle: puzzle.hudLine(), inspect: state.inspect,
      muted: audio.muted, events: director.log, story: story.hudLines(),
    });
  }
}
window.__DEBUG = { pos: () => camera.position.toArray().map((v) => +v.toFixed(2)), director, world, player, story: story.runner, phone: phone.phone, banks: phone.banks, chase: chase.session, puzzle: puzzle.session };
// ?light=1 : 라이트를 켠 채 시작 (smoke 등 자동 점검용)
if (new URLSearchParams(location.search).get('light') === '1') phone.phone.setLight(true);

if (shot) {
  // ?shot=1 : 시간 고정, 포인터락 없음, HUD 숨김, 안정된 프레임 후 __READY
  overlay.classList.add('hidden');
  lights.setInspect(shot.inspect);
  if (shot.noShadow) { lights.setShadows(false); phone.light.spot.castShadow = false; }
  if (shot.noPost) post.enabled = false;
  if (shot.pos) player.setView(shot.pos, shot.yaw, shot.pitch);
  if (shot.event) {
    director.t = shot.time;
    director.trigger(shot.event);
  }
  if (shot.story) {
    story.ui.instant = true;
    if (shot.story === 'ending') story.runner.showEnding(shot.storyEnding);
    else story.runner.jump(shot.story, shot.storyLine, shot.storyFlags);
  }
  // 핸드폰: 사건(E1 배터리 확정) 뒤에 적용
  phone.phone.setLight(shot.light);
  if (shot.phone) phone.phone.openScreen();
  if (shot.battery !== null) phone.phone.s.battery = shot.battery;
  phone.light.sync(phone.phone);
  phone.light.snap();
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
