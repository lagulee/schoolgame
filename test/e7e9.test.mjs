// 단계 14(3): E7 야자 교실 → 정전 → 배전반 → 점프스케어 #1 → 일행 분리, E8 P3 교실 수색(틀린 교실 연기·끌려 나옴) → {gyuha}·{mingeon} 만남,
// E9 4층 {dohyeon} 책 (earlyBook 이면 생략). 화면 없이 StoryRunner + 실제 E2Scene(퍼즐 시작·다음 줄)·StorySteps·P3Search 를 돌린다.
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
import { P3Search, footprintPoints } from '../src/scene/p3.js';
import { MapData } from '../src/world/mapData.js';
import { bankOpen, seenBy } from '../src/phone/bank.js';
import { CHASE, PUZZLE, PLAYER, SCENE } from '../src/config.js';
import { openWorld, distances, POINTS } from './mapWorld.mjs';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { chases, puzzles, powerbanks } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const P3 = puzzles.find((p) => p.id === 'P3');
const S = P3.search;
const DT = 1 / 30;
const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
const ev = (id, route = 'R3') => story.events.find((e) => e.id === id && e.routes.includes(route));
const mid = (id) => {
  const r = map.resolve(id);
  const [a, b, c, d] = r.item.rect;
  return [(a + c) / 2, (b + d) / 2, r.level];
};

// E6 까지 끝난 판. earlyBook = 4층 책을 미리 챙긴 판(R1)
function world({ earlyBook = false } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) runner.registry.done.add(id);
  runner.registry.last = 'E6';
  if (earlyBook) runner.flags.set('earlyBook', true);
  const me = { x: 10, z: -91.9, level: 1, yaw: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: 0 }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => 0, pose });
  const hooks = new GhostHooks();
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => true, maxSpeed: PLAYER.run * 1.4 });
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) };
  const toasts = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE });
  const p3 = new P3Search({ runner, puzzle, pose, where, locate, interactions, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.p3 });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  let knocks = 0;
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level);
      e2.update(DT);
      steps.update(DT);
      if (p3.update(DT)) knocks++;
    }
  };
  const at = (x, z, level = me.level) => {
    Object.assign(me, { x, z, level });
    tick();
  };
  // 대화(dialog)는 E 로 넘기고 자막은 시간으로. 행동 줄에 닿거나 사건이 끝나면 멈춘다
  const play = (limit = 30) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  return { runner, me, puzzle, hooks, steps, p3, items, toasts, tick, at, play, knocks: () => knocks };
}

// E7: 야자 교실 → 정전 → 배전반 → 점프스케어 → 분리
function runE7(w) {
  const { runner, steps } = w;
  w.at(...mid('A2F-3'));
  assert.equal(runner.event?.id, 'E7', '야자 교실에 들어서면 E7');
  assert.equal(steps.powerOut, false, '정전 전');
  w.play();
  assert.equal(steps.powerOut, true, 'blackout 줄 → 정전');
  assert.deepEqual(runner.action, { do: 'reach', id: 'switchboard' });
  w.tick(3);
  assert.equal(runner.action?.do, 'reach', '배전반에 가기 전엔 기다린다');
  w.at(-9, -91.2, 1);
  assert.equal(runner.action?.do, 'scare', '배전반 앞 → 점프스케어');
  assert.ok(steps.scare, '점프스케어 진행 중');
  w.tick(SCARE * 0.5);
  assert.equal(runner.action?.do, 'scare');
  w.tick(SCARE * 0.6);
  assert.notEqual(runner.action?.do, 'scare', '끝나면 다음 줄');
  w.play();
  assert.ok(runner.registry.done.has('E7'));
  w.tick(); // 배전반 앞 = 신관 2층 복도 → (R3·R2) E8 자리 진입
}

// P3 단서를 순서대로: 소지품 → 발자국 → 노크
function gatherClues(w) {
  const { puzzle, items } = w;
  assert.ok(items.has('p3:belongings'), '3-5 교실에 가방 살펴보기');
  items.get('p3:belongings').onUse();
  assert.deepEqual(puzzle.puzzle.got, ['belongings']);
  assert.equal(w.p3.printsVisible, true, '소지품 뒤 발자국이 보인다');
  w.at(-10.4, -91.6, 1);
  assert.deepEqual(puzzle.puzzle.got, ['belongings', 'footprints']);
  w.at(-12.4, -91.9, 2);
  w.tick(1);
  assert.ok(w.knocks() > 0, '발자국 뒤 노크가 들린다');
  w.at(4.6, -91.9, 2);
  assert.deepEqual(puzzle.puzzle.got, ['belongings', 'footprints', 'knock']);
}

test('데이터: E7~E9 자리 진입·행동 줄, 점프스케어 J1 = E7 #1, P3 정답·틀린 교실', () => {
  for (const id of ['E7', 'E8', 'E9']) assert.ok(story.triggers.some((t) => t.event === id), id);
  const E7 = ev('E7');
  const dos = E7.lines.filter((l) => l.do).map((l) => l.do);
  assert.deepEqual(dos, ['blackout', 'reach', 'scare']);
  for (const l of E7.lines.filter((x) => x.do === 'reach')) assert.ok(story.reaches[l.id], l.id);
  for (const l of E7.lines.filter((x) => x.do === 'scare')) assert.equal(story.scares[l.id].n, E7.jumpscare, '점프스케어 번호');
  // 점프스케어 정의는 사건의 jumpscare 번호와 하나씩 맞고, 한 판 3개 이내
  for (const [id, sc] of Object.entries(story.scares).filter(([k]) => k !== '_comment')) assert.equal(story.events.find((e) => e.id === sc.event)?.jumpscare, sc.n, id);
  assert.ok(ev('E8').lines.some((l) => l.do === 'puzzle') && ev('E8').puzzle === 'P3');
  assert.ok(ev('E9').lines.some((l) => l.do === 'take' && story.pickups.some((p) => p.id === l.id)));
  assert.equal(ev('E9').skipIf, 'earlyBook');
  // P3: 교실 4개 (2층 2 + 3층 2), 정답은 3층, 틀린 교실마다 끌려 나갈 복도 자리
  assert.equal(S.rooms.length, 4);
  assert.deepEqual(S.rooms.map((r) => map.resolve(r).level).sort(), [1, 1, 2, 2]);
  assert.ok(S.rooms.includes(P3.answer) && !S.wrong.includes(P3.answer));
  for (const r of S.wrong) {
    assert.ok(S.rooms.includes(r));
    const [x, z] = S.pullTo[r];
    assert.equal(map.locate(x, z, map.resolve(r).level)?.id, 'AC', `${r} 끌려 나오는 곳은 복도`);
  }
  assert.equal(map.locate(...S.belongings.pos, S.belongings.level)?.id, 'A2F-1', '소지품은 3-5 교실');
  assert.equal(map.locate(...S.knock.pos.map((v, i) => (i === 1 ? v - 0.6 : v)), S.knock.level)?.id, 'AC', '노크는 복도에서 듣는 문');
  // 1회차 목표는 정답 교실을 알려 주지 않는다
  assert.doesNotMatch(story.objectives[ev('E8').objective], /3-10|3층/);
});

test('소지품·발자국 자리: 걸어서 닿고, 발자국은 2층·3층 복도 위', () => {
  const w = openWorld();
  const d = distances(w, POINTS.yaja);
  assert.ok(d.near(S.belongings.pos[0], S.belongings.pos[1], S.belongings.level, 1.2), '가방 1.2 m 안에 설 수 있다');
  const prints = footprintPoints(S.footprints);
  assert.ok(prints.length > 20);
  for (const [x, z, lv] of prints) {
    const id = map.locate(x, z, lv)?.id;
    assert.ok(['AC', 'AS1', 'A2F-1'].includes(id), `${x.toFixed(1)},${z.toFixed(1)} ${lv} → ${id}`);
  }
});

test('R3: E7~E9 자동 진행 — 정전·점프스케어 → P3(단서 순서) → 만남 → 4층 책, PB8 은 E8 부터', () => {
  const w = world();
  const seen = seenBy(w.runner.registry);
  const pb8 = powerbanks.find((b) => b.id === 'PB8');
  assert.ok(!bankOpen(pb8, seen));
  runE7(w);
  assert.equal(w.runner.event?.id, 'E8', '신관 2층 복도 → E8');
  assert.ok(bankOpen(pb8, seen), 'PB8 은 E8 부터');
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P3', 'P3 시작');
  assert.equal(w.runner.objectiveKey(), 'findFriends');
  gatherClues(w);
  w.at(...mid('A3F-3'));
  assert.equal(w.puzzle.last?.outcome, 'solved', '3-10 → 성공');
  w.tick();
  w.play();
  assert.ok(w.runner.registry.done.has('E8'));
  assert.equal(w.runner.objectiveKey(), 'dohyeonBook');
  w.at(10, -91.9, 2); // 3층 복도로 나오면 E9
  assert.equal(w.runner.event?.id, 'E9');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'take', id: 'dohyeonBookE9' });
  assert.ok(w.steps.take('dohyeonBookE9'), '4층 2-10 책상 위 책');
  w.play();
  assert.ok(w.runner.registry.done.has('E9'));
  assert.equal(w.runner.objectiveKey(), 'goOld');
  assert.equal(w.runner.route, 'R3');
  assert.equal(w.runner.registry.nextId(w.runner.flags.values, w.runner.route), 'E10');
});

test('정답 교실은 단서를 다 모으지 않아도 들어가면 성공', () => {
  const w = world();
  runE7(w);
  w.play();
  w.at(...mid('A3F-3'));
  assert.equal(w.puzzle.last?.outcome, 'solved');
});

test('R1(earlyBook): E7 은 같고, E8 대신 R1-a 가 걸리며 E9 는 생략된다 (단계 18)', () => {
  const w = world({ earlyBook: true });
  assert.equal(w.runner.route, 'R1');
  runE7(w);
  assert.ok(w.runner.registry.history.includes('R1-a'), 'R1 에는 E8 이 없고, 같은 자리에서 R1-a(책 건네기)가 시작된다');
  assert.ok(!w.runner.registry.history.includes('E8'));
  assert.ok(!w.runner.registry.isAvailable('E9', w.runner.flags.values, w.runner.route), 'E9 생략');
});

test('P3 틀린 교실: 연기 → 끌려 나옴(틀림 1회), 3번이면 실패 → 퍼즐 시작 지점으로 복원', () => {
  const w = world();
  runE7(w);
  w.play();
  const start = { x: w.me.x, z: w.me.z };
  w.items.get('p3:belongings').onUse();
  const wrongIn = (room) => {
    w.at(...mid(room));
    assert.equal(w.p3.pull?.room, room, `${room} 틀린 교실 연출`);
    w.tick(SCENE.p3.pullAfter + 0.1);
    assert.equal(w.p3.pull, null);
  };
  wrongIn('A2F-2');
  assert.equal(w.puzzle.puzzle.wrong, 1);
  assert.equal(map.locate(w.me.x, w.me.z, w.me.level)?.id, 'AC', '복도로 끌려 나옴');
  assert.ok(w.toasts.some((t) => t.includes('끌어냈다')));
  const shows = [];
  w.at(...mid('A2F-2'));
  shows.push(w.p3.pull.show);
  w.tick(SCENE.p3.pullAfter + 0.1);
  assert.equal(w.puzzle.puzzle.wrong, 2);
  w.at(-12.4, -91.9, 2);
  w.at(...mid('A3F-2'));
  shows.push(w.p3.pull.show);
  assert.notEqual(shows[0], shows[1], '같은 연출을 잇달아 쓰지 않는다');
  w.tick(SCENE.p3.pullAfter + 0.1);
  // 3번째 → 실패 → 퍼즐 시작 체크포인트 (단서 0·틀림 0·시작 자리)
  assert.equal(w.puzzle.attemptOf('P3'), 1);
  assert.equal(w.puzzle.last?.outcome, 'failed');
  assert.equal(w.puzzle.puzzle?.id, 'P3', '같은 퍼즐 다시');
  assert.equal(w.puzzle.puzzle.wrong, 0);
  assert.deepEqual(w.puzzle.puzzle.got, []);
  assert.deepEqual({ x: w.me.x, z: w.me.z }, start, '퍼즐 시작 자리');
  assert.equal(w.runner.action?.do, 'puzzle');
  assert.equal(w.runner.event?.id, 'E8');
  w.tick();
  assert.ok(w.items.has('p3:belongings'), '가방 살펴보기가 다시 생긴다');
  assert.equal(w.steps.powerOut, true, '정전은 그대로');
  // 다시 풀 수 있다
  w.at(...mid('A3F-3'));
  assert.equal(w.puzzle.last?.outcome, 'solved');
});

test('정전: 스토리 초기화 → 불이 다시 켜진 상태, 점프스케어 도중 체크포인트 복원 → 처음부터 다시', () => {
  const w = world();
  w.at(...mid('A2F-3'));
  w.play();
  assert.equal(w.steps.powerOut, true);
  w.at(-9, -91.2, 1);
  const snap = w.runner.snapshot();
  w.tick(SCARE * 0.8);
  w.runner.restore(snap);
  w.tick();
  assert.equal(w.runner.action?.do, 'scare');
  assert.ok(w.steps.scare.t < 0.1, '점프스케어가 처음부터');
  w.runner.reset();
  w.tick();
  assert.equal(w.steps.powerOut, false);
  assert.equal(w.steps.scare, null);
});

test('P3: 틀린 교실마다 미리 서 있는 귀신 자리가 있다', async () => {
  const { readFileSync } = await import('node:fs');
  const S = JSON.parse(readFileSync(new URL('../data/puzzles.json', import.meta.url), 'utf8')).puzzles.find((p) => p.id === 'P3').search;
  for (const room of S.wrong) assert.ok(S.standing[room]?.pos && S.standing[room].level != null, `${room} 서 있는 귀신`);
});
