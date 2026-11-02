// 단계 15(4a): E10 구관 현관 홀 → 추격 C2(실제 1층 경로) → 점프스케어 #2 → 기절·각성(구관 4층) → E11 P2 당직실 단서 3개(귀신 90초 이상 간격)
// → E12 선택지(10초, 무응답 = 남는다 / 따라간다 = dutyCompanion). 화면 없이 StoryRunner + 실제 E2Scene·StorySteps·Faint·P2Duty 를 돌린다.
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
import { Faint } from '../src/scene/faint.js';
import { P2Duty } from '../src/scene/p2.js';
import { MapData } from '../src/world/mapData.js';
import { bankOpen, seenBy } from '../src/phone/bank.js';
import { roofReachable, canEnterRoof } from '../src/story/roof.js';
import { CHASE, PUZZLE, PLAYER, SCENE } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { chases, puzzles, powerbanks } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const C2 = chases.find((c) => c.id === 'C2');
const P2 = puzzles.find((p) => p.id === 'P2');
const DT = 1 / 30;
const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;

// E9 까지 끝난 판 (R3). 플레이어는 구관 현관 홀 바깥(현관 유리문 앞)
function world() {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9']) runner.registry.done.add(id);
  runner.registry.last = 'E9';
  const me = { x: 10, z: -1, level: 0, yaw: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: 0 }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  let speed = 0;
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => speed, pose });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => true, maxSpeed: PLAYER.run * 1.4 });
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) };
  const toasts = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE });
  const faint = new Faint({ runner, story, pose, cfg: SCENE.faint });
  const p2 = new P2Duty({ runner, puzzle, interactions, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.duty });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  const veil = [];
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level);
      e2.update(DT);
      chase.update(DT);
      steps.update(DT);
      faint.update(DT);
      p2.update(DT);
      veil.push(faint.veil);
    }
  };
  // (x, z) 까지 v m/s 로 곧게 간다 (이동 속도를 추격에 알린다)
  const walk = (x, z, v) => {
    const tries = chase.attemptOf('C2');
    for (let i = 0; i < 4000 && Math.hypot(x - me.x, z - me.z) > 1e-6; i++) {
      const d = Math.hypot(x - me.x, z - me.z);
      const s = Math.min(d, v * DT);
      me.x += ((x - me.x) / d) * s;
      me.z += ((z - me.z) / d) * s;
      speed = s / DT;
      tick();
      if (chase.attemptOf('C2') !== tries) break; // 잡혀서 시작 자리로 돌아왔다
    }
    speed = 0;
  };
  const play = (limit = 30) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  return { runner, me, chase, puzzle, steps, faint, p2, items, toasts, veil, tick, walk, play, triggers, setSpeed: (v) => (speed = v) };
}

// 현관 홀에 들어서서 추격 줄까지
function startE10(w) {
  w.me.x = 16.5;
  w.me.z = -1;
  w.tick();
  assert.equal(w.runner.event?.id, 'E10', '구관 현관 홀에 들어서면 E10');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'chase' });
  assert.equal(w.chase.chase.def.id, 'C2');
}

// 경로를 달려 끝까지 (현관 홀 → 동쪽 복도 북쪽 끝 → 북쪽 복도)
function runPath(w) {
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(5, -51.5, PLAYER.run);
}

test('데이터: C2 경로 = K7 확정 60 m, 점프스케어는 한 루트에 3개 이내, E10 점프스케어 번호 = J2', () => {
  assert.equal(C2.pathLength, 60);
  assert.deepEqual(C2.delays.map((d) => [d.at, d.seconds]), [[22, 3], [42, 1.5]]);
  const len = C2.path.points.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - C2.path.points[i][0], p[1] - C2.path.points[i][1]), 0);
  const rest = len - C2.path.startAt;
  assert.ok(rest >= C2.pathLength && rest <= C2.pathLength + 4, `경로 시작~끝 ${rest} m: 도착 거리(60 m)에 닿고 조금만 더 간다`);
  assert.equal(story.scares.J2.n, story.events.find((e) => e.id === 'E10').jumpscare);
  for (const route of ['R2', 'R3']) {
    const n = story.events.filter((e) => e.routes.includes(route) && e.jumpscare).length;
    assert.ok(n <= 3, `${route} 점프스케어 ${n}개`);
  }
  assert.equal(P2.answer, '47');
  assert.equal(P2.duty.ghosts.length, P2.clues.length, '귀신은 단서 수만큼');
  assert.ok(SCENE.duty.gap >= 90, 'P2 귀신 간격 90초 이상');
});

test('E10: 걷기만 하면 잡혀 시작 자리·gap +2 m 로 다시, 달리면 도착 → 점프스케어 #2 → 기절 → 구관 4층에서 깨어남', () => {
  const w = world();
  startE10(w);
  const gap0 = w.chase.chase.startGap;
  w.walk(16.5, -51.5, PLAYER.walk);
  assert.equal(w.chase.attemptOf('C2'), 1, '걷기만 하면 잡힌다');
  assert.equal(w.chase.chase.startGap, gap0 + CHASE.retryGapStep);
  assert.equal(w.runner.action?.do, 'chase', '사건은 추격 줄에 머문다');
  assert.ok(w.me.z > -5, '추격 시작 자리로 돌아왔다');
  runPath(w);
  assert.equal(w.chase.last?.outcome, 'exit', '달려서 도착');
  assert.ok(w.chase.last.arrivalGap > CHASE.catchDistance);
  for (let i = 0; i < 200 && w.runner.action?.do !== 'scare'; i++) w.tick(); // 자막 한 줄 뒤
  assert.equal(w.runner.action?.do, 'scare', '도착 → 점프스케어 #2');
  w.tick(SCARE + 0.2);
  assert.equal(w.runner.action?.do, 'faint', '점프스케어 뒤 기절');
  w.tick(SCENE.faint.out + 0.2);
  assert.equal(w.faint.phase, 'black');
  assert.deepEqual([w.me.x, w.me.z, w.me.level], [16.5, -31.5, 3], '어두운 동안 구관 4층으로 옮겨짐');
  assert.equal(w.faint.eyeDrop, SCENE.faint.eyeDrop, '누운 눈높이');
  w.tick(SCENE.faint.black + 0.2);
  assert.equal(w.faint.phase, 'in');
  assert.ok(w.faint.pitch > 0, '천장을 올려다본다');
  w.tick(SCENE.faint.in + 0.2);
  assert.equal(w.faint.active, false);
  assert.equal(w.faint.eyeDrop, 0);
  assert.ok(w.runner.registry.done.has('E10'));
  assert.equal(w.runner.event?.id, 'E11', '깨어난 자리에서 바로 E11');
});

test('기절 연출은 깜빡이지 않는다: 검은 막이 한 번 어두워지고 한 번 밝아지기만 한다', () => {
  const w = world();
  startE10(w);
  runPath(w);
  w.tick(SCARE + SCENE.faint.out + SCENE.faint.black + SCENE.faint.in + 1);
  const v = w.veil;
  let turns = 0;
  let dir = 0;
  let maxStep = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    maxStep = Math.max(maxStep, Math.abs(d));
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d);
    if (dir && s !== dir) turns++;
    dir = s;
  }
  assert.equal(turns, 1, `어두워졌다 밝아질 뿐 (방향 전환 ${turns}번)`);
  assert.equal(Math.max(...v), 1);
  assert.ok(maxStep * 30 < 1, '1초에 막이 다 바뀌는 급변이 없다');
  assert.ok(SCENE.faint.out >= 2 && SCENE.faint.in >= 3, '충분히 천천히');
});

// 깨어난 뒤 E11 대사까지
function wake(w) {
  startE10(w);
  runPath(w);
  w.tick(SCARE + SCENE.faint.out + SCENE.faint.black + SCENE.faint.in + 1);
  assert.equal(w.runner.event?.id, 'E11');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.puzzle.puzzle?.id, 'P2', 'P2 시작');
}

test('E11 P2: 단서 3개 + 귀신은 90초 이상 간격으로 3번, 모두 지난 뒤에 풀린다. PB9 는 E11 부터', () => {
  const w = world();
  const pb9 = powerbanks.find((b) => b.id === 'PB9');
  assert.ok(!bankOpen(pb9, seenBy(w.runner.registry)));
  wake(w);
  assert.ok(bankOpen(pb9, seenBy(w.runner.registry)), 'E11 시작 뒤 PB9 줍기 가능');
  assert.equal(w.runner.objectiveKey(), 'findClue');
  assert.deepEqual([...w.items.keys()].sort(), ['p2:blackboard', 'p2:calendar', 'p2:log'], '당직실 살펴보기 3개');
  assert.ok([...w.items.values()].every((it) => it.level === 3));
  w.items.get('p2:log').onUse();
  w.items.get('p2:log')?.onUse();
  w.tick();
  assert.deepEqual(w.puzzle.puzzle.got, ['log']);
  assert.equal(w.p2.ghost?.def, P2.duty.ghosts[0], '첫 단서 → 바로 첫 귀신');
  const t1 = w.p2.clock;
  w.items.get('p2:calendar').onUse();
  w.items.get('p2:blackboard').onUse();
  assert.ok(w.puzzle.puzzle.complete, '단서 3개');
  w.tick(30);
  assert.ok(w.p2.ghost === null, '첫 귀신은 사라졌다');
  assert.equal(w.p2.shown, 1, '간격이 안 차서 둘째 귀신은 아직');
  assert.equal(w.puzzle.puzzle?.id, 'P2', '귀신이 다 나타나기 전엔 안 풀린다');
  const appear = [t1];
  let last = w.p2.shown;
  for (let i = 0; i < 400 / DT && w.puzzle.active; i++) {
    w.tick();
    if (w.p2.shown !== last) {
      last = w.p2.shown;
      appear.push(w.p2.clock);
    }
  }
  assert.equal(appear.length, 3, '귀신은 정확히 3번');
  assert.ok(appear[1] - appear[0] >= SCENE.duty.gap - 0.1 && appear[2] - appear[1] >= SCENE.duty.gap - 0.1, `간격 ${appear.map((t, i) => (i ? (t - appear[i - 1]).toFixed(1) : 0))}`);
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick();
  w.play();
  assert.ok(w.runner.registry.done.has('E11'));
});

test('P2: 간격이 이미 찼으면 단서를 얻는 즉시 귀신 (천천히 모으는 판)', () => {
  const w = world();
  wake(w);
  w.items.get('p2:log').onUse();
  w.tick(SCENE.duty.gap + 1);
  assert.equal(w.p2.ghost, null);
  w.items.get('p2:calendar').onUse();
  w.tick(DT);
  assert.equal(w.p2.shown, 2, '간격이 찼으니 바로');
  assert.deepEqual(P2.duty.ghosts[0].cue !== P2.duty.ghosts[1].cue || P2.duty.ghosts[0].pos !== P2.duty.ghosts[1].pos, true, '같은 연출을 잇달아 쓰지 않는다');
});

// P2 를 풀고 E12 까지
function toE12(w) {
  wake(w);
  for (const id of ['log', 'calendar', 'blackboard']) w.items.get(`p2:${id}`).onUse();
  for (let i = 0; i < 400 / DT && w.puzzle.active; i++) w.tick();
  w.tick();
  w.play();
  w.me.x = 22;
  w.me.z = -32;
  w.tick();
  assert.equal(w.runner.event?.id, 'E12', '당직실 안에서 E12');
}

// E12 대사를 넘기고 선택지가 뜰 때까지
function toChoice(w) {
  for (let i = 0; i < 300 && w.runner.mode !== 'choice'; i++) {
    if (w.runner.mode === 'line') w.runner.advance();
    w.tick();
  }
  assert.equal(w.runner.mode, 'choice');
}

test('E12: 10초 무응답 = 남는다 → R3 유지, dutyCompanion 꺼짐', () => {
  const w = world();
  toE12(w);
  toChoice(w);
  assert.equal(w.runner.choice.def.timeout, 10);
  assert.equal(w.runner.choice.def.default, 'stay');
  w.tick(9);
  assert.equal(w.runner.mode, 'choice', '9초에는 아직');
  w.tick(1.2);
  assert.equal(w.runner.mode, 'idle');
  assert.equal(w.runner.choice, null);
  assert.equal(w.runner.flags.get('dutyCompanion'), false);
  assert.equal(w.runner.route, 'R3');
  assert.ok(w.runner.registry.done.has('E12'));
  assert.equal(w.runner.objectiveKey(), 'waitDuty');
});

test('E12: 따라간다 → dutyCompanion 켜짐, R2', () => {
  const w = world();
  toE12(w);
  toChoice(w);
  w.runner.moveSelection(-1);
  w.runner.choose();
  assert.equal(w.runner.flags.get('dutyCompanion'), true);
  assert.equal(w.runner.route, 'R2');
  assert.ok(w.runner.registry.done.has('E12'));
});

test('옥상 문 접근 조건: E11 이후에만 (R1 은 R1-c), 옥상 열쇠도 있어야 한다', () => {
  const w = world();
  assert.equal(roofReachable(w.runner.registry), false);
  w.runner.flags.set('hasRoofKey', true);
  assert.equal(canEnterRoof(w.runner), false, 'E11 전에는 불가');
  w.runner.registry.history.push('E11');
  assert.equal(canEnterRoof(w.runner), true);
  w.runner.flags.set('hasRoofKey', false);
  assert.equal(canEnterRoof(w.runner), false, '열쇠 없이는 불가');
  const r1 = world();
  r1.runner.registry.done.add('R1-c');
  assert.equal(roofReachable(r1.runner.registry), true);
});

test('earlyBook(R1) 판은 E10 이 걸리지 않는다', () => {
  const w = world();
  w.runner.flags.set('earlyBook', true);
  w.me.x = 16.5;
  w.me.z = -1;
  w.tick();
  assert.equal(w.runner.event, null);
});
