// v1.28.9: 벽 틈 회귀. 눈높이 평면에서 실내 공간이 바깥으로 새는 자리가 없어야 하고(scripts/audit-gaps.mjs),
// 외벽 셸에 잘린 복도 벽 자리에는 마감 판이 덧대어져 있어야 한다 (본관 동쪽 복도 남서 모서리, 층마다 2장)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findGaps } from '../scripts/audit-gaps.mjs';
import { buildSite } from '../src/world/interior/site.js';
import { buildingShells, annexWalls } from '../src/world/layout.js';
import { INTERIOR } from '../src/config.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const site = buildSite(load('mainInterior.json'), load('annexInterior.json'));

test('실내 공간이 벽 틈으로 바깥에 새지 않는다 (본관·신관 모든 층)', () => {
  assert.deepEqual(findGaps(site.main, buildingShells(), '본관'), []);
  assert.deepEqual(findGaps(site.annex, annexWalls(), '신관'), []);
});

test('외벽 셸에 잘린 복도 벽 자리마다 마감 판이 있다', () => {
  const patches = site.main.walls.filter((w) => w.patch);
  for (let L = 0; L <= site.main.top; L++) assert.equal(patches.filter((w) => w.L === L).length, 2, `${L + 1}층`);
  assert.ok(INTERIOR.patch >= 0.06, '바깥 유리 상자 창살(5.5 cm)을 덮는 두께');
});
