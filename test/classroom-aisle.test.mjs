// 교실 책상 사이 통로: 본관·신관 모든 들어갈 수 있는 교실에서 플레이어(반경 PLAYER.radius)가 책상 줄 사이를 지나 앞뒤로 오갈 수 있어야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collision } from '../src/player/collision.js';
import { buildPlan, addInteriorCollision } from '../src/world/interior/plan.js';
import { furniturePlan, addFurnitureCollision } from '../src/world/interior/furniture.js';
import { annexWalls, annexFaces } from '../src/world/layout.js';
import { PLAYER } from '../src/config.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const S = 0.1;
const R = PLAYER.radius + 0.1; // 반지름에 여유 0.1 m 를 더해, 간신히 닿는 틈(통로 폭 = 지름)은 막힌 것으로 본다

function rooms(plan, extras) {
  const col = new Collision();
  for (const [, h] of addInteriorCollision(col, plan)) h.on = false; // 문 모두 열림
  addFurnitureCollision(col, furniturePlan(plan, extras));
  return plan.spaces.filter((s) => s.kind === 'classroom' && s.enter).map((sp) => ({ sp, col }));
}

// 교실 안 (격자) 자유 칸 중 가장 큰 연결 덩어리 크기와 전체 자유 칸 수
function components(sp, col) {
  const [x0, z0, x1, z1] = sp.rect;
  const t = 0.2;
  const key = (x, z) => `${Math.round(x / S)},${Math.round(z / S)}`;
  const cells = new Map();
  for (let x = x0 + t + R; x <= x1 - t - R; x += S) for (let z = z0 + t + R; z <= z1 - t - R; z += S) if (!col.hit(x, z, R, sp.L)) cells.set(key(x, z), [x, z]);
  const seen = new Set();
  let best = 0;
  let bestSet = null;
  for (const [k, c] of cells) {
    if (seen.has(k)) continue;
    const set = new Set([k]);
    const q = [c];
    seen.add(k);
    while (q.length) {
      const [x, z] = q.pop();
      for (const [dx, dz] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
        const k2 = key(x + dx, z + dz);
        if (cells.has(k2) && !seen.has(k2)) { seen.add(k2); set.add(k2); q.push([x + dx, z + dz]); }
      }
    }
    if (set.size > best) { best = set.size; bestSet = set; }
  }
  return { total: cells.size, best, bestSet, key };
}

const all = [
  ...rooms(buildPlan(load('mainInterior.json'))),
  ...rooms(buildPlan(load('annexInterior.json'), { shells: annexWalls(), faces: Object.values(annexFaces()), group: 'A' }), { yaja: load('annexInterior.json').yaja, spots: load('annexInterior.json').spots }),
];

test('교실이 하나 이상 검사된다', () => assert.ok(all.length >= 9));

for (const { sp, col } of all) {
  test(`${sp.id}: 책상 줄 사이로 지나다닐 수 있다`, () => {
    const { total, best, bestSet, key } = components(sp, col);
    // 큰 덩어리가 자유 칸 대부분(벽과 책상 사이 막다른 틈 제외)을 차지한다
    assert.ok(best / total > 0.85, `${sp.id} 통로 막힘: ${best}/${total}`);
    // 앞쪽 교탁 주변과 뒤쪽 사물함 앞이 같은 덩어리 — 방 앞뒤 끝 칸이 둘 다 들어 있다
    const [x0, z0, x1, z1] = sp.rect;
    const ew = sp.front === 'e' || sp.front === 'w';
    const mid = ew ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const near = (a) => [...bestSet].some((k) => { const [cx, cz] = k.split(',').map((n) => n * S); return Math.abs((ew ? cx : cz) - a) < 1.2 && Math.abs((ew ? cz : cx) - mid) < 3; });
    const back = ew ? (sp.front === 'e' ? x0 : x1) : (sp.front === 'n' ? z0 : z1);
    const front = ew ? (sp.front === 'e' ? x1 : x0) : (sp.front === 'n' ? z1 : z0);
    assert.ok(near(back), `${sp.id} 뒤쪽 닿지 않음`);
    assert.ok(near(front), `${sp.id} 앞쪽 닿지 않음`);
  });
}
