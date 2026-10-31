// 단계 10(옛 1d): 맵 데이터(data/map.json)·위치 이름·잠긴 문·보조배터리 자리. 평면(buildSite)·가구·실제 충돌과 맞는지 검사한다.
// 이동 시간 표는 scripts/travel.mjs (같은 월드·격자, 여기서는 주요 구간이 모두 이어지는지만).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MapData } from '../src/world/mapData.js';
import { mapRecords } from '../src/world/mapGen.js';
import { locate } from '../src/world/interior/site.js';
import { STORY } from '../src/config.js';
import { site, furniture, read, openWorld, distances, POINTS, ROUTES } from './mapWorld.mjs';

const map = read('map.json');
const M = new MapData(map);
const story = read('story.json');
const banks = read('powerbanks.json').powerbanks;
const col = openWorld();
const fromStart = distances(col, POINTS.start);

test('map.json 의 공간·방·잠긴 문 = 실내 평면에서 만든 값 (평면을 바꾸면 npm run map)', () => {
  const gen = mapRecords(site, map.lockSounds);
  for (const k of ['spaces', 'rooms', 'locks']) assert.deepEqual(map[k], gen[k], `${k} 가 평면과 다르다 → npm run map`);
});

test('들어갈 수 있는 방 14개 = 구관 7 + 신관 7 (STORY 4-1 "약 14개"), 열쇠 방은 2-13 하나', () => {
  const enter = map.rooms.filter((r) => r.enterable);
  assert.equal(enter.length, 14);
  assert.deepEqual(enter.filter((r) => r.building === 'main').map((r) => r.name).sort(), ['1-1', '1-2', '2-7', '당직실', '교무실', '상담실', '행정실'].sort());
  assert.deepEqual(enter.filter((r) => r.building === 'annex').map((r) => r.name).sort(), ['2-10', '2-13', '3-10', '3-5', '3-6', '3-7', '3-9'].sort());
  assert.deepEqual(enter.filter((r) => r.key).map((r) => [r.name, r.key]), [['2-13', 'hasClassKey']]);
  // 건물·층 구성: 구관 반 4 (1층은 반 2 + 행정실 + 상담실), 신관 반 3
  for (let L = 0; L < 5; L++) {
    const cls = (b) => map.rooms.filter((r) => r.building === b && r.level === L && (r.kind === 'classroom' || r.kind === 'yaja')).length;
    assert.equal(cls('main'), L === 0 ? 2 : 4, `구관 ${L + 1}층 반`);
    assert.equal(cls('annex'), 3, `신관 ${L + 1}층 반`);
  }
});

test('잠긴 문 목록 = 잠긴 방 문 + 열쇠 문 + 연결문 + 필로티 유리문 + 방화셔터, 소리 종류가 정해져 있다', () => {
  const doors = site.plans.flatMap((P) => P.doors.filter((d) => d.locked || d.key).map((d) => `door:${d.id}`));
  const want = [...doors, 'door:connector', 'door:pilotiGlass', 'shutter:AS1', 'shutter:AS2'].sort();
  assert.deepEqual(map.locks.map((l) => l.id).sort(), want);
  // 잠긴 방(들어갈 수 없는 방)의 문은 모두 목록에 있고, 들어갈 수 있는 방(열쇠 없음)의 문은 없다
  for (const r of map.rooms) {
    const ids = site.plans.flatMap((P) => P.doors.filter((d) => d.room === r.id).map((d) => `door:${d.id}`));
    for (const id of ids) assert.equal(M.locks.has(id), !r.enterable || !!r.key, `${r.name} ${id}`);
  }
  assert.equal(M.locks.get('door:connector').key, 'hasConnectorKey');
  for (const l of map.locks) {
    assert.ok(l.kind in map.lockSounds, `${l.id} 종류`);
    assert.equal(l.sound, map.lockSounds[l.kind]);
    if (l.kind !== 'shutter') assert.ok(['rattle', 'metal', 'glass'].includes(M.lockSound(l.id)), l.id);
  }
  assert.equal(M.lockSound('door:connector'), 'metal');
  assert.equal(M.lockSound('door:pilotiGlass'), 'glass');
  assert.equal(M.lockSound('없는 문'), 'rattle');
});

test('모든 사건·퍼즐·추격 장소(place)가 맵에 있다 (eventPlaces → 공간·방, 층 범위 안)', () => {
  const places = new Set();
  for (const e of story.events) places.add(e.place);
  for (const i of Object.values(story.interactions ?? {})) if (i.place) places.add(i.place);
  for (const p of read('puzzles.json').puzzles) places.add(p.place);
  for (const c of read('chases.json').chases) places.add(c.place);
  for (const text of places) {
    const refs = M.placeRefs(text);
    assert.ok(refs?.length, `맵에 없는 장소: "${text}"`);
    const res = refs.map((r) => M.resolve(r));
    res.forEach((x, i) => assert.ok(x, `"${text}" → 없는 참조 ${refs[i]}`));
    const bs = new Set(res.map((x) => x.item.building));
    if (text.includes('구관')) assert.ok(bs.has('main'), `"${text}" 에 구관 참조 없음`);
    if (text.includes('신관')) assert.ok(bs.has('annex') || bs.has('bridge'), `"${text}" 에 신관(또는 연결통로) 참조 없음`);
  }
  assert.equal(M.resolve('E@7'), null, '층 범위 밖');
  assert.equal(M.resolve('2F-staff@0'), null, '방은 제 층만');
});

test('위치 이름: 실내 판정(site.locate)과 같은 곳을 가리키고, 건물·층·공간 이름으로 보인다', () => {
  let n = 0;
  for (const lv of [0, 1, 2, 3, 4]) {
    for (let x = -26.1; x < 29; x += 1.3) {
      for (let z = -95.1; z < 9; z += 1.3) {
        const a = locate(site, x, z, lv);
        const b = M.locate(x, z, lv);
        if (!a) {
          assert.ok(!b || b.building === null, `(${x.toFixed(1)}, ${z.toFixed(1)}, ${lv}) 실내 아님인데 ${b?.id}`);
          continue;
        }
        n++;
        assert.equal(b?.building, a.where, `(${x.toFixed(1)}, ${z.toFixed(1)}, ${lv})`);
        assert.equal(b.id, a.space.id, `(${x.toFixed(1)}, ${z.toFixed(1)}, ${lv}) 공간`);
      }
    }
  }
  assert.ok(n > 1000, `비교한 실내 점 ${n}`);
  const at = (p) => M.label(p[0], p[1], p[2]);
  assert.equal(at(POINTS.lobby), '구관 1층 · 현관 홀');
  assert.equal(at(POINTS.staff), '구관 2층 · 교무실');
  assert.equal(at(POINTS.yaja), '신관 2층 · 3-7 교실');
  assert.equal(M.label(18.5, -72, 2), '연결통로 (3층)');
  assert.equal(at(POINTS.start), '앞마당');
  assert.equal(M.label(60, -40, 0), '운동장');
  assert.equal(M.label(20, -20, 1.5), '구관 2층~3층 사이 · 현관 쪽 계단');
  assert.equal(M.label(60, -40, 2), '', '바깥 구역은 1층에서만');
});

test('보조배터리 PB1~PB9: 적힌 가구 옆, 장소 문구의 건물·층, 걸어서 손 닿는 곳 (방 문·열쇠 문·연결문을 연 월드)', () => {
  const anchors = furniture.flatMap((F) => F.anchors);
  const props = site.plans.flatMap((P) => P.props);
  const R = STORY.interactRadius;
  for (const b of banks) {
    const [x, z] = b.pos;
    // 가구 옆
    const [room, ...what] = b.anchor.split(':');
    if (room === 'prop') {
      const near = props.some((p) => p.type === what[0] && p.L === b.level && x >= p.rect[0] - 0.6 && x <= p.rect[2] + 0.6 && z >= p.rect[1] - 0.6 && z <= p.rect[3] + 0.6);
      assert.ok(near, `${b.id} 근처에 ${what[0]} 없음`);
    } else {
      const a = anchors.find((t) => t.room === room && t.what === what.join(':'));
      assert.ok(a && a.L === b.level, `${b.id} 가구 ${b.anchor}`);
      assert.ok(Math.hypot(a.pos[0] - x, a.pos[1] - z) < 0.6, `${b.id} 가 ${b.anchor} 에서 멂`);
    }
    // 장소 문구: 구관/신관 · N층
    const loc = M.locate(x, z, b.level);
    assert.ok(loc, `${b.id} 실내 밖`);
    const B = b.place.startsWith('구관') ? 'main' : 'annex';
    assert.equal(loc.building, B, `${b.id} 건물`);
    assert.ok(b.place.includes(`${b.level + 1}층`), `${b.id} 층`);
    // 손 닿는 곳: 같은 층의 걸을 수 있는 칸에서 상호작용 반경 안
    const s = fromStart.near(x, z, b.level, R - 0.1);
    assert.ok(s, `${b.id} 걸어서 닿지 않음`);
    assert.ok(b.hidden ? b.label : b.h !== undefined, `${b.id} hidden 이면 살펴보기 문구, 아니면 높이`);
  }
  // 줍는 시점 규칙(from)은 그대로: 구관 앞쪽 두 개만 E1 부터
  assert.deepEqual(banks.filter((b) => b.from.includes('E1')).map((b) => b.id), ['PB1', 'PB2']);
});

test('주요 구간이 모두 걸어서 이어진다 (이동 시간 표는 scripts/travel.mjs)', () => {
  for (const [a, b, name] of ROUTES) {
    for (const p of [a, b]) assert.ok(Number.isFinite(fromStart.dist(...POINTS[p])), `${name}: ${p} 에 닿지 않음`);
  }
});
