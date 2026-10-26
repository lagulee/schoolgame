import * as THREE from 'three';
import { DIM, SCHOOL, SCHOOL_NAME } from '../config.js';
import { addBox, rng } from './geom.js';
import { LedSign } from './ledSign.js';
import { buildTrees, buildShrubs } from './trees.js';

const AUTUMN = [0x9a3e16, 0xb35a1d, 0x7d2a12, 0xb8862c, 0x8c4a1a, 0xa0301a];

// 필로티 위 두 줄 LED, 가로수, 화단 관목, 상가 거리, 먼 아파트 실루엣 (단계 7: 필로티 너머 공원은 본관 뒷부분이 되어 없앰)
export function buildSurroundings(root, M, col, ctx) {
  const g = new THREE.Group();
  g.name = 'surroundings';
  root.add(g);
  const { frontZ, fenceZ } = DIM;
  const H = DIM.floorH;

  // 필로티 개구부 위 4층 부근 두 줄 전광판
  const sign = new LedSign({
    cols: 176, rows: 28, width: 7.6, height: 1.2,
    lines: [`${SCHOOL_NAME} 학생 여러분 환영합니다   ·   `, `늦은 귀가 시 보호자와 함께   ·   야간 경비 순찰 중   ·   `],
    speeds: [9, 13],
  });
  sign.group.position.set(0, 3 * H + 1.95, frontZ + 0.1);
  g.add(sign.group);

  // 가로수(가을 잎)
  const street = buildTrees(g, [
    { x: -12.4, z: 12.6, h: 5.2 }, { x: -8.4, z: 13.0, h: 4.8 }, { x: 8.6, z: 13.0, h: 5.0 }, { x: 12.4, z: 12.5, h: 5.4 },
    { x: -14.1, z: -7.5, h: 5.6, r: 1.4 }, { x: -14.1, z: 0.5, h: 5.0, r: 1.4 },
  ], { palette: AUTUMN, trunkMat: M.trunk });
  for (const [x, z] of [[-12.4, 12.6], [-8.4, 13.0], [8.6, 13.0], [12.4, 12.5]]) col.circle(x, z, 0.25);

  buildShrubs(g, ctx.yard.beds, M.shrub ?? M.hedge);

  buildShops(g, M, fenceZ);
  buildApartments(g, M, SCHOOL.farZ);

  return { sign, street };
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

function buildApartments(g, M, farZ) {
  const R = rng(13);
  for (let i = 0; i < 7; i++) {
    const x = -90 + i * 36 + R() * 8;
    const h = 18 + R() * 12;
    addBox(g, M.farBuilding ?? M.black, 14, h, 10, x, 0, farZ - R() * 14, { cast: false, receive: false });
  }
  for (let i = 0; i < 6; i++) {
    const h = 18 + R() * 12;
    addBox(g, M.farBuilding ?? M.black, 10, h, 14, SCHOOL.farWestX - R() * 12, 0, -20 - i * 34, { cast: false, receive: false });
  }
}
