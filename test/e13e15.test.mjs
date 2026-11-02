// 단계 16(4b): E13 당직이 돌아오지 않음(45초 뒤) → P4 교무실 열쇠(틀린 열쇠 3번 = 잡힘) → E14 복도에서 {dohyeon} 이 먼저 죽음(점프스케어 #3)
// → 마지막 추격 C4(실제 경로, 40 m, 스태미나 가득) → E15 현관 유리문 앞에서 쓰러짐 = 엔딩 C(endingsSeen 에 C).
// 화면 없이 StoryRunner + 실제 E2Scene·StorySteps·Look·Collapse·P4Keys 를 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { ChaseSession } from '../src/chase/session.js';
import { simulate } from '../src/chase/sim.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks } from '../src/puzzle/hooks.js';
import { E2Scene } from '../src/scene/e2.js';
import { StorySteps } from '../src/scene/steps.js';
import { Look, Collapse } from '../src/scene/finale.js';
import { FinaleView } from '../src/scene/finaleView.js';
import { P4Keys } from '../src/scene/p4.js';
import { ChasePath } from '../src/scene/path.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { MapData } from '../src/world/mapData.js';
import { readFileSync } from 'node:fs';
import { CHASE, PUZZLE, PLAYER, SCENE, STAMINA, STORY } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI, memoryStorage } from './helpers.mjs';

const { story, characters } = loadStory();
const { chases, puzzles } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const C4 = chases.find((c) => c.id === 'C4');
const P2 = puzzles.find((p) => p.id === 'P2');
const P4 = puzzles.find((p) => p.id === 'P4');
const DT = 1 / 30;
const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
const ev = (id, route) => story.events.find((e) => e.id === id && e.routes.includes(route));

// E12 까지 끝난 판 (R3). 플레이어는 구관 4층 당직실 안
function world({ route = 'R3' } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12']) runner.registry.done.add(id);
  runner.registry.last = 'E12';
  if (route === 'R2') runner.flags.set('dutyCompanion', true);
  const me = { x: 22, z: -32, level: 3, yaw: -Math.PI / 2, pitch: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0, pitch: p.pitch ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  let speed = 0;
  const stamina = { resets: 0, reset() { this.resets++; } };
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => speed, pose, stamina });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => true, maxSpeed: PLAYER.run * 1.4 });
  const items = new Map();
  let refreshes = 0;
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id), refresh: () => refreshes++ };
  const toasts = [];
  const sounds = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE, sound: (d) => sounds.push(d) });
  const look = new Look({ runner, story, pose });
  const collapse = new Collapse({ runner, story, pose, cfg: SCENE.collapse });
  let lightOn = false;
  const p4 = new P4Keys({ runner, puzzle, pose, interactions, light: () => lightOn, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.p4 });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  const endings = new EndingsSeen('test', memoryStorage());
  runner.onEnding = (key) => endings.mark(key);
  const veil = [];
  const blood = [];
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level, DT);
      e2.update(DT);
      chase.update(DT);
      steps.update(DT);
      look.update(DT);
      collapse.update(DT);
      p4.update(DT);
      veil.push(collapse.veil);
      blood.push(collapse.blood);
    }
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
  const play = (limit = 30) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  return { runner, me, chase, puzzle, steps, look, collapse, p4, items, toasts, sounds, stamina, endings, veil, blood, tick, walk, play, triggers, e2, setLight: (v) => (lightOn = v), refreshes: () => refreshes };
}

// 당직실에서 기다리다 E13 → 교무실 열쇠 걸이 앞에서 P4 시작
function toP4(w) {
  w.tick(44);
  assert.equal(w.runner.event, null, '45초 전에는 E13 이 시작되지 않는다');
  w.tick(1.5);
  assert.equal(w.runner.event?.id, 'E13', 'E12 뒤 45초가 지나면 자리와 상관없이 E13');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' }, '교무실 열쇠 걸이 앞에 닿을 때까지 기다린다');
  w.tick(5);
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.me.x = 19.4;
  w.me.z = -45;
  w.me.level = 1;
  w.tick();
  w.play();
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.puzzle.puzzle?.id, 'P4', 'P4 시작');
  w.tick();
}

const wrongKeys = ['74', '41', '38', '71'];

test('데이터: P4 정답 = P2 번호표 47, 열쇠 5개 중 47 은 하나, 귀신 단계 = 틀릴 수 있는 횟수, 틀림 한도 3', () => {
  assert.equal(P4.answer, P2.answer);
  assert.equal(P4.wrongLimit, 3);
  assert.equal(P4.keys.hooks.length, 5);
  assert.equal(P4.keys.hooks.filter((h) => h.n === P4.answer).length, 1);
  assert.equal(P4.keys.ghost.steps.length, P4.wrongLimit, '단계 = 틀림 한도 직전까지');
  const dist = (p) => Math.hypot(p[0] - P4.keys.wall, p[1] - P4.keys.hooks[2].z);
  const ds = P4.keys.ghost.steps.map(dist);
  assert.ok(ds.every((d, i) => !i || d < ds[i - 1]), `귀신은 틀릴수록 가까워진다 ${ds.map((d) => d.toFixed(1))}`);
  assert.ok(P4.keys.ghost.caught && dist(P4.keys.ghost.caught) < 2);
});

test('데이터: R3 의 E13~E15 — 출구 열쇠는 E13 에서, 점프스케어 3개(J1~J3), E15 가 엔딩 C, 트리거는 R3 만', () => {
  assert.equal(ev('E13', 'R3').set.hasExitKey, true);
  assert.ok(!ev('E14', 'R3').set, 'E14 는 열쇠를 더 주지 않는다');
  assert.equal(ev('E15', 'R3').ending, 'C');
  assert.equal(story.endings.C.route, 'R3');
  assert.deepEqual(ev('E14', 'R3').finale, { companion: 'dohyeon', fleeing: ['player'], atExit: 'collapse' });
  const jn = story.events.filter((e) => e.routes.includes('R3') && e.jumpscare).map((e) => e.jumpscare);
  assert.deepEqual(jn, [1, 2, 3]);
  assert.equal(story.scares.J3.n, ev('E14', 'R3').jumpscare);
  for (const t of story.triggers.filter((t) => ['E13', 'E14', 'E15'].includes(t.event))) assert.deepEqual(t.routes, ['R3']);
  // 행동 줄이 가리키는 데이터가 모두 있다
  const lines = ['E13', 'E14', 'E15'].flatMap((id) => ev(id, 'R3').lines.filter((l) => l.do));
  for (const l of lines) {
    const table = { reach: 'reaches', scare: 'scares', look: 'looks', sound: 'sounds', collapse: 'collapses' }[l.do];
    if (table) assert.ok(story[table]?.[l.id], `${l.do} ${l.id}`);
  }
});

test('C4 경로: 시작(startAt) 뒤 40 m(=pathLength) 가 현관 유리문 앞 1.5 m 안, 끝은 2~3 m 더, 계단을 내려간다(층 1 → 0.5 → 0)', () => {
  const path = new ChasePath(C4.path);
  const start = C4.path.startAt;
  const [ax, az, al] = path.at(start + C4.pathLength);
  assert.ok(ax > 15 && ax < 18.2 && az > -3.4 && az < -2.0, `도착 자리 ${ax.toFixed(2)}, ${az.toFixed(2)} (유리문 x 15, z −2.7~0.7)`);
  assert.equal(al, 0);
  const rest = path.length - start;
  assert.ok(rest >= C4.pathLength + 1.5 && rest <= C4.pathLength + 4, `끝까지 ${rest.toFixed(1)} m`);
  assert.equal(path.at(start)[2], 1, '시작은 2층');
  assert.equal(path.at(start + 17)[2], 0.5, '계단참');
  // E14 트리거 자리가 경로 시작(startAt) 근처 (z −31 앞뒤 1 m)
  const t = story.triggers.find((x) => x.event === 'E14');
  const zs = path.at(start)[1];
  assert.ok(t.rect[1] <= zs + 1 && t.rect[3] >= zs - 1, `트리거 ${t.rect} / 경로 시작 z ${zs}`);
  assert.equal(C4.startGap, 3);
  assert.equal(C4.companionKillDelay, 4);
});

test('시뮬레이션 회귀 (C4, 40 m): 걷기 위주 실패, 평범 5.42 m, 최적 10.92 m', () => {
  const cfg = { chase: CHASE, stamina: STAMINA, player: PLAYER };
  const walkish = simulate(C4, CHASE.SIM.profiles.walkish, cfg);
  const normal = simulate(C4, CHASE.SIM.profiles.normal, cfg);
  const optimal = simulate(C4, CHASE.SIM.profiles.optimal, cfg);
  assert.equal(walkish.outcome, 'caught');
  assert.equal(normal.outcome, 'exit');
  assert.equal(optimal.outcome, 'exit');
  assert.ok(Math.abs(normal.arrivalGap - 5.42) < 0.05, `평범 ${normal.arrivalGap}`);
  assert.ok(Math.abs(optimal.arrivalGap - 10.92) < 0.05, `최적 ${optimal.arrivalGap}`);
  assert.ok(normal.arrivalGap >= 4.9 && optimal.arrivalGap <= 12);
});

test('E13: 45초 기다리면 시작 → 열쇠 걸이 앞에 닿으면 P4. R2(dutyCompanion)에서는 이 트리거가 걸리지 않는다', () => {
  const w = world();
  assert.equal(w.runner.objectiveKey(), 'waitDuty');
  toP4(w);
  assert.equal(w.runner.objectiveKey(), 'findExitKey');
  assert.deepEqual([...w.items.keys()].sort(), ['p4:key:38', 'p4:key:41', 'p4:key:47', 'p4:key:71', 'p4:key:74'], '열쇠 5개 살펴보기');
  assert.ok([...w.items.values()].every((it) => it.level === 1));
  const r2 = world({ route: 'R2' });
  r2.tick(200);
  assert.equal(r2.runner.event, null, 'R2 의 E13 은 단계 17');
});

test('P4: 라이트가 꺼져 있으면 번호표를 못 읽고, 켜면 읽혀서 라벨이 바뀐다', () => {
  const w = world();
  toP4(w);
  const key = w.items.get('p4:key:47');
  assert.match(key.label, /읽을 수 없다/);
  key.onUse();
  assert.match(w.toasts.at(-1), /라이트/);
  assert.equal(w.puzzle.puzzle.wrong, 0, '읽지 못했으니 틀림이 아니다');
  w.setLight(true);
  w.tick();
  assert.match(key.label, /47번/);
  assert.ok(w.refreshes() >= 1, '안내 문구를 다시 쓰라고 알린다');
});

test('P4: 틀린 열쇠마다 귀신이 한 걸음씩 다가오고, 3번 틀리면 잡혀 퍼즐 시작 자리·틀림 0 으로 돌아간다', () => {
  const w = world();
  toP4(w);
  w.setLight(true);
  w.tick(P4.keys.ghost.fadeIn + 0.5);
  const rack = P4.keys.hooks[2];
  const dist = () => Math.hypot(w.p4.ghost.x - P4.keys.wall, w.p4.ghost.z - rack.z);
  const d0 = dist();
  const start = { x: w.me.x, z: w.me.z };
  let prev = d0;
  for (let i = 0; i < 2; i++) {
    w.items.get(`p4:key:${wrongKeys[i]}`).onUse();
    assert.equal(w.puzzle.puzzle.wrong, i + 1);
    assert.equal(w.p4.events.at(-1)?.kind, 'wrong', '틀리면 소리');
    w.tick(5);
    assert.ok(dist() < prev - 1, `${i + 1}번 틀림 → 가까워짐 (${prev.toFixed(1)} → ${dist().toFixed(1)})`);
    prev = dist();
  }
  w.me.x = 18.8;
  w.me.z = -43.6;
  w.items.get(`p4:key:${wrongKeys[2]}`).onUse();
  assert.equal(w.puzzle.attemptOf('P4'), 1, '세 번째 틀림 = 잡힘');
  assert.equal(w.p4.events.at(-1)?.kind, 'caught');
  assert.equal(w.puzzle.puzzle.wrong, 0, '새 퍼즐');
  assert.deepEqual([w.me.x, w.me.z], [start.x, start.z], '퍼즐 시작 자리로');
  assert.equal(w.runner.action?.do, 'puzzle', '사건은 퍼즐 줄에 머문다');
  w.tick();
  assert.equal(w.p4.ghost.alpha < 0.5, true, '귀신도 처음으로');
});

// 47번을 꽂아 풀고 E13 이 끝날 때까지
function solve(w) {
  w.setLight(true);
  w.tick();
  w.items.get('p4:key:47').onUse();
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick();
  w.play();
}

test('P4 해결 → 출구 열쇠(hasExitKey) → E13 끝, 목표 = 열쇠를 들고 현관으로', () => {
  const w = world();
  toP4(w);
  assert.equal(w.runner.flags.get('hasExitKey'), false);
  solve(w);
  assert.ok(w.runner.registry.done.has('E13'));
  assert.equal(w.runner.flags.get('hasExitKey'), true);
  assert.equal(w.runner.objectiveKey(), 'runExit');
});

// E13 을 끝내고 2층 동쪽 복도로 (E14 트리거 자리 직전)
function toCorridor(w) {
  toP4(w);
  solve(w);
  w.me.x = 16.5;
  w.me.z = -36;
  w.tick();
  assert.equal(w.runner.event, null, '복도 위쪽에서는 아직');
}

// E14 가 시작돼 추격 줄까지
function startE14(w) {
  w.me.z = -31.2;
  w.tick();
  assert.equal(w.runner.event?.id, 'E14');
  w.me.yaw = Math.PI; // 남쪽(계단 쪽)으로 걷던 중
  for (let i = 0; i < 400 && w.runner.action?.do !== 'chase'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.deepEqual(w.runner.action, { do: 'chase' });
}

test('E14: 복도에서 등 뒤 쿵 → 북쪽을 돌아봄 → 점프스케어 #3 → 비명 소리 → 남쪽으로 돌아섬 → 추격 C4 시작(스태미나 가득, 처리 4초)', () => {
  const w = world();
  toCorridor(w);
  const seen = [];
  w.me.z = -31.2;
  w.tick();
  assert.equal(w.runner.event?.id, 'E14');
  w.me.yaw = Math.PI;
  for (let i = 0; i < 600 && w.runner.action?.do !== 'chase'; i++) {
    const a = w.runner.action?.do ? `${w.runner.action.do}${w.runner.action.id ? `:${w.runner.action.id}` : ''}` : null;
    if (a && seen.at(-1) !== a) seen.push(a);
    if (a === 'look:north' && w.look.t > 0.4) assert.ok(Math.abs(w.me.yaw) < 0.2 || Math.abs(w.me.yaw - 2 * Math.PI) < 0.2, '북쪽(0)으로 돌아봄');
    w.tick();
  }
  // 소리 줄은 같은 프레임에 바로 지나가서 순서만 본다
  assert.deepEqual(seen.filter((a) => !a.startsWith('sound')), ['look:north', 'scare:J3', 'look:south']);
  assert.deepEqual(w.sounds.map((s) => s.kind), ['bang', 'sting'], '등 뒤 쿵 → 날카로운 소리');
  assert.ok(Math.abs(Math.abs(w.me.yaw) - Math.PI) < 0.1, `다시 남쪽 ${w.me.yaw}`);
  assert.equal(w.chase.current.id, 'C4');
  assert.equal(w.chase.current.atExit, 'collapse', '출구에서 쓰러짐 결과');
  assert.equal(w.stamina.resets, 1, '마지막 추격 = 스태미나 가득');
  assert.equal(w.chase.chase.phase, 'kill', '{dohyeon} 처리 4초 = 귀신 정지');
  assert.equal(w.chase.chase.startGap, 3);
  assert.equal(w.runner.objectiveKey(), 'runExit');
});

// 곧게 달려 경로 끝까지 (경로 점을 따라)
function runRoute(w, v = PLAYER.run) {
  const tries = () => w.chase.attemptOf('C4', 'collapse');
  const t0 = tries();
  for (const [x, z, l] of C4.path.points.slice(2)) {
    w.me.level = l;
    w.walk(x, z, v, tries);
    if (!w.chase.active || tries() !== t0) break; // 도착했거나 잡혔다
  }
  if (w.chase.active && tries() === t0) w.tick(C4.unlockTime + 0.3); // 출구를 여는 1초 (조작 불가)
}

test('C4: 걷기만 하면 잡혀 시작 자리·gap +2 m 로 다시, 달리면 도착(gap 4.9 m 이상) → 출구 1초 → exit', () => {
  const w = world();
  toCorridor(w);
  startE14(w);
  const gap0 = w.chase.chase.startGap;
  const startPose = { x: w.me.x, z: w.me.z, level: w.me.level };
  runRoute(w, PLAYER.walk);
  assert.equal(w.chase.attemptOf('C4', 'collapse'), 1, '걷기만 하면 잡힌다');
  assert.equal(w.chase.chase.startGap, gap0 + CHASE.retryGapStep, '재시도 gap +2 m');
  assert.deepEqual([w.me.x, w.me.z, w.me.level], [startPose.x, startPose.z, startPose.level], '추격 시작 자리로');
  assert.equal(w.runner.action?.do, 'chase', '사건은 추격 줄에 머문다');
  runRoute(w);
  assert.equal(w.chase.last?.outcome, 'exit', `달려서 도착 (${w.chase.last?.outcome})`);
  assert.equal(w.chase.last.finale, 'collapse');
  assert.ok(w.chase.last.arrivalGap >= 4.9, `도착 거리 ${w.chase.last.arrivalGap.toFixed(1)} m`);
  assert.ok(w.me.x > 15 && w.me.z > -3.6 && w.me.z < -1.5, `유리문 앞 ${w.me.x.toFixed(1)}, ${w.me.z.toFixed(1)}`);
});

test('E15: 도착하면 E14 가 끝나고 유리문 앞에서 E15 → 문 쪽으로 돌아섬 → 주저앉음·붉은 막 → 암전 → 엔딩 C 카드, endingsSeen 에 C', () => {
  const w = world();
  toCorridor(w);
  startE14(w);
  runRoute(w);
  assert.ok(w.runner.registry.done.has('E14'));
  w.tick();
  assert.equal(w.runner.event?.id, 'E15', '현관 유리문 앞에서 E15');
  assert.deepEqual(w.endings.list(), []);
  for (let i = 0; i < 200 && w.runner.action?.do !== 'collapse'; i++) w.tick();
  assert.deepEqual(w.runner.action, { do: 'collapse', id: 'door' });
  const C = SCENE.collapse;
  w.tick(C.turn + 0.1);
  assert.equal(w.collapse.phase, 'sag');
  const yaw = Math.atan2(-(15 - w.me.x), -(-1 - w.me.z));
  assert.ok(Math.abs(Math.sin(w.me.yaw - yaw)) < 0.05, '현관 문 쪽을 본다');
  w.tick(C.sag / 2);
  assert.ok(w.collapse.blood > 0 && w.collapse.blood < C.blood, '붉은 막이 번지는 중');
  assert.ok(w.collapse.eyeDrop > 0 && w.collapse.pitch < 0, '주저앉으며 고개가 숙는다');
  assert.equal(w.collapse.veil, 0);
  w.tick(C.sag);
  assert.equal(w.collapse.phase, 'dark');
  w.tick(C.dark - 1.9 + 0.1);
  assert.equal(w.collapse.veil, 1, '암전');
  assert.equal(w.collapse.phase, 'hold');
  assert.equal(w.runner.mode, 'action');
  w.tick(C.hold + 0.2);
  assert.equal(w.runner.mode, 'ending', '사건이 끝나며 엔딩 카드');
  assert.equal(w.runner.ui.shown?.style, 'ending');
  assert.match(w.runner.ui.shown.text, /쓰러/);
  assert.deepEqual(w.endings.list(), ['C'], 'endingsSeen 에 C');
  assert.ok(w.runner.registry.done.has('E15'));
  assert.equal(w.collapse.veil, 1, '카드가 떠 있는 동안 암전 그대로');
  w.runner.advance();
  w.tick(C.recover + 0.5);
  assert.equal(w.collapse.active, false, '카드를 닫으면 천천히 돌아온다');
  assert.equal(w.collapse.veil, 0);
});

test('붉은 화면·암전은 깜빡이지 않는다: 막이 한 방향으로만 변하고 초당 3회 미만(0회), 급변 없음', () => {
  const w = world();
  toCorridor(w);
  startE14(w);
  runRoute(w);
  w.tick();
  const from = w.veil.length;
  const C = SCENE.collapse;
  w.tick(C.turn + C.sag + C.dark + C.hold + 1);
  for (const [name, series] of [['붉은 막', w.blood.slice(from)], ['검은 막', w.veil.slice(from)]]) {
    let turns = 0;
    let dir = 0;
    let maxStep = 0;
    for (let i = 1; i < series.length; i++) {
      const d = series[i] - series[i - 1];
      maxStep = Math.max(maxStep, Math.abs(d));
      if (Math.abs(d) < 1e-9) continue;
      const s = Math.sign(d);
      if (dir && s !== dir) turns++;
      dir = s;
    }
    assert.equal(turns, 0, `${name}: 줄었다 늘었다 하지 않는다 (방향 전환 ${turns}번)`);
    assert.ok(maxStep * 30 < 1, `${name}: 1초에 막이 다 바뀌는 급변 없음 (${(maxStep * 30).toFixed(2)}/s)`);
  }
  assert.ok(Math.max(...w.blood) <= SCENE.collapse.blood && SCENE.collapse.blood < 0.9);
  assert.ok(C.sag >= 3 && C.dark >= 2, '충분히 천천히');
});

test('마지막 장면 화면: E14 는 추격 줄 앞까지, E15 는 쓰러짐 줄 앞까지 조작이 멈추고, 추격 중에는 풀린다', () => {
  const w = world();
  const dom = () => ({ style: {} });
  const player = { frozen: false, eyeDrop: 0, pos: { x: 0, z: 0 } };
  const camera = { rotation: {} };
  const view = new FinaleView({ runner: w.runner, look: w.look, collapse: w.collapse, player, camera, audio: { started: false }, bloodEl: dom(), veilEl: dom(), threatEl: dom() });
  const frozen = () => {
    player.frozen = false;
    view.update();
    return player.frozen;
  };
  assert.equal(frozen(), false, '평소엔 조작 가능');
  toCorridor(w);
  assert.equal(frozen(), false);
  w.me.z = -31.2;
  w.tick();
  assert.equal(w.runner.event?.id, 'E14');
  assert.equal(frozen(), true, 'E14 시작 = 조작 정지(추격 시작 자리를 지킨다)');
  for (let i = 0; i < 600 && w.runner.action?.do !== 'chase'; i++) {
    assert.equal(frozen(), true, `${w.runner.action?.do ?? 'line'} 동안 정지`);
    w.tick();
  }
  assert.equal(frozen(), false, '추격이 시작되면 조작 가능');
  w.me.yaw = Math.PI;
  runRoute(w);
  w.tick();
  assert.equal(w.runner.event?.id, 'E15');
  assert.equal(frozen(), true, 'E15 = 조작 정지');
  assert.ok(+view.threatEl.style.opacity >= 0.7 - 1e-6, 'E15 동안 화면 가장자리가 어둡다');
  for (let i = 0; i < 200 && w.runner.action?.do !== 'collapse'; i++) w.tick();
  w.tick(SCENE.collapse.turn + SCENE.collapse.sag);
  frozen();
  assert.ok(+view.bloodEl.style.opacity > 0.5, '붉은 막이 그려진다');
  assert.ok(player.eyeDrop > 0.5, '주저앉는다');
});

test('다른 루트·사건은 그대로: R3 의 E14~E15 트리거는 E13 전에는 걸리지 않고, 마지막 사건 외에는 엔딩 카드가 자동으로 뜨지 않는다', () => {
  const w = world();
  w.me.level = 1;
  w.me.x = 16.5;
  w.me.z = -31.1;
  w.tick();
  assert.equal(w.runner.event, null, 'E13 전에는 E14 가 걸리지 않는다');
  assert.ok(story.events.filter((e) => e.ending).every((e) => e.id === 'E15'));
  assert.ok(STORY.endingsKey);
});
