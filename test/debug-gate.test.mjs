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
