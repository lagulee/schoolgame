import * as THREE from 'three';
import { instanced, rng } from './geom.js';
import { addWind } from './trees.js';
import { leafClusterTexture } from '../materials/leaves.js';

// 사실적인 활엽수: 뿌리 퍼짐 + 휘어진 줄기 + 굵은 가지 → 잔가지 구조를 만들고,
// 잔가지 끝마다 잎 카드(알파 컷아웃)를 뭉쳐 달아 듬성듬성 비치는 수관을 만든다.
// 카드는 수관 중심에서 바깥쪽을 향하게 눕혀 조명이 덩어리 단위로 자연스럽게 받도록 한다.

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// p0 → p1 을 잇는 원뿔대 (단위 높이 원기둥을 늘려서 사용). 반지름은 시작 지점 기준 r0
function segment(list, p0, p1, r0) {
  const d = _p.copy(p1).sub(p0);
  const len = d.length();
  _q.setFromUnitVectors(Y, d.normalize());
  _s.set(r0, len, r0);
  list.push(new THREE.Matrix4().compose(p0.clone().addScaledVector(d, len / 2), _q, _s));
}

function gauss(R) {
  return (R() + R() + R() - 1.5) * 0.8;
}

export function buildRealTrees(root, trees, { barkMat, emissive, emissiveIntensity = 0 }) {
  const g = new THREE.Group();
  g.name = 'realTrees';
  const leafTex = leafClusterTexture();
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.78, metalness: 0,
  });
  if (emissive) {
    leafMat.emissive = new THREE.Color(emissive);
    leafMat.emissiveMap = leafTex;
    leafMat.emissiveIntensity = emissiveIntensity;
  }
  addWind(leafMat, 0.045);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x142210, roughness: 1 });

  const trunks = [];
  const flares = [];
  const branches = [];
  const cards = [];
  const cardColors = [];
  const cores = [];
  const tint = new THREE.Color();

  for (const t of trees) {
    const R = rng(t.seed ?? Math.floor(t.x * 31 + t.z * 17 + 5));
    const H = t.h ?? 5.2;
    const spread = (t.r ?? 1.9) / 1.9;
    const th = H * (0.38 + R() * 0.08); // 줄기 높이(첫 갈래까지)
    const base = new THREE.Vector3(t.x, 0, t.z);
    const lean = new THREE.Vector3((R() - 0.5) * 0.16, 1, (R() - 0.5) * 0.16).normalize();
    const fork = base.clone().addScaledVector(lean, th);
    const rb = 0.17 + R() * 0.05;

    segment(trunks, base, fork, rb);
    segment(flares, base.clone().add(new THREE.Vector3(0, -0.02, 0)), base.clone().add(new THREE.Vector3(0, 0.7, 0)), rb * 1.55);

    const crown = new THREE.Vector3(); // 가지 끝들의 평균 = 수관 중심
    const ends = []; // 잎 클러스터가 달릴 (위치, 개수, 퍼짐)
    const nMain = 5 + Math.floor(R() * 2);
    const az0 = R() * Math.PI * 2;
    for (let i = 0; i < nMain; i++) {
      const az = az0 + (i / nMain) * Math.PI * 2 + (R() - 0.5) * 0.7;
      const el = (50 + R() * 22) * (Math.PI / 180);
      const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      const L = H * (0.4 + R() * 0.12) * (0.85 + 0.3 * spread * 0.5);
      const start = fork.clone().addScaledVector(Y, -0.05 * i);
      const tip = start.clone().addScaledVector(dir, L);
      // 가지는 살짝 아래로 휘도록 중간점을 둔다
      const mid = start.clone().lerp(tip, 0.55).addScaledVector(Y, -0.1 * L * (1 - el / 1.2));
      segment(branches, start, mid, rb * 0.5);
      segment(branches, mid, tip, rb * 0.34);
      crown.add(tip);
      ends.push({ p: tip, n: 8 + Math.floor(R() * 4), s: 0.7 * spread });

      const nSub = 3;
      for (let j = 0; j < nSub; j++) {
        const f = 0.45 + (j / nSub) * 0.45 + R() * 0.08;
        const sp = start.clone().lerp(mid, Math.min(1, f / 0.55)).lerp(tip, Math.max(0, (f - 0.55) / 0.45));
        const side = new THREE.Vector3(R() - 0.5, R() * 0.9 + 0.1, R() - 0.5).normalize();
        const sd = dir.clone().multiplyScalar(0.55).addScaledVector(side, 0.85).normalize();
        const sl = L * (0.4 + R() * 0.25);
        const se = sp.clone().addScaledVector(sd, sl);
        segment(branches, sp, se, rb * 0.22);
        ends.push({ p: se, n: 12 + Math.floor(R() * 4), s: 0.62 * spread });
      }
    }
    crown.multiplyScalar(1 / nMain);
    crown.y = Math.max(crown.y, fork.y + H * 0.25);

    // 안쪽을 채우는 어두운 덩어리: 가지 사이로 하늘이 다 비치지 않게 (수관 내부의 그늘)
    for (let i = 0; i < 4; i++) {
      const s = H * (0.13 + R() * 0.07) * spread;
      const c = crown.clone().add(new THREE.Vector3(gauss(R) * 0.9, gauss(R) * 0.5 + 0.1, gauss(R) * 0.9));
      cores.push(new THREE.Matrix4().compose(c, _q.identity(), _s.set(s, s * 0.8, s)));
    }

    // 잎 카드: 클러스터마다 가우시안으로 흩뿌리고, 수관 중심 바깥쪽을 향하게
    for (const e of ends) {
      for (let k = 0; k < e.n; k++) {
        const pos = e.p.clone().add(new THREE.Vector3(gauss(R) * e.s, gauss(R) * e.s * 0.7, gauss(R) * e.s));
        const out = pos.clone().sub(crown).normalize();
        const jitter = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(1.3);
        const n = out.add(jitter).normalize();
        _q.setFromUnitVectors(Z, n);
        const roll = new THREE.Quaternion().setFromAxisAngle(Z, R() * Math.PI * 2);
        _q.multiply(roll);
        const size = 0.85 + R() * 0.55;
        cards.push(new THREE.Matrix4().compose(pos, _q.clone(), _s.set(size, size, size)));
        cardColors.push(tint.setRGB(0.78 + R() * 0.34, 0.86 + R() * 0.2, 0.62 + R() * 0.3).clone());
      }
    }
  }

  const leaves = instanced(new THREE.PlaneGeometry(1, 1), leafMat, cards);
  cardColors.forEach((c, i) => leaves.setColorAt(i, c));
  leaves.instanceColor.needsUpdate = true;
  g.add(leaves);

  const taper = new THREE.CylinderGeometry(0.62, 1, 1, 9, 1, false);
  taper.translate(0, 0, 0);
  g.add(instanced(taper, barkMat, trunks));
  g.add(instanced(new THREE.CylinderGeometry(0.55, 1, 1, 9, 1), barkMat, flares));
  g.add(instanced(new THREE.CylinderGeometry(0.55, 1, 1, 6, 1), barkMat, branches));
  g.add(instanced(new THREE.IcosahedronGeometry(1, 1), coreMat, cores));
  root.add(g);
  return { group: g, material: leafMat, cardCount: cards.length };
}
