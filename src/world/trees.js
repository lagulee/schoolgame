import * as THREE from 'three';
import { U } from './shared.js';
import { instanced, mat4, rng } from './geom.js';

// 울퉁불퉁한 잎 덩어리: 정이십면체에 노이즈 변위
function blobGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const R = rng(seed);
  const bumps = Array.from({ length: 6 }, () => new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 1;
    for (const b of bumps) d += Math.max(0, v.dot(b)) ** 3 * 0.18;
    d += (R() - 0.5) * 0.12;
    v.multiplyScalar(d);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// 정점 셰이더에 바람 흔들림 주입: 인스턴스 위치로 위상을 나누고 높이(로컬 y)가 높을수록 크게
export function addWind(mat, amount = 0.07) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float ph = ip.x * 0.37 + ip.z * 0.61;
        float w = sin(uTime * 1.3 + ph + position.y * 0.8) * 0.6 + sin(uTime * 2.7 + ph * 1.7 + position.x) * 0.4;
        float k = clamp(position.y * 0.5 + 0.6, 0.0, 1.5);
        transformed.x += w * ${amount.toFixed(3)} * k;
        transformed.z += cos(uTime * 1.1 + ph) * ${(amount * 0.6).toFixed(3)} * k;
      }`);
  };
  mat.customProgramCacheKey = () => `wind${amount}`;
  return mat;
}

// trees: [{x, z, h, r, seed}] palette: [hex...]
export function buildTrees(root, trees, { palette, trunkMat, emissive = null, emissiveIntensity = 0 }) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: false });
  if (emissive) {
    mat.emissive = new THREE.Color(emissive);
    mat.emissiveIntensity = emissiveIntensity;
  }
  addWind(mat);
  const blobs = [];
  const colors = [];
  const trunks = [];
  const branches = [];
  for (const t of trees) {
    const R = rng(t.seed ?? Math.floor(t.x * 31 + t.z * 17));
    const h = t.h ?? 5;
    const r = t.r ?? 1.6;
    trunks.push(mat4(t.x, h * 0.45, t.z, 0, 1, h * 0.9, 1));
    for (let b = 0; b < 3; b++) {
      const a = R() * Math.PI * 2;
      branches.push(mat4(t.x + Math.cos(a) * 0.35, h * 0.62, t.z + Math.sin(a) * 0.35, a, 1, 1.4, 1, 0, 0.7));
    }
    const n = 6 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R();
      const rr = i === 0 ? 0 : r * (0.45 + R() * 0.4);
      const s = r * (0.55 + R() * 0.35);
      blobs.push(mat4(t.x + Math.cos(a) * rr, h + (R() - 0.3) * r * 0.8, t.z + Math.sin(a) * rr, R() * 6, s, s * 0.85, s));
      colors.push(new THREE.Color(palette[Math.floor(R() * palette.length)]).multiplyScalar(0.8 + R() * 0.4));
    }
  }
  const foliage = instanced(blobGeometry(3), mat, blobs);
  colors.forEach((c, i) => foliage.setColorAt(i, c));
  foliage.instanceColor.needsUpdate = true;
  g.add(foliage);
  g.add(instanced(new THREE.CylinderGeometry(0.11, 0.17, 1, 8), trunkMat, trunks));
  g.add(instanced(new THREE.CylinderGeometry(0.04, 0.07, 1, 6), trunkMat, branches));
  root.add(g);
  return { group: g, material: mat };
}

// 화단 관목: 낮은 덩어리
export function buildShrubs(root, beds, mat, seed = 11) {
  const R = rng(seed);
  const list = [];
  const colors = [];
  for (const b of beds) {
    for (let x = b.x0 + 0.5; x < b.x1 - 0.3; x += 0.75) {
      for (let z = b.z0 + 0.5; z < b.z1 - 0.3; z += 0.75) {
        if (R() < 0.25) continue;
        const s = 0.26 + R() * 0.2;
        list.push(mat4(x + (R() - 0.5) * 0.3, 0.3 + s * 0.5, z + (R() - 0.5) * 0.3, R() * 6, s, s * 0.8, s));
        colors.push(new THREE.Color().setHSL(0.27 + R() * 0.06, 0.45, 0.13 + R() * 0.06));
      }
    }
  }
  const im = instanced(blobGeometry(9), mat, list);
  colors.forEach((c, i) => im.setColorAt(i, c));
  im.instanceColor.needsUpdate = true;
  root.add(im);
  return im;
}
