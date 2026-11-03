// 단계 18(6a): R1 앞부분 — E7(정전·점프스케어 #1·분리) → R1-a 책 건네기 → R1-b P3 교실 수색(E8 대신) → 구관 4층 당직실 R1-c
// (당직 첫 만남 D7, P2 단서 3개) → R1-d 잡담 → 돌아봄 → {gyuha}(가짜) 검은 연기 퇴장. 화면 없이 StoryRunner + 실제 E2Scene·StorySteps·P3Search·P2Duty·Look·Vanish 를 돌린다.
import test from 'node:test';
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
import { Look, yawTo } from '../src/scene/finale.js';
import { Vanish } from '../src/scene/vanish.js';
import { MapData } from '../src/world/mapData.js';
import { bankOpen, seenBy } from '../src/phone/bank.js';
import { roofReachable } from '../src/story/roof.js';
import { CHASE, PUZZLE, PLAYER, SCENE } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { chases, puzzles, powerbanks } = loadSkeletons();
const nav = JSON.parse(readFileSync('data/nav.json', 'utf8'));
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const DT = 1 / 30;
const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
const r1 = (id) => story.events.find((e) => e.id === id && e.routes.includes('R1'));
const mid = (id) => {
  const r = map.resolve(id);
  const [a, b, c, d] = r.item.rect;
  return [(a + c) / 2, (b + d) / 2, r.level];
};

// E6 까지 끝난 판. earlyBook = E5~E7 사이에 4층 책을 챙긴 판(R1)
function world({ earlyBook = true } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) runner.registry.done.add(id);
  runner.registry.last = 'E6';
  if (earlyBook) runner.flags.set('earlyBook', true);
  const me = { x: 10, z: -91.9, level: 1, yaw: 0, pitch: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0, pitch: p.pitch ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => 0, pose });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => true, maxSpeed: PLAYER.run * 1.4 });
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) };
  const toasts = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE });
  const p3 = new P3Search({ runner, puzzle, pose, where, locate, interactions, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.p3 });
  const p2 = new P2Duty({ runner, puzzle, interactions, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.duty });
  const look = new Look({ runner, story, pose });
  const vanish = new Vanish({ runner, story, cfg: SCENE.vanish });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  const smoke = [];
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level);
      e2.update(DT);
      steps.update(DT);
      p3.update(DT);
      p2.update(DT);
      look.update(DT);
      vanish.update(DT);
      smoke.push(vanish.density);
    }
  };
  const at = (x, z, level = me.level) => {
    Object.assign(me, { x, z, level });
    tick();
  };
  // 대화(dialog)는 E 로 넘기고 자막은 시간으로. 행동 줄에 닿거나 사건이 끝나면 멈춘다
  const play = (limit = 60) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  return { runner, me, puzzle, steps, p2, items, toasts, smoke, tick, at, play };
}

// E7: 야자 교실 → 정전 → 배전반 → 점프스케어 → 분리 (R3 와 같다)
function runE7(w) {
  w.at(...mid('A2F-3'));
  assert.equal(w.runner.event?.id, 'E7');
  w.play();
  w.at(-9, -91.2, 1);
  w.tick(SCARE + 0.1);
  w.play(); // E7 이 끝난 프레임에 같은 자리(신관 2층 복도)에서 R1-a 가 걸리고, play 가 그 대사도 넘긴다
  assert.ok(w.runner.registry.done.has('E7'));
}

// R1-a 끝 → R1-b 퍼즐 줄까지
function toR1b(w) {
  runE7(w);
  w.play();
  assert.ok(w.runner.registry.done.has('R1-a'), 'E7 끝 자리에서 R1-a');
  assert.equal(w.runner.event?.id, 'R1-b', '같은 자리에서 바로 R1-b');
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.puzzle.puzzle?.id, 'P3', 'R1-b = P3 교실 수색');
  assert.equal(w.runner.objectiveKey(), 'findFriends');
}

// R1-b 를 풀고(3-10 진입) 대사를 끝까지
function solveR1b(w) {
  toR1b(w);
  w.at(...mid('A3F-3'));
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick(); // 다음 프레임에 E2Scene 이 다음 줄로 넘긴다
  w.play();
  assert.ok(w.runner.registry.done.has('R1-b'));
}

// 구관 4층 당직실에 들어가 R1-c 의 P2 를 끝까지 (단서 3개 + 귀신 3번, 90초 이상 간격)
function solveR1c(w) {
  w.at(16.5, -31.5, 3); // 4층 복도 (당직실 문 앞)
  assert.ok(!w.runner.busy, '복도에서는 아직');
  w.at(22, -32, 3);
  assert.equal(w.runner.event?.id, 'R1-c', '당직실에 들어서면 R1-c');
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P2');
  for (const id of ['log', 'calendar', 'blackboard']) w.items.get(`p2:${id}`).onUse();
  for (let i = 0; i < 400 && w.puzzle.active; i++) {
    if (w.p2.ghost) w.p2.ghost.t = 99; // 시선을 돌리지 않아도 머무는 시간이 지나면 흐려진다
    w.tick(1);
  }
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick();
  w.play();
  assert.ok(w.runner.registry.done.has('R1-c'));
}

test('데이터: R1-a~R1-d 자리 진입(R1 만)·목표·행동 줄, 대사는 자리표시자만', () => {
  for (const id of ['R1-a', 'R1-b', 'R1-c', 'R1-d']) {
    const tr = story.triggers.filter((t) => t.event === id);
    assert.equal(tr.length, 1, id);
    assert.deepEqual(tr[0].routes, ['R1'], `${id} 는 R1 에서만`);
    assert.notEqual(tr[0].after, 'E9', 'R1 은 E9 가 생략돼 done 에 없으므로 after 로 쓰지 않는다');
    const ev = r1(id);
    for (const k of [ev.objective, ev.objectiveDone]) {
      assert.ok(story.objectives[k], `${id} 목표 ${k}`);
      assert.ok(nav.goals[k], `${id} 길 안내 ${k}`);
    }
  }
  assert.ok(r1('R1-b').lines.some((l) => l.do === 'puzzle') && r1('R1-b').puzzle === 'P3');
  assert.ok(r1('R1-c').lines.some((l) => l.do === 'puzzle') && r1('R1-c').puzzle === 'P2');
  assert.ok(r1('R1-c').lines.some((l) => l.who === 'duty'), 'R1-c 도입부에 당직 첫 만남(D7)');
  const dos = r1('R1-d').lines.filter((l) => l.do).map((l) => `${l.do}:${l.id}`);
  assert.deepEqual(dos, ['look:gyuhaSpot', 'vanish:gyuhaR1d']);
  assert.ok(story.looks.gyuhaSpot && story.vanishes.gyuhaR1d);
  assert.equal(map.locate(...story.vanishes.gyuhaR1d.pos, story.vanishes.gyuhaR1d.level)?.id, '4F-duty', '연기 자리는 당직실 안');
  for (const id of ['R1-a', 'R1-b', 'R1-c', 'R1-d']) assert.ok(!r1(id).jumpscare, `${id} 는 점프스케어가 아니다`);
});

test('R1 점프스케어는 한 판 3개 이내 (E7 #1, R1-f #2)', () => {
  const route = (ev) => ev.routes.includes('R1');
  const n = story.events.filter((e) => route(e) && e.jumpscare).map((e) => `${e.id}#${e.jumpscare}`);
  assert.deepEqual(n, ['E7#1', 'R1-f#2']);
});

test('자동 진행 R1-a~R1-d: E8·E9·E10~E12 를 건너뛰고 구관 4층에서 연기 퇴장까지', () => {
  const w = world();
  assert.equal(w.runner.route, 'R1');
  solveR1b(w);
  assert.equal(w.runner.objectiveKey(), 'goDuty', 'R1-b 뒤 목표 = 구관 4층 당직실');
  // 신관 3층 복도·4층으로 나와도 E9 는 없다. 구관 현관 홀에 들러도 E10 은 없다
  w.at(4.6, -91.9, 2);
  w.at(10, -91.9, 3);
  w.at(16.5, -1, 0);
  assert.ok(!w.runner.busy, 'E9·E10 이 걸리지 않는다');
  solveR1c(w);
  assert.equal(w.runner.objectiveKey(), 'wait');
  w.tick();
  assert.equal(w.runner.event?.id, 'R1-d', '당직실에서 바로 R1-d');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'look', id: 'gyuhaSpot' });
  w.tick(story.looks.gyuhaSpot.time + 0.1);
  const [gx, gz] = story.looks.gyuhaSpot.at;
  assert.ok(Math.abs(w.me.yaw - yawTo(w.me.x, w.me.z, gx, gz)) < 1e-6, '{gyuha} 자리로 돌아봄');
  assert.deepEqual(w.runner.action, { do: 'vanish', id: 'gyuhaR1d' });
  w.tick(SCENE.vanish.time + 0.1);
  assert.notEqual(w.runner.action?.do, 'vanish', '연기가 다 흩어지면 다음 줄');
  w.play();
  assert.ok(w.runner.registry.done.has('R1-d'));
  assert.deepEqual(w.runner.registry.history, ['E7', 'R1-a', 'R1-b', 'R1-c', 'R1-d']);
  for (const id of ['E8', 'E9', 'E10', 'E11', 'E12']) assert.ok(!w.runner.registry.history.includes(id), `${id} 없음`);
  assert.equal(w.runner.route, 'R1', '끝까지 R1');
  assert.equal(w.runner.registry.nextId(w.runner.flags.values, w.runner.route), 'R1-e', '다음은 R1-e (단계 19)');
  w.tick(5);
  assert.ok(!w.runner.busy, 'R1-e 는 아직 자리 진입이 없다 (단계 19)');
});

test('검은 연기는 깜빡이지 않는다: 한 번 짙어졌다 옅어지기만 한다', () => {
  const w = world();
  solveR1b(w);
  solveR1c(w);
  w.tick();
  w.play();
  w.tick(story.looks.gyuhaSpot.time + SCENE.vanish.time + 0.5);
  const v = w.smoke;
  let turns = 0;
  let dir = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d);
    if (dir && s !== dir) turns++;
    dir = s;
  }
  assert.equal(turns, 1, `짙어졌다 옅어질 뿐 (방향 전환 ${turns}번)`);
  assert.ok(Math.max(...v) > 0.99 && v.at(-1) === 0);
});

test('R1-c: PB9 는 R1-c 부터, 옥상 조건도 R1-c 부터', () => {
  const w = world();
  const pb9 = powerbanks.find((b) => b.id === 'PB9');
  solveR1b(w);
  assert.ok(!bankOpen(pb9, seenBy(w.runner.registry)));
  assert.equal(roofReachable(w.runner.registry), false);
  w.at(22, -32, 3);
  assert.equal(w.runner.event?.id, 'R1-c');
  assert.ok(bankOpen(pb9, seenBy(w.runner.registry)), 'R1-c 시작 뒤 PB9 줍기 가능');
  assert.equal(roofReachable(w.runner.registry), true);
});

test('루트 회귀: earlyBook 이 없으면(R3) E7 뒤 E8 이 걸리고 R1 사건은 걸리지 않는다', () => {
  const w = world({ earlyBook: false });
  assert.equal(w.runner.route, 'R3');
  runE7(w);
  w.tick();
  assert.equal(w.runner.event?.id, 'E8');
  w.at(...mid('A3F-3'));
  w.tick();
  w.play();
  w.at(22, -32, 3);
  assert.ok(!w.runner.registry.history.some((id) => id.startsWith('R1')), 'R1 사건 없음');
});

test('체크포인트: R1-c P2 도중 저장 → 복원하면 같은 퍼즐 줄로 돌아온다', () => {
  const w = world();
  solveR1b(w);
  w.at(22, -32, 3);
  w.play();
  const snap = w.runner.snapshot();
  w.runner.reset();
  w.runner.restore(snap);
  assert.equal(w.runner.event?.id, 'R1-c');
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.runner.route, 'R1');
});
