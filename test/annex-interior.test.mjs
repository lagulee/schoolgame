// 단계 9(옛 1c): 신관 실내·3층 연결통로·연결문. 본관·신관·통로 평면(interior/site.js)을 실제 Collision 에 올려
// (x, z, 층) 격자 탐색으로 왕복·층 이동·잠김을 검사한다 (interior.test.mjs 와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision, bridgeFloorY, bridgeOpening } from '../src/world/layout.js';
import { buildSite, addSiteCollision, locate } from '../src/world/interior/site.js';
import { ConnectorState } from '../src/world/interior/connector.js';
import { furniturePlan } from '../src/world/interior/furniture.js';
import { yAt, ceilAt } from '../src/world/interior/plan.js';
import { contains } from '../src/world/interior/rects.js';
import { DIM, SCHOOL, PLAYER, INTERIOR, STORY } from '../src/config.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const mainData = read('mainInterior.json');
const annexData = read('annexInterior.json');
const site = buildSite(mainData, annexData);
const A = site.annex;
const R = PLAYER.radius;
const STEP = 0.25;
const AREA = { x0: -30, x1: 31, z0: -96, z1: 10 };
const inAnnex = (x, z) => x > SCHOOL.annex.x0 && x < SCHOOL.annex.x1 && z > SCHOOL.annex.z0 && z < SCHOOL.annex.z1;

// open: 열 문 id 목록 | 'all'(현관 유리문 빼고 전부). connector: 연결문 열림
function world({ open = [], connector = false } = {}) {
  const col = new Collision();
  addSchoolCollision(col);
  const h = addSiteCollision(col, site);
  for (const [id, d] of h.doors) if ((open === 'all' && id !== 'entrance') || open.includes(id)) d.on = false;
  const st = new ConnectorState(site.bridge, h.connector, () => true);
  if (connector) st.set(true);
  return { col, h, st };
}

// (x, z, 층) 격자 탐색. skip(x, z, 층) 이 참인 칸은 밟지 않는다
function explore(col, start, skip = () => false) {
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
      if (skip(x2, z2, l2)) continue;
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

const center = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
const lobby = site.main.spaces.find((s) => s.kind === 'lobby');
const START = [...center(lobby.rect), 0];
const corridor = A.spaces.find((s) => s.id === 'AC' && s.L === 2);
const ANNEX3 = [...center(corridor.rect), 2];
const enterable = [...site.main.doors, ...A.doors].filter((d) => !d.locked).map((d) => d.id);
const openWorld = world({ open: enterable, connector: true });
const opened = explore(openWorld.col, START);

test('신관 층 구성: 5층, 층당 반 3개, 복도 양끝 계단 2개, 3층 연결통로 출구, 2층 야자 교실 (STORY 4-1)', () => {
  assert.equal(annexData.levels, DIM.floors);
  for (let L = 0; L < A.levels; L++) {
    const cls = A.spaces.filter((s) => s.L === L && (s.kind === 'classroom' || s.kind === 'yaja'));
    assert.equal(cls.length, 3, `${L + 1}층 반 수`);
    assert.equal(A.spaces.filter((s) => s.L === L && s.kind === 'corridor').length, 1, `${L + 1}층 복도 하나 (편복도)`);
  }
  assert.equal(A.stairs.length, 2);
  const [x0, , x1] = corridor.rect;
  assert.deepEqual(A.stairs.map((s) => (s.open === 'e' ? s.rect[2] : s.rect[0])).sort((a, b) => a - b), [x0, x1], '계단 입구 = 복도 양끝');
  const hall = A.spaces.filter((s) => s.openings?.some((o) => o.to === 'bridge'));
  assert.deepEqual(hall.map((s) => s.L), [SCHOOL.bridge.floor], '연결통로 출구는 3층에만');
  // 바깥 야자 교실 창(annex.js)과 같은 자리
  assert.deepEqual(annexData.band.slots, SCHOOL.annex.classes);
  const yaja = A.spaces.filter((s) => s.kind === 'yaja');
  assert.equal(yaja.length, 1);
  assert.equal(yaja[0].L, SCHOOL.annex.yaja.floor);
  assert.equal(yaja[0].slot, SCHOOL.annex.yaja.cls);
  // 모든 칸이 신관 셸 안쪽
  const w = SCHOOL.shellWall;
  const S = SCHOOL.annex;
  for (const s of [...A.spaces, ...A.stairs]) {
    const [a, b, c, d] = s.rect;
    assert.ok(a >= S.x0 + w - 1e-9 && c <= S.x1 - w + 1e-9 && b >= S.z0 + w - 1e-9 && d <= S.z1 - w + 1e-9, `${s.id} 셸 밖`);
  }
  const enter = A.spaces.filter((s) => s.enter).map((s) => s.id).sort();
  assert.deepEqual(enter, ['A2F-1', 'A2F-2', 'A2F-3', 'A3F-2', 'A3F-3', 'A4F-2', 'A5F-2'].sort(), '들어갈 수 있는 방: 야자 교실 + P3 교실 4개 + 4층·5층 책 교실');
});

test('연결통로 바닥 = 본관 3층 = 신관 3층 = 7.65 m, 통로 천장 = 3층 천장', () => {
  const L = SCHOOL.bridge.floor;
  assert.ok(Math.abs(bridgeFloorY() - 7.65) < 1e-9);
  assert.ok(Math.abs(yAt(L) - bridgeFloorY()) < 1e-9);
  assert.ok(Math.abs(site.bridge.y - yAt(L)) < 1e-9);
  assert.ok(Math.abs(bridgeOpening().y1 - ceilAt(L, A.top)) < 1e-9, '통로 천장 = 3층 천장 (셸 구멍 위끝)');
  const { col } = openWorld;
  for (const z of [-62.5, -72.5, -82.5]) assert.ok(Math.abs(col.floorHeight(18.5, z, L) - 7.65) < 1e-9, `통로 바닥 z = ${z}`);
});

test('본관 3층 ↔ 신관 3층 왕복: 연결문을 열면 현관에서 신관 3층까지, 신관 3층에서 현관까지 걸어간다', () => {
  assert.ok(opened.can(...ANNEX3), '현관 → 신관 3층 복도');
  const hall = A.spaces.find((s) => s.id === 'A3F-hall');
  assert.ok(opened.can(...center(hall.rect), 2), '현관 → 신관 3층 연결통로 출구 홀');
  const back = explore(openWorld.col, ANNEX3);
  assert.ok(back.can(...START), '신관 3층 → 현관');
  // 실제 이동: 본관 3층 연결통로 입구에서 북쪽으로 걸어 신관 3층 홀까지. 층·높이가 그대로 이어진다
  const { col } = openWorld;
  const p = { x: 18.9, z: -55, level: 2 };
  let maxJump = 0;
  let y = col.floorHeight(p.x, p.z, p.level);
  for (let i = 0; i < 700 && p.z > -86; i++) {
    col.move(p, 0, -0.05, R, p.level);
    p.level = col.levelAt(p.x, p.z, p.level);
    const y2 = col.floorHeight(p.x, p.z, p.level);
    maxJump = Math.max(maxJump, Math.abs(y2 - y));
    y = y2;
  }
  assert.ok(p.z <= -86, `신관 홀까지 감 z = ${p.z}`);
  assert.equal(p.level, 2);
  assert.ok(maxJump < 1e-9 && Math.abs(y - 7.65) < 1e-9, `통로 바닥 높이 이어짐 (변화 ${maxJump})`);
  assert.equal(locate(site, p.x, p.z, 2)?.where, 'annex');
  assert.equal(locate(site, 18.5, -72, 2)?.where, 'bridge');
});

test('연결문: 열쇠(hasConnectorKey)가 없으면 잠김, 있으면 열리고 닫힌다. 닫혀 있으면 신관으로 못 간다', () => {
  const col = new Collision();
  addSchoolCollision(col);
  const h = addSiteCollision(col, site);
  for (const [id, d] of h.doors) if (enterable.includes(id)) d.on = false;
  const flags = { hasConnectorKey: false };
  const st = new ConnectorState(site.bridge, h.connector, (n) => flags[n] === true);
  const far = { pos: { x: 18.5, z: -57 }, level: 2 };
  assert.equal(st.use(far), 'locked');
  assert.equal(h.connector.closed.on, true);
  const shut = explore(col, START);
  assert.ok(!shut.states.some(([x, z]) => inAnnex(x, z) || z < SCHOOL.main.backZ), '닫힌 연결문 너머로 못 감');
  assert.ok(shut.can(18.5, -57, 2), '연결문 앞(본관 3층 연결통로 입구)까지는 감');
  flags.hasConnectorKey = true;
  const inSweep = { pos: { x: 18.6, z: -62.6 }, level: 2 };
  assert.equal(st.use(inSweep), 'blocked', '문짝이 쓸고 갈 자리에 서 있으면 열지 않음');
  const pressed = { pos: { x: 18.5, z: -61.35 }, level: 2 }; // 본관 쪽에서 닫힌 문에 바짝 붙음
  assert.equal(st.use(pressed), 'open', '문짝은 신관 쪽으로 열리므로 본관 쪽에 붙어 있어도 열린다');
  st.set(false);
  assert.equal(st.use(far), 'open');
  assert.equal(h.connector.closed.on, false);
  assert.equal(h.connector.open.on, true);
  st.update(2, far);
  assert.equal(st.f, 1);
  assert.ok(explore(col, START).can(...ANNEX3), '열면 신관 3층까지');
  const doorway = { pos: { x: 18.5, z: -61.8 }, level: 2 }; // 셸 구멍(문 자리)에 서 있음
  assert.equal(st.use(doorway), 'blocked', '문 자리에 서 있으면 닫지 않음');
  assert.equal(st.use(far), 'close');
  st.update(2, far);
  assert.equal(st.f, 0);
  assert.equal(h.connector.closed.on, true);
  assert.equal(h.connector.open.on, false);
});

test('신관 층 이동: 3층에서 2·4·5층으로 가고, 1층은 2층 계단 방화셔터에 막힌다', () => {
  for (let L = 1; L < A.levels; L++) {
    const c = A.spaces.find((s) => s.id === 'AC' && s.L === L);
    assert.ok(opened.can(...center(c.rect), L), `신관 ${L + 1}층 복도`);
    for (const st of A.stairs) assert.ok(opened.can(...center(st.near), L), `${st.id} ${L + 1}층 계단 앞`);
  }
  assert.ok(!opened.states.some(([x, z, l]) => inAnnex(x, z) && l < 1), '신관 1층·1~2층 계단참에는 못 간다');
  const sh = A.stairs.flatMap((st) => st.blocks.filter((b) => b.kind === 'shutter'));
  assert.equal(sh.length, 2, '양쪽 계단 모두 셔터');
  for (const b of sh) assert.deepEqual(b.level, [0.5, 1]);
  assert.ok(!opened.states.some(([x, z, l]) => inAnnex(x, z) && l > A.top), '5층 위(옥상)로는 못 간다');
});

test('신관 5층은 4층(계단 앞)을 밟아야만 간다 (E5 "계단에서 4층을 지난다", earlyBook 근거)', () => {
  const top = A.top;
  assert.ok(opened.states.some(([x, z, l]) => inAnnex(x, z) && l === top), '평소에는 5층에 간다');
  const skip4 = explore(openWorld.col, START, (x, z, l) => inAnnex(x, z) && l === top - 1);
  assert.ok(!skip4.states.some(([x, z, l]) => inAnnex(x, z) && l >= top - 1), '4층을 건너뛰면 5층에 못 간다');
  assert.ok(skip4.can(...ANNEX3), '3층까지는 그대로');
});

test('열린 방은 들어가고 잠긴 방은 막힌다. 5층 내 책 교실은 열쇠 문(hasClassKey), 야자 교실 뒷문은 열린 채 시작', () => {
  const closedWorld = explore(world({ connector: true }).col, START);
  for (const s of A.spaces.filter((t) => !t.hall)) {
    const [x, z] = center(s.rect);
    if (s.L === 0) continue; // 1층은 가지 못한다 (위 테스트)
    assert.equal(opened.can(x, z, s.L), !!s.enter, `${s.id} (${s.name}) ${s.enter ? '열림' : '잠김'}`);
    const startsOpen = A.doors.some((d) => d.room === s.id && d.open);
    if (!startsOpen) assert.equal(closedWorld.can(x, z, s.L), false, `${s.id} 문을 닫으면 못 들어감`);
  }
  const key = A.doors.filter((d) => d.key);
  assert.ok(key.length > 0 && key.every((d) => d.room === 'A5F-2' && d.key === 'hasClassKey'), '열쇠 문 = 5층 2-13');
  const yajaDoors = A.doors.filter((d) => d.room === 'A2F-3');
  assert.deepEqual(yajaDoors.map((d) => d.open), [false, true], '야자 교실: 앞문 닫힘, 뒷문 열림');
});

test('신관·통로 어디서도 빈 공간·건물 밖으로 새지 않는다 (현관 유리문 말고 모든 문을 연 상태)', () => {
  const e = site.main.entrance;
  const all = explore(world({ open: 'all', connector: true }).col, START);
  for (const [x, z, l] of all.states) {
    const ok = locate(site, x, z, l) || contains(e.threshold, x, z);
    assert.ok(ok, `공간 밖 (${x}, ${z}) 층 ${l}`);
  }
  assert.ok(all.states.some(([x, z]) => inAnnex(x, z)), '신관까지 탐색됨');
});

test('살펴보기 자리: 4층 책상·5층 책상·2층 배전반이 그 방(층)에 있고 걸어서 닿는다', () => {
  const FA = furniturePlan(A, { yaja: annexData.yaja, spots: annexData.spots });
  const reach = STORY.interactRadius;
  for (const s of FA.spots) {
    const room = A.spaces.find((t) => t.id === s.room);
    assert.ok(contains(room.rect, ...s.pos) && s.L === room.L, `${s.id} 가 ${s.room} 안`);
    const states = opened.states.filter(([, , l]) => l === s.L);
    assert.ok(states.some(([x, z]) => Math.hypot(x - s.pos[0], z - s.pos[1]) < reach - 0.2), `${s.id} 에 닿는 자리`);
    assert.ok(s.book && s.book[1] > yAt(s.L), `${s.id} 책상 위 책`);
  }
  assert.deepEqual(FA.spots.map((s) => s.id).sort(), ['dohyeonDesk', 'myDesk']);
  const sb = A.props.filter((p) => p.type === 'switchboard');
  assert.deepEqual(sb.map((p) => p.L), [1], '배전반은 2층에만');
  const yaja = A.spaces.find((t) => t.kind === 'yaja');
  const lit = FA.items.filter((it) => it.mat === 'fixtureLit');
  assert.ok(lit.length > 0 && lit.every((it) => it.L === yaja.L && contains(yaja.rect, (it.b[0] + it.b[3]) / 2, (it.b[2] + it.b[5]) / 2)), '켜진 형광등은 야자 교실에만');
  assert.ok(FA.items.some((it) => it.mat === 'bag') && FA.items.some((it) => it.mat === 'book'), '야자 교실 가방·책');
  assert.ok(INTERIOR.door.reach > 0);
});
