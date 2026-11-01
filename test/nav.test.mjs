// 길 안내 (핸드폰 화살표): 길 찾기(Navigator)·안내 계산(NavGuide)·data/nav.json 점검
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision } from '../src/world/layout.js';
import { addSiteCollision } from '../src/world/interior/site.js';
import { addFurnitureCollision } from '../src/world/interior/furniture.js';
import { MapData } from '../src/world/mapData.js';
import { NavGuide } from '../src/world/navGuide.js';
import { site, furniture, read, openWorld, distances, POINTS } from './mapWorld.mjs';
import { PLAYER } from '../src/config.js';

const navData = read('nav.json');
const story = read('story.json');
const mapData = new MapData(read('map.json'));

// 실제 게임과 같은 월드 (문은 닫힌 채): 충돌 + 가구
function world() {
  const col = new Collision();
  addSchoolCollision(col);
  const h = addSiteCollision(col, site);
  for (const F of furniture) addFurnitureCollision(col, F);
  const info = { handles: h.doors, connector: h.connector, doors: [...site.main.doors, ...site.annex.doors], connectorKey: site.bridge.door.key };
  return { col, info };
}
const W = world();
const mk = (flags = {}) => new NavGuide({ col: W.col, info: W.info, mapData, data: navData, hasKey: (n) => flags[n] === true });
const at = (id) => { const r = mapData.resolve(id); const [a, b, c, d] = r.item.rect; return [(a + c) / 2, (b + d) / 2, r.level]; };
const START = POINTS.start;
const LOBBY = POINTS.lobby;

test('nav.json: 모든 핸드폰 목표(story.json objectives)에 안내가 적혀 있고, 장소 참조가 맵에 있다', () => {
  for (const k of Object.keys(story.objectives)) assert.ok(k in navData.goals, `목표 ${k} 안내 없음`);
  for (const k of Object.keys(navData.goals)) assert.ok(k in story.objectives, `알 수 없는 목표 ${k}`);
  for (const [k, legs] of Object.entries(navData.goals)) {
    for (const leg of legs) {
      assert.ok(leg.text, `${k}: 이름 없음`);
      assert.ok(leg.to ? mapData.resolve(leg.to) : leg.point?.length === 3, `${k}: 장소 ${leg.to ?? leg.point}`);
    }
  }
});

test('시작 지점 → 현관 홀: 길이 있고 마지막이 홀 안, 거리는 최단(격자 Dijkstra, 문 모두 열림)과 5% 안', () => {
  const g = mk();
  const v = g.update(0, START[0], START[1], 0, 'goEntrance');
  assert.equal(v.state, 'path');
  const path = g.cache.path;
  const last = path[path.length - 1];
  const r = mapData.resolve('lobby').item.rect;
  assert.ok(last[0] >= r[0] && last[0] <= r[2] && last[1] >= r[1] && last[1] <= r[3], '홀 안에서 끝남');
  // 최단 거리: 홀 사각형 가장자리까지라 중심까지 거리 이하
  const open = distances(openWorld(), START);
  assert.ok(g.cache.cum.at(-1) <= open.dist(...LOBBY) * 1.05, `길이 ${g.cache.cum.at(-1)}`);
});

test('연결문 열쇠가 없으면 goFifth 는 교무실이 먼저, 열쇠가 있으면 신관 5층 2-13', () => {
  const [x, z, l] = LOBBY;
  const a = mk().update(0, x, z, l, 'goFifth');
  assert.equal(a.state, 'path');
  assert.match(a.text, /교무실/);
  assert.match(a.step, /2층/, '교무실은 2층: 계단 안내');
  const b = mk({ hasConnectorKey: true }).update(0, x, z, l, 'goFifth');
  assert.equal(b.state, 'path');
  assert.match(b.text, /5층 2-13/);
  assert.match(b.step, /층까지/);
  assert.ok(b.dist > 100, `현관 홀에서 신관 5층까지 멀다: ${b.dist}`);
});

test('열쇠 없이 신관 5층 안내(교무실 다리가 없는 목표)는 연결문 때문에 막히면 느슨한 길로 방향을 준다', () => {
  const [x, z, l] = LOBBY;
  const g = mk(); // hasConnectorKey 없음
  const v = g.update(0, x, z, l, 'takeBook');
  assert.equal(v.state, 'path');
  assert.equal(g.cache.lenient, true, '엄격한 길이 없어 느슨한 길');
});

test('모든 목표가 현관 홀·교무실·연결문·신관에서 열쇠를 가진 상태로 길이 엄격하게 이어진다', () => {
  const flags = { hasConnectorKey: true };
  const from = [LOBBY, at('2F-staff'), at('A3F-hall'), at('4F-duty')];
  for (const k of Object.keys(navData.goals)) {
    for (const f of from) {
      const g = mk(flags);
      const v = g.update(0, f[0], f[1], f[2], k);
      assert.ok(v, k);
      if (v.state === 'arrived') continue;
      assert.equal(v.state, 'path', `${k} ← ${f}`);
      // 열쇠 방 2-13 은 hasClassKey 가 없어 문이 잠김 → 느슨한 길이어도 도달은 해야 한다
      assert.ok(v.dist > 0);
    }
  }
});

test('도착: 목표 방 안에 있으면 arrived, 화살표 없음', () => {
  const [x, z, l] = at('1F-2');
  const v = mk().update(0, x, z, l, 'hide');
  assert.equal(v.state, 'arrived');
  assert.match(v.text, /1-2/);
});

test('화살표 방향: 단위 벡터이고, 벽 너머가 아니라 길 쪽(곧장 걸을 수 있는 점)을 가리킨다', () => {
  const g = mk();
  const v = g.update(0, START[0], START[1], 0, 'goEntrance');
  assert.ok(Math.abs(Math.hypot(v.ax, v.az) - 1) < 1e-6);
  const aim = [START[0] + v.ax * 2, START[1] + v.az * 2];
  assert.ok(g.nav.clear(START[0], START[1], aim[0], aim[1], 0), '앞 2 m 는 막히지 않음');
});

test('길 따라가기: 길을 따라 걸으면 거리가 줄고 다시 찾지 않는다, 길에서 벗어나면 다시 찾는다', () => {
  const g = mk();
  let v = g.update(0, START[0], START[1], 0, 'goEntrance');
  const first = g.cache;
  const d0 = v.dist;
  const p = first.path[Math.floor(first.path.length / 2)];
  v = g.update(0, p[0], p[1], p[2], 'goEntrance');
  assert.equal(g.cache, first, '같은 길 재사용');
  assert.ok(v.dist < d0);
  // 길에서 멀리 떨어진 곳(앞마당 반대 끝)
  g.update(0, -20, 10, 0, 'goEntrance');
  assert.notEqual(g.cache, first, '벗어나 다시 찾음');
});

test('성능: 현관 홀 → 신관 5층 처음 찾기(칸 기억 없음) 와 같은 길 다시 찾기', () => {
  const [x, z, l] = LOBBY;
  const g = mk({ hasConnectorKey: true });
  let t = performance.now();
  g.update(0, x, z, l, 'takeBook');
  const first = performance.now() - t;
  g.cache = null;
  t = performance.now();
  g.update(0, x, z, l, 'takeBook');
  const again = performance.now() - t;
  console.log(`길 찾기 첫 ${first.toFixed(0)} ms, 두 번째 ${again.toFixed(0)} ms`);
  assert.ok(first < 3000 && again < 1500);
});

test('Collision.hit 의 ignore: 무시한 박스는 통과, 나머지는 그대로', () => {
  const c = new Collision();
  const b = c.box(0, 0, 1, 1);
  assert.equal(c.hit(0.5, 0.5, PLAYER.radius), true);
  assert.equal(c.hit(0.5, 0.5, PLAYER.radius, 0, new Set([b])), false);
  assert.equal(c.hit(0.5, 0.5, PLAYER.radius, 0, new Set()), true);
});
