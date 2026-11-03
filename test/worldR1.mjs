// 단계 19 테스트 공용 세계 (화면 없이 StoryRunner + 실제 E2Scene·StorySteps·P3Search·P2Duty·P4Keys·Look·Vanish·PovSwitch·Escape·FinaleView
// + 핸드폰(Phone·PowerBanks, src/phone/setup.js 와 같은 연결)). 책을 미리 챙긴 판(R1). from = 'E6'(E6 까지 끝남) 또는 'R1-d'(R1-d 까지 끝남, 당직실 안).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { ChaseSession } from '../src/chase/session.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks } from '../src/puzzle/hooks.js';
import { E2Scene } from '../src/scene/e2.js';
import { StorySteps } from '../src/scene/steps.js';
import { P3Search } from '../src/scene/p3.js';
import { P2Duty } from '../src/scene/p2.js';
import { P4Keys } from '../src/scene/p4.js';
import { Look } from '../src/scene/finale.js';
import { Collapse } from '../src/scene/finale.js';
import { Vanish } from '../src/scene/vanish.js';
import { PovSwitch } from '../src/scene/pov.js';
import { Escape } from '../src/scene/escape.js';
import { FinaleView } from '../src/scene/finaleView.js';
import { Phone } from '../src/phone/phone.js';
import { PowerBanks, seenBy } from '../src/phone/bank.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { MapData } from '../src/world/mapData.js';
import { CHASE, PUZZLE, PLAYER, SCENE, PHONE } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI, memoryStorage } from './helpers.mjs';

export const { story, characters } = loadStory();
export const { chases, puzzles, powerbanks } = loadSkeletons();
export const nav = JSON.parse(readFileSync('data/nav.json', 'utf8'));
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
export const C3 = chases.find((c) => c.id === 'C3');
export const C4 = chases.find((c) => c.id === 'C4');
export const DT = 1 / 30;
export const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
export const r1 = (id) => story.events.find((e) => e.id === id && e.routes.includes('R1'));
const mid = (id) => {
  const r = map.resolve(id);
  const [a, b, c, d] = r.item.rect;
  return [(a + c) / 2, (b + d) / 2, r.level];
};
const COMMON = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
const UP_TO_R1D = [...COMMON, 'E7', 'R1-a', 'R1-b', 'R1-c', 'R1-d'];

export function world({ from = 'R1-d' } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  const done = from === 'E6' ? COMMON : UP_TO_R1D;
  for (const id of done) runner.registry.done.add(id);
  if (from !== 'E6') runner.registry.history.push('E7', 'R1-a', 'R1-b', 'R1-c', 'R1-d');
  runner.registry.last = done.at(-1);
  runner.flags.set('earlyBook', true);
  const me = from === 'E6' ? { x: 10, z: -91.9, level: 1, yaw: 0, pitch: 0 } : { x: 22, z: -32, level: 3, yaw: 0, pitch: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0, pitch: p.pitch ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  let speed = 0;
  // 스태미나: 값 하나만 (저장·복원·가득 채우기)
  const stamina = { value: 100, resets: 0, save() { return { value: this.value }; }, load(v) { this.value = v.value; }, reset() { this.value = 100; this.resets++; } };
  runner.checkpoints.register('stamina', { save: () => stamina.save(), load: (v) => stamina.load(v) });
  // 핸드폰 (src/phone/setup.js 와 같은 연결: E1 은 지난 판이라 begin 으로 확정, 시점 전환 때 교체·보조배터리 빼기)
  const phone = new Phone(PHONE, () => 0.5);
  phone.begin();
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id), refresh: () => {} };
  const toasts = [];
  const toast = (m) => toasts.push(m);
  const msgs = { bankLabel: '보조배터리 줍기', bankTooEarly: '{id}', bankPicked: '{n}', bankPov: 'pov', bankNone: 'none', bankPlaced: '{id}' };
  const banks = new PowerBanks({ phone, defs: powerbanks, interactions, seen: seenBy(runner.registry), msgs, toast, gain: PHONE.BANK_GAIN });
  banks.placeAll();
  runner.onPov = (p) => {
    phone.usePov(p);
    banks.placeAll();
  };
  runner.checkpoints.register('phone', { save: () => phone.save(), load: (v) => { phone.load(v); banks.sync(); } });
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => speed, pose, stamina });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => phone.lightOn, maxSpeed: PLAYER.run * 1.4 });
  const sounds = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE, sound: (d) => sounds.push(d) });
  const text = (t) => runner.text(t);
  const p3 = new P3Search({ runner, puzzle, pose, where, locate, interactions, toast, text, cfg: SCENE.p3 });
  const p2 = new P2Duty({ runner, puzzle, interactions, toast, text, cfg: SCENE.duty });
  const p4 = new P4Keys({ runner, puzzle, pose, interactions, light: () => phone.lightOn, toast, text, cfg: SCENE.p4 });
  const look = new Look({ runner, story, pose });
  const collapse = new Collapse({ runner, story, pose, cfg: SCENE.collapse, ready: () => e2.ghostArrived });
  const vanish = new Vanish({ runner, story, cfg: SCENE.vanish });
  const pov = new PovSwitch({ runner, story, pose, stamina, cfg: SCENE.pov });
  const escape = new Escape({ runner, story, pose, cfg: SCENE.escape });
  const el = () => ({ style: {} });
  const player = { frozen: false, eyeDrop: 0, pos: { x: 0, z: 0 } };
  const view = new FinaleView({ runner, look, collapse, pov, escape, player, camera: { rotation: { x: 0 } }, audio: { started: false }, bloodEl: el(), veilEl: el(), threatEl: el(), text });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  const endings = new EndingsSeen('test', memoryStorage());
  runner.onEnding = (key) => endings.mark(key);
  const log = { veil: [], frozen: [], pov: [] }; // 프레임마다 검은 막·조작 정지·시점
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level, DT);
      e2.update(DT);
      chase.update(DT);
      steps.update(DT);
      p3.update(DT);
      p2.update(DT);
      p4.update(DT);
      look.update(DT);
      collapse.update(DT);
      vanish.update(DT);
      pov.update(DT);
      escape.update(DT);
      phone.update(DT);
      player.frozen = runner.choosing || chase.locked;
      view.veilEl.style.opacity = 0;
      view.update();
      log.veil.push(+view.veilEl.style.opacity);
      log.frozen.push(player.frozen);
      log.pov.push(runner.pov);
    }
  };
  const at = (x, z, level = me.level) => {
    Object.assign(me, { x, z, level });
    tick();
  };
  const walk = (x, z, v, tries = () => 0) => {
    const t0 = tries();
    for (let i = 0; i < 4000 && Math.hypot(x - me.x, z - me.z) > 1e-6; i++) {
      const d = Math.hypot(x - me.x, z - me.z);
      const s = Math.min(d, v * DT);
      me.x += ((x - me.x) / d) * s;
      me.z += ((z - me.z) / d) * s;
      speed = s / DT;
      tick();
      if (tries() !== t0 || chase.locked) break; // 잡혀서 시작 자리로 돌아왔다 / 출구를 여는 동안은 조작 불가
    }
    speed = 0;
  };
  // 대화(dialog)는 E 로 넘기고 자막은 시간으로. 행동 줄에 닿거나 사건이 끝나면 멈춘다
  const play = (limit = 60) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  // 행동 줄도 기다려 사건이 끝날 때까지 (끝나면 다음 사건이 바로 걸릴 수 있다)
  const finish = (id, limit = 60) => {
    for (let i = 0; i < limit * 30 && !runner.registry.done.has(id); i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
    assert.ok(runner.registry.done.has(id), `${id} 끝`);
  };
  return { runner, me, phone, banks, items, toasts, sounds, stamina, chase, puzzle, e2, steps, p2, p3, p4, look, vanish, pov, escape, view, player, triggers, endings, log, tick, at, walk, play, finish, mid };
}

// E6 까지 끝난 판에서 R1-d 가 끝날 때까지 (r1ad.test 와 같은 순서: E7 → R1-a → R1-b P3 → R1-c P2 → R1-d 연기)
export function playToR1d(w) {
  w.at(...mid('A2F-3'));
  assert.equal(w.runner.event?.id, 'E7');
  w.play();
  w.at(-9, -91.2, 1);
  w.tick(SCARE + 0.1);
  w.finish('R1-a');
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P3');
  w.at(...mid('A3F-3'));
  w.finish('R1-b');
  w.at(22, -32, 3);
  assert.equal(w.runner.event?.id, 'R1-c');
  w.play();
  for (const id of ['log', 'calendar', 'blackboard']) w.items.get(`p2:${id}`).onUse();
  for (let i = 0; i < 400 && w.puzzle.active; i++) {
    if (w.p2.ghost) w.p2.ghost.t = 99;
    w.tick(1);
  }
  w.finish('R1-c');
  w.finish('R1-d');
}

// R1-d 뒤 5초 → R1-e 시점 전환이 끝나 열쇠 걸이 앞까지 걸어가 P4 시작
export function toP4(w) {
  w.tick(story.triggers.find((t) => t.event === 'R1-e').wait + 0.1);
  assert.equal(w.runner.event?.id, 'R1-e');
  w.tick(SCENE.pov.out + SCENE.pov.black + SCENE.pov.in + 0.2);
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.at(19.4, -45, 1);
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P4');
  w.tick();
}

// P4 를 47 번으로 풀고 R1-e 가 끝날 때까지, 교무실을 나와 복도 남쪽(R1-f 자리)까지
export function solveP4(w) {
  w.items.get('p4:key:47').onUse();
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.finish('R1-e');
}

// R1-f 를 끝내고 R1-g 추격 줄까지
export function toChase(w) {
  w.at(16.5, -36, 1);
  assert.equal(w.runner.event, null, '복도 위쪽에서는 아직');
  w.at(16.5, -31.1, 1);
  assert.equal(w.runner.event?.id, 'R1-f');
  w.me.yaw = Math.PI;
  for (let i = 0; i < 900 && w.runner.action?.do !== 'chase'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.deepEqual(w.runner.action, { do: 'chase' });
  assert.equal(w.runner.event?.id, 'R1-g');
}

// 곧게 달려 C3 경로 끝까지 (경로 점을 따라)
export function runRoute(w, v = PLAYER.run) {
  const tries = () => w.chase.attemptOf('C3', 'escape');
  const t0 = tries();
  for (const [x, z, l] of C3.path.points.slice(2)) {
    w.me.level = l;
    w.walk(x, z, v, tries);
    if (!w.chase.active || tries() !== t0) break;
  }
  if (w.chase.active && tries() === t0) w.tick(C3.unlockTime + 0.3);
}
