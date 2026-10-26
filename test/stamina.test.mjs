// 스태미나 규칙 (STORY 14-2): 소모·회복 대기·회복 속도·탈진·해제·꼼수 방지·프레임 크기 무관
import test from 'node:test';
import assert from 'node:assert/strict';
import { Stamina } from '../src/player/stamina.js';
import { STAMINA, PLAYER } from '../src/config.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const exhaust = (s) => {
  while (s.canRun) s.update(1 / 60, 'run');
};
const run = (s, mode, sec, dt = 1 / 60) => {
  const n = Math.round(sec / dt);
  for (let i = 0; i < n; i++) s.update(dt, mode);
};

test('상수: STORY 14-2 제안값, 이동 속도 불변', () => {
  assert.equal(STAMINA.MAX, 100);
  assert.equal(STAMINA.RUN_COST, 12.5);
  assert.equal(STAMINA.RECOVER_DELAY, 1);
  assert.deepEqual([STAMINA.RECOVER_WALK, STAMINA.RECOVER_STILL, STAMINA.RECOVER_HIDDEN], [6, 12, 15]);
  assert.equal(STAMINA.EXHAUST_CLEAR, 30);
  assert.equal(STAMINA.EXHAUSTED_SPEED, 1.3);
  assert.equal(STAMINA.PHONE_MOVE_SCALE, 0.7);
  assert.equal(PLAYER.walk, 1.6);
  assert.equal(PLAYER.run, 3.6);
  assert.ok(STAMINA.EXHAUSTED_SPEED < PLAYER.walk);
});

test('소모: 초당 12.5, 가득 찬 상태에서 8초 달리면 0 → 탈진 (약 28.8 m)', () => {
  const s = new Stamina(STAMINA);
  assert.ok(s.full && s.canRun);
  run(s, 'run', 4);
  near(s.value, 50, 1e-6);
  assert.ok(s.draining && !s.exhausted);
  let t = 4;
  while (s.canRun) { s.update(1 / 60, 'run'); t += 1 / 60; }
  near(t, 8, 0.02);
  assert.equal(s.value, 0);
  assert.ok(s.exhausted && !s.canRun);
  near(t * PLAYER.run, 28.8, 0.1);
});

test('회복: 달리기를 멈추고 1초 뒤부터, 걷기 6 · 멈춤 12 · 숨기 15', () => {
  for (const [mode, rate] of [['walk', 6], ['still', 12], ['hidden', 15]]) {
    const s = new Stamina(STAMINA);
    run(s, 'run', 4); // 50
    run(s, mode, 0.95); // 대기
    near(s.value, 50, 1e-6);
    assert.ok(!s.recovering, `${mode}: 대기 중에는 회복 안 함`);
    run(s, mode, 2.05);
    near(s.value, 50 + rate * 2, 1e-6);
    assert.ok(s.recovering);
  }
  // 0 → 100: 걷기 약 17초, 멈춤 약 8초 (대기 제외)
  const w = new Stamina(STAMINA);
  w.value = 0;
  w.sinceRun = STAMINA.RECOVER_DELAY;
  run(w, 'walk', 100 / 6);
  near(w.value, 100, 1e-6);
  const st = new Stamina(STAMINA);
  st.value = 0;
  st.sinceRun = STAMINA.RECOVER_DELAY;
  run(st, 'still', 100 / 12);
  near(st.value, 100, 1e-6);
  assert.ok(!st.recovering || st.full);
  run(st, 'still', 1);
  assert.ok(st.full && !st.recovering, '가득 차면 회복 표시 끝');
});

test('탈진: 0 에 닿으면 달리기 불가, 30 이상 회복해야 해제', () => {
  const s = new Stamina(STAMINA);
  exhaust(s);
  assert.ok(s.exhausted);
  run(s, 'run', 0.5); // 탈진 중 달리기 입력 → 소모 없음, 회복 대기만 흐름 (걷기 속도로 회복)
  assert.ok(!s.draining);
  assert.ok(s.exhausted, '아직 30 미만');
  const s2 = new Stamina(STAMINA);
  exhaust(s2);
  run(s2, 'still', 1 + 29.9 / 12);
  assert.ok(s2.exhausted && s2.value < 30, `${s2.value}`);
  assert.ok(!s2.canRun, '0 보다 커도 탈진 중이면 못 달림');
  run(s2, 'still', 0.1);
  assert.ok(!s2.exhausted && s2.canRun && s2.value >= 30, `${s2.value}`);
  // 해제 뒤에는 다시 달릴 수 있고, 다시 0 이 되면 또 탈진
  exhaust(s2);
  assert.ok(s2.exhausted && s2.value === 0);
});

test('꼼수 방지: 짧게 끊어 달리기를 반복해도 회복 대기가 매번 처음부터 → 결국 탈진', () => {
  // 0.5초 달리고 0.5초 멈추기: 멈춤 0.5초는 회복 대기(1초) 안이라 회복 0 → 쉬지 않고 8초 달린 것과 같은 시점에 탈진
  const s = new Stamina(STAMINA);
  let runTime = 0;
  let prev = s.value;
  let firstAt = null;
  let exhaustions = 0;
  for (let c = 0; c < 60; c++) {
    const wasEx = s.exhausted;
    for (let i = 0; i < 30; i++) {
      if (s.canRun) { s.update(1 / 60, 'run'); runTime += 1 / 60; } else s.update(1 / 60, 'still');
    }
    if (!wasEx && s.exhausted) { exhaustions++; firstAt ??= runTime; }
    run(s, 'still', 0.5);
    if (firstAt === null) {
      assert.ok(s.value <= prev + 1e-9, `${c}: 탈진 전에는 0.5초 쉬어도 회복되지 않음`);
      prev = s.value;
    }
  }
  near(firstAt, 8, 0.05);
  assert.ok(exhaustions >= 2, `탈진 ${exhaustions}회`);
  assert.ok(runTime < 60 * 0.5 * 0.75, `달린 시간 ${runTime.toFixed(1)}초 / 원한 시간 30초`);
});

test('꼼수 방지: 어떤 연타 방식도 장기 평균 속도가 달리기 3.6 에 못 미친다', () => {
  // 달리기/쉬기 길이를 바꿔 가며 120초 동안의 평균 이동 속도를 잰다 (쉬는 동안은 걷기 1.6 으로 계속 이동하는 최선의 경우)
  let best = 0;
  for (const on of [0.1, 0.3, 0.5, 1, 2, 4]) {
    for (const off of [0.1, 0.5, 0.9, 1.5, 3]) {
      const s = new Stamina(STAMINA);
      let dist = 0;
      const dt = 1 / 60;
      let t = 0;
      while (t < 120) {
        for (let i = 0; i < on / dt && t < 120; i++, t += dt) {
          const r = s.canRun;
          s.update(dt, r ? 'run' : 'walk');
          dist += (r ? PLAYER.run : s.exhausted ? STAMINA.EXHAUSTED_SPEED : PLAYER.walk) * dt;
        }
        for (let i = 0; i < off / dt && t < 120; i++, t += dt) {
          s.update(dt, 'walk');
          dist += (s.exhausted ? STAMINA.EXHAUSTED_SPEED : PLAYER.walk) * dt;
        }
      }
      best = Math.max(best, dist / 120);
    }
  }
  // 이론 상한: 회복(걷기 6/s)으로만 달릴 수 있으므로 달리는 비율 ≤ 6 / (12.5 + 6) + 처음 100 의 몫
  assert.ok(best < 2.6, `최고 평균 속도 ${best.toFixed(2)} m/s`);
});

test('탈진 하한: 탈진 직후 짧게 쉬었다 다시 달려도 30 이 차기 전에는 못 달림', () => {
  const s = new Stamina(STAMINA);
  exhaust(s);
  // 해제까지: 대기 1초 + 30/12 = 2.5초 → 3.5초. 0.5초마다 달리기를 시도해도 그 전에는 못 달림
  for (let i = 0; i < 6; i++) {
    run(s, 'still', 0.5);
    s.update(1 / 60, 'run');
    assert.ok(!s.draining && s.exhausted, `${i}: 탈진 중 달리기 입력은 무시 (${s.value.toFixed(1)})`);
  }
  run(s, 'still', 0.5);
  assert.ok(s.canRun && s.value >= 30, `${s.value}`);
  // 해제 직후 30 으로 달릴 수 있는 시간은 2.4초뿐 (짧게 쉬고 길게 달리는 꼼수 차단)
  let t = 0;
  while (s.canRun) { s.update(1 / 60, 'run'); t += 1 / 60; }
  assert.ok(t < 2.6, `${t.toFixed(2)}초`);
});

test('프레임 크기와 무관: 1/30·1/60·1/144 초 스텝이 같은 결과', () => {
  const res = [1 / 30, 1 / 60, 1 / 144].map((dt) => {
    const s = new Stamina(STAMINA);
    run(s, 'run', 3, dt);
    run(s, 'walk', 0.5, dt);
    run(s, 'still', 2.5, dt);
    return s.value;
  });
  near(res[0], res[1], 0.05);
  near(res[1], res[2], 0.05);
  // 회복 대기 경계를 한 스텝이 넘어가도 넘은 만큼만 회복
  const s = new Stamina(STAMINA);
  run(s, 'run', 4);
  s.update(1.5, 'still');
  near(s.value, 50 + 12 * 0.5, 1e-9);
});

test('reset: 가득 찬 상태로', () => {
  const s = new Stamina(STAMINA);
  exhaust(s);
  s.reset();
  assert.ok(s.full && !s.exhausted && s.canRun);
});
