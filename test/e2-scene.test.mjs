// 단계 12(2a): E1 → E2 자리 진입 → 추격 C1(실제 경로) → 숨기 P1 → {gyuha} 퇴장 → 흔적. 잡힘 → 체크포인트 복원 → 재시도 gap 증가.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { ChaseSession } from '../src/chase/session.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks } from '../src/puzzle/hooks.js';
import { E2Scene } from '../src/scene/e2.js';
import { ChasePath, PathProgress } from '../src/scene/path.js';
import { Hide } from '../src/scene/hide.js';
import { Traces } from '../src/scene/traces.js';
import { MapData } from '../src/world/mapData.js';
import { CHASE, PUZZLE, PLAYER } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { chases, puzzles } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const C1 = chases.find((c) => c.id === 'C1');
const P1 = puzzles.find((p) => p.id === 'P1');
const DT = 1 / 30;

// 화면 없이 E2 를 돌리는 세계: 플레이어 위치·라이트·문만 흉내 낸다
function world() {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const me = { x: 0, z: 12, level: 0 };
  const pose = { get: () => ({ ...me }), set: (p) => Object.assign(me, p) };
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => 0, pose });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { closed: false, forced: new Set(), roomClosed: () => doors.closed, setForced: (rooms, on) => rooms.forEach((r) => (on ? doors.forced.add(r) : doors.forced.delete(r))) };
  const phone = { lightOn: true };
  const toasts = [];
  const e2 = new E2Scene({
    runner, chase, puzzle, pose, where: () => ({ ...me }), doors, locate: (x, z, l) => map.locate(x, z, l),
    light: () => phone.lightOn, maxSpeed: PLAYER.run * 1.4, toast: (m) => toasts.push(m),
  });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate: (x, z, l) => map.locate(x, z, l) });
  const items = new Map();
  const traces = new Traces({ runner, defs: story.traces, interactions: { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) }, toast: (m) => toasts.push(m) });
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level);
      e2.update(DT);
      chase.update(DT);
      traces.update();
    }
  };
  // (x, z) 까지 speed m/s 로 곧게 걷는다
  const walk = (x, z, speed) => {
    for (let i = 0; i < 5000; i++) {
      const d = Math.hypot(x - me.x, z - me.z);
      if (d < 1e-6) return;
      const s = Math.min(d, speed * DT);
      me.x += ((x - me.x) / d) * s;
      me.z += ((z - me.z) / d) * s;
      tick();
    }
  };
  const talk = () => {
    for (let i = 0; i < 40 && runner.mode === 'line'; i++) {
      runner.advance();
      runner.advance();
    }
  };
  return { runner, me, chase, puzzle, doors, phone, e2, triggers, traces, items, toasts, tick, walk, talk };
}

// E1 을 끝내고 동쪽 복도의 E2 자리까지
function toE2(w) {
  w.runner.start('E1');
  w.talk();
  assert.ok(w.runner.registry.done.has('E1'));
  Object.assign(w.me, { x: 16.5, z: -14 });
  w.walk(16.5, -24, PLAYER.walk);
  assert.equal(w.runner.event?.id, 'E2', 'E1 뒤 동쪽 복도에서 E2');
  w.talk(); // {gyuha} 대사 → 자막(자동) → 추격
  for (let i = 0; i < 200 && w.runner.action?.do !== 'chase'; i++) w.tick();
  assert.equal(w.runner.action?.do, 'chase');
}

test('데이터: C1 경로 — 출발 → 모퉁이 28 m(지연 자리), 출발 → 1-2 서쪽 문 앞 약 45 m(pathLength), 목표 방 = P1 의 열린 방', () => {
  const path = new ChasePath(C1.path);
  assert.ok(Math.abs(path.project(16.5, -51.5) - C1.path.startAt - C1.delays[0].at) < 0.01);
  assert.ok(Math.abs(path.project(0.2, -51.5) - C1.path.startAt - C1.pathLength) < 1.5);
  assert.equal(C1.target, P1.hide.room);
  assert.ok(map.byId.get(P1.hide.room), 'map.json 에 열린 방');
  for (const r of P1.hide.lockedRooms) assert.equal(map.byId.get(r).level, 0, r);
  assert.equal(P1.hide.lockedRooms.length, 3, '1층 방 4개 중 잠긴 문 3개');
  const room = map.byId.get(P1.hide.room).rect;
  const [x0, z0, x1, z1] = P1.hide.spot;
  assert.ok(x0 >= room[0] && x1 <= room[2] && z0 >= room[1] && z1 <= room[3], '숨는 자리는 열린 방 안');
  const e2 = story.events.find((e) => e.id === 'E2');
  assert.deepEqual(e2.lines.filter((l) => l.do).map((l) => l.do), ['chase', 'puzzle']);
  assert.ok(story.objectives[e2.objectiveDone]);
});

test('경로 진행: 앞으로만 늘고, 뒤로 가거나 제자리면 0, 한 프레임에 건너뛰지 않는다', () => {
  const path = new ChasePath(C1.path);
  const pr = new PathProgress(path, 5);
  pr.begin(16.5, -23.5);
  assert.ok(Math.abs(pr.best - 17.5) < 1e-6);
  assert.ok(Math.abs(pr.update(16.5, -23.6, 0.1) - 1) < 1e-6);
  assert.equal(pr.update(16.5, -20, 0.1), 0, '뒤로');
  assert.equal(pr.update(16.5, -40, 0.1), 5, '순간이동은 상한까지만');
  const [x, z] = path.at(45.5 + 10);
  assert.deepEqual([+x.toFixed(2), +z.toFixed(2)], [6.5, -51.5]);
});

test('E2 끝까지: 추격 → 1-2 교실에 들어서면 도착 → 숨기(문·라이트·책상) → 그림자 통과 → {gyuha} 퇴장 → 흔적', () => {
  const w = world();
  toE2(w);
  assert.deepEqual([...w.doors.forced].sort(), [...P1.hide.lockedRooms].sort(), '추격 동안 다른 방 3개 잠김');
  // 달려서 모퉁이 → 북쪽 복도 → 1-2 동쪽 문 → 교실 안
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(6.3, -51.5, PLAYER.run);
  w.walk(6.3, -54.5, PLAYER.walk);
  assert.equal(w.chase.last?.outcome, 'exit', '목표 방에 들어서면 도착');
  assert.ok(w.chase.last.arrivalGap > CHASE.catchDistance);
  w.tick();
  assert.equal(w.runner.action?.do, 'puzzle');
  assert.equal(w.e2.hide.phase, 'prep');
  assert.equal(w.e2.hint, P1.hide.hints.door, '첫 안내 = 문 닫기');
  w.doors.closed = true;
  w.tick();
  assert.equal(w.e2.hint, P1.hide.hints.light, '다음 = 라이트 끄기');
  w.phone.lightOn = false;
  w.walk(2.5, -58, PLAYER.walk);
  w.tick();
  assert.equal(w.e2.hide.phase, 'pass', '세 조건을 맞추면 그림자가 지나간다');
  assert.equal(w.e2.ghost.mode, 'pass');
  w.tick(P1.hide.pass + 0.2);
  assert.equal(w.puzzle.last?.outcome, 'solved');
  assert.equal(w.doors.forced.size, 0, '숨기가 끝나면 잠금 해제');
  w.tick(3);
  w.talk();
  w.tick(5);
  assert.ok(w.runner.registry.done.has('E2'), 'E2 끝');
  assert.equal(w.runner.objective(), story.objectives.goFifth, '{gyuha} 퇴장 뒤 목표 문구가 바뀐다');
  assert.ok(w.traces.visible('gyuhaPhone') && w.items.has('trace:gyuhaPhone'), '현관 출구 문 앞에 떨어진 핸드폰');
  w.items.get('trace:gyuhaPhone').onUse();
  assert.match(w.toasts.at(-1), new RegExp(characters.gyuha.name));
  w.runner.reset();
  w.tick();
  assert.ok(!w.traces.visible('gyuhaPhone'), '스토리 초기화 뒤 흔적 없음');
});

test('추격 잡힘 → 추격 시작 지점으로 복원 → 재시도마다 시작 gap +2 m', () => {
  const w = world();
  toE2(w);
  const start = { ...w.me };
  assert.equal(w.chase.chase.startGap, C1.startGap);
  const until = (n) => {
    for (let i = 0; i < 30 / DT && w.chase.attemptOf('C1') < n; i++) w.tick();
  };
  w.walk(16.5, -30, PLAYER.walk);
  until(1); // 제자리에 서 있으면 잡힌다
  assert.equal(w.chase.attemptOf('C1'), 1);
  assert.equal(w.chase.chase.startGap, C1.startGap + CHASE.retryGapStep);
  assert.deepEqual([w.me.x, w.me.z], [start.x, start.z], '추격 시작 자리로');
  assert.equal(w.runner.action?.do, 'chase', '사건은 추격 줄에 머문다');
  until(2);
  assert.equal(w.chase.chase.startGap, C1.startGap + 2 * CHASE.retryGapStep);
});

test('숨기 실패(라이트를 켠 채) → 퍼즐 시작 지점으로 복원 → 다시 숨기', () => {
  const w = world();
  toE2(w);
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(6.3, -51.5, PLAYER.run);
  w.walk(6.3, -54.5, PLAYER.walk);
  w.tick();
  const at = { ...w.me };
  w.doors.closed = true;
  w.walk(2.5, -58, PLAYER.walk);
  w.tick(P1.hide.prep + 0.5);
  assert.equal(w.puzzle.attemptOf('P1'), 1);
  assert.equal(w.toasts.at(-1), P1.hide.hints.caught);
  assert.equal(w.runner.action?.do, 'puzzle');
  assert.equal(w.e2.hide.phase, 'prep', '숨기를 처음부터');
  assert.ok(Math.abs(w.me.x - at.x) < 0.05 && w.me.z < -53 && w.me.z > -54, `숨기 시작 자리(교실에 들어선 곳)로 ${w.me.x}, ${w.me.z}`);
  assert.deepEqual([...w.doors.forced].sort(), [...P1.hide.lockedRooms].sort());
  // 이번엔 제대로: 그림자가 지나가는 도중 라이트를 켜면 들킨다
  w.phone.lightOn = false;
  w.walk(2.5, -58, PLAYER.walk);
  w.tick(2);
  w.phone.lightOn = true;
  w.tick();
  assert.equal(w.puzzle.attemptOf('P1'), 2, '지나가는 동안 조건이 깨지면 잡힘');
});

test('숨기 규칙: 준비 시간 안에 조건 → 통과, 아니면 잡힘', () => {
  const h = new Hide(P1.hide);
  h.begin();
  const inSpot = { x: 2.5, z: -58, level: 0 };
  assert.equal(h.update(1, { roomClosed: true, lightOn: false, ...inSpot }), null);
  assert.equal(h.phase, 'pass');
  assert.equal(h.update(P1.hide.pass, { roomClosed: true, lightOn: false, ...inSpot }), 'hidden');
  h.begin();
  assert.equal(h.update(P1.hide.prep + 0.1, { roomClosed: true, lightOn: false, x: 6.3, z: -54, level: 0 }), 'caught', '문 바로 앞은 숨는 자리가 아님');
});

test('디버그로 시작한 추격(C 키)은 경로·E2 가 건드리지 않는다', () => {
  const w = world();
  w.chase.start('C1');
  w.tick(0.5);
  assert.equal(w.e2.path, null);
  assert.ok(w.chase.active);
});

// v1.26.1 사용자 제보: "귀신과 닿아도 안 죽음, 시간제임" · 귀신이 엉뚱한 곳에 보임
test('귀신은 플레이어 발자취를 따라온다: 되돌아가 귀신에 닿으면 gap 과 무관하게 바로 잡힌다', () => {
  const w = world();
  toE2(w);
  w.walk(16.5, -40, PLAYER.run); // 앞으로 달려 gap 을 벌린다
  const g = w.e2.ghost;
  assert.ok(g.z > w.me.z, '귀신은 등 뒤(남쪽)');
  assert.ok(Math.abs(g.x - 16.5) < 1, '귀신은 복도 위');
  assert.ok(w.chase.chase.gap > 5 * CHASE.catchDistance, `아직 멀다 (gap ${w.chase.chase.gap.toFixed(1)})`);
  // 귀신 쪽으로 되돌아 달린다 → 귀신과 마주쳐 잡힘 (예전엔 진행이 줄지 않아 귀신을 뚫고 지나갔다)
  const before = w.chase.attemptOf('C1');
  const timeOnly = (w.chase.chase.gap - CHASE.catchDistance) / C1.ghostSpeed; // 시간만으로 잡히는 데 걸리는 시간
  let t = 0;
  for (let i = 0; i < 200 && w.chase.attemptOf('C1') === before; i++, t += DT) {
    w.me.z += PLAYER.run * DT;
    w.tick();
  }
  assert.equal(w.chase.attemptOf('C1'), before + 1, '닿으면 잡힘');
  assert.ok(t < timeOnly * 0.7, `마주쳐서 잡힘 (${t.toFixed(2)} s, 시간만이면 ${timeOnly.toFixed(2)} s)`);
  assert.equal(w.chase.last.outcome, 'caught');
  assert.ok(w.me.z < -20, '추격 시작 자리로 되돌아감');
});

test('귀신 자리: 경로에서 벗어나도 플레이어가 지나온 자리에 있고, 실제 거리 = 추격 gap 이하', () => {
  const w = world();
  toE2(w);
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(10, -51.5, PLAYER.run);
  w.walk(10, -50, PLAYER.walk); // 북쪽 복도 안쪽 벽 쪽으로 비켜 섬
  const g = w.e2.ghost;
  const d = Math.hypot(g.x - w.me.x, g.z - w.me.z);
  assert.ok(d <= w.chase.chase.gap + 1e-6, `직선 거리 ${d.toFixed(2)} ≤ gap ${w.chase.chase.gap.toFixed(2)}`);
  // 발자취 위: 동쪽 복도(x ≈ 16.5) 또는 북쪽 복도(z ≈ −51.5) 위
  assert.ok(Math.abs(g.x - 16.5) < 0.6 || Math.abs(g.z + 51.5) < 2.2, `귀신 (${g.x.toFixed(1)}, ${g.z.toFixed(1)})`);
});
