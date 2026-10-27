// 단계 8(옛 1b-1): Collision 의 층(level). 층을 생략한 기존 호출이 그대로 동작하는지(하위 호환)와
// 층별 충돌·바닥·경사(계단)·층 전환을 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collision } from '../src/player/collision.js';

const R = 0.3;

test('하위 호환: 층을 생략하면 level 0 — hit·move·floorHeight·surfaceAt·rayDistance 가 이전과 같다', () => {
  const col = new Collision();
  col.box(-1, -1, 1, 1);
  col.circle(5, 0, 0.5);
  col.floor(10, -1, 12, 1, 0.45);
  col.surface(10, -1, 12, 1, 'stone');
  assert.equal(col.hit(0, 0, R), true);
  assert.equal(col.hit(0, 0, R, 0), true);
  assert.equal(col.hit(3, 0, R), false);
  assert.equal(col.hit(5.6, 0, R), true);
  // 벽 슬라이딩: 대각선으로 밀면 막힌 축만 취소
  const p = { x: -3, z: 0.5 };
  col.move(p, 2, 0.2, R);
  assert.ok(Math.abs(p.x - -1.3) < 0.2 && p.z > 0.5, JSON.stringify(p));
  assert.equal(col.floorHeight(11, 0), 0.45);
  assert.equal(col.floorHeight(20, 0), 0);
  assert.equal(col.surfaceAt(11, 0), 'stone');
  assert.equal(col.surfaceAt(20, 0), 'brick');
  assert.ok(Math.abs(col.rayDistance(-5, 0, 1, 0, 50) - 4) < 1e-9);
  assert.ok(Math.abs(col.rayDistance(0, 3, 1, 0, 50) - 50) < 1e-9);
});

test('층마다 따로: 1층 벽은 2층을 막지 않고, 범위로 넣은 셸 벽은 모든 층·계단참을 막는다', () => {
  const col = new Collision();
  col.box(0, 0, 1, 1); // 1층(바깥)
  col.box(3, 0, 4, 1, 1); // 2층
  col.box(6, 0, 7, 1, [0, 4]); // 외벽 셸
  assert.equal(col.hit(0.5, 0.5, R, 0), true);
  assert.equal(col.hit(0.5, 0.5, R, 1), false);
  assert.equal(col.hit(3.5, 0.5, R, 0), false);
  assert.equal(col.hit(3.5, 0.5, R, 1), true);
  for (const lv of [0, 0.5, 1, 2.5, 4]) assert.equal(col.hit(6.5, 0.5, R, lv), true, `셸 level ${lv}`);
  assert.equal(col.hit(6.5, 0.5, R, 5), false);
  assert.ok(Math.abs(col.rayDistance(2, 0.5, 1, 0, 20, 0) - 4) < 1e-9, '1층 광선은 2층 벽을 지나친다');
  assert.ok(Math.abs(col.rayDistance(2, 0.5, 1, 0, 20, 1) - 1) < 1e-9);
  const p = { x: 2, z: 0.5 };
  col.move(p, 3, 0, R, 0);
  assert.ok(p.x > 4.9 && p.x < 5.71, `1층에서는 2층 벽을 지나 셸에서 멈춤 ${p.x}`);
});

test('바닥·재질도 층마다: 같은 xz 라도 층마다 높이가 다르다', () => {
  const col = new Collision();
  col.floor(0, 0, 10, 10, 0.45, 0);
  col.floor(0, 0, 10, 10, 4.05, 1);
  col.surface(0, 0, 10, 10, 'tile', [0, 4]);
  assert.equal(col.floorHeight(5, 5, 0), 0.45);
  assert.equal(col.floorHeight(5, 5, 1), 4.05);
  assert.equal(col.floorHeight(5, 5, 2), 0);
  assert.equal(col.surfaceAt(5, 5, 3), 'tile');
  assert.equal(col.surfaceAt(5, 5, 5), 'brick');
});

test('열린 문: on = false 인 박스는 무시하고 다시 닫으면 막는다', () => {
  const col = new Collision();
  const door = col.box(0, -1, 0.1, 1);
  assert.equal(col.hit(0, 0, R), true);
  door.on = false;
  assert.equal(col.hit(0, 0, R), false);
  assert.ok(col.rayDistance(-2, 0, 1, 0, 10) === 10);
  door.on = true;
  assert.equal(col.hit(0, 0, R), true);
});

// ㄷ자로 꺾이는 계단 하나 (2줄 + 계단참): 왼쪽 줄 0 → 0.5 층, 오른쪽 줄 0.5 → 1 층
function dogLeg() {
  const col = new Collision();
  const H = 3.6;
  const y0 = 0.45;
  col.floor(0, 0, 1.5, 3, y0, 0); // 1층 계단 앞 (x 0~1.5)
  col.floor(0, 0, 1.5, 3, y0 + H, 1); // 2층 계단 앞
  col.ramp({ x0: 1.5, z0: 0, x1: 5, z1: 1.5, dir: 'x+', h0: y0, h1: y0 + H / 2, lo: 0, hi: 0.5 });
  col.floor(5, 0, 6.5, 3, y0 + H / 2, 0.5); // 계단참
  col.ramp({ x0: 1.5, z0: 1.5, x1: 5, z1: 3, dir: 'x-', h0: y0 + H / 2, h1: y0 + H, lo: 0.5, hi: 1 });
  col.box(1.5, 1.45, 5, 1.55, [0, 1]); // 두 줄 사이 칸막이
  col.box(-0.1, -0.1, 6.6, 0, [0, 1]); // 계단실 벽
  col.box(-0.1, 3, 6.6, 3.1, [0, 1]);
  col.box(6.5, 0, 6.6, 3, [0, 1]);
  return { col, H, y0 };
}

// 플레이어처럼 이동 → 층 갱신 → 바닥 높이
function walk(col, st, dx, dz, n) {
  for (let i = 0; i < n; i++) {
    col.move(st, dx, dz, R, st.level);
    st.level = col.levelAt(st.x, st.z, st.level);
    st.y = col.floorHeight(st.x, st.z, st.level);
  }
  return st;
}

test('경사: 높이를 이어서 계산하고, 가운데를 넘으면 위끝 층으로 바뀐다', () => {
  const { col, H, y0 } = dogLeg();
  assert.ok(Math.abs(col.floorHeight(3.25, 0.75, 0) - (y0 + H / 4)) < 1e-9);
  assert.equal(col.levelAt(2, 0.75, 0), 0);
  assert.equal(col.levelAt(4.5, 0.75, 0), 0.5);
  assert.equal(col.levelAt(2, 0.75, 0.5), 0, '내려오면 다시 아래끝 층');
  assert.equal(col.levelAt(2, 2.25, 0.5), 1);
  assert.equal(col.levelAt(2, 2.25, 1), 1);
  // 1층에서 오른쪽 줄(0.5 → 1)은 보이지 않는다: 그 자리는 1층 바닥이 없는 칸 (높이 0)
  assert.equal(col.rampAt(2, 2.25, 0), null);
});

test('ㄷ자 계단을 걸어 올라가 2층에 도착하고, 다시 내려오면 1층이다', () => {
  const { col, H, y0 } = dogLeg();
  const st = { x: 0.7, z: 0.75, level: 0, y: y0 };
  walk(col, st, 0.05, 0, 120); // 왼쪽 줄을 따라 계단참까지
  assert.equal(st.level, 0.5);
  assert.ok(Math.abs(st.y - (y0 + H / 2)) < 1e-9, `계단참 높이 ${st.y}`);
  walk(col, st, 0, 0.05, 30); // 계단참에서 오른쪽 줄 쪽으로
  walk(col, st, -0.05, 0, 110); // 오른쪽 줄을 따라 위로 (계단 앞은 복도 쪽으로 열려 있어 5.5 m 만)
  assert.equal(st.level, 1);
  assert.ok(Math.abs(st.y - (y0 + H)) < 1e-9, `2층 높이 ${st.y}`);
  assert.ok(st.x > 0 && st.x < 1.5, `2층 계단 앞에 도착 x = ${st.x}`);
  // 내려가기: 오른쪽 줄 → 계단참 → 왼쪽 줄 → 1층
  walk(col, st, 0.05, 0, 140);
  walk(col, st, 0, -0.05, 30);
  walk(col, st, -0.05, 0, 110);
  assert.equal(st.level, 0);
  assert.ok(Math.abs(st.y - y0) < 1e-9 && st.x > 0 && st.x < 1.5, `1층 계단 앞 ${JSON.stringify(st)}`);
});

test('계단 두 줄 사이 칸막이: 같은 높이 구간이 아니면 옆 줄로 건너갈 수 없다', () => {
  const { col } = dogLeg();
  const st = { x: 3, z: 0.75, level: 0, y: 0 };
  walk(col, st, 0, 0.05, 40);
  assert.ok(st.z < 1.45 - R + 0.01, `칸막이에서 멈춤 z = ${st.z}`);
});
