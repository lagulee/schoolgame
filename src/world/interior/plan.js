// 본관 실내 평면 계산 (단계 8 = 옛 1b, three 없음). data/mainInterior.json 을 받아 층마다
// 바닥·천장·벽·문·난간·창·소품·유도등 자리와 계단을 만들고, 같은 결과로 충돌을 등록한다(addInteriorCollision).
// 그리기(build.js 등)와 테스트(test/interior.test.mjs)가 이 결과를 함께 쓴다.
//
// 벽 규칙: 방·계단은 칸 안쪽으로 벽을 세운다 (외벽 쪽은 얇은 마감 + 창). 복도·홀은 다른 복도·홀·계단 입구와는 트이고,
// 중정 쪽은 난간, 아무것도 없는 쪽(빈 공간)은 칸 바깥으로 벽을 세운다 → 복도 벽면은 항상 칸 경계 위에 있다.
import { DIM, INTERIOR } from '../../config.js';
import { SIDE, OPP, near, subtractSpans, subtractRect, sideStrip, contains } from './rects.js';
import { stairPlan } from './stairs.js';
import { buildingShells, facadeFaces, facePoint, windowSlots, entranceOpening } from '../layout.js';

export const yAt = (L) => INTERIOR.base + L * DIM.floorH;
export const ceilAt = (L, top) => (L >= top ? DIM.floors * DIM.floorH : yAt(L + 1)) - INTERIOR.slab;

const HALL = new Set(['corridor', 'lobby', 'hall', 'passage']);
const SURFACE = { lobby: 'stone', classroom: 'wood', counsel: 'wood', duty: 'wood' }; // 나머지는 tile
const FLOOR = { lobby: 'floorStone', classroom: 'floorWood', counsel: 'floorWood', duty: 'floorWood' }; // 나머지는 floorTile
const NORMAL = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

// 공간 목록: 층마다 하나씩 펼친다. 북쪽 띠(northBand)의 방은 slot 으로 자리를 받는다
function listSpaces(data) {
  const nb = data.northBand;
  const out = [];
  for (const s of data.spaces) {
    for (let L = s.levels[0]; L <= s.levels[1]; L++) out.push({ ...s, L, hall: HALL.has(s.kind), windows: [].concat(s.windows ?? []) });
  }
  for (const r of data.rooms) {
    const slot = r.slot !== undefined ? nb.slots[r.slot] : null;
    const base = slot ? { side: nb.side, doors: nb.doors, front: nb.front, windows: nb.windows } : {};
    const rect = r.rect ?? [slot[0], nb.z[0], slot[1], nb.z[1]];
    out.push({ ...base, ...r, L: r.level, rect, hall: HALL.has(r.kind), windows: [].concat(r.windows ?? base.windows ?? []) });
  }
  return out;
}

// 변 d 위 구간별 이웃: [{ a, b, what }] — what = 이웃 공간 | 'court' | 'dead'
function sideParts(sp, d, here, court) {
  const S = SIDE[d];
  const c = S.at(sp.rect);
  const [a, b] = S.span(sp.rect);
  const parts = [];
  const take = (r, what) => {
    if (!near(SIDE[OPP[d]].at(r), c)) return;
    const [ta, tb] = S.span(r);
    const lo = Math.max(a, ta);
    const hi = Math.min(b, tb);
    if (hi - lo > 1e-3) parts.push({ a: lo, b: hi, what });
  };
  for (const t of here) if (t !== sp) take(t.rect, t);
  take(court, 'court');
  for (const [ga, gb] of subtractSpans([a, b], parts.map((p) => [p.a, p.b]))) parts.push({ a: ga, b: gb, what: 'dead' });
  return parts.sort((p, q) => p.a - q.a);
}

function classify(sp, d, part) {
  if (sp.windows.includes(d) || sp.exit?.side === d) return 'lining';
  if (sp.glass === d) return 'glass';
  if (!sp.hall) return 'wall';
  const t = part.what;
  if (t === 'court') return 'rail';
  if (t === 'dead') return 'out';
  if (t.stair) return OPP[d] === t.open ? 'open' : 'none';
  return t.hall ? 'open' : 'none';
}

const thickness = { lining: INTERIOR.lining, wall: INTERIOR.wall };

export function buildPlan(data) {
  const top = data.levels - 1;
  const P = {
    top, levels: data.levels, court: data.courtyard, messages: data.messages,
    spaces: listSpaces(data),
    stairs: data.stairs.map((d) => stairPlan(d, data.levels, yAt)),
    floors: [], ceilings: [], edges: [], walls: [], rails: [], columns: [], doors: [], windows: [], glass: [],
    props: [], signs: [], solids: [], colFloors: [], surfaces: [], ramps: [],
  };
  const shells = buildingShells();
  const faces = Object.values(facadeFaces());
  const stairSpaces = P.stairs.flatMap((st) => Array.from({ length: data.levels }, (_, L) => ({ ...st, L, stair: true, kind: 'stair' })));
  P.entrance = entrance(data);
  const e = P.entrance;
  P.signs.push({ L: 0, kind: 'exit', pos: [e.block[2], (e.z0 + e.z1) / 2, (e.top + ceilAt(0, top)) / 2], normal: [1, 0] }); // 현관 문 위 (안쪽)

  for (let L = 0; L <= top; L++) {
    const here = [...P.spaces.filter((s) => s.L === L), ...stairSpaces.filter((s) => s.L === L)];
    for (const sp of here) if (!sp.stair) addSpace(P, sp, here, shells, faces);
  }
  addCourt(P);
  for (const st of P.stairs) addStair(P, st);
  addProps(P, data.props);
  return P;
}

function addSpace(P, sp, here, shells, faces) {
  const { L, rect: r } = sp;
  const y0 = yAt(L);
  const y1 = ceilAt(L, P.top);
  P.floors.push({ L, rect: r, y: y0, mat: FLOOR[sp.kind] ?? 'floorTile' });
  P.ceilings.push({ L, rect: r, y: y1 });
  P.colFloors.push({ rect: r, h: y0, level: L });
  P.surfaces.push({ rect: r, name: SURFACE[sp.kind] ?? 'tile', level: L });

  const parts = {};
  const tIn = {};
  for (const d of ['n', 's', 'w', 'e']) {
    parts[d] = sideParts(sp, d, here, P.court).map((p) => ({ ...p, type: classify(sp, d, p) }));
    const k = parts[d][0].type;
    tIn[d] = k === 'lining' || k === 'wall' ? thickness[k] : 0;
  }
  for (const d of ['n', 's', 'w', 'e']) {
    let [a, b] = SIDE[d].span(r);
    if (d === 'w' || d === 'e') [a, b] = [a + tIn.n, b - tIn.s]; // 모서리는 남북 벽이 차지
    const list = parts[d];
    if (list[0].type === 'wall' || list[0].type === 'lining' || list[0].type === 'glass') {
      addSolidSide(P, sp, d, list[0].type, a, b, y0, y1, faces);
      continue;
    }
    for (const p of list) {
      const pa = Math.max(a, p.a);
      const pb = Math.min(b, p.b);
      if (pb - pa < 1e-3) continue;
      if (p.type === 'out') {
        for (const rr of subtractRect(sideStrip(r, d, pa, pb, INTERIOR.wall, 1), shells)) {
          P.walls.push({ L, rect: rr, y0, y1, mat: 'wall' });
          P.solids.push({ rect: rr, level: L });
        }
      } else if (p.type === 'rail') {
        const rr = sideStrip(r, d, pa, pb, INTERIOR.rail.t, -1);
        P.rails.push({ L, rect: rr, y: y0, side: d });
        P.solids.push({ rect: rr, level: L });
        P.edges.push({ L, side: d, at: SIDE[d].at(r), a: pa, b: pb, y0: L === 0 ? INTERIOR.courtyardFloor : y0 - INTERIOR.slab, y1: y0 });
      }
    }
  }
}

// 막힌 변: 방 벽(문 자리 비움) · 외벽 마감(창, 현관 문 자리) · 유리벽
function addSolidSide(P, sp, d, type, a, b, y0, y1, faces) {
  const { L, rect: r } = sp;
  if (type === 'glass') {
    P.glass.push({ L, side: d, at: SIDE[d].at(r), a, b, y0, y1 });
    P.signs.push(sign(r, d, (a + b) / 2, y0 + INTERIOR.props.sign.y, 'exit', L, 0));
    return;
  }
  const t = thickness[type];
  const cuts = [];
  if (type === 'wall' && d === sp.side) {
    (sp.doors ?? []).forEach((off, i) => {
      const c = off >= 0 ? SIDE[d].span(r)[0] + off : SIDE[d].span(r)[1] + off;
      const w = INTERIOR.door.w;
      cuts.push({ c0: c - w / 2, c1: c + w / 2, top: y0 + INTERIOR.door.h });
      const block = sideStrip(r, d, c - w / 2, c + w / 2, t, -1);
      const mid = (a + b) / 2;
      P.doors.push({
        id: `${sp.id}-${i + 1}`, room: sp.id, name: sp.name, L, side: d, kind: 'room', locked: !sp.enter,
        c, w, y: y0, h: INTERIOR.door.h, block, slide: c < mid ? -1 : 1, pos: rectCenter(block), normal: NORMAL[d],
      });
    });
  }
  if (type === 'lining' && sp.kind === 'lobby' && d === 'w') {
    const e = P.entrance;
    cuts.push({ c0: e.z0 - e.frame, c1: e.z1 + e.frame, top: e.top });
  }
  for (const [s0, s1] of subtractSpans([a, b], cuts.map((k) => [k.c0, k.c1]))) addWall(P, L, sideStrip(r, d, s0, s1, t, -1), y0, y1, type);
  for (const k of cuts) addWall(P, L, sideStrip(r, d, k.c0, k.c1, t, -1), k.top, y1, type, false); // 문 위
  if (type !== 'lining') return;
  const inner = SIDE[d].at(r) - SIDE[d].out * t;
  if (sp.exit?.side === d) {
    const c = SIDE[d].span(r)[0] + sp.exit.at;
    const E = INTERIOR.exitDoor;
    P.doors.push({ id: `${sp.id}-exit`, room: sp.id, name: sp.exit.name, L, side: d, kind: 'exit', locked: true, c, w: E.w, y: y0, h: E.h, inner, pos: linePoint(d, inner, c), normal: NORMAL[d] });
    P.signs.push(sign(r, d, c, y0 + E.h + 0.25, 'exit', L, t));
  }
  // 창: 이 변 바깥의 외벽 면에서 FacadeKit 과 같은 자리
  const o = SIDE[d].out;
  const W = DIM.window;
  for (const f of faces) {
    const fn = f.normal;
    if (fn[0] !== NORMAL[d][0] || fn[1] !== NORMAL[d][1]) continue;
    const plane = fn[0] ? f.origin[0] : f.origin[1];
    const gap = (plane - SIDE[d].at(r)) * o;
    if (gap < -1e-3 || gap > 0.6) continue;
    for (const u of windowSlots(f, L)) {
      const [px, pz] = facePoint(f, u);
      const c = SIDE[d].along === 'x' ? px : pz;
      if (c < a + W.w / 2 + 0.1 || c > b - W.w / 2 - 0.1) continue;
      if (cuts.some((k) => c + W.w / 2 > k.c0 && c - W.w / 2 < k.c1)) continue;
      P.windows.push({ L, room: sp.id, side: d, c, y: L * DIM.floorH + W.sill + W.h / 2, pos: linePoint(d, inner, c), normal: NORMAL[d].map((v) => -v) });
    }
  }
}

function addWall(P, L, rect, y0, y1, type, solid = true) {
  if (y1 - y0 < 1e-3) return;
  P.walls.push({ L, rect, y0, y1, mat: 'wall', lining: type === 'lining' });
  if (solid && type === 'wall') P.solids.push({ rect, level: L });
}

const rectCenter = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
const linePoint = (d, at, c) => (SIDE[d].along === 'x' ? [c, at] : [at, c]);

// 유도등·표시등: 변 d 의 c 자리, 벽면에서 off 만큼 안쪽, 공간 안쪽을 향함
function sign(r, d, c, y, kind, L, off) {
  const at = SIDE[d].at(r) - SIDE[d].out * off;
  return { L, kind, pos: [...linePoint(d, at, c), y], normal: NORMAL[d].map((v) => -v) };
}

function entrance(data) {
  const e = entranceOpening();
  const w = INTERIOR.lining + 0.35; // 셸 두께 + 마감
  return { ...e, id: data.entrance.id, name: data.entrance.name, block: [e.x, e.z0, e.x + w, e.z1], threshold: [e.x - 0.05, e.z0, e.x + w, e.z1] };
}

// 중정: 1층 화단 바닥, 지붕 아래 천장, 모서리·변 기둥 (모든 층)
function addCourt(P) {
  const [x0, z0, x1, z1] = P.court;
  const c = INTERIOR.column;
  const [ex, ez] = INTERIOR.columnEvery;
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += ex) pts.push([x, z0, 'n'], [x, z1, 's']);
  for (let z = z0 + ez; z < z1 - 1e-6; z += ez) pts.push([x0, z, 'w'], [x1, z, 'e']);
  for (const [x, z, d] of pts) {
    const corner = near(x, x0) || near(x, x1);
    let r;
    if (corner) r = [near(x, x0) ? x0 - c : x1, d === 'n' ? z0 - c : z1, near(x, x0) ? x0 : x1 + c, d === 'n' ? z0 : z1 + c];
    else if (d === 'n' || d === 's') r = [x - c / 2, d === 'n' ? z0 - c : z1, x + c / 2, d === 'n' ? z0 : z1 + c];
    else r = [d === 'w' ? x0 - c : x1, z - c / 2, d === 'w' ? x0 : x1 + c, z + c / 2];
    P.columns.push({ rect: r });
    P.solids.push({ rect: r, level: [0, P.top] });
  }
}

function addStair(P, st) {
  const all = [0, P.top];
  for (const w of st.walls) P.solids.push({ rect: w, level: all });
  for (const b of st.blocks) P.solids.push({ rect: b.rect, level: b.level });
  P.colFloors.push(...st.floors.map((f) => ({ rect: f.rect, h: f.h, level: f.level })));
  P.ramps.push(...st.ramps);
  P.surfaces.push({ rect: st.rect, name: 'tile', level: all });
  for (let L = 0; L <= P.top; L++) {
    const [x0, z0, x1, z1] = st.rect;
    const z = (z0 + z1) / 2;
    const x = st.open === 'w' ? x0 : x1;
    P.signs.push({ L, kind: 'exit', pos: [x, z, yAt(L) + INTERIOR.props.sign.y], normal: st.open === 'w' ? [-1, 0] : [1, 0], hang: true });
  }
}

// 복도 벽 소품: 모든 층 같은 자리 (소화전함·사물함·게시판·소화기)
function addProps(P, props) {
  const D = INTERIOR.props;
  const front = (f, x, z, wd, dp) => {
    const [nx, nz] = NORMAL[f];
    return nx ? [Math.min(x, x + nx * dp), z - wd / 2, Math.max(x, x + nx * dp), z + wd / 2] : [x - wd / 2, Math.min(z, z + nz * dp), x + wd / 2, Math.max(z, z + nz * dp)];
  };
  const line = (x0, z0, x1, z1, f, dp) => {
    const [nx, nz] = NORMAL[f];
    return nx ? [Math.min(x0, x0 + nx * dp), Math.min(z0, z1), Math.max(x0, x0 + nx * dp), Math.max(z0, z1)] : [Math.min(x0, x1), Math.min(z0, z0 + nz * dp), Math.max(x0, x1), Math.max(z0, z0 + nz * dp)];
  };
  for (let L = 0; L <= P.top; L++) {
    const y = yAt(L);
    const put = (type, rect, f, y0, y1, solid) => {
      P.props.push({ L, type, rect, f, y0, y1 });
      if (solid) P.solids.push({ rect, level: L });
    };
    for (const [x, z, f] of props.hydrants) {
      const H = D.hydrant;
      put('hydrant', front(f, x, z, H.w, H.d), f, y + H.y, y + H.y + H.h, true);
      P.signs.push({ L, kind: 'hydrant', pos: [x + NORMAL[f][0] * 0.08, z + NORMAL[f][1] * 0.08, y + H.y + H.h + 0.15], normal: NORMAL[f] });
    }
    for (const [x0, z0, x1, z1, f] of props.lockers) put('locker', line(x0, z0, x1, z1, f, D.locker.d), f, y, y + D.locker.h, true);
    for (const [x0, z0, x1, z1, f] of props.boards) put('board', line(x0, z0, x1, z1, f, D.board.d), f, y + D.board.y, y + D.board.y + D.board.h, false);
    for (const [x, z, f] of props.extinguishers) {
      const E = D.extinguisher;
      const cx = x + NORMAL[f][0] * E.out;
      const cz = z + NORMAL[f][1] * E.out;
      put('extinguisher', [cx - E.r, cz - E.r, cx + E.r, cz + E.r], f, y, y + E.h, true);
    }
  }
}

// 충돌 등록. 반환: 문 id → 충돌 박스 핸들 (on = false 면 열림). 현관 유리문은 'entrance'
export function addInteriorCollision(col, P) {
  for (const f of P.colFloors) col.floor(...f.rect, f.h, f.level);
  for (const s of P.surfaces) col.surface(...s.rect, s.name, s.level);
  for (const r of P.ramps) col.ramp(r);
  for (const b of P.solids) col.box(...b.rect, b.level);
  const doors = new Map();
  for (const d of P.doors) if (d.block) doors.set(d.id, col.box(...d.block, d.L));
  const e = P.entrance;
  col.floor(...e.threshold, e.y, 0);
  col.surface(...e.threshold, 'stone', 0);
  doors.set('entrance', col.box(...e.block, 0));
  return doors;
}

// (x, z, 층) 이 들어 있는 공간 (계단은 계단참 층도 포함). 없으면 null
export function spaceAt(P, x, z, level) {
  const L = Math.floor(level + 1e-6);
  const st = P.stairs.find((s) => contains(s.rect, x, z));
  if (st && level <= P.top) return { ...st, kind: 'stair', L };
  return P.spaces.find((s) => s.L === L && Number.isInteger(level) && contains(s.rect, x, z)) ?? null;
}
