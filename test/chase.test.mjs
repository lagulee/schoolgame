// 추격 엔진 (STORY 14-3·14-4, 단계 0b-3): gap 갱신·지형 지연·잡힘·일행 처리 지연·출구 통과·재시도·체크포인트·R2 분기·자동 시뮬레이션
import test from 'node:test';
import assert from 'node:assert/strict';
import { Chase, retryBonus } from '../src/chase/chase.js';
import { ChaseSession } from '../src/chase/session.js';
import { simulate, simulateAll } from '../src/chase/sim.js';
import { chaseVariants } from '../src/chase/variants.js';
import { exitMinGap } from '../src/story/chases.js';
import { Stamina } from '../src/player/stamina.js';
import { Phone } from '../src/phone/phone.js';
import { StoryRunner } from '../src/story/runner.js';
import { CHASE, STAMINA, PLAYER, PHONE } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { chases } = loadSkeletons();
const by = Object.fromEntries(chases.map((c) => [c.id, c]));
const cfg = { chase: CHASE, stamina: STAMINA, player: PLAYER };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const run = (c, sec, v, dt = 1 / 60) => {
  for (let i = 0, n = Math.round(sec / dt); i < n && !c.done; i++) c.update(dt, v);
};
// 시험용 추격 정의
const plain = (patch = {}) => ({ id: 'T', ghostSpeed: 3.0, startGap: 20, pathLength: 100, companionKillDelay: 0, unlockTime: 0, delays: [], ...patch });
const final = (patch = {}) => ({ ...by.C4, ...patch });

test('상수: 잡힘 1.5 m, 재시도 +2 m 최대 +8 m, 마지막 추격 값', () => {
  assert.equal(CHASE.catchDistance, 1.5);
  assert.equal(CHASE.retryGapStep, 2);
  assert.equal(CHASE.retryGapMax, 8);
  for (const id of ['C3', 'C4']) {
    near(exitMinGap(by[id], CHASE.catchDistance), 4.9);
    assert.equal(by[id].companionKillDelay, 4);
  }
});

test('gap 갱신: gap += (플레이어 − 귀신) × dt, 프레임 크기와 무관', () => {
  const c = new Chase(plain(), CHASE);
  run(c, 5, 3.6);
  near(c.gap, 20 + 0.6 * 5, 1e-6);
  near(c.dist, 18, 1e-6);
  near(c.remaining, 82, 1e-6);
  near(c.ghostPos, 18 - c.gap, 1e-9);
  run(c, 4, 1.6);
  near(c.gap, 23 - 1.4 * 4, 1e-6);
  // 1/30 초와 1/240 초 프레임이 같은 결과
  const a = new Chase(plain(), CHASE);
  const b = new Chase(plain(), CHASE);
  run(a, 7, 2.2, 1 / 30);
  run(b, 7, 2.2, 1 / 240);
  near(a.gap, b.gap, 1e-6);
});

test('지형 지연: at 에 닿으면 그 시간 동안 귀신이 멈춤 → 끝난 뒤 gap 은 ghostSpeed × 시간 만큼 더 크다', () => {
  const withDelay = new Chase(plain({ delays: [{ at: 10, seconds: 2 }] }), CHASE);
  const without = new Chase(plain(), CHASE);
  run(withDelay, 10 / 3.6 + 0.5, 3.6);
  assert.equal(withDelay.ghostNow, 0, '지연 중 귀신 정지');
  run(without, 10 / 3.6 + 0.5, 3.6);
  run(withDelay, 3, 3.6);
  run(without, 3, 3.6);
  assert.equal(withDelay.ghostNow, 3.0, '지연이 끝나면 다시 쫓아옴');
  near(withDelay.gap - without.gap, 3.0 * 2, 1e-6);
  // 지연은 한 번만, 플레이어가 멈춰 있으면 일어나지 않는다
  const still = new Chase(plain({ delays: [{ at: 10, seconds: 2 }] }), CHASE);
  run(still, 1, 0);
  assert.equal(still.ghostNow, 3.0);
});

test('잡힘 판정: gap ≤ 1.5 m 가 되는 순간 caught (멈춰 있으면 (20 − 1.5) / 귀신 속도 초)', () => {
  const c = new Chase(plain(), CHASE);
  run(c, 10, 0);
  assert.equal(c.phase, 'caught');
  near(c.gap, CHASE.catchDistance, 1e-9);
  near(c.t, 18.5 / 3.0, 1e-9);
  assert.equal(c.result().outcome, 'caught');
  assert.equal(c.result().finale, null);
  // 끝난 뒤에는 더 진행하지 않는다
  c.update(1, 3.6);
  near(c.gap, CHASE.catchDistance, 1e-9);
  // 걷기(1.6)로는 따라잡힌다, 달리기(3.6)로는 벌어진다
  const w = new Chase(plain(), CHASE);
  run(w, 60, 1.6);
  assert.equal(w.phase, 'caught');
  const r = new Chase(plain(), CHASE);
  run(r, 20, 3.6);
  assert.ok(r.gap > 20);
});

test('일행 처리 지연: 마지막 추격은 4초 동안 귀신 정지, 그 뒤 gap = 3 + 3.4 × 4 + (v − 3.4) × 4', () => {
  const c = new Chase(final(), CHASE);
  assert.equal(c.phase, 'kill');
  assert.equal(c.ghostNow, 0);
  run(c, 2, 3.6);
  near(c.gap, 3 + 3.6 * 2, 1e-6);
  run(c, 2, 3.6);
  assert.equal(c.phase, 'run');
  assert.equal(c.ghostNow, 3.4);
  near(c.gap, 3 + 3.4 * 4 + (3.6 - 3.4) * 4, 1e-6);
  // 처리 중 가만히 서 있으면 그대로 3 m, 그 뒤 곧 잡힌다
  const s = new Chase(final(), CHASE);
  run(s, 4, 0);
  near(s.gap, 3, 1e-6);
  run(s, 1, 0);
  assert.equal(s.phase, 'caught');
  // 일반 추격에는 처리 지연이 없다
  assert.equal(new Chase(by.C1, CHASE).phase, 'run');
});

test('출구 통과 조건: 도착 gap ≥ 4.9 m 면 1초 문 열기(조작 불가) 뒤 통과, 모자라면 문 앞에서 잡힘', () => {
  // 귀신과 같은 속도로 달리면 gap 이 시작값 그대로 유지된다 → 도착 gap 을 정확히 맞출 수 있다
  const at = (gap) => {
    const c = new Chase(final({ startGap: gap, companionKillDelay: 0, pathLength: 10 }), CHASE);
    run(c, 10 / 3.4 + 0.02, 3.4);
    return c;
  };
  const ok = at(4.9);
  assert.equal(ok.phase, 'unlock');
  assert.ok(ok.locked);
  near(ok.arrivalGap, 4.9, 1e-6);
  run(ok, 0.5, 3.6); // 문을 여는 동안은 움직일 수 없다 (속도를 넣어도 무시)
  near(ok.dist, 10, 1e-9);
  run(ok, 1, 0);
  assert.equal(ok.phase, 'exit');
  near(ok.gap, 1.5, 1e-6);
  assert.equal(ok.result('escape').finale, 'escape');
  const bad = at(4.8);
  assert.ok(bad.locked && !bad.passed);
  run(bad, 1, 0);
  assert.equal(bad.phase, 'caught');
  assert.ok(bad.t < 10 / 3.4 + 1, '문을 다 열기 전에 잡힘');
  // 일반 추격은 도착하면 바로 끝
  const c1 = new Chase(plain({ pathLength: 10 }), CHASE);
  run(c1, 5, 3.6);
  assert.equal(c1.phase, 'exit');
});

test('재시도: 시작 gap +2 m 씩, 최대 +8 m', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map((n) => retryBonus(n, CHASE)), [0, 2, 4, 6, 8, 8, 8]);
  assert.equal(new Chase(by.C4, CHASE, { attempt: 2 }).startGap, 7);
  assert.equal(new Chase(by.C4, CHASE, { attempt: 7 }).startGap, 11);
  assert.equal(new Chase(by.C1, CHASE, { attempt: 1 }).startGap, 22);
});

// 스토리 진행기 + 핸드폰 + 스태미나 + 추격 세션 (main.js 와 같은 연결)
function world() {
  const { story, characters } = loadStory();
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const phone = new Phone(PHONE, () => 0);
  const stamina = new Stamina(STAMINA);
  runner.checkpoints.register('phone', { save: () => phone.save(), load: (v) => phone.load(v) });
  runner.checkpoints.register('stamina', { save: () => stamina.save(), load: (v) => stamina.load(v) });
  const me = { speed: 0, pos: [0, 0] };
  const session = new ChaseSession({
    runner, chases, cfg: CHASE, getSpeed: () => me.speed, stamina,
    pose: { get: () => [...me.pos], set: (p) => (me.pos = [...p]) },
  });
  const results = [];
  session.onResult = (r) => results.push(r);
  return { runner, phone, stamina, session, me, results, story };
}

test('체크포인트: 잡히면 추격 시작 때의 배터리·스태미나·플래그·위치로 되돌리고 시도 +1 로 다시', () => {
  const w = world();
  w.runner.flags.set('hasExitKey', true);
  w.phone.s.battery = 50;
  w.stamina.update(2, 'run'); // 75
  w.me.pos = [3, 4];
  w.session.start('C2');
  assert.equal(w.stamina.value, 75, '일반 추격은 시작 때 스태미나를 채우지 않는다');
  // 추격 중에 바뀐 것들
  w.runner.flags.set('hasExitKey', false);
  w.runner.flags.set('earlyBook', true);
  w.phone.s.battery = 20;
  w.stamina.update(4, 'run');
  w.me.pos = [30, 40];
  // 가만히 서서 잡힌다
  for (let i = 0; i < 60 * 10 && w.results.length === 0; i++) w.session.update(1 / 60);
  assert.equal(w.results[0].outcome, 'caught');
  assert.equal(w.results[0].attempt, 0);
  assert.equal(w.runner.flags.get('hasExitKey'), true);
  assert.equal(w.runner.flags.get('earlyBook'), false);
  assert.equal(w.phone.battery, 50);
  assert.equal(w.stamina.value, 75);
  assert.deepEqual(w.me.pos, [3, 4]);
  assert.ok(w.session.active, '같은 추격을 다시 시작');
  assert.equal(w.session.chase.attempt, 1);
  assert.equal(w.session.chase.startGap, 22);
  // 계속 잡혀도 보너스는 +8 m 까지
  for (let n = 0; n < 6; n++) for (let i = 0; i < 60 * 30 && w.session.chase.attempt === n + 1; i++) w.session.update(1 / 60);
  assert.equal(w.session.chase.attempt, 7);
  assert.equal(w.session.chase.startGap, 28);
  // 저장 객체는 JSON 으로 바꿀 수 있고, 'chase' 항목에 진행 중인 추격이 들어 있다
  const snap = w.runner.snapshot();
  assert.deepEqual(snap.parts.chase, { id: 'C2', atExit: null, pose: [3, 4] });
  assert.deepEqual(snap.parts.stamina, { value: 75, exhausted: false });
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(snap))), JSON.stringify(snap));
  // 새로 시작하면 시도 횟수가 처음으로
  w.session.start('C2');
  assert.equal(w.session.chase.attempt, 0);
  w.session.stop();
  assert.ok(!w.session.active);
});

test('체크포인트: 마지막 추격은 시작 때 스태미나를 가득 채우고, 탈진 상태도 저장·복원', () => {
  const w = world();
  while (w.stamina.canRun) w.stamina.update(0.1, 'run');
  assert.ok(w.stamina.exhausted);
  const saved = w.stamina.save();
  w.session.start('C4', { atExit: 'collapse' });
  assert.ok(w.stamina.full && !w.stamina.exhausted);
  const s = new Stamina(STAMINA);
  s.load(saved);
  assert.ok(s.exhausted && s.value === 0 && !s.canRun);
  s.load(null); // 예전 저장(값 없음)은 가득
  assert.ok(s.full);
});

test('마지막 추격 분기: R1 escape / R3 collapse 는 출구 통과, R2 는 입구 5 m 앞 트리거에서 playerCaught', () => {
  const { story } = loadStory();
  const variants = chaseVariants(story.events);
  const fin = Object.fromEntries(variants.filter((v) => v.atExit).map((v) => [v.atExit, v.id]));
  assert.deepEqual(fin, { collapse: 'C4', playerCaught: 'C4', escape: 'C3' });
  assert.deepEqual(variants.filter((v) => !v.atExit).map((v) => v.id), ['C1', 'C2']);
  for (const [atExit, outcome, at] of [['escape', 'exit', 40], ['collapse', 'exit', 40], ['playerCaught', 'trigger', 35]]) {
    const w = world();
    w.session.start(fin[atExit], { atExit });
    w.me.speed = 3.6; // 계속 달린다 (스태미나는 이 시험에서 쓰지 않음)
    for (let i = 0; i < 60 * 30 && w.results.length === 0; i++) w.session.update(1 / 60);
    const r = w.results[0];
    assert.equal(r.outcome, outcome, atExit);
    assert.equal(r.finale, atExit);
    assert.ok(!w.session.active);
    assert.ok(Math.abs(w.session.last.arrivalGap - (3 + 3.6 * 4 + 0.2 * (at / 3.6 - 4))) < 1e-6, `${atExit} 도착 gap`);
  }
  // 트리거 지점 전에 잡히면 붙잡힘 연출이 아니라 재시작
  const w = world();
  w.session.start('C4', { atExit: 'playerCaught' });
  for (let i = 0; i < 60 * 10 && w.results.length === 0; i++) w.session.update(1 / 60);
  assert.equal(w.results[0].outcome, 'caught');
  assert.equal(w.results[0].finale, null);
  assert.equal(w.session.chase.attempt, 1);
});

test('시뮬레이션 (마지막 추격 C3·C4, R2 포함): 걷기 위주 실패, 평범 4.5~6 m, 최적 10~12 m', () => {
  const report = [];
  for (const [id, opts] of [['C3', {}], ['C4', {}], ['C4', { trigger: true }]]) {
    const r = simulateAll(by[id], cfg, opts);
    report.push(`${id}${opts.trigger ? '(R2)' : ''} ${Object.entries(r).map(([k, x]) => `${k} ${x.outcome} ${x.arrivalGap?.toFixed(2) ?? '-'}`).join(' / ')}`);
    assert.equal(r.walkOnly.outcome, 'caught');
    assert.equal(r.walkish.outcome, 'caught', '걷기 위주 = 실패');
    if (opts.trigger) {
      assert.equal(r.normal.outcome, 'trigger');
      assert.equal(r.optimal.outcome, 'trigger');
      continue;
    }
    assert.equal(r.normal.outcome, 'exit');
    assert.ok(r.normal.arrivalGap >= 4.5 && r.normal.arrivalGap <= 6, `평범 ${r.normal.arrivalGap}`);
    assert.ok(Math.abs(r.normal.avgAfter - 2.0) < 0.15, `평범 평균 ${r.normal.avgAfter}`);
    assert.equal(r.optimal.outcome, 'exit');
    assert.ok(r.optimal.arrivalGap >= 10 && r.optimal.arrivalGap <= 12, `최적 ${r.optimal.arrivalGap}`);
    assert.ok(Math.abs(r.optimal.avgAfter - 2.25) < 0.1, `최적 평균 ${r.optimal.avgAfter}`);
  }
  console.log(report.join('\n'));
});

test('시뮬레이션 (일반 추격 C1·C2): 걷기만 하면 실패, 평범·최적은 여유 3 m 이상으로 도착', () => {
  for (const id of ['C1', 'C2']) {
    const r = simulateAll(by[id], cfg);
    assert.equal(r.walkOnly.outcome, 'caught', `${id} 걷기만`);
    for (const k of ['normal', 'optimal']) {
      assert.equal(r[k].outcome, 'exit', `${id} ${k}`);
      assert.ok(r[k].minGap - CHASE.catchDistance >= 3, `${id} ${k} 최소 여유 ${r[k].minGap}`);
    }
    console.log(`${id} ${Object.entries(r).map(([k, x]) => `${k} ${x.outcome} ${x.arrivalGap?.toFixed(2) ?? '-'}`).join(' / ')}`);
  }
});

test('시뮬레이션: 프레임 크기(1/30·1/120 초)가 달라도 결과가 같은 범위', () => {
  for (const dt of [1 / 30, 1 / 120]) {
    const n = simulate(by.C4, CHASE.SIM.profiles.normal, cfg, { dt });
    const o = simulate(by.C4, CHASE.SIM.profiles.optimal, cfg, { dt });
    assert.ok(n.outcome === 'exit' && n.arrivalGap >= 4.5 && n.arrivalGap <= 6, `dt ${dt} 평범 ${n.arrivalGap}`);
    assert.ok(o.outcome === 'exit' && o.arrivalGap >= 10 && o.arrivalGap <= 12, `dt ${dt} 최적 ${o.arrivalGap}`);
  }
});
