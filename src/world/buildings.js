import * as THREE from 'three';
import { DIM } from '../config.js';
import { addBlock, instanced, mat4 } from './geom.js';
import { FacadeKit } from './facade.js';

// 본관: ㄷ자 매스 (북쪽 중앙 블록 + 동·서 날개), 필로티 개구부, 유리 계단실, 외벽 디테일
export function buildBuildings(root, M, col) {
  const g = new THREE.Group();
  g.name = 'buildings';
  root.add(g);
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz } = DIM;
  const top = DIM.floors * DIM.floorH + DIM.parapet;
  const pw = DIM.piloti.halfW;
  const ph = DIM.piloti.h;
  const T = { tile: 2 };

  // 매스 (벽돌 변형 2종을 나눠 써서 반복 티를 줄인다)
  addBlock(g, M.brick, -ox, 0, bz, -pw, top, fz, T);
  addBlock(g, M.brickB, pw, 0, bz, ox, top, fz, T);
  addBlock(g, M.brick, -pw, ph, bz, pw, top, fz, T);
  addBlock(g, M.brickB, -ox, 0, fz, -ix, top, wz, T);
  addBlock(g, M.brick, ix, 0, fz, ox, top, wz, T);
  col.box(-ox, bz, -pw, fz);
  col.box(pw, bz, ox, fz);
  col.box(-ox, fz, -ix, wz);
  col.box(ix, fz, ox, wz);

  // 필로티 내부: 콘크리트 마감 벽 + 천장 + 가운데 기둥 + 천장 형광등(발광만)
  addBlock(g, M.concrete, -pw, 0, bz, -pw + 0.05, ph, fz, { tile: 2 });
  addBlock(g, M.concrete, pw - 0.05, 0, bz, pw, ph, fz, { tile: 2 });
  addBlock(g, M.concrete, -pw, ph - 0.06, bz, pw, ph, fz, { tile: 2, cast: false });
  addBlock(g, M.concrete, -pw - 0.2, ph - 0.7, fz - 0.05, pw + 0.2, ph, fz + 0.12, { tile: 2 }); // 보
  addBlock(g, M.concrete, -pw - 0.2, ph - 0.7, bz - 0.12, pw + 0.2, ph, bz + 0.05, { tile: 2 });
  const colm = new THREE.Mesh(new THREE.CylinderGeometry(DIM.piloti.colR, DIM.piloti.colR, ph, 20), M.concrete);
  colm.position.set(0, ph / 2, DIM.piloti.colZ);
  colm.castShadow = colm.receiveShadow = true;
  g.add(colm);
  col.circle(0, DIM.piloti.colZ, DIM.piloti.colR);
  const tubes = [];
  for (let z = fz - 3.5; z > bz + 1; z -= 3.5) tubes.push(mat4(-2.2, ph - 0.08, z, 0), mat4(2.2, ph - 0.08, z, 0));
  g.add(instanced(new THREE.BoxGeometry(0.12, 0.05, 1.3), M.tubeLight ?? M.frame, tubes, { cast: false }));

  // 유리 계단실 2곳 (중앙 블록 동쪽 모서리, 서쪽 날개 남쪽 끝)
  const stairs = [
    [ix - 3, fz, ix, fz + 1.0],
    [-ix, wz - 3.4, -ix + 1.0, wz - 0.2],
  ];
  for (const s of stairs) buildStairwell(g, M, s, top + 0.9);
  for (const [x0, z0, x1, z1] of stairs) col.box(x0, z0, x1, z1);

  // 외벽 디테일
  const kit = new FacadeKit(M);
  const fl = DIM.floorH;
  kit.add({
    id: 'front', origin: [-ix, fz], normal: [0, 1], length: ix * 2, cctv: 0.12, ac: 0.05,
    openings: [
      { u0: ix - pw - 0.3, u1: ix + pw + 0.3, v0: 0, v1: ph + 0.1 },
      { u0: ix - 4.2, u1: ix + 4.2, v0: 3 * fl + 0.45, v1: 4 * fl - 0.1 }, // LED 전광판 자리
      { u0: ix * 2 - 3.1, u1: ix * 2, v0: 0, v1: top + 1 }, // 계단실
    ],
    pipes: [0.35, ix - pw - 0.6, ix + pw + 0.6],
  });
  kit.add({
    id: 'west', origin: [-ix, wz], normal: [1, 0], length: wz - fz, cctv: 0.1, ac: 0.08,
    openings: [{ u0: 0, u1: 3.7, v0: 0, v1: top + 1 }],
    pipes: [3.9, wz - fz - 0.35],
  });
  kit.add({
    id: 'east', origin: [ix, fz], normal: [-1, 0], length: wz - fz, cctv: 0.1, ac: 0.04,
    openings: [{ u0: DIM.canopy.z0 - fz - 0.2, u1: DIM.canopy.z1 - fz + 0.2, v0: 0, v1: DIM.canopy.colH + 0.6 }],
    pipes: [0.35, wz - fz - 0.35],
  });
  kit.add({ id: 'eastSouth', origin: [ix, wz], normal: [0, 1], length: ox - ix, ac: 0.1, cctv: 0.05 });
  kit.add({ id: 'westSouth', origin: [-ox, wz], normal: [0, 1], length: ox - ix, ac: 0.1, cctv: 0.05 });
  kit.add({
    id: 'back', origin: [ox, bz], normal: [0, -1], length: ox * 2, ac: 0.12, cctv: 0.04,
    openings: [{ u0: ox - pw - 0.3, u1: ox + pw + 0.3, v0: 0, v1: ph + 0.1 }],
    pipes: [0.35, ox - pw - 0.6, ox + pw + 0.6, ox * 2 - 0.35],
  });
  kit.add({ id: 'sideE', origin: [ox, wz], normal: [1, 0], length: wz - bz, noWindows: true, pipes: [] });
  kit.add({ id: 'sideW', origin: [-ox, bz], normal: [-1, 0], length: wz - bz, noWindows: true, pipes: [] });
  kit.finalize(g);
  return { kit, litInfo: kit.litInfo, cctv: kit.cctv };
}

// 검은 반사 유리 박스 + 격자 프레임
function buildStairwell(g, M, [x0, z0, x1, z1], h) {
  addBlock(g, M.darkGlass, x0, 0, z0, x1, h, z1, { cast: true });
  const bars = [];
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const faces = [
    [cx, z1 + 0.02, w, 0], [cx, z0 - 0.02, w, 0], [x1 + 0.02, cz, d, Math.PI / 2], [x0 - 0.02, cz, d, Math.PI / 2],
  ];
  for (const [fx, fzz, len, ry] of faces) {
    for (let v = 0; v <= h + 0.01; v += 1.8) bars.push(mat4(fx, v, fzz, ry, len + 0.04, 0.07, 0.07));
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len * i) / n;
      const px = fx + Math.cos(ry) * t;
      const pz = fzz - Math.sin(ry) * t;
      bars.push(mat4(px, h / 2, pz, ry, 0.07, h, 0.07));
    }
  }
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.iron, bars));
}
