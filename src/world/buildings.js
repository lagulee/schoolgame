import * as THREE from 'three';
import { DIM, SCHOOL, INTERIOR } from '../config.js';
import { addBlock, addBlocks, instanced, mat4 } from './geom.js';
import { FacadeKit } from './facade.js';
import { pilotiBackZ, frontShellWalls, pilotiWalls, facadeFaces, buildingTop } from './layout.js';
import { buildMainRear } from './mainBuilding.js';
import { pilotiGlassTexture } from '../materials/windowTex.js';

// 본관 앞부분: ㄷ자 (북쪽 중앙 블록 + 동·서 날개 = 좌우 돌출부), 얕은 필로티, 유리 계단실, 외벽 디테일.
// 단계 8부터 속이 빈 셸(벽 + 지붕 슬래브)이고 안은 실내(interior/). 뒷부분(중정형 셸)은 mainBuilding.js. 큰 충돌은 layout.js
export function buildBuildings(root, M, col) {
  const g = new THREE.Group();
  g.name = 'buildings';
  root.add(g);
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz } = DIM;
  const top = buildingTop();
  const roof = DIM.floors * DIM.floorH;
  const pw = DIM.piloti.halfW;
  const ph = DIM.piloti.h;
  const T = { tile: 2 };

  // 셸 벽 (벽돌 변형 2종을 번갈아 써서 반복 티를 줄인다) + 필로티 양옆 벽. 충돌은 layout.js
  const pz = pilotiBackZ();
  // 재질별로 메시 하나씩 합친다 (뒷부분 셸 벽도 같은 목록 → mainBuilding.js 가 채운다)
  const walls = { brick: [], brickB: [] };
  frontShellWalls().forEach(({ r: [x0, z0, x1, z1], y0, y1 }, i) => walls[i % 2 ? 'brickB' : 'brick'].push([x0, y0, z0, x1, y1, z1]));
  for (const [x0, z0, x1, z1] of pilotiWalls().slice(0, 2)) walls.brick.push([x0, 0, z0, x1, ph, z1]);
  // 지붕 슬래브: 실내 맨 위층 천장(roof − slab)보다 5 cm 위에서 시작해 천장 면과 겹치지 않게
  const sy = roof - INTERIOR.slab + 0.05;
  // 셸 벽 바깥 면과 겹치지 않게 벽 안쪽까지만 (rx 밖의 중앙 블록 뒷면도 셸 벽)
  const w = SCHOOL.shellWall;
  const rx = SCHOOL.main.outerX;
  const slabs = [
    [-ix, bz, ix, fz - w], [ix, bz, rx, fz], [rx, bz + w, ox - w, fz], [-rx, bz, -ix, fz], [-ox + w, bz + w, -rx, fz],
    [ix + w, fz, ox - w, wz - w], [-ox + w, fz, -ix - w, wz - w],
  ];
  const roofs = slabs.map(([x0, z0, x1, z1]) => [x0, sy, z0, x1, roof, z1]);

  // 필로티 내부: 콘크리트 마감 벽 + 천장 + 가운데 기둥 + 천장 형광등(발광만) + 막힌 끝의 유리문
  addBlock(g, M.concrete, -pw, 0, pz, -pw + 0.05, ph, fz, { tile: 2 });
  addBlock(g, M.concrete, pw - 0.05, 0, pz, pw, ph, fz, { tile: 2 });
  addBlock(g, M.concrete, -pw, ph - 0.06, pz, pw, ph, fz, { tile: 2, cast: false });
  addBlock(g, M.concrete, -pw - 0.2, ph - 0.7, fz - 0.05, pw + 0.2, ph, fz + 0.12, { tile: 2 }); // 보
  addBlock(g, M.concrete, -pw, ph - 0.7, pz, pw, ph, pz + 0.12, { tile: 2 });
  const colm = new THREE.Mesh(new THREE.CylinderGeometry(DIM.piloti.colR, DIM.piloti.colR, ph, 20), M.concrete);
  colm.position.set(0, ph / 2, DIM.piloti.colZ);
  colm.castShadow = colm.receiveShadow = true;
  g.add(colm);
  const tubes = [];
  for (let z = fz - 2.2; z > pz + 0.8; z -= 3) tubes.push(mat4(-2.2, ph - 0.08, z, 0), mat4(2.2, ph - 0.08, z, 0));
  g.add(instanced(new THREE.BoxGeometry(0.12, 0.05, 1.3), M.tubeLight ?? M.frame, tubes, { cast: false }));
  buildPilotiGlass(g, M, pz, pw, ph);

  // 유리 계단실 2곳 (중앙 블록 동쪽 모서리, 서쪽 날개 남쪽 끝)
  const stairs = [
    [ix - 3, fz, ix, fz + 1.0],
    [-ix, wz - 3.4, -ix + 1.0, wz - 0.2],
  ];
  for (const s of stairs) buildStairwell(g, M, s, top + 0.9);
  for (const [x0, z0, x1, z1] of stairs) col.box(x0, z0, x1, z1);

  // 외벽 디테일: 면 위치·창 자리는 layout.facadeFaces (실내 창과 같은 목록), 여기서는 장식만 더한다
  const kit = new FacadeKit(M);
  const F = facadeFaces();
  const face = (id, extra = {}) => kit.add({ id, ...F[id], ...extra });
  face('front', { cctv: 0.12, ac: 0.05, pipes: [0.35, ix - pw - 0.6, ix + pw + 0.6] });
  face('west', { cctv: 0.1, ac: 0.08, pipes: [3.9, wz - fz - 0.35] });
  face('east', { cctv: 0.1, ac: 0.04, pipes: [0.35, wz - fz - 0.35] });
  face('eastSouth', { ac: 0.1, cctv: 0.05 });
  face('westSouth', { ac: 0.1, cctv: 0.05 });
  // 중앙 블록 뒷면은 단계 7부터 중정형 뒷부분에 붙는다: 뒷부분보다 튀어나온 양끝 2 m 만 보인다
  face('backE', { pipes: [] });
  face('backW', { pipes: [] });
  // 옆면: 운동장에서 보이므로 창을 낸다 (이전에는 창 없는 벽)
  face('sideE', { cctv: 0.06, ac: 0.08, pipes: [0.35, wz - bz - 0.35] });
  face('sideW', { pipes: [] });
  const rear = buildMainRear(g, M, F, walls, roofs);
  for (const k of ['brick', 'brickB']) addBlocks(g, M[k], walls[k], T);
  addBlocks(g, M.concrete, roofs, { tile: 3 });
  for (const id of ['rearE', 'rearW', 'rearN']) kit.add({ id, ...F[id], ...rear.decor[id] });
  kit.finalize(g);
  return { kit, litInfo: kit.litInfo, cctv: kit.cctv, rear };
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

// 필로티 막힌 끝: 은색 프레임 유리문 4짝, 안쪽은 초록 유도등 빛만 (잠김)
function buildPilotiGlass(g, M, z, pw, ph) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.1, metalness: 0.4,
    emissive: 0xffffff, emissiveMap: pilotiGlassTexture(), emissiveIntensity: 1.3, envMapIntensity: 0.35 });
  const w = pw * 2 - 0.1;
  const h = ph - 0.7;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
  pane.position.set(0, h / 2, z + 0.03);
  g.add(pane);
  const bars = [];
  for (let i = 0; i <= 4; i++) bars.push(mat4(-pw + 0.05 + (w * i) / 4, h / 2, z + 0.06, 0, 0.09, h, 0.08));
  for (const y of [0.05, 2.35, h - 0.05]) bars.push(mat4(0, y, z + 0.06, 0, w, 0.08, 0.08));
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.silver, bars, { cast: false }));
  addBlock(g, M.exitSign, -0.25, 2.55, z + 0.05, 0.25, 2.73, z + 0.1, { cast: false });
}
