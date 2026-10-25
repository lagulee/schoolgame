import * as THREE from 'three';

// BoxGeometry 의 각 면 UV 를 실제 치수(m)/tile 로 늘려 텍스처 밀도를 일정하게 만든다.
export function boxGeo(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * dims[f][0]) / tile, (uv.getY(idx) * dims[f][1]) / tile);
    }
  }
  return g;
}

// y 는 바닥면 기준. 정적 메시이므로 행렬 자동 갱신을 끈다.
export function addBox(parent, mat, w, h, d, x, y, z, opt = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, opt.tile ?? 1), mat);
  m.position.set(x, y + h / 2, z);
  if (opt.ry) m.rotation.y = opt.ry;
  m.castShadow = opt.cast ?? true;
  m.receiveShadow = opt.receive ?? true;
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  parent.add(m);
  return m;
}

// x0..x1, z0..z1 영역의 박스 (y0..y1)
export function addBlock(parent, mat, x0, y0, z0, x1, y1, z1, opt = {}) {
  return addBox(parent, mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, opt);
}

export function addPlane(parent, mat, w, d, x, y, z, tile = 1, opt = {}) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile + (opt.u0 ?? 0), (uv.getY(i) * d) / tile + (opt.v0 ?? 0));
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.castShadow = false;
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  parent.add(m);
  return m;
}

// 결정적 난수 (시드 고정 → 매 실행 같은 배치)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 행렬 배열로 InstancedMesh 생성
export function instanced(geo, mat, matrices, opt = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = matrices.length;
  im.castShadow = opt.cast ?? true;
  im.receiveShadow = opt.receive ?? true;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

const _o = new THREE.Object3D();
export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _o.position.set(x, y, z);
  _o.rotation.set(rx, ry, rz);
  _o.scale.set(sx, sy, sz);
  _o.updateMatrix();
  return _o.matrix.clone();
}
