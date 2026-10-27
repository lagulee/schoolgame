import { DIM, SCHOOL, INTERIOR } from '../config.js';
import { mainShellWalls } from './layout.js';

// 본관 뒷부분: 중정형(ㅁ자) 셸. 외벽과 지붕은 막혀 있고 안쪽이 중정 (STORY 4-1).
// 앞부분(buildings.js 의 ㄷ자 중앙 블록)이 ㅁ자의 남쪽 동이 된다. 실내 층·복도·중정은 단계 8부터 interior/.
// F = layout.facadeFaces(). walls·roofs: 재질별 셸 벽·지붕 슬래브 목록 (buildings.js 가 앞부분과 함께 메시 하나로 합친다). 반환 decor 는 외벽 면별 장식(에어컨·CCTV·배수관) — buildings.js 가 FacadeKit 에 넣는다
export function buildMainRear(g, M, F, walls, roofs) {
  const { outerX: X, backZ: B } = SCHOOL.main;
  const H = DIM.floorH;
  const roof = DIM.floors * H;
  const top = roof + DIM.parapet;
  const w = SCHOOL.shellWall;
  mainShellWalls().forEach(([x0, z0, x1, z1], i) => walls[i % 2 ? 'brickB' : 'brick'].push([x0, 0, z0, x1, top, z1]));
  // 지붕 슬래브: 동 위와 중정 위를 모두 덮는다 (천장이 막힌 중정). 실내 천장보다 5 cm 위, 셸 벽 안쪽까지만
  roofs.push([-X + w, roof - INTERIOR.slab + 0.05, B + w, X - w, roof, DIM.backZ]);

  const Br = SCHOOL.bridge;
  const L = F.rearN.length;
  return {
    decor: {
      rearE: { ac: 0.08, cctv: 0.05, pipes: [0.35, F.rearE.length - 0.35] },
      rearW: { ac: 0.06, cctv: 0.04, pipes: [0.35, F.rearW.length - 0.35] },
      rearN: { ac: 0.1, cctv: 0.04, pipes: [0.35, X - Br.x1 - 0.8, L - 0.35] },
    },
    courtyard: { x0: -(X - SCHOOL.main.ring), x1: X - SCHOOL.main.ring, z0: B + SCHOOL.main.ring, z1: DIM.backZ },
  };
}
