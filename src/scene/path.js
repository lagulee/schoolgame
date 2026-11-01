// 추격 경로 (단계 12, three 없음): chases.json 의 path.points 꺾은선 위에서 위치 ↔ 경로 거리를 바꾼다.
// 플레이어 진행은 경로에 투영한 거리이고 앞으로만 늘어난다 (뒤로 가거나 옆길로 새면 진행 0 → gap 이 줄어든다).
// 한 프레임에 늘어날 수 있는 거리는 maxStep 으로 막는다 (순간이동·투영 점프로 경로를 건너뛰지 않게).
export class ChasePath {
  constructor({ points, startAt = 0 }) {
    this.points = points;
    this.startAt = startAt;
    this.seg = [];
    let acc = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      this.seg.push({ ax, az, bx, bz, len, from: acc });
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

  // 경로 거리 → (x, z). 0 미만·길이 초과는 끝점에서 멈춘다
  at(dist) {
    const d = Math.max(0, Math.min(this.length, dist));
    for (const s of this.seg) {
      if (d <= s.from + s.len || s === this.seg.at(-1)) {
        const t = s.len > 0 ? (d - s.from) / s.len : 0;
        return [s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t];
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
