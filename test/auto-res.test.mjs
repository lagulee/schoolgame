// 자동 해상도 (v1.28.8): FPS 가 목표에 못 미칠 때만 한 칸씩 내려가고, 긴 프레임(탭 전환·headless)은 세지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoRes } from '../src/ui/autoRes.js';
import { PERF_TUNE } from '../src/config.js';

const cfg = PERF_TUNE.autoRes;
const run = (a, fps, seconds) => { for (let t = 0; t < seconds; t += 1 / fps) a.frame(1 / fps); };

test('60fps 면 해상도를 그대로 둔다', () => {
  const a = new AutoRes(cfg);
  run(a, 60, 30);
  assert.equal(a.scale, 1);
});

test('낮은 FPS 가 이어지면 한 칸씩 내려가 마지막 칸에서 멈춘다', () => {
  const seen = [];
  const a = new AutoRes(cfg, (s) => seen.push(s));
  run(a, 20, cfg.settle + cfg.window + 0.5);
  assert.equal(a.scale, cfg.steps[1]);
  run(a, 20, 120);
  assert.equal(a.scale, cfg.steps.at(-1));
  assert.deepEqual(seen, cfg.steps.slice(1));
});

test('긴 프레임(탭 전환·일시정지·headless)은 세지 않는다', () => {
  const a = new AutoRes(cfg);
  for (let i = 0; i < 200; i++) a.frame(cfg.maxGap + 0.1);
  a.frame(0);
  assert.equal(a.scale, 1);
});

test('품질을 바꾸면(reset) 처음 배율로 돌아간다', () => {
  const a = new AutoRes(cfg);
  run(a, 15, 20);
  assert.ok(a.scale < 1);
  a.reset();
  assert.equal(a.scale, 1);
});

test('배율 단계는 내림차순이고 최소 배율 이상이다', () => {
  for (let i = 1; i < cfg.steps.length; i++) assert.ok(cfg.steps[i] < cfg.steps[i - 1]);
  assert.ok(cfg.steps.at(-1) >= cfg.minRatio && cfg.target < 60);
});
