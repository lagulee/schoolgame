// 귀신 모델 공용 도형 도구: 경로를 따라 타원 단면을 이어 붙인 관(loft). 팔·다리·몸통·손가락을 모두 이것으로 만든다.
import * as THREE from 'three';

const _t = new THREE.Vector3();
const _s = new THREE.Vector3();
const _w = new THREE.Vector3();
const _ref = new THREE.Vector3(1, 0, 0);

// pts: [{ p: [x, y, z], rx, rz }] — rx 는 옆(x) 방향 반지름, rz 는 앞(z) 방향 반지름. 앞(+z)은 θ = π/2 (u = 0.25)
// opts: seg(둘레 칸 수), capStart·capEnd(끝 막기), shape(θ, i) → 반지름 배율
export function loft(pts, { seg = 16, capStart = false, capEnd = false, shape = null } = {}) {
  const P = pts.map((q) => new THREE.Vector3(...q.p));
  const n = P.length;
  const pos = [];
  const uv = [];
  const idx = [];
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = len[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    _t.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    _s.copy(_ref).addScaledVector(_t, -_ref.dot(_t));
    if (_s.lengthSq() < 1e-6) _s.set(0, 0, 1);
    _s.normalize();
    _w.crossVectors(_s, _t).normalize();
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const k = shape ? shape(th, i, pts[i]) : 1;
      const c = Math.cos(th) * pts[i].rx * k;
      const s = Math.sin(th) * pts[i].rz * k;
      pos.push(P[i].x + _s.x * c + _w.x * s, P[i].y + _s.y * c + _w.y * s, P[i].z + _s.z * c + _w.z * s);
      uv.push(j / seg, len[i] / total);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1); // 바깥이 앞면
    }
  }
  const cap = (i, flip) => {
    const c = pos.length / 3;
    pos.push(P[i].x, P[i].y, P[i].z);
    uv.push(0.5, len[i] / total);
    for (let j = 0; j < seg; j++) {
      const a = i * row + j;
      if (flip) idx.push(c, a, a + 1);
      else idx.push(c, a + 1, a);
    }
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 이음매(θ = 0 과 2π)의 법선을 평균해 세로 줄이 보이지 않게 한다
  const nr = g.attributes.normal;
  for (let i = 0; i < n; i++) {
    const a = i * row;
    const b = a + seg;
    _t.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, _t.x, _t.y, _t.z);
    nr.setXYZ(b, _t.x, _t.y, _t.z);
  }
  return g;
}

// 여러 BufferGeometry(같은 속성 구성)를 하나로 합친다 (그리는 횟수를 줄이려고)
export function merge(list) {
  const names = Object.keys(list[0].attributes);
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = list[0].attributes[name].itemSize;
    const arr = [];
    for (const g of list) arr.push(...g.attributes[name].array);
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  const idx = [];
  let base = 0;
  for (const g of list) {
    const ix = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    for (const v of ix) idx.push(v + base);
    base += g.attributes.position.count;
  }
  out.setIndex(idx);
  return out;
}

export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
