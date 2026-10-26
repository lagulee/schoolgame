import * as THREE from 'three';
import { SCHOOL } from '../config.js';
import { addBlock, addPlane, instanced, mat4 } from './geom.js';
import { fieldFenceRuns } from './layout.js';
import { makeLamp } from './props.js';
import { buildRealTrees } from './realTrees.js';

// 운동장 (본관 오른쪽, STORY 4-0): 마사토 바닥, 200 m 트랙 선, 골대 2개, 서쪽 스탠드·구령대·국기봉,
// 동·북쪽 공 막이 그물, 꺼진 조명탑, 가로등 3개(옆길·스탠드 옆). 운동장 가운데는 가로등이 없어 마당보다 어둡다 (STORY 15-3)
export function buildField(root, M, col) {
  const g = new THREE.Group();
  g.name = 'field';
  root.add(g);
  const F = SCHOOL.field;
  const T = F.track;

  addPlane(g, M.dirt, F.x1 - F.x0, F.z1 - F.z0, (F.x0 + F.x1) / 2, 0.001, (F.z0 + F.z1) / 2, 6);
  col.surface(F.x0, F.z0, F.x1, F.z1, 'dirt');

  // 트랙 선: 레인 경계마다 직선 2개 + 반원 2개, 가운데 선·센터 서클
  const lines = new THREE.Group();
  const lw = T.line;
  for (let i = 0; i <= T.lanes; i++) {
    const rr = T.r + (T.w * i) / T.lanes;
    for (const s of [-1, 1]) addFlat(lines, M.lineWhite, T.cx + s * rr, T.cz, lw, T.straight);
    for (const [zc, th] of [[T.cz - T.straight / 2, 0], [T.cz + T.straight / 2, Math.PI]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr - lw / 2, rr + lw / 2, 64, 1, th, Math.PI), M.lineWhite);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(T.cx, 0.006, zc);
      lines.add(ring);
    }
  }
  addFlat(lines, M.lineWhite, T.cx, T.cz, T.r * 2, lw);
  const circle = new THREE.Mesh(new THREE.RingGeometry(4 - lw / 2, 4 + lw / 2, 64), M.lineWhite);
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(T.cx, 0.006, T.cz);
  lines.add(circle);
  for (const m of lines.children) m.receiveShadow = true;
  g.add(lines);

  // 골대 (트랙 안쪽 양끝, 서로 마주 봄)
  for (const s of [-1, 1]) buildGoal(g, M, col, T.cx, T.cz + s * F.goalZ, s);

  // 서쪽 스탠드 (건물을 등지고 운동장을 바라봄) + 구령대 + 국기봉 3개
  const back = F.x0 + 0.6;
  const d = F.standD / F.standSteps;
  for (const [z0, z1] of F.stands) {
    for (let i = 0; i < F.standSteps; i++) addBlock(g, M.concrete, back, 0, z0, back + F.standD - i * d, (i + 1) * F.standRise, z1, { tile: 2 });
    col.box(back, z0, back + F.standD, z1);
  }
  const P = F.podium;
  addBlock(g, M.concrete, back, 0, P.z0, back + P.d, P.h, P.z1, { tile: 2 });
  for (let i = 0; i < 3; i++) addBlock(g, M.granite, back + P.d, 0, P.z0 + 2, back + P.d + 0.9 - i * 0.3, (P.h * (i + 1)) / 4, P.z1 - 2);
  const posts = [];
  for (const x of [back + 0.4, back + P.d - 0.4]) for (const z of [P.z0 + 0.4, P.z1 - 0.4]) posts.push(mat4(x, P.h + (P.roofH - P.h) / 2, z));
  g.add(instanced(new THREE.CylinderGeometry(0.12, 0.12, P.roofH - P.h, 10), M.lampPole ?? M.iron, posts));
  addBlock(g, M.canopy, back - 0.3, P.roofH, P.z0 - 0.5, back + P.d + 0.5, P.roofH + 0.25, P.z1 + 0.5);
  col.box(back, P.z0, back + P.d + 0.9, P.z1);
  const flags = [];
  for (let i = 0; i < 3; i++) {
    const z = P.z0 - 2.2 - i * 1.4;
    flags.push(mat4(back + 1.5, 4.5, z));
    col.circle(back + 1.5, z, 0.12);
  }
  g.add(instanced(new THREE.CylinderGeometry(0.04, 0.06, 9, 8), M.silver, flags));

  // 공 막이 그물 (동·북쪽 끝) + 서쪽 낮은 울타리
  buildNet(g, M, [F.x1, F.z1 - 0.5], [F.x1, F.z0], F.netH);
  buildNet(g, M, [F.x1, F.z0], [F.x0, F.z0], F.netH);
  for (const [a, b] of fieldFenceRuns()) buildNet(g, M, a, b, 1.2, M.iron);

  // 꺼진 조명탑 2개 (동쪽)
  const towers = [[F.x1 - 1.2, T.cz + 22], [F.x1 - 1.2, T.cz - 22]];
  const poles = [];
  const heads = [];
  for (const [x, z] of towers) {
    poles.push(mat4(x, 7, z));
    heads.push(mat4(x - 0.3, 14.2, z, Math.PI / 2));
    col.circle(x, z, 0.3);
  }
  g.add(instanced(new THREE.CylinderGeometry(0.16, 0.26, 14, 10), M.lampPole ?? M.iron, poles));
  g.add(instanced(new THREE.BoxGeometry(2.4, 1.2, 0.3), M.black, heads));

  // 그물 밖 나무 (닿을 수 없는 곳)
  const trees = [];
  for (let z = F.z1 - 8; z > F.z0; z -= 13) trees.push({ x: F.x1 + 4 + Math.abs(z * 7) % 3, z, h: 5.6 + Math.abs(z * 3) % 1.6, r: 1.9 });
  for (let x = F.x0 + 6; x < F.x1; x += 14) trees.push({ x, z: F.z0 - 4, h: 6, r: 2 });
  buildRealTrees(g, trees, { barkMat: M.bark, emissiveIntensity: 0 });

  // 가로등: 옆길(마당 → 운동장) 1개 + 스탠드 옆 2개 (건물 옆면이 보일 만큼만)
  const lamps = F.lamps.map(([x, z, ry]) => {
    col.circle(x, z, 0.2);
    return makeLamp(g, M, x, z, { ry });
  });
  return { lamps };
}

function addFlat(parent, mat, x, z, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.006, z);
  parent.add(m);
}

// 축구 골대: 기둥 2 + 가로대 + 뒤로 기운 그물. s = 골대가 놓인 쪽(−1 북, +1 남), 입구는 운동장 가운데를 향함
function buildGoal(g, M, col, cx, z, s) {
  const { w, h, d } = SCHOOL.field.goal;
  const bars = [];
  for (const dx of [-w / 2, w / 2]) {
    bars.push(mat4(cx + dx, h / 2, z, 0, 0.1, h, 0.1));
    bars.push(mat4(cx + dx, 0.03, z + s * d * 0.5, 0, 0.06, 0.06, d)); // 바닥 받침
    col.circle(cx + dx, z, 0.1);
  }
  bars.push(mat4(cx, h, z, 0, w + 0.1, 0.1, 0.1));
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.goalWhite, bars));
  const net = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.hypot(h, d)), M.net);
  net.position.set(cx, h / 2, z + (s * d) / 2);
  net.rotation.x = -s * Math.atan2(d, h);
  g.add(net);
  col.box(cx - w / 2, Math.min(z, z + s * d), cx + w / 2, Math.max(z, z + s * d));
}

// 기둥 + 위아래 레일 + (높은 것은) 그물 면. 충돌은 layout.js (서쪽 울타리) 와 field 경계
function buildNet(g, M, a, b, hgt, railMat = M.lampPole ?? M.iron) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(-dz, dx);
  const n = Math.ceil(len / 6);
  const posts = [];
  for (let i = 0; i <= n; i++) posts.push(mat4(a[0] + (dx * i) / n, hgt / 2, a[1] + (dz * i) / n, 0, 1, hgt, 1));
  g.add(instanced(new THREE.BoxGeometry(0.08, 1, 0.08), railMat, posts));
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  const rails = [mat4(mx, hgt, mz, ry, len, 1, 1), mat4(mx, 0.15, mz, ry, len, 1, 1)];
  if (hgt < 2) rails.push(mat4(mx, hgt * 0.55, mz, ry, len, 1, 1));
  g.add(instanced(new THREE.BoxGeometry(1, 0.05, 0.05), railMat, rails));
  if (hgt >= 2) {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(len, hgt), M.net);
    net.position.set(mx, hgt / 2, mz);
    net.rotation.y = ry;
    g.add(net);
  }
}
