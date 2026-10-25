import * as THREE from 'three';
import { DIM } from '../config.js';
import { addBlock, addPlane, addBox, instanced, mat4 } from './geom.js';

// 앞마당 바닥, 바깥 도로, 공원 바닥, 화단, 철제 담장 + 생울타리, 이동 경계
export function buildCourtyard(root, M, col) {
  const g = new THREE.Group();
  g.name = 'courtyard';
  root.add(g);
  const { innerX, frontZ, backZ, fenceZ, streetMaxZ, park } = DIM;

  // 바닥
  addPlane(g, M.paving, innerX * 2, fenceZ - frontZ, 0, 0, (fenceZ + frontZ) / 2, 4);
  addPlane(g, M.concrete, DIM.piloti.halfW * 2, frontZ - backZ, 0, 0.002, (frontZ + backZ) / 2, 2);
  addPlane(g, M.concrete, 70, 4, 0, 0.0, fenceZ + 2.4, 2); // 보도
  addPlane(g, M.asphalt, 160, 9, 0, -0.01, fenceZ + 8.9, 6); // 도로
  addPlane(g, M.concrete, 160, 5, 0, 0.0, fenceZ + 15.9, 2); // 건너편 보도
  addPlane(g, M.grass, 90, 50, 0, -0.005, backZ - 25, 4); // 공원 잔디
  addPlane(g, M.gravel, 4, 18, 0, 0.003, backZ - 9, 3); // 공원 산책로
  addPlane(g, M.gravel, 34, 3, 0, 0.004, backZ - 11, 3);
  addPlane(g, M.asphalt, 400, 400, 0, -0.03, 0, 8, {}); // 바깥 먼 바닥

  // 발소리 재질 영역
  col.surface(-80, fenceZ, 80, 80, 'concrete');
  col.surface(-DIM.piloti.halfW, backZ, DIM.piloti.halfW, frontZ, 'concrete');
  col.surface(-80, -120, 80, backZ, 'grass');
  col.surface(-2, backZ - 18, 2, backZ, 'gravel');
  col.surface(-17, backZ - 12.5, 17, backZ - 9.5, 'gravel');

  // 화단 (연석 + 흙), 관목은 props 에서 배치
  const beds = [
    [-innerX, -12, -13.2, 4],
    [-13.2, frontZ, -6.8, -12.6],
    [6.8, frontZ, 11.6, -12.6],
    [13.2, 3.2, innerX, 7.5],
  ];
  for (const [x0, z0, x1, z1] of beds) {
    const t = 0.18;
    addBlock(g, M.curb, x0, 0, z0, x1, 0.32, z0 + t);
    addBlock(g, M.curb, x0, 0, z1 - t, x1, 0.32, z1);
    addBlock(g, M.curb, x0, 0, z0, x0 + t, 0.32, z1);
    addBlock(g, M.curb, x1 - t, 0, z0, x1, 0.32, z1);
    addBlock(g, M.soil, x0 + t, 0, z0 + t, x1 - t, 0.26, z1 - t, { cast: false });
    col.box(x0, z0, x1, z1);
  }
  const bedList = beds.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 }));

  buildFence(g, M, col);

  // 이동 경계 (보이지 않는 벽)
  col.box(-80, streetMaxZ, 80, streetMaxZ + 2);
  col.box(-32, fenceZ, -30, streetMaxZ);
  col.box(30, fenceZ, 32, streetMaxZ);
  col.box(park.minX - 2, park.minZ - 2, park.maxX + 2, park.minZ);
  col.box(park.minX - 2, park.minZ, park.minX, backZ);
  col.box(park.maxX, park.minZ, park.maxX + 2, backZ);

  return { beds: bedList };
}

// 검은 철제 펜스: 기둥 + 상하 레일 + 살 + 파도 곡선 장식 + 원형 장식, 뒤쪽 생울타리
function buildFence(g, M, col) {
  const { innerX, wingSouthZ, fenceZ, gateHalf } = DIM;
  const runs = [
    [[-innerX, fenceZ], [-gateHalf - 0.4, fenceZ], [0, 1]],
    [[gateHalf + 0.4, fenceZ], [innerX, fenceZ], [0, 1]],
    [[-innerX, wingSouthZ], [-innerX, fenceZ], [-1, 0]],
    [[innerX, wingSouthZ], [innerX, fenceZ], [1, 0]],
  ];
  const posts = [];
  const pickets = [];
  const rings = [];
  const rails = [];
  for (const [a, b, out] of runs) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const ry = Math.atan2(-uz, ux);
    const nPost = Math.ceil(len / 2.4);
    for (let i = 0; i <= nPost; i++) {
      const t = (i / nPost) * len;
      posts.push(mat4(a[0] + ux * t, 0.95, a[1] + uz * t, ry));
    }
    for (let t = 0.15; t < len; t += 0.16) pickets.push(mat4(a[0] + ux * t, 0.9, a[1] + uz * t, ry));
    for (const y of [0.14, 1.72]) rails.push(mat4(a[0] + ux * len / 2, y, a[1] + uz * len / 2, ry, len, 1, 1));

    // 파도 곡선: y = 0.92 + 0.26 sin(2πt/2.4)
    const pts = [];
    const wl = 2.4;
    for (let t = 0; t <= len + 0.001; t += 0.1) {
      pts.push(new THREE.Vector3(a[0] + ux * t, 0.92 + 0.26 * Math.sin((2 * Math.PI * t) / wl), a[1] + uz * t));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.022, 5), M.iron);
    tube.castShadow = true;
    g.add(tube);
    for (let t = wl / 4; t < len; t += wl / 2) {
      const y = 0.92 + 0.26 * Math.sin((2 * Math.PI * t) / wl);
      rings.push(mat4(a[0] + ux * t, y + (y > 0.92 ? 0.2 : -0.2), a[1] + uz * t, ry));
    }

    // 생울타리 (담장 바깥쪽)
    const hx = a[0] + ux * len / 2 + out[0] * 0.75;
    const hz = a[1] + uz * len / 2 + out[1] * 0.75;
    addBox(g, M.hedge, Math.abs(ux) * len + Math.abs(out[0]) * 0.9, 1.35, Math.abs(uz) * len + Math.abs(out[1]) * 0.9, hx, 0, hz, { tile: 1.5 });
    col.box(a[0] - 0.1 * Math.abs(uz), a[1] - 0.1 * Math.abs(ux), b[0] + 0.1 * Math.abs(uz), b[1] + 0.1 * Math.abs(ux));
  }
  g.add(instanced(new THREE.BoxGeometry(0.09, 1.9, 0.09), M.iron, posts));
  g.add(instanced(new THREE.BoxGeometry(0.022, 1.6, 0.022), M.iron, pickets));
  g.add(instanced(new THREE.BoxGeometry(1, 0.05, 0.035), M.iron, rails));
  g.add(instanced(new THREE.TorusGeometry(0.1, 0.016, 5, 16), M.iron, rings));

  // 정문 기둥 (벽돌)
  for (const s of [-1, 1]) {
    addBox(g, M.brick, 0.7, 2.1, 0.7, s * (gateHalf + 0.05), 0, fenceZ, { tile: 2 });
    addBox(g, M.curb, 0.82, 0.12, 0.82, s * (gateHalf + 0.05), 2.1, fenceZ);
    col.box(s * (gateHalf + 0.05) - 0.35, fenceZ - 0.35, s * (gateHalf + 0.05) + 0.35, fenceZ + 0.35);
  }
}
