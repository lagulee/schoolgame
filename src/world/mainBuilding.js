import { DIM, SCHOOL } from '../config.js';
import { addBlock } from './geom.js';
import { mainShellWalls, courtyardWalls } from './layout.js';

// 본관 뒷부분: 중정형(ㅁ자) 셸. 외벽과 지붕은 막혀 있고 안쪽만 중정으로 비어 있다 (STORY 4-1).
// 앞부분(buildings.js 의 ㄷ자 중앙 블록)이 ㅁ자의 남쪽 동이 된다. 실내 층·복도는 단계 8(1b).
export function buildMainRear(g, M, kit) {
  const { outerX: X, backZ: B } = SCHOOL.main;
  const F = DIM.backZ;
  const H = DIM.floorH;
  const roof = DIM.floors * H;
  const top = roof + DIM.parapet;
  const T = { tile: 2 };

  mainShellWalls().forEach(([x0, z0, x1, z1], i) => addBlock(g, i % 2 ? M.brickB : M.brick, x0, 0, z0, x1, top, z1, T));
  for (const [x0, z0, x1, z1] of courtyardWalls()) addBlock(g, M.concrete, x0, 0, z0, x1, roof, z1, { tile: 2, cast: false });
  // 지붕 슬래브: 동 위와 중정 위를 모두 덮는다 (천장이 막힌 중정)
  addBlock(g, M.concrete, -X, roof - 0.3, B, X, roof, F, { tile: 3 });

  // 외벽 디테일 (앞부분과 같은 키트 → 창·띠·패널이 이어진다)
  const Br = SCHOOL.bridge;
  const bv = Br.floor * H;
  kit.add({ id: 'rearE', origin: [X, F], normal: [1, 0], length: F - B, ac: 0.08, cctv: 0.05, pipes: [0.35, F - B - 0.35] });
  kit.add({ id: 'rearW', origin: [-X, B], normal: [-1, 0], length: F - B, ac: 0.06, cctv: 0.04, pipes: [0.35, F - B - 0.35] });
  kit.add({
    id: 'rearN', origin: [X, B], normal: [0, -1], length: X * 2, ac: 0.1, cctv: 0.04,
    openings: [{ u0: X - Br.x1 - 0.3, u1: X - Br.x0 + 0.3, v0: bv - 0.2, v1: bv + Br.h + 0.4 }], // 연결통로가 붙는 자리
    pipes: [0.35, X - Br.x1 - 0.8, X * 2 - 0.35],
  });
  return { courtyard: { x0: -(X - SCHOOL.main.ring), x1: X - SCHOOL.main.ring, z0: B + SCHOOL.main.ring, z1: F } };
}
