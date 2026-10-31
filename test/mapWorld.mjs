// 맵 검사용 월드 (단계 10): 바깥 큰 충돌 + 실내 평면 + 가구를 실제 Collision 에 올리고, 문을 열어 둔 채
// (x, z, 층) 격자에서 도달 가능한 칸과 최단 거리(8방향, 대각선 √2)를 구한다. test/map.test.mjs·scripts/travel.mjs 가 쓴다.
import { readFileSync } from 'node:fs';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision } from '../src/world/layout.js';
import { buildSite, addSiteCollision } from '../src/world/interior/site.js';
import { ConnectorState } from '../src/world/interior/connector.js';
import { furniturePlan, addFurnitureCollision } from '../src/world/interior/furniture.js';
import { PLAYER } from '../src/config.js';

export const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
export const mainData = read('mainInterior.json');
export const annexData = read('annexInterior.json');
export const site = buildSite(mainData, annexData);
export const furniture = [furniturePlan(site.main), furniturePlan(site.annex, { yaja: annexData.yaja, spots: annexData.spots })];
export const STEP = 0.25;
const AREA = { x0: -30, x1: 31, z0: -96, z1: 16 };
const R = PLAYER.radius;

// 들어갈 수 있는 방 문·열쇠 문·연결문을 모두 연 월드 (현관 유리문은 자동문이라 연다)
export function openWorld() {
  const col = new Collision();
  addSchoolCollision(col);
  const h = addSiteCollision(col, site);
  for (const F of furniture) addFurnitureCollision(col, F);
  const doors = [...site.main.doors, ...site.annex.doors];
  for (const [id, d] of h.doors) if (id === 'entrance' || doors.some((t) => t.id === id && (!t.locked || t.key))) d.on = false;
  new ConnectorState(site.bridge, h.connector, () => true).set(true);
  return col;
}

const key = (x, z, lv) => `${Math.round(x / STEP)},${Math.round(z / STEP)},${lv}`;

// start = [x, z, 층] 에서 Dijkstra. 반환 { states: Map(key → [x, z, 층, 거리]), near(x, z, 층) → 가장 가까운 칸, dist(x, z, 층) }
export function distances(col, start) {
  let [sx, sz, sl] = start;
  if (col.hit(sx, sz, R, sl)) {
    // 가구 사이 등 막힌 점이면 4 m 안의 가장 가까운 빈 격자 칸에서 시작
    let bd = Infinity;
    for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
      const x = Math.round(start[0] / STEP + i) * STEP;
      const z = Math.round(start[1] / STEP + j) * STEP;
      const e = Math.hypot(x - start[0], z - start[1]);
      if (e < bd && !col.hit(x, z, R, sl)) [bd, sx, sz] = [e, x, z];
    }
    if (bd === Infinity) throw new Error(`시작 칸이 막혀 있음 ${start}`);
  }
  const states = new Map();
  const heap = [[0, sx, sz, sl]];
  const best = new Map([[key(sx, sz, sl), 0]]);
  const push = (e) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const free = (x, z, lv) => x >= AREA.x0 && x <= AREA.x1 && z >= AREA.z0 && z <= AREA.z1 && !col.hit(x, z, R, lv);
  while (heap.length) {
    const [d, x, z, lv] = pop();
    const k = key(x, z, lv);
    if (states.has(k)) continue;
    states.set(k, [x, z, lv, d]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x2 = x + dx * STEP;
      const z2 = z + dz * STEP;
      if (!free(x2, z2, lv) || !free(x + (dx * STEP) / 2, z + (dz * STEP) / 2, lv)) continue;
      if (dx && dz && (!free(x2, z, lv) || !free(x, z2, lv))) continue; // 모서리 자르기 금지
      const l2 = col.levelAt(x2, z2, lv);
      const k2 = key(x2, z2, l2);
      const d2 = d + STEP * (dx && dz ? Math.SQRT2 : 1);
      if (states.has(k2) || (best.get(k2) ?? Infinity) <= d2) continue;
      best.set(k2, d2);
      push([d2, x2, z2, l2]);
    }
  }
  const list = [...states.values()];
  const near = (x, z, lv, within = Infinity) => {
    let b = null;
    let bd = within;
    for (const s of list) {
      if (s[2] !== lv) continue;
      const e = Math.hypot(s[0] - x, s[1] - z);
      if (e < bd) {
        bd = e;
        b = s;
      }
    }
    return b;
  };
  return { states: list, near, dist: (x, z, lv) => near(x, z, lv, 4)?.[3] ?? Infinity };
}

// 주요 구간 (이동 시간 측정, 단계 10). 점 = [x, z, 층]. cmp = 비교할 추격 경로 길이 (data/chases.json)
const mid = (id) => {
  const s = [...site.main.spaces, ...site.annex.spaces].find((t) => t.id === id);
  return [(s.rect[0] + s.rect[2]) / 2, (s.rect[1] + s.rect[3]) / 2, s.L];
};
const desk = furniture[1].spots.find((s) => s.id === 'dohyeonDesk');
export const POINTS = {
  start: [PLAYER.start[0], PLAYER.start[2], 0],
  lobby: mid('lobby'),
  hydrant: [17.3, -22.3, 0],
  room11: mid('1F-1'),
  staff: [22.3, -43, 1],
  bridgeDoor: [18.5, -56, 2],
  annexHall: mid('A3F-hall'),
  desk4: [desk.pos[0], desk.pos[1] - 0.6, desk.L],
  room5: mid('A5F-2'),
  yaja: mid('A2F-3'),
  switchboard: [-9, -91.2, 1],
  duty: mid('4F-duty'),
  stairs4: [16.5, -19.75, 3],
};
export const ROUTES = [
  ['start', 'lobby', '시작 지점(정문 안) → 구관 현관 홀', 'E1'],
  ['lobby', 'hydrant', '현관 홀 → 1층 복도 소화전(PB2)', 'E2'],
  ['lobby', 'room11', '현관 홀 → 1층 1-1 교실', 'C1', 'C1'],
  ['lobby', 'staff', '현관 홀 → 2층 교무실', 'E4'],
  ['staff', 'bridgeDoor', '교무실 → 3층 연결문 앞', 'E3·E5'],
  ['bridgeDoor', 'annexHall', '연결문 → 신관 3층 출구 홀', 'E5'],
  ['annexHall', 'desk4', '신관 3층 → 4층 2-10 책상', 'E5(책)'],
  ['desk4', 'room5', '4층 2-10 → 5층 2-13', 'E6'],
  ['room5', 'yaja', '5층 2-13 → 2층 야자 교실', 'E7'],
  ['yaja', 'switchboard', '야자 교실 → 2층 배전반', 'E7'],
  ['yaja', 'duty', '신관 야자 교실 → 구관 4층 당직실', 'E10·E11'],
  ['lobby', 'stairs4', '현관 홀 → 계단으로 구관 4층', 'C2', 'C2'],
  ['duty', 'staff', '당직실 → 2층 교무실', 'E12·E13'],
  ['staff', 'lobby', '교무실 → 현관 홀', 'C3·C4', 'C4'],
];
