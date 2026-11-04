// 추격 경로 (단계 12, three 없음): chases.json 의 path.points 꺾은선 위에서 위치 ↔ 경로 거리를 바꾼다.
// 점은 [x, z] 또는 [x, z, 층] (단계 16: 계단을 내려가는 C4 — 셋째 값이 있으면 at() 이 층도 돌려준다).
// 플레이어 진행은 경로에 투영한 거리이고 앞으로만 늘어난다 (뒤로 가거나 옆길로 새면 진행 0 → gap 이 줄어든다).
// 한 프레임에 늘어날 수 있는 거리는 maxStep 으로 막는다 (순간이동·투영 점프로 경로를 건너뛰지 않게).
export class ChasePath {
  constructor({ points, startAt = 0 }) {
    this.points = points;
    this.startAt = startAt;
    this.seg = [];
    let acc = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, az, al] = points[i];
      const [bx, bz, bl] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      this.seg.push({ ax, az, bx, bz, al, bl, len, from: acc });
      acc += len;
    }
    this.length = acc;
  }

  // (x, z) 에 가장 가까운 경로 위 거리
  project(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (const s of this.seg) {
      const t = s.len > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * (s.bx - s.ax) + (z - s.az) * (s.bz - s.az)) / (s.len * s.len))) : 0;
      const px = s.ax + (s.bx - s.ax) * t;
      const pz = s.az + (s.bz - s.az) * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        best = s.from + t * s.len;
      }
    }
    return best;
  }

  // 경로 거리 → [x, z, 층]. 0 미만·길이 초과는 끝점에서 멈춘다. 층은 점에 셋째 값이 있을 때만(없으면 undefined)
  at(dist) {
    const d = Math.max(0, Math.min(this.length, dist));
    for (const s of this.seg) {
      if (d <= s.from + s.len || s === this.seg.at(-1)) {
        const t = s.len > 0 ? (d - s.from) / s.len : 0;
        const lv = s.al === undefined || s.bl === undefined ? undefined : s.al + (s.bl - s.al) * t;
        return [s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t, lv];
      }
    }
    return [...this.points[0]];
  }
}

// 플레이어 진행 추적: begin(x, z) 뒤 update(x, z, dt) 가 이번 프레임의 경로 방향 속도(m/s, 0 이상)를 돌려준다
export class PathProgress {
  constructor(path, maxSpeed) {
    this.path = path;
    this.maxSpeed = maxSpeed;
    this.best = path.startAt;
    this.speed = 0;
  }

  begin(x, z) {
    this.best = Math.max(this.path.startAt, this.path.project(x, z));
    this.speed = 0;
  }

  update(x, z, dt) {
    if (dt <= 0) return this.speed;
    const p = this.path.project(x, z);
    const gain = Math.max(0, Math.min(p - this.best, this.maxSpeed * dt));
    this.best += gain;
    this.speed = gain / dt;
    return this.speed;
  }
}

// 귀신이 따라오는 발자취 (v1.26.1): 경로 시작 → 플레이어 출발 지점까지는 추격 경로, 그 뒤는 플레이어가 실제로 걸은 자리.
// 귀신은 이 발자취 위에서 움직이므로 늘 플레이어가 지나온 곳(벽 안쪽)에 있고, 플레이어가 되돌아가면 마주친다.
// 점은 [x, z, 층, 누적 거리]. 한 프레임에 늘어나는 길이는 maxSpeed 로 막는다 (순간이동해도 gap 이 튀지 않게).
export class Trail {
  constructor(maxSpeed, minStep = 0.05) {
    this.maxSpeed = maxSpeed;
    this.minStep = minStep;
    this.pts = [];
    this.since = 0;
    this.speed = 0;
  }

  // path: ChasePath, base: 플레이어 출발 지점의 경로 위치, (x, z, level): 플레이어 자리, lv0: 경로 점에 층이 없을 때의 층
  begin(path, base, x, z, level, lv0 = 0) {
    this.pts = [];
    const lvOf = (v) => (v === undefined ? lv0 : v);
    for (let i = 0; i < path.points.length && (i === 0 || path.seg[i - 1].from + path.seg[i - 1].len < base); i++) {
      const [px, pz, pl] = path.points[i];
      this.pts.push([px, pz, lvOf(pl), i === 0 ? 0 : path.seg[i - 1].from + path.seg[i - 1].len]);
    }
    const [bx, bz, bl] = path.at(base);
    if (base > this.pts.at(-1)[3]) this.pts.push([bx, bz, lvOf(bl), base]);
    this.prefix = this.pts.length;
    const last = this.pts.at(-1);
    this.pts.push([x, z, level, last[3] + Math.hypot(x - last[0], z - last[1])]);
    this.start = this.pts.at(-1)[3]; // 귀신 자리 = start + Chase.ghostPos
    this.since = 0;
    this.speed = 0;
  }

  // 발자취 끝(플레이어 자리)의 누적 거리
  get length() {
    return this.pts.at(-1)[3];
  }

  // 플레이어가 움직였으면 점을 더한다. 반환: 이번 프레임에 늘어난 길이의 속도 (m/s)
  update(x, z, level, dt) {
    this.since += dt;
    const last = this.pts.at(-1);
    const d = Math.hypot(x - last[0], z - last[1]);
    let gain = 0;
    if (d >= this.minStep || level !== last[2]) {
      gain = Math.min(d, this.maxSpeed * this.since);
      this.pts.push([x, z, level, last[3] + gain]);
      this.since = 0;
    }
    this.speed = dt > 0 ? gain / dt : 0;
    return this.speed;
  }

  // 누적 거리 → [x, z, 층] (0 미만·끝 너머는 끝점)
  at(dist) {
    const P = this.pts;
    if (dist <= 0) return [P[0][0], P[0][1], P[0][2]];
    if (dist >= P.at(-1)[3]) return [P.at(-1)[0], P.at(-1)[1], P.at(-1)[2]];
    let lo = 0;
    let hi = P.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (P[m][3] <= dist) lo = m;
      else hi = m;
    }
    const a = P[lo];
    const b = P[hi];
    const t = b[3] > a[3] ? (dist - a[3]) / (b[3] - a[3]) : 0;
    // 경로 구간은 경로처럼 층을 이어 붙이고, 발자취 구간은 가까운 점의 층 (계단에서 플레이어 층이 0.5 단위로 바뀐다)
    const lv = hi < this.prefix ? a[2] + (b[2] - a[2]) * t : t < 0.5 ? a[2] : b[2];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, lv];
  }
}
