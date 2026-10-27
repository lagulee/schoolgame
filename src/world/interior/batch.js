// 정적 실내 형상 모으기 (단계 8): 면(사각형)을 (묶음, 재질)별 버퍼에 쌓았다가 메시 하나로 만든다.
// 층마다 재질 수만큼만 드로우콜이 생긴다. UV 는 월드 좌표 / TILE[재질] 이라 이웃한 면의 무늬가 이어진다.
import * as THREE from 'three';
import { TILE } from './materials.js';

const FACES = 'tbnsew'; // 위·아래·북(−z)·남(+z)·서(−x)·동(+x)

export class Batch {
  constructor() {
    this.buckets = new Map();
  }

  bucket(group, mat) {
    const k = `${group}|${mat}`;
    let b = this.buckets.get(k);
    if (!b) {
      b = { group, mat, pos: [], nor: [], uv: [], idx: [] };
      this.buckets.set(k, b);
    }
    return b;
  }

  // 네 꼭짓점 (순서 무관하게 normal 쪽에서 반시계가 되도록 맞춘다). uvAt(p) → [u, v]
  quad(group, mat, pts, n, uvAt) {
    const b = this.bucket(group, mat);
    const [a, c, d] = [pts[0], pts[1], pts[2]];
    const cr = [
      (c[1] - a[1]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[1] - a[1]),
      (c[2] - a[2]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[2] - a[2]),
      (c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]),
    ];
    const ps = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? [...pts].reverse() : pts;
    const base = b.pos.length / 3;
    for (const p of ps) {
      b.pos.push(p[0], p[1], p[2]);
      b.nor.push(n[0], n[1], n[2]);
      b.uv.push(...uvAt(p));
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // 축 정렬 상자의 면들. faces = 'tbnsew' 중 일부. opt.local = [u0, v0] 이면 UV 를 상자 모서리 기준으로 (문짝·사물함 등)
  box(group, mat, x0, y0, z0, x1, y1, z1, faces = FACES, opt = {}) {
    const t = opt.tile ?? TILE[mat] ?? 1;
    const [tu, tv] = Array.isArray(t) ? t : [t, t];
    const lo = opt.local ? [x0, y0, z0] : [0, 0, 0];
    const H = (p) => [(p[0] - lo[0]) / tu, (p[2] - lo[2]) / tv];
    const X = (p) => [(p[2] - lo[2]) / tu, (p[1] - lo[1]) / tv];
    const Z = (p) => [(p[0] - lo[0]) / tu, (p[1] - lo[1]) / tv];
    if (faces.includes('t')) this.quad(group, mat, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], H);
    if (faces.includes('b')) this.quad(group, mat, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], H);
    if (faces.includes('n')) this.quad(group, mat, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], Z);
    if (faces.includes('s')) this.quad(group, mat, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], Z);
    if (faces.includes('w')) this.quad(group, mat, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], X);
    if (faces.includes('e')) this.quad(group, mat, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], X);
  }

  // 수평면 (바닥 = up true, 천장 = up false)
  floor(group, mat, [x0, z0, x1, z1], y, up = true) {
    this.box(group, mat, x0, y, z0, x1, y, z1, up ? 't' : 'b');
  }

  // 같은 묶음끼리 메시를 만들어 groups[group] 에 넣는다
  build(materials, groups, opt = {}) {
    for (const b of this.buckets.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      const mat = materials[b.mat];
      if (!mat) throw new Error(`실내 재질 없음: ${b.mat}`);
      const m = new THREE.Mesh(g, mat);
      m.name = `${b.group}:${b.mat}`;
      m.castShadow = opt.cast?.(b.mat) ?? true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      if (!groups[b.group]) throw new Error(`실내 묶음 없음: ${b.group}`);
      groups[b.group].add(m);
    }
    this.buckets.clear();
  }
}
