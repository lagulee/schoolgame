// 단계 8(옛 1b): 본관 실내. 평면(interior/plan.js)을 실제 Collision 에 올려 층·계단·문·난간·소품을 검사한다.
// 격자 탐색은 (x, z, 층) 상태로 하고, 한 칸 옮길 때마다 Collision.levelAt 으로 층을 바꾼다 (계단 경사).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision } from '../src/world/layout.js';
import { buildPlan, addInteriorCollision, yAt, ceilAt, spaceAt } from '../src/world/interior/plan.js';
import { connectorPlan, addConnectorCollision } from '../src/world/interior/connector.js';
import { contains } from '../src/world/interior/rects.js';
import { DIM, INTERIOR, PLAYER } from '../src/config.js';

const data = JSON.parse(readFileSync(new URL('../data/mainInterior.json', import.meta.url), 'utf8'));
const plan = buildPlan(data);
const R = PLAYER.radius;
const STEP = 0.25;
const AREA = { x0: -30, x1: 31, z0: -64, z1: 10 };

// 단계 9 부터 본관 셸 3층에 연결통로 구멍이 있다 → 연결문(닫힘)까지 올려야 본관 안이 닫힌다 (신관 쪽은 annex-interior.test.mjs)
function world(open = []) {
  const col = new Collision();
  addSchoolCollision(col);
  addConnectorCollision(col, connectorPlan());
  const doors = addInteriorCollision(col, plan);
  for (const [id, h] of doors) if (open === 'all' || open.includes(id)) h.on = false;
  return { col, doors };
}

// (x, z, 층) 격자 탐색. 반환: 도달한 상태 목록 + 조회 함수
function explore(col, start) {
  const key = (x, z, lv) => `${Math.round(x / STEP)},${Math.round(z / STEP)},${lv}`;
  const seen = new Map();
  const [sx, sz, sl] = start;
  assert.equal(col.hit(sx, sz, R, sl), false, `시작 칸이 막혀 있음 ${start}`);
  const q = [[sx, sz, sl]];
  seen.set(key(sx, sz, sl), [sx, sz, sl]);
  while (q.length) {
    const [x, z, lv] = q.pop();
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const x2 = x + dx;
      const z2 = z + dz;
      if (x2 < AREA.x0 || x2 > AREA.x1 || z2 < AREA.z0 || z2 > AREA.z1) continue;
      if (col.hit(x + dx / 2, z + dz / 2, R, lv) || col.hit(x2, z2, R, lv)) continue;
      const l2 = col.levelAt(x2, z2, lv);
      const k = key(x2, z2, l2);
      if (seen.has(k)) continue;
      seen.set(k, [x2, z2, l2]);
      q.push([x2, z2, l2]);
    }
  }
  const states = [...seen.values()];
  const can = (x, z, lv) => states.some(([a, b, l]) => l === lv && Math.abs(a - x) <= STEP && Math.abs(b - z) <= STEP);
  return { states, can };
}

const lobby = plan.spaces.find((s) => s.kind === 'lobby');
const START = [(lobby.rect[0] + lobby.rect[2]) / 2, (lobby.rect[1] + lobby.rect[3]) / 2, 0];
const roomCenter = (id) => {
  const r = plan.spaces.find((s) => s.id === id);
  return [(r.rect[0] + r.rect[2]) / 2, (r.rect[1] + r.rect[3]) / 2, r.L];
};
const enterable = plan.doors.filter((d) => !d.locked).map((d) => d.id);
const opened = explore(world(enterable).col, START);
const closed = explore(world([]).col, START);

test('층 구성: 층당 반 4개, 1층 반 2 + 행정실 + 상담실, 2층 교무실, 3층 연결통로 입구, 4층 당직실 (STORY 4-1)', () => {
  const rooms = (L, kind) => plan.spaces.filter((s) => s.L === L && s.kind === kind);
  assert.equal(rooms(0, 'classroom').length, 2);
  assert.equal(rooms(0, 'admin').length, 1);
  assert.equal(rooms(0, 'counsel').length, 1);
  for (const L of [1, 2, 3, 4]) assert.equal(rooms(L, 'classroom').length, 4, `${L + 1}층 반 수`);
  assert.equal(rooms(1, 'staff').length, 1);
  assert.equal(rooms(2, 'passage').length, 1);
  assert.equal(rooms(3, 'duty').length, 1);
  const enter = plan.spaces.filter((s) => s.enter).map((s) => s.id).sort();
  assert.deepEqual(enter, ['1F-1', '1F-2', '1F-admin', '1F-counsel', '2F-staff', '4F-3', '4F-duty'].sort(), '들어갈 수 있는 방 (STORY 4-1 반 수 조정)');
  assert.equal(data.levels, DIM.floors);
});

test('층 높이: 1층 바닥 = 현관 계단 위, 층마다 floorH, 5층 천장 = 지붕 슬래브 아래', () => {
  assert.ok(Math.abs(yAt(0) - DIM.steps.count * DIM.steps.rise) < 1e-9);
  for (let L = 1; L < data.levels; L++) assert.ok(Math.abs(yAt(L) - yAt(L - 1) - DIM.floorH) < 1e-9);
  assert.ok(Math.abs(ceilAt(plan.top, plan.top) - (DIM.floors * DIM.floorH - INTERIOR.slab)) < 1e-9);
  for (let L = 0; L < plan.top; L++) assert.ok(ceilAt(L, plan.top) - yAt(L) > INTERIOR.door.h + 0.5, '문 위에 여유');
});

test('현관에서 계단 두 곳으로 1~5층 복도를 모두 오르내린다', () => {
  const N = plan.spaces.find((s) => s.id === 'N');
  for (let L = 0; L < data.levels; L++) {
    assert.ok(opened.can((N.rect[0] + N.rect[2]) / 2, (N.rect[1] + N.rect[3]) / 2, L), `${L + 1}층 북쪽 복도`);
    for (const st of plan.stairs) {
      const [x0, z0, x1, z1] = st.near;
      assert.ok(opened.can((x0 + x1) / 2, (z0 + z1) / 2, L), `${st.id} ${L + 1}층 계단 앞`);
      if (L < plan.top) assert.ok(opened.can((st.far[0] + st.far[2]) / 2, (st.far[1] + st.far[3]) / 2, L + 0.5), `${st.id} ${L + 1}층 위 계단참`);
    }
  }
  assert.ok(!opened.states.some(([, , l]) => l > plan.top), '5층 위(옥상)로는 못 간다');
});

test('열 수 있는 방은 문을 열면 들어가고, 잠긴 방은 들어갈 수 없다', () => {
  for (const s of plan.spaces.filter((s) => !s.hall)) {
    const [x, z, L] = roomCenter(s.id);
    assert.equal(opened.can(x, z, L), !!s.enter, `${s.id} (${s.name}) ${s.enter ? '열림' : '잠김'}`);
    assert.equal(closed.can(x, z, L), false, `${s.id} 문을 닫으면 못 들어감`);
  }
});

test('빈 공간·중정·건물 밖으로 새지 않는다 (현관 유리문이 닫혀 있으면)', () => {
  const e = plan.entrance;
  for (const [x, z, l] of opened.states) {
    const ok = spaceAt(plan, x, z, l) || contains(e.threshold, x, z);
    assert.ok(ok, `공간 밖 (${x}, ${z}) 층 ${l}`);
    assert.ok(!(contains(plan.court, x, z) && x > plan.court[0] && x < plan.court[2] && z > plan.court[1] && z < plan.court[3]), `중정 안 (${x}, ${z}) 층 ${l}`);
  }
});

test('난간·벽에 닿은 자리: 중정 쪽은 난간이 막고, 계단 두 줄 사이는 칸막이가 막는다', () => {
  const { col } = world('all');
  for (let L = 0; L < data.levels; L++) {
    const p = { x: 3.75, z: -51.5 }; // 기둥(0, 7.5) 사이
    for (let i = 0; i < 100; i++) col.move(p, 0, 0.05, R, L);
    assert.ok(Math.abs(p.z - (plan.court[1] - INTERIOR.rail.t - R)) < 0.06, `${L + 1}층 북쪽 난간에서 멈춤 z = ${p.z}`);
  }
  const st = plan.stairs[0];
  const p = { x: (st.laneA[0] + st.laneA[2]) / 2, z: (st.laneA[1] + st.laneA[3]) / 2 };
  for (let i = 0; i < 60; i++) col.move(p, 0, -0.05, R, 0);
  assert.ok(p.z >= st.divider[3] + R - 0.01, `칸막이에서 멈춤 z = ${p.z}`);
});

test('계단을 걸어 오르면 높이가 끊기지 않고 이어진다 (S1: 1층 → 2층)', () => {
  const { col } = world('all');
  const st = plan.stairs.find((s) => s.id === 'S1');
  const sign = st.open === 'w' ? 1 : -1;
  const s = { x: st.near[0] + 0.7 * (st.near[2] - st.near[0]), z: (st.laneA[1] + st.laneA[3]) / 2, level: 0 };
  let y = col.floorHeight(s.x, s.z, 0);
  let maxJump = 0;
  const walk = (dx, dz, n) => {
    for (let i = 0; i < n; i++) {
      col.move(s, dx, dz, R, s.level);
      s.level = col.levelAt(s.x, s.z, s.level);
      const y2 = col.floorHeight(s.x, s.z, s.level);
      maxJump = Math.max(maxJump, Math.abs(y2 - y));
      y = y2;
    }
  };
  walk(0.05 * sign, 0, 140);
  assert.equal(s.level, 0.5);
  walk(0, -0.05, 60);
  walk(-0.05 * sign, 0, 140);
  assert.equal(s.level, 1);
  assert.ok(Math.abs(y - yAt(1)) < 1e-9, `2층 높이 ${y}`);
  assert.ok(maxJump < 0.06, `한 걸음 높이 변화 ${maxJump}`);
});

test('복도 소품(소화전함·사물함·게시판·소화기)은 모든 층에서 벽에 붙어 있고, 문 앞을 막지 않는다', () => {
  const walls = (L) => plan.walls.filter((w) => w.L === L).map((w) => w.rect);
  const N = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  for (const p of plan.props) {
    const [nx, nz] = N[p.f];
    const cx = (p.rect[0] + p.rect[2]) / 2;
    const cz = (p.rect[1] + p.rect[3]) / 2;
    // 소품 뒤쪽(벽 쪽) 5 cm
    const bx = nx ? (nx < 0 ? p.rect[2] : p.rect[0]) - nx * 0.05 : cx;
    const bz = nz ? (nz < 0 ? p.rect[3] : p.rect[1]) - nz * 0.05 : cz;
    const back = p.type === 'extinguisher' ? [cx - nx * 0.25, cz - nz * 0.25] : [bx, bz];
    assert.ok(walls(p.L).some((r) => contains(r, ...back)), `${p.type} (${cx.toFixed(1)}, ${cz.toFixed(1)}) ${p.L + 1}층 뒤에 벽 없음`);
    for (const d of plan.doors.filter((d) => d.L === p.L)) {
      const [dx, dz] = d.pos;
      const r = 0.5 + d.w / 2;
      const hitDoor = p.rect[0] < dx + r && p.rect[2] > dx - r && p.rect[1] < dz + r && p.rect[3] > dz - r;
      assert.ok(!hitDoor, `${p.type} 가 ${d.id} 문 앞을 막음`);
    }
  }
});

test('창은 외벽 쪽 방에만, 외벽 창(FacadeKit)과 같은 높이', () => {
  assert.ok(plan.windows.length > 0);
  for (const w of plan.windows) {
    const s = plan.spaces.find((x) => x.id === w.room && x.L === w.L);
    assert.ok(s.windows.includes(w.side), `${w.room} ${w.side}`);
    assert.ok(Math.abs(w.y - (w.L * DIM.floorH + DIM.window.sill + DIM.window.h / 2)) < 1e-9);
  }
  const classrooms = plan.spaces.filter((s) => s.kind === 'classroom');
  for (const c of classrooms) assert.ok(plan.windows.filter((w) => w.room === c.id).length >= 4, `${c.id} 창 4개 이상`);
});

test('가구: 들어갈 수 있는 방마다 있고, 방 안·천장 아래에 있으며, 문 안쪽과 방 앞쪽까지 걸어갈 수 있다', async () => {
  const { furniturePlan, addFurnitureCollision } = await import('../src/world/interior/furniture.js');
  const FP = furniturePlan(plan);
  const rooms = plan.spaces.filter((s) => s.enter);
  for (const r of rooms) {
    const [x0, z0, x1, z1] = r.rect;
    const mine = FP.items.filter((it) => it.L === r.L && it.mat !== 'fixture' && it.b[0] >= x0 - 1e-6 && it.b[3] <= x1 + 1e-6 && it.b[2] >= z0 - 1e-6 && it.b[5] <= z1 + 1e-6);
    assert.ok(mine.length > 10, `${r.id} 가구 ${mine.length}개`);
    for (const it of mine) assert.ok(it.b[4] <= ceilAt(r.L, plan.top) + 1e-6 && it.b[1] >= yAt(r.L) - 1e-6, `${r.id} ${it.mat} 높이`);
  }
  for (const s of FP.solids) {
    const r = rooms.find((x) => x.L === s.level && contains(x.rect, (s.rect[0] + s.rect[2]) / 2, (s.rect[1] + s.rect[3]) / 2));
    assert.ok(r || plan.spaces.some((x) => x.kind === 'lobby' && contains(x.rect, s.rect[0], s.rect[1])), `방 밖 가구 ${s.rect}`);
  }
  const { col } = world(enterable);
  addFurnitureCollision(col, FP);
  const walk = explore(col, START);
  for (const d of plan.doors.filter((x) => !x.locked)) {
    const [px, pz] = d.pos;
    const [nx, nz] = d.normal; // 방 바깥(복도) 쪽
    assert.ok(walk.can(px - nx * 0.9, pz - nz * 0.9, d.L), `${d.id} 문 안쪽 0.9 m`);
  }
  for (const c of rooms.filter((r) => r.kind === 'classroom')) {
    const [x0, z0, x1, z1] = c.rect;
    assert.ok(walk.can(x1 - 1.2, (z0 + z1) / 2 + 2.6, c.L), `${c.id} 칠판 앞 (교탁 옆)`);
  }
});
