// 단계 20 3루트 회귀: test/worldFull.mjs 의 세계를 학교 앞에서 엔딩까지 움직이는 순서 (사건별 시험(e2-scene·e3e6·e7e9·e10e12·
// e13e15·e17r2·r1ad·r1eh)과 같은 자리·행동을 이어 붙였다). 사건마다 기대한 사건이 걸렸는지 확인하며 간다.
import assert from 'node:assert/strict';
import { PLAYER } from '../src/config.js';
import { story, chases, puzzles, mid, SCARE } from './worldFull.mjs';
import { playToR1d, toP4 as r1ToP4, solveP4 as r1SolveP4, toChase as r1ToChase, runRoute as r1RunRoute } from './worldR1.mjs';

const P1 = puzzles.find((p) => p.id === 'P1');
const C4 = chases.find((c) => c.id === 'C4');
const advanceTo = (w, pred, limit = 900) => {
  for (let i = 0; i < limit && !pred(); i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
};

// 학교 앞 → 현관 홀(E1) → 1층 동쪽 복도(E2: 추격 C1 → 숨기 P1 → {gyuha} 퇴장)
export function playE1E2(w) {
  w.tick(1);
  assert.equal(w.runner.event, null, '학교 앞에서는 사건이 없다 (자유 탐색)');
  w.at(...mid('lobby'));
  assert.equal(w.runner.event?.id, 'E1', '현관 홀 → E1');
  w.finish('E1');
  w.at(16.5, -14, 0);
  w.walk(16.5, -24, PLAYER.walk);
  assert.equal(w.runner.event?.id, 'E2', '동쪽 복도 → E2');
  advanceTo(w, () => w.runner.action?.do === 'chase');
  assert.equal(w.chase.current?.id, 'C1');
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(6.3, -51.5, PLAYER.run);
  w.walk(6.3, -54.5, PLAYER.walk);
  assert.equal(w.chase.last?.outcome, 'exit', 'C1 도착');
  w.tick();
  assert.equal(w.puzzle.puzzle?.id, 'P1');
  w.doors.closed = true;
  w.tick();
  w.phone.setLight(false);
  w.walk(2.5, -58, PLAYER.walk);
  w.tick(P1.hide.pass + 0.3);
  assert.equal(w.puzzle.last?.outcome, 'solved', 'P1 숨기 성공');
  w.doors.closed = false;
  w.finish('E2');
}

// E3(3층 연결문, 가짜 {gyuha}) → E4(2층 복도, 열쇠함) → E5(연결문 열기) → [book 이면 4층 {dohyeon} 책] → E6(신관 5층).
// idle = 사건 사이에 서 있는 시간 (혼자일 때 연출이 나올 틈)
export function playE3E6(w, { book = false, idle = [30, 95] } = {}) {
  w.tick(idle[0]);
  w.at(...mid('3F-bridge@2'));
  assert.equal(w.runner.event?.id, 'E3', '3층 연결문 앞 → E3');
  w.finish('E3');
  w.at(16.5, -30, 1);
  assert.equal(w.runner.event?.id, 'E4', '2층 동쪽 복도 → E4');
  w.play();
  w.items.get('take:connectorKey').onUse();
  assert.equal(w.runner.flags.get('hasConnectorKey'), true, '연결문 열쇠');
  w.finish('E4');
  w.tick(idle[1]);
  w.at(...mid('3F-bridge@2'));
  assert.equal(w.runner.event?.id, 'E5', '열쇠 들고 3층 연결문 → E5');
  w.finish('E5');
  if (book) {
    assert.ok(w.runner.interact('dohyeonBook'), '신관 4층 {dohyeon} 책');
    w.play();
    assert.equal(w.runner.flags.get('earlyBook'), true);
  }
  w.at(...mid('AC@4'));
  assert.equal(w.runner.event?.id, 'E6', '신관 5층 → E6');
  // 2회차(엔딩을 본 판): 2-13 열쇠로 내 책을 챙길 때까지 기다린다
  advanceTo(w, () => w.runner.registry.done.has('E6') || w.runner.action?.do === 'take');
  if (w.runner.action?.do === 'take') {
    assert.equal(w.runner.repeat, true, '내 책은 2회차에만');
    assert.ok(w.steps.take(w.runner.action.id), '2-13 내 책');
  }
  w.finish('E6');
}

// E7 정전 → 배전반 → 점프스케어 #1
export function playE7(w) {
  w.at(...mid('A2F-3'));
  assert.equal(w.runner.event?.id, 'E7', '야자 교실 → E7');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'switchboard' });
  w.at(-9, -91.2, 1);
  w.tick(SCARE + 0.1);
  w.finish('E7');
}

// R3·R2: E8(P3 교실 수색) → E9(4층 책)
export function playE8E9(w) {
  w.tick();
  assert.equal(w.runner.event?.id, 'E8', '신관 2층 복도 → E8');
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P3');
  w.items.get('p3:belongings').onUse();
  w.at(-10.4, -91.6, 1);
  w.at(-12.4, -91.9, 2);
  w.tick(1);
  w.at(4.6, -91.9, 2);
  w.at(...mid('A3F-3'));
  assert.equal(w.puzzle.last?.outcome, 'solved', 'P3 → 3-10');
  w.finish('E8');
  w.at(10, -91.9, 2);
  assert.equal(w.runner.event?.id, 'E9', '3층 복도 → E9');
  w.play();
  assert.ok(w.steps.take('dohyeonBookE9'), '{dohyeon} 책');
  w.finish('E9');
}

// R3·R2: E10(구관 현관 → 추격 C2 → 점프스케어 #2 → 기절) → E11(P2 당직실 단서) → E12 선택지. follow = 따라간다(R2)
export function playE10E12(w, { follow, idle = 30 }) {
  w.at(10, -1, 0);
  w.tick(idle); // 구관으로 먼저 돌아가는 길 (혼자일 때 연출 구간)
  w.at(16.5, -1, 0);
  assert.equal(w.runner.event?.id, 'E10', '구관 현관 홀 → E10');
  w.play();
  assert.equal(w.chase.current?.id, 'C2');
  w.walk(16.5, -51.5, PLAYER.run);
  w.walk(5, -51.5, PLAYER.run);
  assert.equal(w.chase.last?.outcome, 'exit', 'C2 도착');
  w.finish('E10');
  w.tick();
  assert.equal(w.runner.event?.id, 'E11', `깨어난 자리(구관 4층)에서 E11 (${w.me.x.toFixed(1)}, ${w.me.z.toFixed(1)}, ${w.me.level})`);
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P2');
  for (const id of ['log', 'calendar', 'blackboard']) w.items.get(`p2:${id}`).onUse();
  for (let i = 0; i < 400 * 30 && w.puzzle.active; i++) w.tick();
  w.finish('E11');
  w.at(22, -32, 3);
  assert.equal(w.runner.event?.id, 'E12', '당직실 → E12');
  advanceTo(w, () => w.runner.mode === 'choice', 600);
  assert.equal(w.runner.mode, 'choice');
  if (follow) {
    w.runner.moveSelection(-1);
    w.runner.choose();
  } else w.tick(w.runner.choice.def.timeout + 0.3);
  assert.ok(w.runner.registry.done.has('E12'));
  assert.equal(w.runner.route, follow ? 'R2' : 'R3');
}

// 교무실 열쇠 걸이 앞에서 P4 를 47번으로 (R3 = 45초 기다리면 E13, R2 = 교무실에 들어서면 E13)
export function playE13(w, { route }) {
  if (route === 'R3') {
    w.tick(46);
    assert.equal(w.runner.event?.id, 'E13', 'R3: 45초 뒤 E13');
  } else {
    w.at(24, -40, 1);
    assert.equal(w.runner.event?.id, 'E13', 'R2: 교무실 → E13');
  }
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.at(19.4, -45, 1);
  w.play();
  assert.equal(w.puzzle.puzzle?.id, 'P4');
  w.phone.setLight(true);
  w.tick();
  w.items.get('p4:key:47').onUse();
  assert.equal(w.puzzle.last?.outcome, 'solved', 'P4 → 47번');
  w.finish('E13');
  assert.equal(w.runner.flags.get('hasExitKey'), true);
}

// E14(복도 → 점프스케어 #3 → 마지막 추격 C4) → R3 = 출구 도착 → E15 쓰러짐 → 엔딩 C / R2 = 입구 5 m 앞 붙잡힘 → 엔딩 B
export function playE14End(w, { route }) {
  w.at(16.5, -36, 1);
  assert.equal(w.runner.event, null);
  w.at(16.5, -31.2, 1);
  assert.equal(w.runner.event?.id, 'E14', '2층 동쪽 복도 남쪽 → E14');
  w.me.yaw = Math.PI;
  advanceTo(w, () => w.runner.action?.do === 'chase');
  assert.equal(w.chase.current?.id, 'C4');
  const finale = route === 'R3' ? 'collapse' : 'playerCaught';
  const tries = () => (w.chase.active ? w.chase.attemptOf('C4', finale) : -1);
  const t0 = tries();
  for (const [x, z, l] of C4.path.points.slice(2)) {
    w.me.level = l;
    w.walk(x, z, PLAYER.run, tries);
    if (tries() !== t0) break;
  }
  if (route === 'R3') {
    w.tick(C4.unlockTime + 0.3);
    w.finish('E14');
    w.tick();
    assert.equal(w.runner.event?.id, 'E15', '현관 유리문 앞 → E15');
  } else assert.equal(w.chase.last?.outcome, 'trigger', 'R2: 입구 5 m 앞 트리거');
  w.toEnding();
}

// R1: E7 → R1-a~R1-d (worldR1.playToR1d) → R1-e({mingeon} 시점 P4) → R1-f → R1-g(C3) → R1-h → 엔딩 A
export function playR1(w) {
  playToR1d(w);
  r1ToP4(w);
  w.phone.setLight(true);
  r1SolveP4(w);
  r1ToChase(w);
  r1RunRoute(w);
  w.finish('R1-g');
  w.toEnding();
}

export const ORDER = {
  R3: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15'],
  R2: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14'],
  R1: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'R1-a', 'R1-b', 'R1-c', 'R1-d', 'R1-e', 'R1-f', 'R1-g', 'R1-h'],
};

// 처음부터 엔딩까지 한 판
export function playRoute(w, route) {
  playE1E2(w);
  playE3E6(w, { book: route === 'R1' });
  if (route === 'R1') return playR1(w);
  playE7(w);
  playE8E9(w);
  playE10E12(w, { follow: route === 'R2' });
  playE13(w, { route });
  playE14End(w, { route });
}

export { story };
