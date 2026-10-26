import * as THREE from 'three';
import { DIM, SCHOOL, YAJA_LIGHT } from '../config.js';
import { addBlock } from './geom.js';
import { FacadeKit } from './facade.js';
import { annexWalls } from './layout.js';
import { addWorldStain } from '../materials/library.js';

// 신관: 편복도형 5층 셸 (STORY 4-1). 남쪽 면 = 교실 창(층당 반 3개), 북쪽 면 = 복도 창, 양끝 = 계단.
// 본관(벽돌)보다 새 건물이라 밝은 패널 벽으로 구분한다. 2층 동쪽 끝 반이 야자 교실로 불이 켜져 있다.
// 충돌은 layout.js, 실내는 단계 9(1c).
export function buildAnnex(root, M) {
  const g = new THREE.Group();
  g.name = 'annex';
  root.add(g);
  const A = SCHOOL.annex;
  const H = DIM.floorH;
  const roof = DIM.floors * H;
  const top = roof + DIM.parapet;
  const len = A.x1 - A.x0;
  const depth = A.z1 - A.z0;

  const wall = addWorldStain(M.whiteWall.clone(), 0.7);
  wall.color.setHex(A.wallColor);
  for (const [x0, z0, x1, z1] of annexWalls()) addBlock(g, wall, x0, 0, z0, x1, top, z1, { tile: 3 });
  addBlock(g, M.concrete, A.x0, roof - 0.3, A.z0, A.x1, roof, A.z1, { tile: 3 });

  const [cx0, cx1] = A.classes[A.yaja.cls];
  const fl = A.yaja.floor;
  const Br = SCHOOL.bridge;
  const bv = Br.floor * H;
  const kit = new FacadeKit(M);
  kit.add({
    id: 'annexS', origin: [A.x0, A.z1], normal: [0, 1], length: len, blueEvery: 4, ac: 0.06, cctv: 0.04,
    openings: [{ u0: Br.x0 - A.x0 - 0.3, u1: Br.x1 - A.x0 + 0.3, v0: bv - 0.2, v1: bv + Br.h + 0.4 }],
    lit: [{ floor: fl, u0: cx0 - A.x0, u1: cx1 - A.x0, kind: 'yaja' }],
    pipes: [0.35, len - 0.35],
  });
  kit.add({
    id: 'annexN', origin: [A.x1, A.z0], normal: [0, -1], length: len, blueEvery: 99, cctv: 0.03,
    lit: [{ floor: fl, u0: A.x1 - cx1, u1: A.x1 - cx0, kind: 'leak' }], // 교실 빛이 복도로 새어 나온다
    pipes: [0.35, len - 0.35],
  });
  kit.add({ id: 'annexE', origin: [A.x1, A.z1], normal: [1, 0], length: depth, blueEvery: 99, pipes: [0.35] });
  kit.add({ id: 'annexW', origin: [A.x0, A.z0], normal: [-1, 0], length: depth, blueEvery: 99, pipes: [0.35] });
  kit.finalize(g);

  // 야자 교실 빛: 창 밖으로 번지는 약한 점광원 하나 (그림자 없음, 깜빡이지 않음)
  const yajaLightPos = new THREE.Vector3((cx0 + cx1) / 2, fl * H + 2.0, A.z1 + YAJA_LIGHT.out);
  return { yajaLightPos, kit };
}
