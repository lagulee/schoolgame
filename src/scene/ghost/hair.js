// 젖은 머리카락: 두피에서 내려오는 띠(리본) 수백 장을 한 지오메트리로. 다발로 뭉치고 앞머리가 얼굴을 반쯤 덮는다.
// headMatrix = 단위 머리 → 모델 좌표. 머리를 뚫지 않게 단위 머리 좌표에서 1.1 밖으로 밀어낸다.
import * as THREE from 'three';
import { isScalp } from './head.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function hairGeometry(headMatrix, { count = 230, clumps = 40, seed = 7, part = -0.1 } = {}) {
  const rand = rng(seed);
  const inv = headMatrix.clone().invert();
  const center = new THREE.Vector3().applyMatrix4(headMatrix);
  const pickRoot = () => {
    for (;;) {
      const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
      d.normalize();
      if (!isScalp(d)) continue;
      if (d.z > 0.2 && Math.abs(d.x - part) < 0.16) continue; // 가르마: 한쪽 눈이 머리카락 틈으로 보인다
      return d;
    }
  };
  const SEG = 10;
  const grow = (d, len, lead = null, pull = 0) => {
    const pts = [];
    const p = d.clone().multiplyScalar(1.01).applyMatrix4(headMatrix);
    const out = p.clone().sub(center).normalize();
    const dir = out.clone().multiplyScalar(0.15).add(new THREE.Vector3(0, -1, 0)).normalize();
    const step = len / SEG;
    const loc = new THREE.Vector3();
    pts.push(p.clone());
    for (let i = 1; i <= SEG; i++) {
      dir.lerp(new THREE.Vector3(0, -1, 0), 0.35).normalize();
      p.addScaledVector(dir, step);
      loc.copy(p).applyMatrix4(inv);
      if (loc.length() < 1.045) p.copy(loc.setLength(1.045).applyMatrix4(headMatrix));
      if (lead) p.lerp(lead[i], pull * Math.pow(i / SEG, 1.4));
      pts.push(p.clone());
    }
    return pts;
  };
  // 다발 중심 가닥을 먼저 만들고, 각 가닥 끝을 가까운 다발 쪽으로 모은다 (젖어서 뭉친 모양)
  const leads = [];
  for (let i = 0; i < clumps; i++) {
    const d = pickRoot();
    const front = d.z > 0.2 ? 1 : 0;
    leads.push({ d, pts: grow(d, front ? 0.2 + rand() * 0.06 : 0.22 + rand() * 0.08) });
  }
  const pos = [];
  const uv = [];
  const idx = [];
  const nrm = [];
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let s = 0; s < count; s++) {
    const d = pickRoot();
    let best = leads[0];
    for (const L of leads) if (L.d.distanceToSquared(d) < best.d.distanceToSquared(d)) best = L;
    const len = best.pts.reduce((a, q, i) => (i ? a + q.distanceTo(best.pts[i - 1]) : 0), 0) * (0.85 + rand() * 0.3);
    const pts = grow(d, len, best.pts, 0.75);
    const w = 0.01 + rand() * 0.012;
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const p = pts[i];
      tan.subVectors(pts[Math.min(SEG, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      out.subVectors(p, center).normalize();
      side.crossVectors(tan, out).normalize().multiplyScalar((w * (1 - 0.6 * (i / SEG))) / 2);
      pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
      uv.push(0, 1 - i / SEG, 1, 1 - i / SEG);
      nrm.push(out.x, out.y, out.z, out.x, out.y, out.z);
      if (i < SEG) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
