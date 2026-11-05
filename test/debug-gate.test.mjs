// 디버그 잠금 (순수 로직) + 유령 모드 설정값
import test from 'node:test';
import assert from 'node:assert/strict';
import { DebugGate } from '../src/debug/gate.js';
import { DEBUG } from '../src/config.js';

test('비밀번호 3141 이 맞아야 풀린다, 틀리면 잠긴 채 실패 횟수만 센다', () => {
  const g = new DebugGate();
  assert.equal(DEBUG.password, '3141');
  assert.equal(g.unlocked, false);
  for (const bad of ['', '0000', '314', '31410', 'abcd']) assert.equal(g.submit(bad), false);
  assert.equal(g.unlocked, false);
  assert.equal(g.fails, 5);
  assert.equal(g.submit(' 3141 '), true);
  assert.equal(g.unlocked, true);
  assert.equal(g.fails, 0);
});

test('guard: 잠겨 있으면 실행하지 않고, 풀리면 실행한다', () => {
  const g = new DebugGate();
  let n = 0;
  assert.equal(g.guard(() => n++), false);
  assert.equal(n, 0);
  g.submit('3141');
  assert.equal(g.guard(() => n++), true);
  assert.equal(n, 1);
  g.lock();
  assert.equal(g.guard(() => n++), false);
});

test('유령 모드 속도 배율은 1 보다 크다', () => {
  assert.ok(DEBUG.ghostSpeedScale > 1);
});

test('tapCounter: n 번 연속 탭이면 부르고, 간격(함수면 매번 읽음)을 넘으면 처음부터 센다', async () => {
  const { tapCounter } = await import('../src/debug/gateUi.js');
  let fired = 0;
  let win = 1e9;
  const tap = tapCounter(5, () => win, () => fired++);
  for (let i = 0; i < 4; i++) tap();
  assert.equal(fired, 0, '4번은 아직');
  tap();
  assert.equal(fired, 1, '5번째에 부름');
  win = -1; // 간격 0 미만 = 매 탭이 새로 시작
  for (let i = 0; i < 10; i++) tap();
  assert.equal(fired, 1);
  const fixed = tapCounter(2, 1e9, () => fired++); // 숫자도 그대로 된다
  fixed();
  fixed();
  assert.equal(fired, 2);
});
