// 단계 20 3루트 회귀용 세계 (화면 없이, 처음부터 끝까지): 학교 앞 → 현관 홀(E1) → … → 엔딩. 실제 모듈을 src/scene/setup.js·phone/setup.js 와
// 같은 순서로 잇는다 (Prelude·E2Scene(숨기)·Traces·StorySteps·P3·Faint·P2·P4·Look·Collapse·Vanish·PovSwitch·Escape·FinaleView·AloneAmbience + 핸드폰).
// 프레임마다 화면 밝기를 바꾸는 신호(검은 막·붉은 막·점프스케어 실루엣·검은 연기·혼자일 때 떨림·라이트 줄임)를 기록해 깜빡임을 검사하고,
// 행동 줄 기록으로 점프스케어 수를 센다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { Prelude } from '../src/story/prelude.js';
import { ChaseSession } from '../src/chase/session.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks } from '../src/puzzle/hooks.js';
import { E2Scene } from '../src/scene/e2.js';
import { Traces } from '../src/scene/traces.js';
import { StorySteps } from '../src/scene/steps.js';
import { P3Search } from '../src/scene/p3.js';
import { Faint } from '../src/scene/faint.js';
import { P2Duty } from '../src/scene/p2.js';
import { P4Keys } from '../src/scene/p4.js';
import { Look, Collapse } from '../src/scene/finale.js';
import { Vanish } from '../src/scene/vanish.js';
import { PovSwitch } from '../src/scene/pov.js';
import { Escape } from '../src/scene/escape.js';
import { FinaleView } from '../src/scene/finaleView.js';
import { AloneAmbience } from '../src/scene/alone.js';
import { Phone } from '../src/phone/phone.js';
import { PowerBanks, seenBy } from '../src/phone/bank.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { MapData } from '../src/world/mapData.js';
import { CHASE, PUZZLE, PLAYER, SCENE, PHONE, FINISH } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI, memoryStorage } from './helpers.mjs';

export const { story, characters } = loadStory();
export const { chases, puzzles, powerbanks } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
export const DT = 1 / 30;
export const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
export const mid = (id) => {
  const r = map.resolve(id);
  const [a, b, c, d] = r.item.rect;
  return [(a + c) / 2, (b + d) / 2, r.level];
};

// 점프스케어 실루엣 불투명도 (stepsView 와 같은 곡선: rise → hold → fade)
function scareAlpha(sc) {
  if (!sc) return 0;
  const S = SCENE.scare;
  const t = sc.t;
  if (t < S.rise) return t / S.rise;
  if (t < S.rise + S.hold) return 1;
  return Math.max(0, 1 - (t - S.rise - S.hold) / S.fade);
}

// endings = 이전 판에서 본 엔딩 저장소 (2회차 시험용), seed = 혼자일 때 연출 랜덤 (고정)
export function world({ endings = new EndingsSeen('test', memoryStorage()), seed = 0.5 } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  runner.repeat = endings.repeat;
  runner.allEndings = endings.allMain;
  const me = { x: 0, z: 12, level: 0, yaw: 0, pitch: 0 }; // 학교 앞 (PLAYER.start 근처)
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0, pitch: p.pitch ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  let speed = 0;
  const stamina = { value: 100, resets: 0, save() { return { value: this.value }; }, load(v) { this.value = v.value; }, reset() { this.value = 100; this.resets++; } };
  runner.checkpoints.register('stamina', { save: () => stamina.save(), load: (v) => stamina.load(v) });
  // 핸드폰 (phone/setup.js 와 같은 연결): E1 시작 때 배터리 확정, 시점 전환 때 교체·보조배터리 빼기
  const phone = new Phone(PHONE, () => 0.5);
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id), refresh: () => {} };
  const toasts = [];
  const toast = (m) => toasts.push(m);
  const msgs = { bankLabel: '보조배터리 줍기', bankTooEarly: '{id}', bankPicked: '{n}', bankPov: 'pov', bankNone: 'none', bankPlaced: '{id}' };
  const banks = new PowerBanks({ phone, defs: powerbanks, interactions, seen: seenBy(runner.registry), msgs, toast, gain: PHONE.BANK_GAIN });
  banks.placeAll();
  const log = { events: [], actions: [], veil: [], blood: [], scare: [], smoke: [], dim: [], lightDip: [], frozen: [] };
  runner.onEvent = (id, phase) => {
    if (id === PHONE.BEGIN_EVENT && phase === 'start') phone.begin();
    if (phase === 'start') log.events.push(id);
  };
  runner.onPov = (p) => {
    phone.usePov(p);
    banks.placeAll();
  };
  runner.onAction = (line, { restoring }) => {
    if (!restoring) log.actions.push(line.id ? `${line.do}:${line.id}` : line.do);
  };
  runner.checkpoints.register('phone', { save: () => phone.save(), load: (v) => { phone.load(v); banks.sync(); } });
  const prelude = new Prelude({ runner, def: story.prelude, locate });
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => speed, pose, stamina });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { closed: false, forced: new Set(), roomClosed: () => doors.closed, setForced: (rooms, on) => rooms.forEach((r) => (on ? doors.forced.add(r) : doors.forced.delete(r))) };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => phone.lightOn, maxSpeed: PLAYER.run * 1.4, toast });
  const traces = new Traces({ runner, defs: story.traces, interactions, toast });
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE, toast });
  const text = (t) => runner.text(t);
  const p3 = new P3Search({ runner, puzzle, pose, where, locate, interactions, toast, text, cfg: SCENE.p3 });
  const faint = new Faint({ runner, story, pose, cfg: SCENE.faint });
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
  const inside = () => !!locate(me.x, me.z, me.level);
  const alone = new AloneAmbience({ runner, def: story.alone, cfg: FINISH.alone, inside: () => inside() && !chase.active && !puzzle.active, rand: () => seed });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  runner.onEnding = (key) => endings.mark(key);
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      prelude.update(me.x, me.z, me.level);
      runner.update(DT);
      triggers.update(me.x, me.z, me.level, DT);
      e2.update(DT);
      traces.update();
      chase.update(DT);
      steps.update(DT);
      p3.update(DT);
      faint.update(DT);
      p2.update(DT);
      p4.update(DT);
      look.update(DT);
      collapse.update(DT);
      vanish.update(DT);
      pov.update(DT);
      escape.update(DT);
      alone.update(DT);
      phone.update(DT);
      player.frozen = runner.choosing || chase.locked || faint.active;
      view.veilEl.style.opacity = faint.veil; // FaintView 가 먼저 쓰고 FinaleView 가 더 큰 값을 쓴다
      view.update();
      log.veil.push(+view.veilEl.style.opacity);
      log.blood.push(collapse.blood);
      log.scare.push(scareAlpha(steps.scare));
      log.lightDip.push(steps.scare ? 1 - (1 - SCENE.scare.lightDip) * scareAlpha(steps.scare) : 1);
      log.smoke.push(vanish.density ?? 0);
      log.dim.push(alone.dim);
      log.frozen.push(player.frozen);
    }
  };
  const at = (x, z, level = me.level) => {
    Object.assign(me, { x, z, level });
    tick();
  };
  const walk = (x, z, v, tries = () => 0) => {
    const t0 = tries();
    for (let i = 0; i < 6000 && Math.hypot(x - me.x, z - me.z) > 1e-6; i++) {
      const d = Math.hypot(x - me.x, z - me.z);
      const s = Math.min(d, v * DT);
      me.x += ((x - me.x) / d) * s;
      me.z += ((z - me.z) / d) * s;
      speed = s / DT;
      tick();
      if (tries() !== t0 || chase.locked) break;
    }
    speed = 0;
  };
  // 대화는 E 로 넘기고 자막은 시간으로. 행동 줄에 닿거나 사건이 끝나면 멈춘다
  const play = (limit = 60) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  // 행동 줄도 기다려 사건이 끝날 때까지
  const finish = (id, limit = 60) => {
    for (let i = 0; i < limit * 30 && !runner.registry.done.has(id); i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
    assert.ok(runner.registry.done.has(id), `${id} 끝`);
  };
  // 엔딩 카드가 뜰 때까지
  const toEnding = (limit = 90) => {
    for (let i = 0; i < limit * 30 && runner.mode !== 'ending'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
    assert.equal(runner.mode, 'ending', '엔딩 카드');
  };
  return { runner, me, phone, banks, items, toasts, stamina, chase, puzzle, doors, e2, traces, steps, p2, p3, p4, faint, look, collapse, vanish, pov, escape, alone, view, player, triggers, prelude, endings, log, tick, at, walk, play, finish, toEnding, setSpeed: (v) => (speed = v) };
}
