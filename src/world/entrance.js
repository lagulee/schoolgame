import * as THREE from 'three';
import { DIM, SCHOOL_NAME } from '../config.js';
import { addBlock, addBox, addPlane, instanced, mat4 } from './geom.js';
import { LedSign } from './ledSign.js';

// 동쪽 날개 현관: 자주빛 캐노피, 화강암 원기둥 2개, 유리 자동문, 카드 리더기, 계단 3단, 붉은 LED 전광판
export function buildEntrance(root, M, col) {
  const g = new THREE.Group();
  g.name = 'entrance';
  root.add(g);
  const C = DIM.canopy;
  const S = DIM.steps;
  const wx = DIM.innerX;
  const zc = (C.z0 + C.z1) / 2;

  // 캐노피 슬래브 + 처마 테두리
  addBlock(g, M.canopy, C.x0, C.colH, C.z0, wx, C.colH + C.thick, C.z1);
  addBlock(g, M.canopy, C.x0 - 0.06, C.colH - 0.12, C.z0 - 0.06, C.x0 + 0.1, C.colH + C.thick + 0.08, C.z1 + 0.06);
  // 캐노피 하부 다운라이트 (발광만)
  const downs = [];
  for (const z of [C.z0 + 1.2, zc, C.z1 - 1.2]) downs.push(mat4(C.x0 + 1.6, C.colH - 0.01, z, 0, 1, 1, 1, Math.PI / 2));
  g.add(instanced(new THREE.CircleGeometry(0.13, 16), M.downLight ?? M.frame, downs, { cast: false, receive: false }));

  // 둥근 화강암 기둥 2개
  const colGeo = new THREE.CylinderGeometry(C.colD / 2, C.colD / 2, C.colH, 28);
  for (const z of [C.z0 + 0.6, C.z1 - 0.6]) {
    const m = new THREE.Mesh(colGeo, M.granite);
    m.position.set(C.x0 + 0.55, C.colH / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    col.circle(C.x0 + 0.55, z, C.colD / 2);
  }

  // 계단 3단 + 층계참 (화강암)
  for (let i = 0; i < S.count; i++) {
    const x0 = S.x0 + i * S.tread;
    const h = (i + 1) * S.rise;
    addBlock(g, M.granite, x0, 0, S.z0 - 0.2, wx, h, S.z1 + 0.2);
    col.floor(x0, S.z0 - 0.2, wx, S.z1 + 0.2, h);
  }
  col.surface(S.x0, S.z0 - 0.2, wx, S.z1 + 0.2, 'stone');
  col.surface(C.x0, C.z0, wx, C.z1, 'stone');

  // 유리 자동문: 은색 프레임 + 청백색으로 새어 나오는 실내광
  const doorY = S.count * S.rise;
  const dz0 = S.z0 + 0.3;
  const dz1 = S.z1 - 0.3;
  const dw = dz1 - dz0;
  addBlock(g, M.silver, wx - 0.12, doorY, dz0 - 0.12, wx + 0.02, doorY + 3.0, dz0, { cast: false });
  addBlock(g, M.silver, wx - 0.12, doorY, dz1, wx + 0.02, doorY + 3.0, dz1 + 0.12, { cast: false });
  addBlock(g, M.silver, wx - 0.12, doorY + 2.4, dz0, wx + 0.02, doorY + 2.52, dz1, { cast: false });
  addBlock(g, M.silver, wx - 0.12, doorY + 2.9, dz0, wx + 0.02, doorY + 3.02, dz1, { cast: false });
  addBlock(g, M.silver, wx - 0.1, doorY, (dz0 + dz1) / 2 - 0.03, wx + 0.0, doorY + 2.4, (dz0 + dz1) / 2 + 0.03, { cast: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(dw, 2.4), M.door);
  door.rotation.y = -Math.PI / 2;
  door.position.set(wx - 0.05, doorY + 1.2, (dz0 + dz1) / 2);
  g.add(door);
  const transom = new THREE.Mesh(new THREE.PlaneGeometry(dw, 0.38), M.glass);
  transom.rotation.y = -Math.PI / 2;
  transom.position.set(wx - 0.05, doorY + 2.71, (dz0 + dz1) / 2);
  g.add(transom);

  // 카드 리더기 + 초록 비상구 표지
  addBox(g, M.black, 0.06, 0.2, 0.13, wx - 0.03, doorY + 1.25, dz1 + 0.45, { cast: false });
  addBox(g, M.readerLed ?? M.exitSign ?? M.frame, 0.07, 0.025, 0.04, wx - 0.03, doorY + 1.41, dz1 + 0.45, { cast: false });
  addBox(g, M.exitSign ?? M.frame, 0.05, 0.18, 0.46, wx - 0.03, doorY + 3.25, dz0 + 0.2, { cast: false });

  // 붉은 LED 전광판 (캐노피 정면, 가로로 긴 검은 패널)
  const sign = new LedSign({
    cols: 150, rows: 14, width: 5.2, height: 0.5,
    lines: [`${SCHOOL_NAME}   ·   야간 출입 통제 중   ·   외부인 출입 금지   ·   22:47   ·   `], speeds: [11],
  });
  sign.group.rotation.y = -Math.PI / 2;
  sign.group.position.set(C.x0 - 0.14, C.colH + C.thick / 2 - 0.02, zc);
  g.add(sign.group);

  return {
    sign,
    signPos: new THREE.Vector3(C.x0 - 0.3, C.colH + 0.2, zc),
    lightPos: new THREE.Vector3(wx - 0.9, doorY + 2.0, (dz0 + dz1) / 2),
  };
}

// 현관 왼쪽(북쪽) 파도형 지붕 통로: 사인 곡선 반투명 지붕 + 은색 프레임 + 주황 띠 + 흰 낮은 벽 + 청록 유리 띠
export function buildWaveCorridor(root, M, col) {
  const g = new THREE.Group();
  g.name = 'waveCorridor';
  root.add(g);
  const W = DIM.wave;
  const len = W.z1 - W.z0;
  const xo = W.x0 - 0.2; // 바깥 모서리
  const yAt = (z) => W.h + W.amp * Math.sin(((z - W.z0) / len) * W.waves * 2 * Math.PI);

  // 지붕 (z 방향으로 사인 변위)
  const roofGeo = new THREE.PlaneGeometry(W.x1 - xo + 0.3, len, 1, 80);
  roofGeo.rotateX(-Math.PI / 2);
  const p = roofGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, yAt(p.getZ(i) + (W.z0 + W.z1) / 2));
  roofGeo.translate((xo + W.x1) / 2 - 0.15, 0, (W.z0 + W.z1) / 2);
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, M.waveRoof);
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  // 은색 금속 프레임 (곡선 테두리) + 주황 띠
  const curve = (x, dy) => {
    const pts = [];
    for (let z = W.z0; z <= W.z1 + 0.001; z += 0.15) pts.push(new THREE.Vector3(x, yAt(z) + dy, z));
    return new THREE.CatmullRomCurve3(pts);
  };
  for (const [x, dy, r, mat] of [[xo - 0.3, -0.05, 0.06, M.silver], [W.x1 - 0.05, -0.05, 0.05, M.silver], [xo - 0.3, -0.22, 0.05, M.orange]]) {
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve(x, dy), 140, r, 6), mat);
    t.castShadow = true;
    g.add(t);
  }

  // 기둥 + 보
  const posts = [];
  const beams = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const z = W.z0 + 0.2 + ((len - 0.4) * i) / n;
    const h = yAt(z);
    posts.push(mat4(xo - 0.15, h / 2, z, 0, 1, h, 1));
    beams.push(mat4((xo + W.x1) / 2 - 0.1, h - 0.12, z, 0, W.x1 - xo + 0.2, 1, 1));
    col.circle(xo - 0.15, z, 0.1);
  }
  g.add(instanced(new THREE.CylinderGeometry(0.075, 0.075, 1, 10), M.silver, posts));
  g.add(instanced(new THREE.BoxGeometry(1, 0.12, 0.08), M.silver, beams));

  // 흰 낮은 벽 + 청록 유리 띠 (가운데 출입 틈)
  const gap0 = W.z0 + len * 0.42;
  const gap1 = gap0 + 1.8;
  for (const [a, b] of [[W.z0, gap0], [gap1, W.z1]]) {
    addBlock(g, M.whiteWall, xo - 0.1, 0, a, xo + 0.12, 0.9, b);
    addBlock(g, M.teal, xo - 0.03, 0.9, a, xo + 0.05, 1.45, b, { cast: false });
    addBlock(g, M.silver, xo - 0.05, 1.45, a, xo + 0.07, 1.5, b);
    col.box(xo - 0.1, a, xo + 0.12, b);
  }
  addPlane(g, M.concrete, W.x1 - xo, len, (xo + W.x1) / 2, 0.004, (W.z0 + W.z1) / 2, 2);
  col.surface(xo, W.z0, W.x1, W.z1, 'concrete');
  return { yAt };
}
