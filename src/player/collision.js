// 2D(xz) 충돌: AABB + 원기둥. 축별 이동으로 벽 슬라이딩을 만든다.
// 바닥 높이(계단)와 발소리 재질 영역도 여기서 관리한다.
//
// 층(level, 단계 8 = 옛 1b-1): 모든 모양은 층 범위 [lo, hi] 를 가진다. 정수 = 층(0 = 1층·바깥, 1 = 2층 …),
// 0.5 단위 = 계단참. 층을 생략한 기존 호출은 level 0 으로 하위 호환된다. 숫자 하나면 그 층만,
// [lo, hi] 배열이면 그 사이 모든 층(계단참 포함)에 있다 (예: 외벽 셸 [0, 4]).
// 층 이동은 경사(ramp = 계단 한 줄)로만 한다: 경사는 아래끝 층(lo)과 위끝 층(hi) 양쪽에 있고,
// 경사 위에서는 높이가 가운데를 넘으면 hi, 아니면 lo 가 된다 (levelAt).

const EPS = 1e-6;
const span = (lv) => (Array.isArray(lv) ? { lo: lv[0], hi: lv[1] } : { lo: lv, hi: lv });
const onLevel = (s, level) => s.lo - EPS <= level && level <= s.hi + EPS;
const inside = (s, x, z) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;

// 경사 안에서의 진행 비율 t (0 = 낮은 끝, 1 = 높은 끝). dir = 높아지는 방향
function rampT(r, x, z) {
  switch (r.dir) {
    case 'x+': return (x - r.x0) / (r.x1 - r.x0);
    case 'x-': return (r.x1 - x) / (r.x1 - r.x0);
    case 'z+': return (z - r.z0) / (r.z1 - r.z0);
    default: return (r.z1 - z) / (r.z1 - r.z0); // 'z-'
  }
}

export class Collision {
  constructor() {
    this.boxes = []; // {x0,z0,x1,z1,lo,hi,on} — on=false 면 무시 (열린 문)
    this.circles = [];
    this.floors = []; // {x0,z0,x1,z1,h,lo,hi}
    this.ramps = []; // {x0,z0,x1,z1,dir,h0,h1,lo,hi}
    this.surfaces = []; // {x0,z0,x1,z1,name,lo,hi} 나중에 추가된 것이 우선
    this.cache = new Map(); // 층 → 그 층의 박스·원 (모양이 추가되면 비운다)
  }

  box(x0, z0, x1, z1, level = 0) {
    const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), ...span(level), on: true };
    this.boxes.push(b);
    this.cache.clear();
    return b;
  }

  circle(x, z, r, level = 0) {
    const c = { x, z, r, ...span(level), on: true };
    this.circles.push(c);
    this.cache.clear();
    return c;
  }

  floor(x0, z0, x1, z1, h, level = 0) {
    this.floors.push({ x0, z0, x1, z1, h, ...span(level) });
  }

  // 계단 한 줄: dir 방향으로 h0 → h1 로 높아진다. 낮은 끝은 층 lo, 높은 끝은 층 hi
  ramp({ x0, z0, x1, z1, dir, h0, h1, lo, hi }) {
    this.ramps.push({ x0, z0, x1, z1, dir, h0, h1, lo, hi });
  }

  surface(x0, z0, x1, z1, name, level = 0) {
    this.surfaces.push({ x0, z0, x1, z1, name, ...span(level) });
  }

  // 그 층에 걸리는 박스·원 (층마다 한 번 거른 목록을 재사용)
  at(level) {
    let c = this.cache.get(level);
    if (!c) {
      c = { boxes: this.boxes.filter((b) => onLevel(b, level)), circles: this.circles.filter((s) => onLevel(s, level)) };
      this.cache.set(level, c);
    }
    return c;
  }

  hit(x, z, r, level = 0) {
    const { boxes, circles } = this.at(level);
    for (const b of boxes) {
      if (!b.on) continue;
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (const c of circles) {
      if (!c.on) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = r + c.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  // 축별로 나눠 이동 → 막힌 축만 취소되므로 벽을 따라 미끄러진다.
  move(pos, dx, dz, r, level = 0) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (r * 0.5)));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (!this.hit(pos.x + sx, pos.z, r, level)) pos.x += sx;
      if (!this.hit(pos.x, pos.z + sz, r, level)) pos.z += sz;
    }
  }

  // xz 평면 광선 → 첫 충돌까지 거리 (핸드폰 라이트 원뿔 길이용)
  rayDistance(ox, oz, dx, dz, maxD, level = 0) {
    const { boxes, circles } = this.at(level);
    let best = maxD;
    for (const b of boxes) {
      if (!b.on) continue;
      let t0 = 0;
      let t1 = best;
      for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oz, dz, b.z0, b.z1]]) {
        if (Math.abs(d) < 1e-6) {
          if (o < lo || o > hi) { t0 = Infinity; break; }
        } else {
          let a = (lo - o) / d;
          let c = (hi - o) / d;
          if (a > c) [a, c] = [c, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, c);
        }
      }
      if (t0 <= t1 && t0 > 0 && t0 < best) best = t0;
    }
    for (const c of circles) {
      if (!c.on) continue;
      const fx = ox - c.x;
      const fz = oz - c.z;
      const a = dx * dx + dz * dz;
      const bb = 2 * (fx * dx + fz * dz);
      const cc = fx * fx + fz * fz - c.r * c.r;
      const disc = bb * bb - 4 * a * cc;
      if (disc < 0 || a < 1e-9) continue;
      const t = (-bb - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best) best = t;
    }
    return best;
  }

  // 그 층에서 (x, z) 를 덮는 경사
  rampAt(x, z, level = 0) {
    for (const r of this.ramps) {
      if ((Math.abs(r.lo - level) < EPS || Math.abs(r.hi - level) < EPS) && inside(r, x, z)) return r;
    }
    return null;
  }

  // 경사 위면 경사 높이, 아니면 그 층 바닥 구역 중 가장 높은 값 (없으면 0 = 바깥 땅)
  floorHeight(x, z, level = 0) {
    const r = this.rampAt(x, z, level);
    if (r) {
      const t = Math.max(0, Math.min(1, rampT(r, x, z)));
      return r.h0 + (r.h1 - r.h0) * t;
    }
    let h = 0;
    for (const f of this.floors) {
      if (onLevel(f, level) && inside(f, x, z)) h = Math.max(h, f.h);
    }
    return h;
  }

  // 이동 뒤의 층: 경사 위에서 가운데를 넘으면 위끝 층, 아니면 아래끝 층. 경사 밖이면 그대로
  levelAt(x, z, level = 0) {
    const r = this.rampAt(x, z, level);
    if (!r) return level;
    return rampT(r, x, z) < 0.5 ? r.lo : r.hi;
  }

  surfaceAt(x, z, level = 0) {
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      const s = this.surfaces[i];
      if (onLevel(s, level) && inside(s, x, z)) return s.name;
    }
    return 'brick';
  }
}
