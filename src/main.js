import * as THREE from 'three';
import { LIGHTS, PLAYER, FOG, PALETTE, QUALITY, STAMINA, DEBUG, FINISH } from './config.js';
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
import { DebugGate } from './debug/gate.js';
import { GateUi, tapCounter } from './debug/gateUi.js';
import { isTouchDevice, setupTouch, enterImmersive, toggleImmersive } from './player/touch.js';
import { setupStory } from './story/setup.js';
import { setupPhone } from './phone/setup.js';
import { MapData } from './world/mapData.js';
import { NavGuide } from './world/navGuide.js';
import navData from '../data/nav.json';
import mapJson from '../data/map.json';
import { StaminaBar } from './ui/staminaBar.js';
import { setupChase } from './chase/setup.js';
import { setupPuzzle } from './puzzle/setup.js';
import { Prelude } from './story/prelude.js';
import { setupStartFlow } from './ui/startFlow.js';
import { setupScenes } from './scene/setup.js';
import { Brightness } from './ui/brightness.js';
import { mountBrightness } from './ui/brightnessUi.js';

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
const mapData = new MapData(mapJson); // 위치 이름·잠긴 문 소리 (단계 10)
const where = () => mapData.label(player.pos.x, player.pos.z, player.level);
// 시작 전 자유 탐색 (단계 0c): 현관 홀에 들어서면 E1 (배터리 확정·hasRoofKey 판정은 E1 시작 경로 그대로)
const prelude = new Prelude({ runner: story.runner, def: story.runner.story.prelude, locate: (x, z, l) => mapData.locate(x, z, l) });
// 길 안내 (핸드폰 화살표): 목표(objective 키)에 맞는 곳까지 길을 찾아 내가 보는 방향 기준 각도를 낸다
const flagOn = (name) => story.runner.flags.values[name] === true;
const navGuide = new NavGuide({ col: collision, info: world.interior.nav, mapData, data: navData, hasKey: flagOn });
const _look = new THREE.Vector3();
const guide = (dt) => {
  const v = navGuide.update(dt, player.pos.x, player.pos.z, player.level, story.runner.objectiveKey());
  if (!v) return null;
  camera.getWorldDirection(_look);
  const h = Math.hypot(_look.x, _look.z) || 1;
  const fx = _look.x / h;
  const fz = _look.z / h;
  // 오른쪽 = (−fz, fx). 0° = 바로 앞, 시계 방향이 +
  const angle = Math.round((Math.atan2(v.ax * -fz + v.az * fx, v.ax * fx + v.az * fz) * 180) / Math.PI);
  return { state: v.state, text: v.text, step: v.step, rough: v.rough, angle };
};
const phone = setupPhone({ scene, camera, story, touch: touchMode, toast, collision, where, guide, note: () => scenes.roof.keyNote() }); // 손전등 대신 핸드폰 라이트 (결정 D6). note = 옥상 열쇠 안내 (단계 21)
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
// 실내 문·연결문·신관 살펴보기 자리 (E). 열쇠 문은 스토리 플래그(없는 이름이면 잠김), 책상 위 책은 상호작용 사건
world.interior.attach({ interactions: story.interactions, toast, audio, player, hasKey: (name) => story.runner.flags.values[name] === true, runner: story.runner, lockSound: (id) => mapData.lockSound(id), take: (id) => scenes.steps.take(id) });
// 사건 연출 (단계 12): E2 자리 진입·추격 C1·숨기 P1·흔적·E1 조작 안내
const scenes = setupScenes({ scene, camera, story, chase, puzzle, player, phone, world, mapData, collision, audio, toast, touch: touchMode });
// 실내 밝기 보정 (단계 20): 브라우저에 저장, 시작 화면·- = 키·터치 메뉴
const brightness = new Brightness(FINISH.bright, (() => { try { return localStorage; } catch { return null; } })());
const brightBox = mountBrightness(document.querySelector('#overlay .card'), brightness);
world.interior.atmo.setBright(brightness);
brightness.onChange = () => { world.interior.atmo.setBright(brightness); brightBox.sync(); toast(`실내 밝기 ${brightness.label}`); };
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

// 디버그 잠금: 비밀번호를 맞히기 전에는 디버그 기능(아래 DEBUG_CODES·터치 메뉴의 (디버그) 항목)이 동작하지 않는다.
// 키보드는 ` 키, 터치는 메뉴의 '디버그 잠금 해제' 로 입력 창을 연다
const gate = new DebugGate();
const gateUi = new GateUi(gate, {
  toast,
  onUnlock: () => touchRefresh?.(), // 열려 있는 터치 메뉴에 디버그 항목을 바로 보이게
  onOpen: () => { player.keys.clear(); player.controls.unlock?.(); },
});
const act = {
  phone: () => phone.toggleScreen(),
  light: () => phone.toggleLight(),
  bank: () => phone.debugBank(player.pos, camera.getWorldDirection(new THREE.Vector3()), player.level),
  bloom: () => toast(`블룸 ${onOff(post.toggle('bloom'))}`),
  grain: () => toast(`그레인 ${onOff(post.toggle('grain'))}`),
  vignette: () => toast(`비네팅 ${onOff(post.toggle('vignette'))}`),
  fogLess: () => { setFog(state.fog - FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  fogMore: () => { setFog(state.fog + FOG.step); toast(`안개 밀도 ${state.fog.toFixed(4)}`); },
  inspect: () => { state.inspect = !state.inspect; lights.setInspect(state.inspect); toast(`점검 모드 ${onOff(state.inspect)}`); },
  quality: (name) => { applyQuality(name); toast(`품질 ${name[0].toUpperCase()}${name.slice(1)}`); },
  event: () => { director.force(); toast(`이상 현상: ${director.status}`); },
  storyNext: () => story.next(),
  storyReset: () => { chase.reset(); puzzle.reset(); story.reset(); scenes.roof.stop(); phone.reset(); player.stamina.reset(); },
  chase: () => chase.debugToggle(),
  puzzle: () => puzzle.debugToggle(),
  puzzleClue: () => puzzle.debugClue(),
  puzzleRight: () => puzzle.debugRight(),
  puzzleWrong: () => puzzle.debugWrong(),
  storyBook: () => story.book(),
  mute: () => toast(audio.toggleMute() ? '음소거' : '소리 켜짐'),
  hud: () => (gate.unlocked ? hud.toggle() : gateUi.show()),
  ghost: () => { player.ghost = !player.ghost; toast(`유령 모드 ${onOff(player.ghost)} (벽 통과·이속 ×${DEBUG.ghostSpeedScale})`); },
  infStamina: () => { player.stamina.infinite = !player.stamina.infinite; toast(`무한 스태미나 ${onOff(player.stamina.infinite)}`); },
  unlock: () => (gate.unlocked ? toast('디버그 잠금 해제됨') : gateUi.show()),
  shot: () => { requestScreenshot(); toast('스크린샷 저장'); },
  bob: () => toast(`헤드밥 ${Math.round(player.bob.cycleLevel() * 100)}%`),
  brightDown: () => brightness.step(-1) === FINISH.bright.min && toast(`실내 밝기 ${brightness.label} (최저)`),
  brightUp: () => brightness.step(1) === FINISH.bright.max && toast(`실내 밝기 ${brightness.label} (최고)`),
};
const KEYS = {
  KeyE: act.phone, KeyR: act.light, KeyU: act.bank, KeyB: act.bloom, KeyG: act.grain, KeyV: act.vignette, BracketLeft: act.fogLess, BracketRight: act.fogMore,
  KeyL: act.inspect, Digit1: () => act.quality('low'), Digit2: () => act.quality('mid'), Digit3: () => act.quality('high'),
  Minus: act.brightDown, Equal: act.brightUp, NumpadSubtract: act.brightDown, NumpadAdd: act.brightUp,
  KeyY: act.event, KeyC: act.chase, KeyI: act.puzzle, KeyO: act.puzzleClue, KeyZ: act.puzzleRight, KeyX: act.puzzleWrong, KeyN: act.storyNext, KeyJ: act.storyBook, KeyK: act.storyReset, KeyM: act.mute, Backquote: act.hud, KeyP: act.shot, KeyH: act.bob, KeyT: act.ghost, KeyF: act.infStamina,
};
// 잠금 없이 쓰는 키: 핸드폰·라이트·음소거·품질·실내 밝기. ` 키는 잠겨 있으면 비밀번호 창을 연다. 나머지는 모두 디버그 기능
const FREE_CODES = new Set(['KeyE', 'KeyR', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Backquote', 'Minus', 'Equal', 'NumpadSubtract', 'NumpadAdd']);
const unlocked = () => gate.unlocked;
const verTap = tapCounter(DEBUG.tapCount, () => DEBUG.tapWindowMs, () => act.unlock());
const dbg = (run) => () => (gate.unlocked ? run() : toast('디버그 잠금 (` 키로 해제)'));
// E 우선순위: ① 대화·선택지 ② 근처 상호작용 대상 ③ 핸드폰 화면 열기/닫기. 앞의 둘(story.key)이 소비하지 않은 키만 단축키로 넘긴다
addEventListener('keydown', (e) => {
  if (e.repeat || gateUi.open) return;
  if (story.key(e.code)) return;
  const fn = KEYS[e.code];
  if (!fn) return;
  if (FREE_CODES.has(e.code) || gate.unlocked) fn();
});

// 시작 화면의 버전 글자를 5번 연속 탭하면 디버그 비밀번호 창 (시작 클릭으로 번지지 않게 막음)
document.getElementById('version').addEventListener('click', (e) => { e.stopPropagation(); verTap(); });

// 시작 화면: 터치 기기는 탭으로 시작(포인터락 없음), 그 외에는 클릭 후 포인터락
const overlay = document.getElementById('overlay');
// 경고 → 이름 입력(필수) → 시작. 이름이 맞을 때만 시작 화면을 닫는다 (단계 0c)
const startFlow = setupStartFlow({ overlay, touch: touchMode, hint: story.runner.text(story.runner.story.prelude.hint), onName: (name) => story.setPlayerName(name) });
let touchSync = null; // 터치 📱·💡 버튼 켜짐 표시
let touchRefresh = null; // 터치 메뉴 항목 다시 그리기 (디버그 잠금 해제 직후)
if (touchMode) {
  overlay.querySelector('.start').textContent = '화면을 터치하여 시작';
  const nextQuality = { low: 'mid', mid: 'high', high: 'low' };
  const qlabel = { low: 'Low', mid: 'Mid', high: 'High' };
  const flag = (name, label) => ({ label: () => `${label} ${post.flags[name] ? '켜짐' : '꺼짐'}`, run: dbg(act[name]) });
  const touch = setupTouch({
    player,
    phone: { screen: act.phone, light: act.light, state: phone.phone },
    menuItems: [
      { label: '이상 현상 발동', run: dbg(act.event), show: unlocked },
      { label: () => (audio.muted ? '소리 켜기' : '음소거'), run: act.mute },
      { label: () => `품질 ${qlabel[state.quality]}`, run: () => act.quality(nextQuality[state.quality]) },
      { label: () => `실내 밝기 ${brightness.label}`, run: () => brightness.cycle() },
      { label: () => `헤드밥 ${Math.round(player.bob.level * 100)}%`, run: dbg(act.bob), show: unlocked },
      { ...flag('bloom', '블룸'), show: unlocked },
      { ...flag('grain', '그레인'), show: unlocked },
      { ...flag('vignette', '비네팅'), show: unlocked },
      { label: '안개 −', run: dbg(act.fogLess), show: unlocked },
      { label: '안개 +', run: dbg(act.fogMore), show: unlocked },
      { label: () => `점검 ${state.inspect ? '켜짐' : '꺼짐'}`, run: dbg(act.inspect), show: unlocked },
      { label: 'HUD', run: act.hud, show: unlocked },
      { label: () => (document.fullscreenElement ? '전체화면 해제' : '전체화면'), run: toggleImmersive },
      { label: '다음 사건 (디버그)', run: dbg(act.storyNext), show: unlocked },
      { label: '책 줍기 (디버그)', run: dbg(act.storyBook), show: unlocked },
      { label: '보조배터리 놓기 (디버그)', run: dbg(act.bank), show: unlocked },
      { label: () => (chase.session.active ? '추격 중지 (디버그)' : '추격 시작 (디버그)'), run: dbg(act.chase), show: unlocked },
      { label: () => (puzzle.session.active ? '시험 퍼즐 중지 (디버그)' : '시험 퍼즐 시작 (디버그)'), run: dbg(act.puzzle), show: unlocked },
      { label: '단서 얻기 (디버그)', run: dbg(act.puzzleClue), show: unlocked },
      { label: '정답 입력 (디버그)', run: dbg(act.puzzleRight), show: unlocked },
      { label: '오답 입력 (디버그)', run: dbg(act.puzzleWrong), show: unlocked },
      { label: '스토리 초기화', run: dbg(act.storyReset), show: unlocked },
      { label: () => `유령 모드 ${player.ghost ? '켜짐' : '꺼짐'} (디버그)`, run: dbg(act.ghost), show: unlocked },
      { label: () => `무한 스태미나 ${player.stamina.infinite ? '켜짐' : '꺼짐'} (디버그)`, run: dbg(act.infStamina), show: unlocked },
      { label: () => __APP_VERSION__.label, run: () => verTap(), quiet: true }, // 눈에 띄지 않는 해제 입구: 5번 연속 탭
    ],
  });
  touchSync = touch.sync;
  touchRefresh = touch.refresh;
  overlay.addEventListener('click', () => {
    if (!startFlow.accept()) return;
    audio.start();
    overlay.classList.add('hidden');
    enterImmersive();
  });
} else {
  overlay.addEventListener('click', () => {
    if (!startFlow.accept()) return;
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
  if (!shot && !scenes.roof.paused) director.update(t, dt); // 옥상(엔딩 D)에서는 이상 현상도 멈춘다
  prelude.update(player.pos.x, player.pos.z, player.level);
  story.update(dt);
  scenes.update(dt); // 추격 진행(경로 투영)을 추격 update 보다 먼저
  chase.update(dt);
  phone.update(dt);
  staminaBar.update(dt, player.stamina);
  audio.setBreath(audio.muted ? 0 : Math.max(player.tired, scenes.breath));
  touchSync?.();
  world.interior.update(dt, player, camera);
  world.update(t, dt, camera);
  fx.update(camera, player.level);
  audio.update();
  post.render(t);
  captureIfRequested(renderer.domElement);
  if (!shot) {
    hud.update({
      quality: state.quality, pos: camera.position, level: player.level, interior: `${world.interior.atmo.hudLine(player)}  위치 ${where() || '-'}`, surface: collision.surfaceAt(camera.position.x, camera.position.z, player.level),
      fog: state.fog, bob: player.bob.level, flags: post.flags, phone: phone.hudLine(), stamina: staminaHud(), chase: chase.hudLine(), puzzle: puzzle.hudLine(), inspect: state.inspect,
      muted: audio.muted, events: director.log, story: story.hudLines(),
    });
  }
}
window.__DEBUG = { brightness, mapData, navGuide, where, phonePlace: phone.place, bankView: phone.view, renderer, applyQuality, debugCfg: DEBUG, gate, gateUi, pos: () => camera.position.toArray().map((v) => +v.toFixed(2)), director, world, player, interior: world.interior, story: story.runner, prelude, startFlow, scenes, phone: phone.phone, banks: phone.banks, chase: chase.session, puzzle: puzzle.session };
// ?light=1 : 라이트를 켠 채 시작 (smoke 등 자동 점검용)
if (new URLSearchParams(location.search).get('light') === '1') phone.phone.setLight(true);

if (shot) {
  // ?shot=1 : 시간 고정, 포인터락 없음, HUD 숨김, 안정된 프레임 후 __READY
  overlay.classList.add('hidden');
  prelude.enabled = false; // 촬영 자리가 현관 홀이어도 E1 이 끼어들지 않게
  scenes.auto = false;
  lights.setInspect(shot.inspect);
  if (shot.noShadow) { lights.setShadows(false); phone.light.spot.castShadow = false; }
  if (shot.noPost) post.enabled = false;
  if (shot.pos) player.setView(shot.pos, shot.yaw, shot.pitch, shot.level);
  if (shot.open.includes('connector')) world.interior.connector.set(true);
  if (shot.bright !== null) { brightness.level = brightness.clamp(shot.bright); world.interior.atmo.setBright(brightness); } // 저장값을 바꾸지 않고, 알림 없이
  if (shot.power === false) { story.runner.used.add('power:off'); world.interior.atmo.powerOut = true; } // 정전 뒤 (스냅 전에)
  world.interior.snap(player, camera); // 자동문·실내 노출을 최종 상태로
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
