import * as THREE from 'three';
import { DIM, SCHOOL } from '../config.js';
import { addBlock, instanced, mat4 } from './geom.js';

// 3층 연결통로 외관 (본관 뒷면 ↔ 신관 남쪽 면, STORY 4-1). 막힌 복도형: 슬래브 + 낮은 벽 + 띠창 + 지붕,
// 가운데 기둥 한 쌍. 안의 잠긴 연결문은 단계 9(1c). 충돌(기둥)은 layout.js
export function buildBridge(root, M) {
  const g = new THREE.Group();
  g.name = 'bridge';
  root.add(g);
  const Br = SCHOOL.bridge;
  const z0 = SCHOOL.annex.z1;
  const z1 = SCHOOL.main.backZ;
  const y = Br.floor * DIM.floorH;
  const { x0, x1, h } = Br;
  const sill = 1.0;
  const head = 2.6;

  addBlock(g, M.concrete, x0 - 0.1, y - 0.45, z0, x1 + 0.1, y, z1, { tile: 2 }); // 바닥 슬래브
  addBlock(g, M.redBand, x0 - 0.12, y - 0.3, z0, x1 + 0.12, y - 0.05, z1, { cast: false }); // 본관과 같은 붉은 띠
  for (const [a, b] of [[x0, x0 + 0.25], [x1 - 0.25, x1]]) {
    addBlock(g, M.whiteWall, a, y, z0, b, y + sill, z1, { tile: 2 }); // 낮은 벽
    addBlock(g, M.whiteWall, a, y + head, z0, b, y + h, z1, { tile: 2 }); // 창 위 벽
    addBlock(g, M.darkGlass, a + 0.08, y + sill, z0, b - 0.08, y + head, z1, { cast: false }); // 띠창
  }
  addBlock(g, M.concrete, x0 - 0.15, y + h, z0, x1 + 0.15, y + h + 0.25, z1, { tile: 2 }); // 지붕

  // 띠창 세로 창살 (양쪽 면)
  const bars = [];
  for (let z = z0 + 1.2; z < z1 - 0.6; z += 1.5) {
    for (const x of [x0 - 0.01, x1 + 0.01]) bars.push(mat4(x, y + (sill + head) / 2, z, 0, 0.06, head - sill, 0.08));
  }
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.frame, bars, { cast: false }));

  // 가운데 기둥 한 쌍
  const colGeo = new THREE.CylinderGeometry(Br.pillarR, Br.pillarR, y - 0.45, 16);
  for (const x of [x0 + 0.4, x1 - 0.4]) {
    const m = new THREE.Mesh(colGeo, M.concrete);
    m.position.set(x, (y - 0.45) / 2, Br.pillarZ);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return {};
}
