// 귀신의 직접 추적 (v1.28, three 없음): 귀신은 플레이어가 지나온 발자취를 따라 하지 않고, 자기 자리에서 플레이어의 "지금 자리"까지
// 길 찾기(Navigator, nav.js)로 최단 길을 구해 쫓아온다. 플레이어가 길을 바꾸거나 되돌아가면 귀신도 길을 새로 구한다.
// - 길은 REPLAN 초마다, 또는 길 끝에 닿았거나 플레이어가 길 끝에서 멀어지면 다시 구한다. 귀신은 구한 길 위를 step(m)만큼 간다.
// - 귀신이 얼마나 가는가(step)는 Chase(gap 모델)의 귀신 속도·멈춤(지형 지연)이 정한다. gap 은 이 길의 실제 남은 거리로 되돌려 준다.
// - 시작 때 귀신은 추격 경로(chases.json path) 위 startGap 만큼 뒤에서 출발한다. 경로 시작보다 더 뒤라면(건물 밖) offstage 만큼 보이지 않게 달려온다.
// - Navigator 가 없거나 길이 없으면(막힌 자리) 곧장 플레이어 쪽으로 간다.
// - v1.28.1: 같은 층에서 플레이어까지 곧장 걸을 수 있으면(nav.clear) 길 찾기를 하지 않고 곧장 간다 (복도에서 대부분, 끊김을 줄인다).
const REPLAN = 0.3; // 길을 다시 구하는 간격 (초)
const DRIFT = 1.0; // 플레이어가 길 끝에서 이만큼 벗어나면 바로 다시 구한다 (m)
const RETRY = 1.5; // 길을 못 찾았을 때 다시 시도하기까지 (초)
const LEVEL_RATE = 1.5; // 귀신 층(계단 높이)이 바뀌는 최대 속도 (층/초)

const half = (v) => Math.round(v * 2) / 2;

// 누적 거리가 붙은 꺾은선: [x, z, 층, 누적 거리]
export class Route {
  constructor(pts) {
    this.pts = [];
    let acc = 0;
    pts.forEach((p, i) => {
      if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      this.pts.push([p[0], p[1], p[2] ?? 0, acc]);
    });
  }

  get length() {
    return this.pts.at(-1)[3];
  }

  // 누적 거리 → [x, z, 층] (0 미만·끝 너머는 끝점)
  at(dist) {
    const P = this.pts;
    if (dist <= 0) return [P[0][0], P[0][1], P[0][2]];
    if (dist >= this.length) return [P.at(-1)[0], P.at(-1)[1], P.at(-1)[2]];
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
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
}

export class Pursuer {
  // nav: Navigator (setPassable 로 귀신이 지날 문을 정해 둔 것) 또는 null
  constructor(nav = null) {
    this.nav = nav;
    this.x = 0;
    this.z = 0;
    this.level = 0;
    this.offstage = 0; // 아직 건물 밖(보이지 않음)에서 달려와야 하는 거리 (m)
    this.route = null;
    this.s = 0; // 길 위에서 간 거리
    this.age = 0;
    this.failed = 0;
  }

  // path: ChasePath, base: 플레이어 출발 지점의 경로 위치, startGap: 시작 거리, p: { x, z, level }
  begin(path, base, startGap, p, lv0 = 0) {
    const [sx, sz, sl] = path.at(Math.max(0, base - startGap));
    Object.assign(this, { x: sx, z: sz, level: sl ?? lv0, offstage: 0, s: 0, age: 0, failed: 0, route: null });
    this.plan(p);
    const L0 = this.route.length;
    if (L0 >= startGap) this.s = L0 - startGap; // 길이 더 길면 그만큼 앞에서 출발해 gap 이 startGap 이 되게
    else this.offstage = startGap - L0; // 짧으면 그만큼 뒤(보이지 않는 곳)에서 출발
    this.place();
    this.level = this.target;
  }

  plan(p) {
    this.age = 0;
    const from = [this.x, this.z, half(this.level)];
    let pts = null;
    const sameLevel = Math.abs(this.level - p.level) < 0.01 && Math.abs(p.level - Math.round(p.level)) < 0.01;
    if (this.nav && sameLevel && this.nav.clear(this.x, this.z, p.x, p.z, p.level)) pts = [[this.x, this.z, this.level]];
    else if (this.nav && this.failed <= 0) {
      const r = this.nav.find(from, { rect: [p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5], level: half(p.level) });
      if (r) pts = [[this.x, this.z, this.level], ...r.path.slice(1)];
      else this.failed = RETRY;
    }
    this.route = new Route([...(pts ?? [[this.x, this.z, this.level]]), [p.x, p.z, p.level]]);
    this.s = 0;
    this.end = [p.x, p.z];
  }

  place() {
    [this.x, this.z, this.target] = this.route.at(this.s);
  }

  // step: 이번 프레임에 귀신이 달린 거리(m). 반환: 귀신과 플레이어 사이 길 거리 gap (m)
  update(dt, step, p) {
    this.age += dt;
    this.failed -= dt;
    let move = step;
    if (this.offstage > 0) {
      const w = Math.min(this.offstage, move);
      this.offstage -= w;
      move -= w;
    }
    if (this.offstage <= 0) {
      const stale = this.age >= REPLAN || this.s >= this.route.length - 0.05 || Math.hypot(p.x - this.end[0], p.z - this.end[1]) > DRIFT;
      if (stale) this.plan(p);
      this.s = Math.min(this.route.length, this.s + move);
      this.place();
      const dl = this.target - this.level;
      this.level += Math.sign(dl) * Math.min(Math.abs(dl), LEVEL_RATE * dt);
    }
    // 길 끝에서 플레이어 지금 자리까지는 곧장
    return this.offstage + this.route.length - this.s + Math.hypot(p.x - this.end[0], p.z - this.end[1]);
  }

  // 지금 귀신 자리 → 플레이어 지금 자리까지의 꺾은선 (R2 붙잡힘 장면: 귀신이 이 길로 등 뒤까지 다가온다)
  line(p) {
    const r = this.route;
    const rest = r.pts.filter((q) => q[3] > this.s).map((q) => [q[0], q[1], q[2]]);
    return new Route([[this.x, this.z, this.level], ...rest, [p.x, p.z, p.level]]);
  }
}
