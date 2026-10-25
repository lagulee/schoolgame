import * as THREE from 'three';
import { DIM, PALETTE, SCHOOL_NAME } from '../config.js';
import { addBox, instanced, mat4, rng } from './geom.js';
import { LedSign } from './ledSign.js';
import { makeLamp } from './props.js';
import { buildTrees, buildShrubs } from './trees.js';

const AUTUMN = [0x9a3e16, 0xb35a1d, 0x7d2a12, 0xb8862c, 0x8c4a1a, 0xa0301a];
const PARK_GREEN = [0x3d6b23, 0x4c7d2a, 0x2f5a1d, 0x5a8a30];

// 필로티 위 두 줄 LED, 공원(초록 조명·정자·나무), 가로수, 화단 관목, 상가 거리, 먼 아파트 실루엣
export function buildSurroundings(root, M, col, ctx) {
  const g = new THREE.Group();
  g.name = 'surroundings';
  root.add(g);
  const { frontZ, backZ, fenceZ } = DIM;
  const H = DIM.floorH;

  // 필로티 개구부 위 4층 부근 두 줄 전광판
  const sign = new LedSign({
    cols: 176, rows: 28, width: 7.6, height: 1.2,
    lines: [`${SCHOOL_NAME} 학생 여러분 환영합니다   ·   `, `늦은 귀가 시 보호자와 함께   ·   야간 경비 순찰 중   ·   `],
    speeds: [9, 13],
  });
  sign.group.position.set(0, 3 * H + 1.95, frontZ + 0.1);
  g.add(sign.group);

  // 가로수(가을 잎) + 공원 나무(초록 발광)
  const street = buildTrees(g, [
    { x: -12.4, z: 12.6, h: 5.2 }, { x: -8.4, z: 13.0, h: 4.8 }, { x: 8.6, z: 13.0, h: 5.0 }, { x: 12.4, z: 12.5, h: 5.4 },
    { x: -14.1, z: -7.5, h: 5.6, r: 1.4 }, { x: -14.1, z: 0.5, h: 5.0, r: 1.4 },
  ], { palette: AUTUMN, trunkMat: M.trunk });
  for (const [x, z] of [[-12.4, 12.6], [-8.4, 13.0], [8.6, 13.0], [12.4, 12.5]]) col.circle(x, z, 0.25);

  const parkTrees = [];
  const R = rng(21);
  const spots = [[-7, -35], [6.8, -40.5], [-1.2, -47], [-12, -42], [11, -33], [-15, -31.5], [15, -44], [3, -52], [-9, -50]];
  for (const [x, z] of spots) parkTrees.push({ x, z, h: 4.6 + R() * 1.6, r: 1.6 + R() * 0.6 });
  const park = buildTrees(g, parkTrees, { palette: PARK_GREEN, trunkMat: M.trunk, emissive: PALETTE.parkGreen, emissiveIntensity: 0.3 });
  for (const t of parkTrees) col.circle(t.x, t.z, 0.25);

  buildShrubs(g, ctx.yard.beds, M.shrub ?? M.hedge);

  // 공원 가로등 (초록 빛)
  const parkLamps = [
    makeLamp(g, M, 3.2, -33.5, { color: PALETTE.parkGreen, height: 4.2, ry: Math.PI }),
    makeLamp(g, M, -9.5, -40.5, { color: PALETTE.parkGreen, height: 4.2, ry: 0.4 }),
  ];
  for (const l of parkLamps) col.circle(l.group.position.x, l.group.position.z, 0.2);

  // 정자 실루엣
  buildPavilion(g, M, -4.6, -39.5);
  col.box(-4.6 - 2, -39.5 - 2, -4.6 + 2, -39.5 + 2);

  buildShops(g, M, fenceZ);
  buildApartments(g, M, backZ);

  return { sign, street, park, parkLamps };
}

function buildPavilion(g, M, x, z) {
  const p = new THREE.Group();
  const posts = [];
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) posts.push(mat4(dx, 1.35, dz));
  p.add(instanced(new THREE.CylinderGeometry(0.12, 0.13, 2.7, 10), M.pavilion ?? M.trunk, posts));
  addBox(p, M.pavilion ?? M.trunk, 3.8, 0.4, 0.2, 0, 0.35, -1.7);
  addBox(p, M.pavilion ?? M.trunk, 3.7, 0.25, 3.7, 0, 0, 0);
  // 겹처마 지붕: 납작한 사각뿔 2단, 처마 끝을 살짝 들어 올림
  const roofGeo = new THREE.ConeGeometry(3.4, 1.2, 4, 3, false);
  const pos = roofGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.55) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      pos.setY(i, y + Math.max(0, r - 2.6) * 0.5);
    }
  }
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, M.roofTile ?? M.black);
  roof.position.y = 3.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 4), M.roofTile ?? M.black);
  cap.position.y = 4.1;
  cap.rotation.y = Math.PI / 4;
  p.add(roof, cap);
  p.position.set(x, 0, z);
  p.rotation.y = 0.25;
  g.add(p);
}

// 담장 바깥 상가 거리 실루엣: 박스 + 네온 발광 띠, 간판은 의미 없는 모양
function buildShops(g, M, fenceZ) {
  const R = rng(5);
  const z0 = fenceZ + 18.4;
  const neon = [0xff3fa4, 0x3fe7ff, 0xa36bff, 0xffb13f, 0x58ff8a];
  let x = -48;
  const signTex = glyphTexture();
  while (x < 48) {
    const w = 5 + R() * 6;
    const h = 7 + R() * 9;
    const d = 8;
    addBox(g, M.shopWall ?? M.concrete, w - 0.2, h, d, x + w / 2, 0, z0 + d / 2, { tile: 3 });
    // 1층 쇼윈도 (어두운 발광)
    const c = new THREE.Color(neon[Math.floor(R() * neon.length)]);
    const glow = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.1 + R() * 0.12) });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.2), glow);
    win.position.set(x + w / 2, 1.5, z0 - 0.01);
    win.rotation.y = Math.PI;
    g.add(win);
    // 네온 간판 (의미 없는 글리프 텍스처)
    if (R() < 0.85) {
      const sm = new THREE.MeshBasicMaterial({ map: signTex, color: c.clone().multiplyScalar(1.6 + R()), transparent: true });
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 4.5), 0.9), sm);
      sg.position.set(x + w / 2, 3.3 + R() * 1.5, z0 - 0.05);
      sg.rotation.y = Math.PI;
      sm.map = signTex.clone();
      sm.map.offset.x = R();
      sm.map.needsUpdate = true;
      g.add(sg);
    }
    // 위층 창 몇 개
    for (let fy = 4.5; fy < h - 1; fy += 3) {
      for (let fx = x + 1; fx < x + w - 1; fx += 2) {
        if (R() < 0.82) continue;
        const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), R() < 0.5 ? M.shopWinWarm : M.shopWinCool);
        wm.position.set(fx + 0.5, fy, z0 - 0.02);
        wm.rotation.y = Math.PI;
        g.add(wm);
      }
    }
    x += w;
  }
}

function glyphTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  const R = rng(99);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  for (let i = 0; i < 9; i++) {
    const x0 = 20 + i * 54;
    ctx.beginPath();
    for (let s = 0; s < 3; s++) {
      const ax = x0 + R() * 34;
      const ay = 18 + R() * 60;
      ctx.moveTo(ax, ay);
      if (R() < 0.5) ctx.lineTo(x0 + R() * 34, 18 + R() * 60);
      else ctx.arc(x0 + 17, 48, 8 + R() * 14, R() * 6, R() * 6 + 2);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function buildApartments(g, M, backZ) {
  const R = rng(13);
  for (let i = 0; i < 7; i++) {
    const x = -60 + i * 20 + R() * 6;
    const h = 28 + R() * 18;
    addBox(g, M.farBuilding ?? M.black, 14, h, 10, x, 0, backZ - 52 - R() * 14, { cast: false, receive: false });
  }
}
