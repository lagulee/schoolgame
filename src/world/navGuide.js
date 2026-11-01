// 길 안내 (핸드폰 화살표, three 없음): 핸드폰 목표(objective 키)마다 data/nav.json 의 가는 곳(다리 leg)을 정하고,
// Navigator(nav.js)로 지금 위치에서 그곳까지 길을 찾아 "어느 쪽으로 걸을지"와 거리·계단 안내를 만든다.
// - 다리(leg): 목표 하나에 여러 곳이 있을 수 있다 (예: 연결문 열쇠가 없으면 먼저 교무실). 조건 if 가 맞는 첫 다리를 쓴다.
// - 길은 한 번 찾아 두고 따라간다. 목표·다리·열쇠 상태가 바뀌거나 길에서 NAV.offPath 이상 벗어나면 다시 찾는다.
// - 열쇠 때문에 길이 없으면(엄격 → 느슨) 열쇠 문도 통과로 보고 대략의 방향을 알려 준다.
import { NAV } from '../config.js';
import { Navigator } from './nav.js';

// 통과로 볼 문 박스. info = { handles: 문 id → 박스, doors: 평면 문 목록, connector: {closed}, connectorKey }
export function passableBoxes(info, hasKey, lenient) {
  const set = new Set();
  const byId = new Map(info.doors.map((d) => [d.id, d]));
  for (const [id, box] of info.handles) {
    if (id === 'entrance') { set.add(box); continue; } // 자동문
    const d = byId.get(id);
    if (d && d.kind === 'room' && !d.locked && (!d.key || lenient || hasKey(d.key))) set.add(box);
  }
  if (info.connector && (lenient || hasKey(info.connectorKey))) set.add(info.connector.closed);
  return set;
}

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const cond = (c, has) => (c.startsWith('!') ? !has(c.slice(1)) : has(c));

export class NavGuide {
  // data: data/nav.json, info: passableBoxes 의 info, mapData: MapData(resolve), hasKey(플래그 이름)
  constructor({ col, info, mapData, data, hasKey, cfg = NAV }) {
    this.cfg = cfg;
    this.nav = new Navigator(col, cfg);
    this.info = info;
    this.mapData = mapData;
    this.data = data;
    this.hasKey = hasKey;
    this.keys = [...new Set([info.connectorKey, ...info.doors.map((d) => d.key).filter(Boolean)])].sort();
    this.cache = null;
    this.retryLeft = 0;
  }

  // 목표 키 → { leg, goal: { rect, level }, id } 또는 null (안내 없음)
  legFor(objectiveKey) {
    const legs = this.data.goals[objectiveKey];
    if (!legs?.length) return null;
    const i = legs.findIndex((l) => [l.if ?? []].flat().every((c) => cond(c, this.hasKey)));
    if (i < 0) return null;
    const leg = legs[i];
    let goal;
    if (leg.point) {
      const [x, z, level] = leg.point;
      goal = { rect: [x - 1, z - 1, x + 1, z + 1], level };
    } else {
      const r = this.mapData.resolve(leg.to);
      if (!r) throw new Error(`nav.json: 알 수 없는 장소 ${leg.to}`);
      goal = { rect: r.item.rect, level: r.level };
    }
    return { leg, goal, id: `${objectiveKey}#${i}` };
  }

  sigOf(lenient) {
    return `${lenient ? 1 : 0}:${this.keys.map((k) => (this.hasKey(k) ? 1 : 0)).join('')}`;
  }

  // 길 찾기: 엄격(지금 가진 열쇠만) → 느슨(열쇠 문도 통과). 반환 { path, dist, lenient } 또는 null
  plan(x, z, level, goal) {
    for (const lenient of [false, true]) {
      this.nav.setPassable(passableBoxes(this.info, this.hasKey, lenient), this.sigOf(lenient));
      const r = this.nav.find([x, z, level], goal);
      if (r) return { ...r, lenient };
    }
    return null;
  }

  // 길 위 진행: 가장 가까운 길 점 번호와 그 거리
  progress(c, x, z, level) {
    let idx = -1;
    let best = Infinity;
    for (let i = 0; i < c.path.length; i++) {
      const p = c.path[i];
      if (Math.abs(p[2] - level) > this.cfg.levelTol) continue;
      const e = Math.hypot(p[0] - x, p[1] - z);
      if (e < best) [best, idx] = [e, i];
    }
    return { idx, off: best };
  }

  // 화면에 보일 안내. 반환 null(안내 없음) 또는
  // { state: 'arrived'|'path'|'lost', text, step, ax, az (가리킬 방향 단위 벡터), dist }
  update(dt, x, z, level, objectiveKey) {
    const L = this.legFor(objectiveKey);
    if (!L) { this.cache = null; return null; }
    const T = this.data.texts;
    const { rect } = L.goal;
    const text = L.leg.text;
    const inside = Math.abs(level - L.goal.level) < 0.01 && x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3];
    if (inside) return { state: 'arrived', text: fill(T.arrived, { name: text }), step: '', ax: 0, az: 0, dist: 0 };
    this.retryLeft -= dt;
    const key = `${L.id}|${this.sigOf(false)}`;
    let c = this.cache;
    let prog = c?.path && c.key === key ? this.progress(c, x, z, level) : null;
    const stale = !c || c.key !== key || (c.path ? !prog || prog.idx < 0 || prog.off > this.cfg.offPath : this.retryLeft <= 0);
    if (stale) {
      const r = this.plan(x, z, level, L.goal);
      this.cache = c = { key, path: r?.path ?? null, cum: null, lenient: r?.lenient ?? false };
      this.retryLeft = this.cfg.retryRoute;
      if (r) {
        c.cum = [0];
        for (let i = 1; i < r.path.length; i++) c.cum.push(c.cum[i - 1] + Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]));
        prog = this.progress(c, x, z, level);
      }
    }
    if (!c.path || !prog || prog.idx < 0) return { state: 'lost', text: fill(T.lost, { name: text }), step: '', ax: 0, az: 0, dist: 0 };
    const { path, cum } = c;
    const i0 = prog.idx;
    const lv0 = path[i0][2];
    // 화살표: 길을 따라 lookahead 안에서, 같은 층에서 곧장 걸어 갈 수 있는 가장 먼 점
    let j = i0 + 1;
    for (let k = path.length - 1; k > i0; k--) {
      if (cum[k] - cum[i0] > this.cfg.lookahead || path[k][2] !== lv0) continue;
      if (this.nav.clear(x, z, path[k][0], path[k][1], lv0)) { j = k; break; }
    }
    j = Math.min(j, path.length - 1);
    let ax = path[j][0] - x;
    let az = path[j][1] - z;
    const h = Math.hypot(ax, az) || 1;
    ax /= h;
    az /= h;
    // 계단 안내: 앞으로 층이 바뀌는 곳
    let step = '';
    for (let k = i0 + 1; k < path.length; k++) {
      if (Math.abs(path[k][2] - lv0) < 0.01) continue;
      let e = k;
      while (e < path.length - 1 && Math.abs(path[e][2] - Math.round(path[e][2])) > 0.01) e++;
      step = fill(T.stairs, { n: Math.round(path[e][2]) + 1 });
      break;
    }
    const dist = Math.max(1, Math.round(cum[cum.length - 1] - cum[i0]));
    return { state: 'path', text: fill(T.route, { name: text, n: dist }), step, ax, az, dist, rough: c.lenient };
  }
}
