import * as THREE from 'three';
import { DIM, PALETTE } from '../config.js';
import { addBox, instanced, mat4 } from './geom.js';

// 가로등 한 개: 기둥 + 팔 + 등갓 + 발광 렌즈(개별 재질 → 이벤트로 개별 소등)
export function makeLamp(root, M, x, z, { color = PALETTE.lampWarm, height = 5.2, ry = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.1, height, 10), M.lampPole ?? M.iron);
  pole.position.y = height / 2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), M.lampPole ?? M.iron);
  arm.position.set(0.42, height - 0.05, 0);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.32), M.lampPole ?? M.iron);
  hood.position.set(0.85, height - 0.02, 0);
  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3.2) });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.24), lensMat);
  lens.position.set(0.85, height - 0.1, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), M.lampPole ?? M.iron);
  base.position.y = 0.25;
  for (const m of [pole, arm, hood, base]) m.castShadow = true;
  g.add(pole, arm, hood, lens, base);
  root.add(g);
  g.updateMatrixWorld(true);
  const headPos = new THREE.Vector3();
  lens.getWorldPosition(headPos);
  return { group: g, lensMat, headPos, color: new THREE.Color(color), baseLens: lensMat.color.clone(), on: 1 };
}

export function buildProps(root, M, col, ctx) {
  const g = new THREE.Group();
  g.name = 'props';
  root.add(g);

  // 앞마당 가로등 3개
  const lamps = [
    makeLamp(g, M, -7, 7.5, { ry: 0.3 }),
    makeLamp(g, M, 8.4, -6.2, { ry: Math.PI - 0.5 }),
    makeLamp(g, M, -6.4, -9.6, { ry: -0.6 }),
  ];
  for (const l of lamps) col.circle(l.group.position.x, l.group.position.z, 0.2);

  // 대형 반구형 화분 줄 (서쪽) + 필로티 양옆
  const potGeo = new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  potGeo.rotateX(Math.PI);
  potGeo.translate(0, 0.85, 0);
  const pots = [];
  const potSpots = [[-10.5, -7], [-10.5, -3], [-10.5, 1], [-10.5, 5], [-10.5, 9], [-7, -11.2], [7, -11.2]];
  for (const [x, z] of potSpots) {
    pots.push(mat4(x, 0, z));
    col.circle(x, z, 0.85);
  }
  g.add(instanced(potGeo, M.planter, pots));
  const soil = new THREE.CircleGeometry(0.8, 20);
  soil.rotateX(-Math.PI / 2);
  g.add(instanced(soil, M.soil, potSpots.map(([x, z]) => mat4(x, 0.82, z)), { cast: false }));

  // 현관 계단 옆 자전거 1대
  g.add(makeBike(M, DIM.steps.x0 - 0.9, 2.7, 0.35));
  col.circle(DIM.steps.x0 - 0.9, 2.7, 0.5);

  // 벤치 (공원)
  for (const [x, z, ry] of [[-6, -33, 0.3], [5, -37, -0.4], [-1.5, -43, 0]]) g.add(makeBench(M, x, z, ry));

  // 지상 에어컨 실외기 + 초록 비상구 표지
  for (const [x, z, ry] of [[-14.4, 6.6, Math.PI / 2], [14.5, -3.6 - 1.1, -Math.PI / 2], [-28, -27.4, Math.PI], [24, -28.5, Math.PI]]) {
    addBox(g, M.metalBox, 0.9, 0.75, 0.38, x, 0, z, { ry });
  }
  addBox(g, M.exitSign, 0.46, 0.18, 0.05, -4.2, DIM.piloti.h - 0.45, DIM.frontZ - 0.08, { cast: false });
  addBox(g, M.exitSign, 0.46, 0.18, 0.05, 4.2, DIM.piloti.h - 0.45, DIM.backZ + 0.08, { cast: false });

  // CCTV 돔 (상시: 천천히 플레이어 쪽으로 회전)
  const cams = buildCctv(g, M, ctx.bld.cctv);

  return { lamps, cams };
}

function makeBike(M, x, z, ry) {
  const g = new THREE.Group();
  const wheel = new THREE.TorusGeometry(0.33, 0.025, 6, 24);
  for (const dx of [-0.52, 0.52]) {
    const w = new THREE.Mesh(wheel, M.black);
    w.position.set(dx, 0.35, 0);
    w.castShadow = true;
    g.add(w);
  }
  const bar = (len, px, py, rz) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), M.bikeFrame ?? M.silver);
    m.position.set(px, py, 0);
    m.rotation.z = rz;
    m.castShadow = true;
    g.add(m);
  };
  bar(0.72, -0.18, 0.55, -1.0);
  bar(0.62, 0.2, 0.58, 0.95);
  bar(0.62, 0.0, 0.78, Math.PI / 2);
  bar(0.5, -0.52 + 0.12, 0.5, 0.5);
  bar(0.46, 0.45, 0.62, 0.35);
  bar(0.4, 0.52, 0.9, Math.PI / 2 + 0.0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), M.black);
  seat.position.set(-0.28, 0.9, 0);
  g.add(seat);
  g.position.set(x, 0, z);
  g.rotation.set(0, ry, 0.04);
  return g;
}

function makeBench(M, x, z, ry) {
  const g = new THREE.Group();
  addBox(g, M.trunk, 1.6, 0.05, 0.42, 0, 0.42, 0);
  addBox(g, M.trunk, 1.6, 0.35, 0.05, 0, 0.5, -0.2);
  for (const dx of [-0.7, 0.7]) addBox(g, M.iron, 0.05, 0.45, 0.42, dx, 0, 0);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  return g;
}

function buildCctv(g, M, list) {
  const n = list.length;
  const mount = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), M.metalBox, n);
  const dome = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), M.cctvDome ?? M.darkGlass, n);
  const lens = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.03, 0.05, 8).rotateX(Math.PI / 2), M.black, n);
  const cams = list.map((c, i) => {
    const base = c.pos.clone().addScaledVector(c.normal, 0.12);
    mount.setMatrixAt(i, mat4(base.x, base.y + 0.02, base.z, c.ry));
    dome.setMatrixAt(i, mat4(base.x, base.y, base.z, c.ry));
    return { base, yaw: c.ry, baseYaw: c.ry };
  });
  mount.instanceMatrix.needsUpdate = dome.instanceMatrix.needsUpdate = true;
  g.add(mount, dome, lens);
  const o = new THREE.Object3D();
  const update = (dt, playerPos) => {
    cams.forEach((c, i) => {
      const dx = playerPos.x - c.base.x;
      const dz = playerPos.z - c.base.z;
      let want = Math.atan2(dx, dz);
      let diff = Math.atan2(Math.sin(want - c.baseYaw), Math.cos(want - c.baseYaw));
      diff = Math.max(-1.3, Math.min(1.3, diff)); // 벽 안쪽은 보지 않음
      want = c.baseYaw + diff;
      const d = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
      c.yaw += Math.sign(d) * Math.min(Math.abs(d), 0.25 * dt); // 천천히 (≈14°/s)
      const pitch = Math.atan2(c.base.y - 1.6, Math.hypot(dx, dz));
      o.position.set(c.base.x + Math.sin(c.yaw) * 0.07, c.base.y - 0.06, c.base.z + Math.cos(c.yaw) * 0.07);
      o.rotation.set(Math.min(pitch, 1.2), c.yaw, 0, 'YXZ');
      o.updateMatrix();
      lens.setMatrixAt(i, o.matrix);
    });
    lens.instanceMatrix.needsUpdate = true;
  };
  update(10, new THREE.Vector3(0, 0, 12));
  lens.computeBoundingSphere();
  return { update, count: n };
}
