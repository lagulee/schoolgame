// 일시정지(ESC): 상태 전환·시작 전 금지·중복 호출 무시
import test from 'node:test';
import assert from 'node:assert/strict';
import { PauseState } from '../src/ui/pause.js';

function make(started = true) {
  const log = [];
  const s = { started };
  const p = new PauseState({ canPause: () => s.started, onPause: () => log.push('pause'), onResume: () => log.push('resume') });
  return { p, s, log };
}

test('일시정지 ↔ 재개가 한 번씩만 알려진다', () => {
  const { p, log } = make();
  assert.equal(p.paused, false);
  assert.equal(p.set(true), true);
  p.set(true); // 중복
  assert.equal(p.set(false), false);
  p.set(false); // 중복
  assert.deepEqual(log, ['pause', 'resume']);
});

test('시작 전에는 일시정지되지 않는다', () => {
  const { p, s, log } = make(false);
  assert.equal(p.set(true), false);
  assert.deepEqual(log, []);
  s.started = true;
  assert.equal(p.toggle(), true);
  assert.equal(p.toggle(), false);
  assert.deepEqual(log, ['pause', 'resume']);
});

test('main.js 루프: 일시정지 중에는 step 을 건너뛴다 (정적 점검)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const loop = src.slice(src.lastIndexOf('renderer.setAnimationLoop'));
  assert.ok(loop.indexOf('pause.paused') > 0 && loop.indexOf('pause.paused') < loop.indexOf('step(t, dt)'));
  assert.match(src, /audio\.pause\(\)/);
  assert.match(src, /audio\.resume\(\)/);
});
