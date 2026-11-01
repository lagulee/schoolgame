// 길 찾기 (길 안내용, three 없음): 충돌 월드(Collision)를 NAV.step 격자로 보고 A* 로 목표 구역까지의 길을 찾는다.
// - 칸이 비었는지 = Collision.hit (플레이어 반지름). 한 번 본 칸은 층·통과 설정별로 기억해 두 번째부터 빠르다.
// - 닫힌 문은 열 수 있으면 통과로 본다: setPassable(무시할 박스 Set, 서명). 잠긴 문·열쇠 없는 문은 벽이다.
// - 층 이동은 계단(경사)으로만: 이동 뒤 층 = Collision.levelAt (플레이어 컨트롤러와 같은 규칙).
// 칸 사이를 건널 때 중간 점은 따로 검사하지 않는다: 양쪽 끝이 벽에서 반지름(0.3)보다 멀면 간격(0.25)으로는 벽을 넘을 수 없다.
import { NAV, PLAYER } from '../config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const lk = (level) => Math.round(level * 2); // 0.5 단위 층 번호
const BLOCK = 2; // 충돌 모양을 추리는 블록 크기 (m)

export class Navigator {
  constructor(col, cfg = NAV) {
    this.col = col;
    this.step = cfg.step;
    this.cfg = cfg;
    const [x0, z0, x1, z1] = cfg.area;
    this.x0 = x0;
    this.z0 = z0;
    this.W = Math.ceil((x1 - x0) / cfg.step) + 1;
    this.H = Math.ceil((z1 - z0) / cfg.step) + 1;
    this.ignore = null;
    this.sig = '';
    this.grids = new Map(); // 서명 → (층 번호 → Uint8Array: 0 모름, 1 빔, 2 막힘)
    this.grid = new Map();
    this.blocks = new Map(); // 층:블록 → 가까운 충돌 모양 (모양을 나중에 더하면 새 Navigator 를 만든다)
  }

  // 통과로 볼 박스(열 수 있는 문). 서명이 같으면 기억해 둔 칸을 그대로 쓴다
  setPassable(ignore, sig) {
    if (sig === this.sig && this.ignore) return;
    this.sig = sig;
    this.ignore = ignore;
    if (!this.grids.has(sig)) {
      if (this.grids.size >= 6) this.grids.delete(this.grids.keys().next().value);
      this.grids.set(sig, new Map());
    }
    this.grid = this.grids.get(sig);
  }

  cell(x, z) {
    return [Math.round((x - this.x0) / this.step), Math.round((z - this.z0) / this.step)];
  }

  // 칸 (i, j) 이 층 level 에서 비었나
  free(i, j, level) {
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return false;
    const k = lk(level);
    let g = this.grid.get(k);
    if (!g) this.grid.set(k, (g = new Uint8Array(this.W * this.H)));
    const n = j * this.W + i;
    if (g[n]) return g[n] === 1;
    const ok = !this.blocked(this.x0 + i * this.step, this.z0 + j * this.step, level);
    g[n] = ok ? 1 : 2;
    return ok;
  }

  // Collision.hit 과 같은 판정. 모양이 많아서(층마다 수백 개) 2 m 블록마다 가까운 모양만 추려 기억해 둔다
  blocked(x, z, level) {
    const B = BLOCK;
    const bi = Math.floor(x / B);
    const bj = Math.floor(z / B);
    const key = `${lk(level)}:${bi}:${bj}`;
    let list = this.blocks.get(key);
    if (!list) {
      const m = PLAYER.radius + 1e-6;
      const { boxes, circles } = this.col.at(level);
      list = {
        boxes: boxes.filter((b) => b.x0 - m <= (bi + 1) * B && b.x1 + m >= bi * B && b.z0 - m <= (bj + 1) * B && b.z1 + m >= bj * B),
        circles: circles.filter((c) => c.x - c.r - m <= (bi + 1) * B && c.x + c.r + m >= bi * B && c.z - c.r - m <= (bj + 1) * B && c.z + c.r + m >= bj * B),
      };
      this.blocks.set(key, list);
    }
    const r = PLAYER.radius;
    for (const b of list.boxes) {
      if (!b.on || this.ignore?.has(b)) continue;
      const dx = x - Math.max(b.x0, Math.min(x, b.x1));
      const dz = z - Math.max(b.z0, Math.min(z, b.z1));
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (const c of list.circles) {
      if (!c.on) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = r + c.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  // 두 점 사이를 곧장 걸을 수 있나 (한 층 위에서)
  clear(ax, az, bx, bz, level) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / this.step));
    for (let t = 0; t <= n; t++) {
      const [i, j] = this.cell(ax + ((bx - ax) * t) / n, az + ((bz - az) * t) / n);
      if (!this.free(i, j, level)) return false;
    }
    return true;
  }

  // from = [x, z, 층], goal = { rect: [x0, z0, x1, z1], level } (이 구역 안에 들어가면 도착).
  // 반환 { path: [[x, z, 층], …], dist (m) } 또는 null (길 없음)
  find(from, goal) {
    const { W, H, step } = this;
    const [r0, q0, r1, q1] = goal.rect;
    const gl = lk(goal.level);
    const wt = this.cfg.weight ?? 1;
    const toGoal = (x, z) => wt * Math.hypot(Math.max(r0 - x, 0, x - r1), Math.max(q0 - z, 0, z - q1));
    const sl = from[2];
    let [si, sj] = this.cell(from[0], from[1]);
    if (!this.free(si, sj, sl)) {
      let best = Infinity;
      let [bi, bj] = [si, sj];
      const R = Math.ceil(this.cfg.startSnap / step);
      for (let a = -R; a <= R; a++) {
        for (let b = -R; b <= R; b++) {
          const e = Math.hypot(a, b) * step;
          if (e < best && e <= this.cfg.startSnap && this.free(si + a, sj + b, sl)) [best, bi, bj] = [e, si + a, sj + b];
        }
      }
      if (best === Infinity) return null;
      [si, sj] = [bi, bj];
    }
    const id = (i, j, k) => (k * H + j) * W + i;
    const g = new Map();
    const parent = new Map();
    const heap = []; // [f, g, i, j, 층]
    const push = (e) => {
      heap.push(e);
      let n = heap.length - 1;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heap[p][0] <= heap[n][0]) break;
        [heap[p], heap[n]] = [heap[n], heap[p]];
        n = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let n = 0;
        for (;;) {
          const l = 2 * n + 1;
          const r = l + 1;
          let m = n;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === n) break;
          [heap[m], heap[n]] = [heap[n], heap[m]];
          n = m;
        }
      }
      return top;
    };
    const start = id(si, sj, lk(sl));
    g.set(start, 0);
    push([toGoal(this.x0 + si * step, this.z0 + sj * step), 0, si, sj, sl]);
    const done = new Set();
    let expanded = 0;
    while (heap.length) {
      const [, d, i, j, lv] = pop();
      const cur = id(i, j, lk(lv));
      if (done.has(cur)) continue;
      done.add(cur);
      const x = this.x0 + i * step;
      const z = this.z0 + j * step;
      if (lk(lv) === gl && x >= r0 && x <= r1 && z >= q0 && z <= q1) {
        const path = [];
        for (let n = cur; n !== undefined; n = parent.get(n)) {
          const k = Math.floor(n / (W * H));
          const rem = n - k * W * H;
          path.push([this.x0 + (rem % W) * step, this.z0 + Math.floor(rem / W) * step, k / 2]);
        }
        return { path: path.reverse(), dist: d };
      }
      if (++expanded > this.cfg.maxExpand) return null;
      for (const [dx, dz] of DIRS) {
        const i2 = i + dx;
        const j2 = j + dz;
        if (!this.free(i2, j2, lv)) continue;
        if (dx && dz && (!this.free(i2, j, lv) || !this.free(i, j2, lv))) continue; // 모서리 자르기 금지
        const x2 = this.x0 + i2 * step;
        const z2 = this.z0 + j2 * step;
        const l2 = this.col.levelAt(x2, z2, lv);
        const n2 = id(i2, j2, lk(l2));
        const d2 = d + step * (dx && dz ? Math.SQRT2 : 1);
        if (done.has(n2) || (g.get(n2) ?? Infinity) <= d2) continue;
        g.set(n2, d2);
        parent.set(n2, cur);
        push([d2 + toGoal(x2, z2), d2, i2, j2, l2]);
      }
    }
    return null;
  }
}
