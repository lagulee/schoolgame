// 귀신 직접 추적 (v1.28): 발자취를 따라 하지 않고 플레이어의 지금 자리를 향해 길을 찾아 쫓아온다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision } from '../src/world/layout.js';
import { addSiteCollision } from '../src/world/interior/site.js';
import { addFurnitureCollision } from '../src/world/interior/furniture.js';
import { Navigator } from '../src/world/nav.js';
import { Pursuer, Route } from '../src/scene/pursuer.js';
import { ChasePath } from '../src/scene/path.js';
import { site, furniture } from './mapWorld.mjs';

const col = new Collision();
addSchoolCollision(col);
const h = addSiteCollision(col, site);
for (const F of furniture) addFurnitureCollision(col, F);
const nav = new Navigator(col);
nav.setPassable(new Set([...h.doors.values(), h.connector.closed]), 'ghost');

const DT = 1 / 30;
const path = new ChasePath({ points: [[16.5, -6], [16.5, -51.5], [-17, -51.5]], startAt: 17.5 });

test('Route: 누적 거리 위 보간', () => {
  const r = new Route([[0, 0, 0], [3, 4, 1], [3, 14, 1]]);
  assert.equal(r.length, 15);
  assert.deepEqual(r.at(2.5), [1.5, 2, 0.5]);
  assert.deepEqual(r.at(99), [3, 14, 1]);
});

test('시작: gap 이 startGap 과 같고, 경로 시작 앞이면 offstage 로 보이지 않게 달려온다', () => {
  const pu = new Pursuer(nav);
  pu.begin(path, 17.5, 20, { x: 16.5, z: -23.5, level: 0 });
  const gap = pu.update(0, 0, { x: 16.5, z: -23.5, level: 0 });
  assert.ok(Math.abs(gap - 20) < 0.5, `gap ${gap}`);
  const pu2 = new Pursuer(nav);
  pu2.begin(path, 7.5, 20, { x: 16.5, z: -14, level: 0 });
  assert.ok(pu2.offstage > 10, `offstage ${pu2.offstage}`);
});

test('직접 추적: 플레이어가 제자리에 있으면 귀신이 최단 길로 와서 따라잡는다', () => {
  const pu = new Pursuer(nav);
  const me = { x: 16.5, z: -23.5, level: 0 };
  pu.begin(path, 17.5, 20, me);
  let gap = 20;
  for (let i = 0; i < 30 * 12 && gap > 1.5; i++) gap = pu.update(DT, 3 * DT, me);
  assert.ok(gap <= 1.5, `gap ${gap}`);
  assert.ok(Math.hypot(pu.x - me.x, pu.z - me.z) < 2);
});

test('플레이어가 길을 꺾어 도망쳐도 귀신은 늘 걸을 수 있는 자리에서 쫓는다', () => {
  // 귀신은 (16.5,-6) 쪽에서 출발. 플레이어는 북쪽으로 20 m 갔다가 서쪽 복도로 꺾는다
  const pu = new Pursuer(nav);
  const me = { x: 16.5, z: -23.5, level: 0 };
  pu.begin(path, 17.5, 12, me);
  const pts = [[16.5, -51.5], [8, -51.5]];
  let total = 0;
  for (const [tx, tz] of pts) {
    while (Math.hypot(tx - me.x, tz - me.z) > 0.05) {
      const d = Math.hypot(tx - me.x, tz - me.z);
      const s = Math.min(d, 3 * DT);
      me.x += ((tx - me.x) / d) * s;
      me.z += ((tz - me.z) / d) * s;
      pu.update(DT, 2.6 * DT, me);
      total++;
    }
  }
  assert.ok(total > 100);
  // 귀신 위치는 늘 걸어 다닐 수 있는 자리(벽 안이 아님)
  assert.ok(!nav.blocked(pu.x, pu.z, 0), '벽 안에 들어감');
});

test('플레이어가 되돌아가면 귀신도 방향을 바꿔 곧장 마주 온다 (옛 지연 따라 하기와 다름)', () => {
  const pu = new Pursuer(nav);
  const me = { x: 16.5, z: -40, level: 0 };
  pu.begin(path, 34, 15, me); // 귀신은 (16.5,-25) 근처
  for (let i = 0; i < 20; i++) pu.update(DT, 2.6 * DT, me);
  const zBefore = pu.z;
  // 플레이어가 남쪽(귀신 쪽)으로 되돌아온다
  for (let i = 0; i < 30; i++) {
    me.z += 3 * DT;
    pu.update(DT, 2.6 * DT, me);
  }
  assert.ok(pu.z < zBefore + 3 || pu.z <= me.z + 0.5);
  const gap = pu.update(DT, 0, me);
  assert.ok(gap < 15 - 2, `gap ${gap}`);
});

test('Navigator 가 없으면 곧장 간다 (대비책)', () => {
  const pu = new Pursuer(null);
  const me = { x: 16.5, z: -23.5, level: 0 };
  pu.begin(path, 17.5, 10, me);
  let gap = 10;
  for (let i = 0; i < 300 && gap > 1; i++) gap = pu.update(DT, 3 * DT, me);
  assert.ok(gap <= 1);
});

test('line(): 귀신 자리에서 플레이어까지 (붙잡힘 장면)', () => {
  const pu = new Pursuer(nav);
  const me = { x: 16.5, z: -23.5, level: 0 };
  pu.begin(path, 17.5, 10, me);
  pu.update(DT, 1, me);
  const line = pu.line(me);
  assert.ok(Math.abs(line.length - pu.update(0, 0, me)) < 0.6);
  const [x, z] = line.at(0);
  assert.ok(Math.hypot(x - pu.x, z - pu.z) < 1e-6);
  const e = line.at(1e9);
  assert.deepEqual([e[0], e[1]], [me.x, me.z]);
});
