// 이동 시간 측정 (단계 10): 주요 구간의 최단 걷기 거리(8방향 격자, 실제 충돌·가구·계단)와 걷기 1.6 m/s 기준 시간.
// 사용: node scripts/travel.mjs  → 마크다운 표. 격자 경로라 실제 직선 걸음보다 0~8% 길게 나올 수 있다.
import { openWorld, distances, POINTS, ROUTES, read } from '../test/mapWorld.mjs';
import { PLAYER } from '../src/config.js';

const col = openWorld();
const chases = Object.fromEntries(read('chases.json').chases.map((c) => [c.id, c.pathLength]));
const cache = new Map();
const from = (p) => cache.get(p) ?? cache.set(p, distances(col, POINTS[p])).get(p);
console.log(`| 구간 | 사건 | 거리 (m) | 걷기 ${PLAYER.walk} m/s | 달리기 ${PLAYER.run} m/s | 추격 경로 길이 |`);
console.log('|---|---|---|---|---|---|');
let total = 0;
for (const [a, b, name, ev, cmp] of ROUTES) {
  const d = from(a).dist(...POINTS[b]);
  if (!['C1', 'C2'].includes(ev)) total += d;
  const c = cmp ? `${cmp} ${chases[cmp]} m` : '';
  console.log(`| ${name} | ${ev} | ${d.toFixed(1)} | ${(d / PLAYER.walk).toFixed(0)} s | ${(d / PLAYER.run).toFixed(0)} s | ${c} |`);
}
console.log(`\nC1·C2 비교 구간을 뺀 합계 ${total.toFixed(0)} m = 걷기 ${(total / PLAYER.walk / 60).toFixed(1)} 분`);
