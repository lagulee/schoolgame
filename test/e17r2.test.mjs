// 단계 17(5): R2(당직 동행). E12 "따라간다" → 교무실(2F-staff)에 들어서면 E13(당직과 함께 P4) → E14 복도에서 {duty} 가 먼저 덮쳐짐(점프스케어 #3)
// → 마지막 추격 C4(입구 5 m 앞 = 경로 35 m 트리거) → 붙잡힘 장면(귀신이 등 뒤로 다가옴, {dohyeon} 탈출) → 엔딩 B(endingsSeen 에 B).
// 화면 없이 test/worldE13.mjs 의 세계(실제 E2Scene·Look·Collapse·P4Keys)를 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/chase/sim.js';
import { FinaleView } from '../src/scene/finaleView.js';
import { CHASE, PLAYER, SCENE, STAMINA } from '../src/config.js';
import { story, C4, P4, ev, world, toP4 } from './worldE13.mjs';
import { readFileSync } from 'node:fs';

const R2 = (id) => ev(id, 'R2');
const STAFF = [24, -40]; // 교무실 안 (문 쪽)
const RACK = [19.4, -45]; // 열쇠 걸이 앞

// 당직과 함께: 교무실에 들어서면 E13 → 열쇠 걸이 앞에서 P4
function r2ToP4(w) {
  w.tick(60);
  assert.equal(w.runner.event, null, 'R2 는 45초 기다려도 E13 이 시작되지 않는다 (교무실에 가야 한다)');
  w.me.level = 1;
  w.me.x = 16.5;
  w.me.z = -36;
  w.tick();
  assert.equal(w.runner.event, null, '복도에서는 아직');
  [w.me.x, w.me.z] = STAFF;
  w.tick();
  assert.equal(w.runner.event?.id, 'E13', '교무실에 들어서면 E13');
  assert.deepEqual(w.runner.event.routes, ['R2']);
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.tick(5);
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' }, '걸이 앞에 닿을 때까지 기다린다');
  [w.me.x, w.me.z] = RACK;
  w.tick();
  w.play();
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.puzzle.puzzle?.id, 'P4');
  w.tick();
}

function r2Solved(w) {
  r2ToP4(w);
  w.setLight(true);
  w.tick();
  w.items.get('p4:key:47').onUse();
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick();
  w.play();
}

// E14 가 시작돼 추격 줄까지
function r2StartE14(w) {
  r2Solved(w);
  w.me.x = 16.5;
  w.me.z = -36;
  w.tick();
  assert.equal(w.runner.event, null);
  w.me.z = -31.2;
  w.tick();
  assert.equal(w.runner.event?.id, 'E14');
  assert.deepEqual(w.runner.event.routes, ['R2']);
  w.me.yaw = Math.PI;
  for (let i = 0; i < 600 && w.runner.action?.do !== 'chase'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.deepEqual(w.runner.action, { do: 'chase' });
}

// 달려서 트리거(경로 35 m)까지. 잡히면 멈춘다
function runToTrigger(w, v = PLAYER.run) {
  const attempts = () => w.chase.attemptOf('C4', 'playerCaught');
  const tries = () => (w.chase.active ? attempts() : -1); // 트리거로 추격이 끝나면 걸음을 멈춘다
  const t0 = tries();
  for (const [x, z, l] of C4.path.points.slice(2)) {
    w.me.level = l;
    w.walk(x, z, v, tries);
    if (tries() !== t0) break;
  }
}

test('데이터: R2 의 E13 은 P4·출구 열쇠(hasExitKey)를, E14 는 점프스케어 #3·엔딩 B·추격 C4(playerCaught)를 가진다', () => {
  assert.equal(R2('E13').puzzle, 'P4');
  assert.equal(R2('E13').set.hasExitKey, true);
  assert.ok(!R2('E14').set, 'E14 는 열쇠를 더 주지 않는다 (E13 에서 얻음)');
  assert.equal(R2('E14').ending, 'B');
  assert.equal(story.endings.B.route, 'R2');
  assert.deepEqual(story.endings.B.survivors, ['dohyeon']);
  assert.equal(R2('E14').chase, 'C4');
  assert.deepEqual(R2('E14').finale, { companion: 'duty', fleeing: ['player', 'dohyeon'], atExit: 'playerCaught' });
  assert.deepEqual(R2('E14').deaths, ['duty', 'player']);
  const jn = story.events.filter((e) => e.routes.includes('R2') && e.jumpscare).map((e) => e.jumpscare);
  assert.deepEqual(jn, [1, 2, 3], 'R2 점프스케어도 한 판 3개');
  assert.ok(R2('E14').lines.findIndex((l) => l.do === 'collapse') > R2('E14').lines.findIndex((l) => l.do === 'chase'), '붙잡힘 장면은 추격 뒤');
  // 행동 줄이 가리키는 데이터가 모두 있다
  for (const l of ['E13', 'E14'].flatMap((id) => R2(id).lines.filter((x) => x.do))) {
    const table = { reach: 'reaches', scare: 'scares', look: 'looks', sound: 'sounds', collapse: 'collapses' }[l.do];
    if (table) assert.ok(story[table]?.[l.id], `${l.do} ${l.id}`);
  }
  // 트리거: R2 만, E13 = 교무실, E14 = R3 와 같은 복도 자리
  const t = (e, r) => story.triggers.find((x) => x.event === e && x.routes?.includes(r));
  assert.equal(t('E13', 'R2').space, '2F-staff');
  assert.equal(t('E13', 'R2').wait, undefined);
  assert.deepEqual(t('E14', 'R2').rect, t('E14', 'R3').rect);
  // P4 문구: 당직과 함께일 때만 덮어쓴다 (없는 키는 R3 문구)
  assert.ok(P4.keys.textsDuty.wrong && P4.keys.textsDuty.wrong !== P4.keys.texts.wrong);
});

test('E12 에서 따라가면 목표 = 당직을 따라 교무실로 (길 안내도 같은 키), 남으면 기존 대로 기다린다', () => {
  const nav = JSON.parse(readFileSync('data/nav.json', 'utf8'));
  assert.ok(story.objectives.followDuty && nav.goals.followDuty, '목표 문구와 길 안내 키');
  assert.equal(nav.goals.followDuty[0].to, '2F-staff');
  const follow = world({ route: 'R2' });
  assert.equal(follow.runner.objectiveKey(), 'followDuty');
  const stay = world();
  assert.equal(stay.runner.objectiveKey(), 'waitDuty');
});

test('E13(R2): 교무실에 들어서면 시작 → 열쇠 걸이 P4(퍼즐은 R3 와 같고 당직 문구) → 47번 → hasExitKey, 목표 = 현관으로', () => {
  const w = world({ route: 'R2' });
  r2ToP4(w);
  assert.equal(w.runner.objectiveKey(), 'findExitKey');
  assert.equal(w.runner.flags.get('hasExitKey'), false);
  assert.match(w.p4.texts.wrong, /\{duty|당직|서둘러/, '당직 문구');
  assert.notEqual(w.p4.texts.wrong, P4.keys.texts.wrong);
  w.setLight(true);
  w.tick();
  w.items.get('p4:key:74').onUse();
  assert.equal(w.puzzle.puzzle.wrong, 1, '틀리면 R3 와 똑같이 틀림 +1·귀신 한 걸음');
  w.items.get('p4:key:47').onUse();
  assert.equal(w.puzzle.last?.outcome, 'solved');
  w.tick();
  w.play();
  assert.ok(w.runner.registry.done.has('E13'));
  assert.equal(w.runner.flags.get('hasExitKey'), true);
  assert.equal(w.runner.objectiveKey(), 'runExit');
  // R3 는 그대로 R3 문구
  const r3 = world();
  assert.equal(r3.p4.texts.wrong, P4.keys.texts.wrong);
});

test('E14(R2): 등 뒤 쿵 → 북쪽을 돌아봄 → 점프스케어 #3 → 소리 → 남쪽 → 추격 C4(처리 4초, 스태미나 가득, atExit = playerCaught, 입구 5 m 앞 트리거)', () => {
  const w = world({ route: 'R2' });
  r2StartE14(w);
  assert.deepEqual(w.sounds.map((s) => s.kind), ['bang', 'sting']);
  assert.equal(w.chase.current.id, 'C4');
  assert.equal(w.chase.current.atExit, 'playerCaught');
  assert.equal(w.stamina.resets, 1);
  assert.equal(w.chase.chase.triggerAt, C4.pathLength - C4.triggerBeforeExit, '35 m 에서 트리거');
  assert.equal(w.chase.chase.phase, 'kill');
  assert.equal(w.runner.objectiveKey(), 'runExit');
});

test('C4(R2): 걷기만 하면 트리거 전에 잡혀 다시, 달리면 트리거(35 m)에 닿아 붙잡힘 장면으로 — 일반 도착(exit)이 아니다', () => {
  const w = world({ route: 'R2' });
  r2StartE14(w);
  const gap0 = w.chase.chase.startGap;
  runToTrigger(w, PLAYER.walk);
  assert.equal(w.chase.attemptOf('C4', 'playerCaught'), 1, '걷기만 하면 잡힌다');
  assert.equal(w.chase.chase.startGap, gap0 + CHASE.retryGapStep);
  assert.equal(w.runner.action?.do, 'chase');
  runToTrigger(w);
  assert.equal(w.chase.last?.outcome, 'trigger');
  assert.equal(w.chase.last.finale, 'playerCaught');
  assert.ok(w.chase.last.arrivalGap > 5, `트리거 때 거리 ${w.chase.last.arrivalGap.toFixed(1)} m`);
  assert.ok(w.me.level === 0 && w.me.x > 15 && w.me.z > -8 && w.me.z < -3, `입구 5 m 앞 ${w.me.x.toFixed(1)}, ${w.me.z.toFixed(1)}`);
});

test('시뮬레이션 회귀 (C4 R2 트리거): 걷기 위주 실패, 평범 9.93 m, 최적 13.49 m. R3(exit) 평범 5.42 m 는 그대로', () => {
  const cfg = { chase: CHASE, stamina: STAMINA, player: PLAYER };
  const sim = (p, opts) => simulate(C4, CHASE.SIM.profiles[p], cfg, opts);
  assert.equal(sim('walkish', { trigger: true }).outcome, 'caught');
  const normal = sim('normal', { trigger: true });
  const optimal = sim('optimal', { trigger: true });
  assert.equal(normal.outcome, 'trigger');
  assert.equal(optimal.outcome, 'trigger');
  assert.ok(Math.abs(normal.arrivalGap - 9.93) < 0.05, `평범 ${normal.arrivalGap}`);
  assert.ok(Math.abs(optimal.arrivalGap - 13.49) < 0.05, `최적 ${optimal.arrivalGap}`);
  assert.ok(Math.abs(sim('normal', {}).arrivalGap - 5.42) < 0.05, 'R3 기준 유지');
});

// 트리거 뒤 붙잡힘 장면까지
function toCaught(w) {
  r2StartE14(w);
  runToTrigger(w);
  assert.equal(w.chase.last?.outcome, 'trigger');
}

test('붙잡힘 장면: 귀신이 등 뒤 1.5 m 까지 다가오고, 조작이 멈춘 채 자막 → 북쪽(귀신 쪽)으로 돌아봄 → 주저앉음·붉은 막 → 암전 → 엔딩 B 카드, endingsSeen 에 B', () => {
  const w = world({ route: 'R2' });
  toCaught(w);
  w.tick();
  assert.equal(w.runner.event?.id, 'E14', '아직 E14 안 (엔딩 B 는 이 사건의 끝)');
  assert.ok(w.e2.held, '귀신이 등 뒤로 다가오는 장면');
  const g0 = w.e2.ghost;
  assert.equal(g0.mode, 'chase');
  const px = w.me.x;
  const pz = w.me.z;
  const dist = () => Math.hypot(w.e2.ghost.x - px, w.e2.ghost.z - pz);
  const d0 = dist();
  assert.ok(d0 > 5, `처음엔 멀다 ${d0.toFixed(1)}`);
  assert.deepEqual(w.endings.list(), []);
  // 자막 줄 동안 귀신이 다가온다 (조작은 멈춰 있어 플레이어 자리는 그대로)
  for (let i = 0; i < 400 && w.runner.action?.do !== 'collapse'; i++) w.tick();
  assert.deepEqual(w.runner.action, { do: 'collapse', id: 'caught' });
  if (w.e2.held && !w.e2.ghostArrived) assert.equal(w.collapse.phase, 'wait', '귀신이 다 오기 전에는 돌아보지 않는다');
  for (let i = 0; i < 400 && w.collapse.phase === 'wait'; i++) w.tick();
  assert.equal(w.collapse.phase, 'turn');
  assert.ok(dist() < d0 && Math.abs(dist() - SCENE.caught.stopAt) < 0.35, `등 뒤 ${dist().toFixed(2)} m (stopAt ${SCENE.caught.stopAt})`);
  assert.ok(w.e2.ghost.z < pz, '플레이어 북쪽(등 뒤)');
  const C = SCENE.collapse;
  w.tick(C.turn + 0.1);
  assert.equal(w.collapse.phase, 'sag');
  assert.ok(Math.abs(Math.sin(w.me.yaw)) < 0.05 && Math.cos(w.me.yaw) > 0.9, `북쪽(귀신 쪽)을 본다 yaw ${w.me.yaw}`);
  w.tick(C.sag + 0.1);
  assert.equal(w.collapse.phase, 'dark');
  w.tick(C.dark + C.hold + 0.4);
  assert.equal(w.runner.mode, 'ending', '사건이 끝나며 엔딩 카드');
  assert.match(w.runner.ui.shown.text, /혼자 출구/);
  assert.deepEqual(w.endings.list(), ['B'], 'endingsSeen 에 B');
  assert.ok(w.runner.registry.done.has('E14'));
  assert.equal(w.collapse.veil, 1);
  w.runner.advance();
  w.tick(C.recover + 0.5);
  assert.equal(w.collapse.active, false);
  assert.equal(w.e2.held, null, '장면이 끝나면 귀신도 사라진다');
});

test('엔딩 B 도 깜빡이지 않는다: 붉은 막·검은 막이 한 방향으로만, 급변 없음', () => {
  const w = world({ route: 'R2' });
  toCaught(w);
  for (let i = 0; i < 400 && w.runner.action?.do !== 'collapse'; i++) w.tick();
  const from = w.veil.length;
  const C = SCENE.collapse;
  w.tick(C.turn + C.sag + C.dark + C.hold + 1);
  for (const series of [w.blood.slice(from), w.veil.slice(from)]) {
    let turns = 0;
    let dir = 0;
    let maxStep = 0;
    for (let i = 1; i < series.length; i++) {
      const d = series[i] - series[i - 1];
      maxStep = Math.max(maxStep, Math.abs(d));
      if (Math.abs(d) < 1e-9) continue;
      if (dir && Math.sign(d) !== dir) turns++;
      dir = Math.sign(d);
    }
    assert.equal(turns, 0);
    assert.ok(maxStep * 30 < 1);
  }
});

test('조작 정지(R2 E14): 추격 줄 앞까지 + 추격이 끝난 뒤 사건이 끝날 때까지 멈추고, 추격 중에는 풀린다', () => {
  const w = world({ route: 'R2' });
  const dom = () => ({ style: {} });
  const player = { frozen: false, eyeDrop: 0, pos: { x: 0, z: 0 } };
  const view = new FinaleView({ runner: w.runner, look: w.look, collapse: w.collapse, player, camera: { rotation: {} }, audio: { started: false }, bloodEl: dom(), veilEl: dom(), threatEl: dom() });
  const frozen = () => {
    player.frozen = false;
    view.update();
    return player.frozen;
  };
  r2Solved(w);
  assert.equal(frozen(), false);
  w.me.x = 16.5;
  w.me.z = -31.2;
  w.tick();
  assert.equal(w.runner.event?.id, 'E14');
  assert.equal(frozen(), true, '추격 앞 줄(쿵·돌아봄·점프스케어) 동안 정지');
  w.me.yaw = Math.PI;
  for (let i = 0; i < 600 && w.runner.action?.do !== 'chase'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.equal(frozen(), false, '추격 중에는 달릴 수 있다');
  runToTrigger(w);
  w.tick();
  assert.equal(frozen(), true, '트리거 뒤 붙잡힘 장면은 정지');
});

test('R3 회귀: 같은 세계에서 R3 는 트리거(wait 45초)·E14·엔딩 C 가 그대로 — R2 트리거가 R3 에서 걸리지 않는다', () => {
  const w = world();
  w.me.level = 1;
  [w.me.x, w.me.z] = STAFF;
  w.tick();
  assert.equal(w.runner.event, null, 'R3 는 교무실에 들어서도 E13 이 시작되지 않는다 (45초 대기)');
  toP4(w);
  assert.equal(w.runner.event?.routes?.[0], 'R3');
  assert.equal(w.p4.texts.wrong, P4.keys.texts.wrong);
});
