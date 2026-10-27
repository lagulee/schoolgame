// 사각형 [x0, z0, x1, z1] 과 1차원 구간 [a, b] 도구 (실내 배치 계산용, three 없음)

export const near = (a, b) => Math.abs(a - b) < 1e-4;

// 구간 [a, b] 에서 잘라 낼 구간들을 뺀 나머지 (짧은 조각은 버림)
export function subtractSpans([a, b], cuts, min = 1e-3) {
  let segs = [[a, b]];
  for (const [c0, c1] of cuts) {
    segs = segs.flatMap(([s0, s1]) => {
      if (c1 <= s0 || c0 >= s1) return [[s0, s1]];
      const r = [];
      if (c0 > s0) r.push([s0, c0]);
      if (c1 < s1) r.push([c1, s1]);
      return r;
    });
  }
  return segs.filter(([s0, s1]) => s1 - s0 > min);
}

// 사각형 r 에서 구멍들을 뺀 조각 (서로 겹치지 않는 사각형 목록)
export function subtractRect(r, holes) {
  let parts = [r];
  for (const h of holes) {
    parts = parts.flatMap((p) => {
      const [x0, z0, x1, z1] = p;
      if (h[2] <= x0 || h[0] >= x1 || h[3] <= z0 || h[1] >= z1) return [p];
      const out = [];
      if (h[1] > z0) out.push([x0, z0, x1, h[1]]); // 북쪽 띠
      if (h[3] < z1) out.push([x0, h[3], x1, z1]); // 남쪽 띠
      const mz0 = Math.max(z0, h[1]);
      const mz1 = Math.min(z1, h[3]);
      if (h[0] > x0) out.push([x0, mz0, h[0], mz1]);
      if (h[2] < x1) out.push([h[2], mz0, x1, mz1]);
      return out;
    });
  }
  return parts.filter(([x0, z0, x1, z1]) => x1 - x0 > 1e-3 && z1 - z0 > 1e-3);
}

export const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
export const contains = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
export const center = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

// 변 이름: n = 북(z0), s = 남(z1), w = 서(x0), e = 동(x1). along = 변을 따라가는 축, out = 바깥 방향 부호
export const SIDE = {
  n: { along: 'x', at: (r) => r[1], span: (r) => [r[0], r[2]], out: -1 },
  s: { along: 'x', at: (r) => r[3], span: (r) => [r[0], r[2]], out: 1 },
  w: { along: 'z', at: (r) => r[0], span: (r) => [r[1], r[3]], out: -1 },
  e: { along: 'z', at: (r) => r[2], span: (r) => [r[1], r[3]], out: 1 },
};
export const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };

// 변 d 위 구간 [a, b] 에 두께 t 의 띠 사각형. dir = +1 이면 바깥쪽, −1 이면 안쪽
export function sideStrip(r, d, a, b, t, dir) {
  const S = SIDE[d];
  const c = S.at(r);
  const k = S.out * dir; // 좌표가 늘어나는 쪽이면 +1
  const c0 = k > 0 ? c : c - t;
  const c1 = k > 0 ? c + t : c;
  return S.along === 'x' ? [a, c0, b, c1] : [c0, a, c1, b];
}
