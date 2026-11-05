// 추격 중 길 안내 (v1.28.1): 화살표만 보고 달리는 플레이어가 각 추격(C1~C4)의 도착점에 귀신보다 먼저 닿는다.
// 예전에는 목표 장소(story objectives)를 가리켜, C2 는 추격 내내 출발점(현관 홀 = 귀신 쪽)을, C3·C4 는 유리문 10 m 앞에서 "도착"을 보였다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision } from '../src/world/layout.js';
import { addSiteCollision } from '../src/world/interior/site.js';
import { addFurnitureCollision } from '../src/world/interior/furniture.js';
import { MapData, placeLabeler } from '../src/world/mapData.js';
import { NavGuide, chaseGoal } from '../src/world/navGuide.js';
import { ghostNavigator } from '../src/scene/ghostNav.js';
import { Pursuer } from '../src/scene/pursuer.js';
import { ChasePath } from '../src/scene/path.js';
import { PLAYER, CHASE } from '../src/config.js';
import { site, furniture, read } from './mapWorld.mjs';

const navData = read('nav.json');
const mapData = new MapData(read('map.json'));
const chases = read('chases.json').chases;
const OBJ = { C1: 'hide', C2: 'goOld', C3: 'runExit', C4: 'runExit' }; // 사건의 핸드폰 목표 (story.json)
const DT = 1 / 30;

// 실제 게임과 같은 충돌 월드. 플레이어가 문을 여는 것은 흉내 내지 않고 방 문은 열어 둔다 (연결문은 닫힘)
const col = new Collision();
addSchoolCollision(col);
const h = addSiteCollision(col, site);
for (const F of furniture) addFurnitureCollision(col, F);
const info = { handles: h.doors, connector: h.connector, doors: [...site.main.doors, ...site.annex.doors], connectorKey: site.bridge.door.key };
const gnav = ghostNavigator(col, info);
for (const d of h.doors.values()) d.on = false;
const inGoal = (g, p) => Math.abs(p.level - g.level) < 0.01 && p.x >= g.rect[0] && p.x <= g.rect[2] && p.z >= g.rect[1] && p.z <= g.rect[3];

// 화살표 방향으로 달린다. 반환 { arrived, caught, t, back(경로 반대쪽을 가리킨 프레임 비율), arrivedEarly(도착점 밖인데 "도착") }
function follow(def, { chaseAware }) {
  const guide = new NavGuide({ col, info, mapData, data: navData, hasKey: () => true });
  const path = new ChasePath(def.path);
  const goal = chaseGoal(def, mapData);
  const [sx, sz] = path.at(def.path.startAt);
  const me = { x: sx, z: sz, level: def.path.level ?? 0 };
  const pu = new Pursuer(gnav);
  pu.begin(path, def.path.startAt, def.startGap, me, def.path.level ?? 0);
  let back = 0;
  let early = 0;
  let n = 0;
  for (let t = 0; t < 40; t += DT) {
    if (inGoal(goal, me)) return { arrived: true, caught: false, t, back: back / n, early };
    const v = guide.update(DT, me.x, me.z, me.level, OBJ[def.id], chaseAware ? def : null);
    n++;
    if (v?.state === 'arrived') early++;
    if (v?.state === 'path') {
      const s = path.project(me.x, me.z);
      const [ax, az] = path.at(s);
      const [bx, bz] = path.at(s + 2);
      if ((bx - ax) * v.ax + (bz - az) * v.az < -0.5) back++;
      // 벽 모서리에 몇 mm 걸리면 사람처럼 방향을 조금 틀어 빠져나간다
      const d = PLAYER.run * DT;
      for (const a of [0, 0.5, -0.5, 1, -1]) {
        const pos = { x: me.x, z: me.z };
        const c = Math.cos(a);
        const s2 = Math.sin(a);
        col.move(pos, (v.ax * c - v.az * s2) * d, (v.ax * s2 + v.az * c) * d, PLAYER.radius, me.level);
        if (Math.hypot(pos.x - me.x, pos.z - me.z) > d * 0.5) {
          me.x = pos.x;
          me.z = pos.z;
          break;
        }
      }
      me.level = col.levelAt(me.x, me.z, me.level);
    }
    const gap = pu.update(DT, def.ghostSpeed * DT, me);
    if (gap <= CHASE.catchDistance) return { arrived: false, caught: true, t, back: back / n, early };
  }
  return { arrived: false, caught: false, t: 40, back: back / n, early };
}

for (const def of chases) {
  test(`${def.id}: 화살표만 따라 달리면 귀신에게 잡히기 전에 도착점에 닿는다`, () => {
    const r = follow(def, { chaseAware: true });
    assert.ok(r.arrived, JSON.stringify(r));
    assert.ok(r.back < 0.05, `경로 반대쪽을 가리킨 비율 ${r.back}`);
    assert.equal(r.early, 0, '도착점 밖에서 "도착"');
  });
}

test('예전 방식(목표 장소만)으로는 C2 화살표가 출발점 쪽을 가리켰다 (회귀 확인용)', () => {
  const r = follow(chases.find((c) => c.id === 'C2'), { chaseAware: false });
  assert.ok(!r.arrived);
});

test('nav.json chases: 모든 추격(chases.json)에 이름이 있고 도착 구역이 맵 안의 걸을 수 있는 곳이다', () => {
  for (const def of chases) {
    assert.ok(navData.chases[def.id], `${def.id} 이름 없음`);
    const g = chaseGoal(def, mapData);
    assert.ok(g, def.id);
    const cx = (g.rect[0] + g.rect[2]) / 2;
    const cz = (g.rect[1] + g.rect[3]) / 2;
    assert.ok(mapData.locate(cx, cz, g.level), `${def.id} 도착점 (${cx}, ${cz}) 이 맵 밖`);
  }
});

test('핸드폰 위치 이름: 마지막 추격 경로(2층 → 계단 → 1층 → 현관 홀)를 따라가는 동안 이름이 비지 않는다', () => {
  for (const id of ['C3', 'C4']) {
    const def = chases.find((c) => c.id === id);
    const path = new ChasePath(def.path);
    const at = placeLabeler(mapData);
    let lv = def.path.level;
    for (let s = def.path.startAt; s <= def.path.startAt + def.pathLength; s += 0.1) {
      const [x, z] = path.at(s);
      lv = col.levelAt(x, z, lv);
      assert.ok(at(x, z, lv), `${id} ${s.toFixed(1)} m (${x.toFixed(2)}, ${z.toFixed(2)}, ${lv})`);
    }
  }
});
