// 실내 가구 배치 (단계 8 본관, 단계 9 신관, three 없음). 들어갈 수 있는 방과 현관 홀만 채운다 (잠긴 방은 안이 보이지 않음).
// 방마다 앞(front) 벽 쪽을 u = D, 뒤를 u = 0 으로 두는 방 좌표(u, v)로 배치하고 월드 상자로 바꾼다.
// 결과: { items: [{ L, mat, b: [x0, y0, z0, x1, y1, z1], faces?, local?, tile? }], solids: [{ rect, level }],
//         spots: [{ id, room, L, pos: [x, z], book?: b }] (신관 책상 위 책 — 따로 그려 사건에서 숨길 수 있게) }
// 그리기는 interior/index.js 가 Batch 로, 충돌은 addFurnitureCollision. 치수는 config INTERIOR.furniture.
import { INTERIOR, ANNEX } from '../../config.js';
import { yAt, ceilAt } from './plan.js';

const F = () => INTERIOR.furniture;

// 방 안쪽 사각형 (벽 두께만큼 줄임; 외벽 쪽 마감은 더 얇지만 같은 값으로 둔다)
const innerOf = ([x0, z0, x1, z1]) => {
  const t = INTERIOR.wall;
  return [x0 + t, z0 + t, x1 - t, z1 - t];
};

// 방 좌표 → 월드. 반환 { D (앞뒤 길이), W (가로), R(u0, u1, v0, v1) → [x0, z0, x1, z1], at(d) → 'u0'|'uD'|'v0'|'vW' }
function frame(inner, front) {
  const [x0, z0, x1, z1] = inner;
  const ew = front === 'e' || front === 'w';
  const D = ew ? x1 - x0 : z1 - z0;
  const W = ew ? z1 - z0 : x1 - x0;
  const R = {
    e: (u0, u1, v0, v1) => [x0 + u0, z0 + v0, x0 + u1, z0 + v1],
    w: (u0, u1, v0, v1) => [x1 - u1, z1 - v1, x1 - u0, z1 - v0],
    n: (u0, u1, v0, v1) => [x0 + v0, z1 - u1, x0 + v1, z1 - u0],
    s: (u0, u1, v0, v1) => [x1 - v1, z0 + u0, x1 - v0, z0 + u1],
  }[front];
  const SIDES = { e: { n: 'v0', s: 'vW', w: 'u0', e: 'uD' }, w: { s: 'v0', n: 'vW', e: 'u0', w: 'uD' }, n: { w: 'v0', e: 'vW', s: 'u0', n: 'uD' }, s: { e: 'v0', w: 'vW', n: 'u0', s: 'uD' } }[front];
  return { D, W, R, at: (d) => SIDES[d] };
}

// 방 하나의 배치 도구: put(재질, [u0, u1], [v0, v1], [h0, h1], opt) / solid([u0, u1], [v0, v1])
function roomKit(out, sp) {
  const fr = frame(innerOf(sp.rect), sp.front);
  const y = yAt(sp.L);
  const put = (mat, [u0, u1], [v0, v1], [h0, h1], opt = {}) => {
    const [x0, z0, x1, z1] = fr.R(u0, u1, v0, v1);
    out.items.push({ L: sp.L, mat, b: [x0, y + h0, z0, x1, y + h1, z1], ...opt });
  };
  const solid = ([u0, u1], [v0, v1]) => out.solids.push({ rect: fr.R(u0, u1, v0, v1), level: sp.L });
  // 문 쪽 가로 끝 (문이 v = W 쪽이면 true) — 문 앞은 비운다
  const doorAtW = fr.at(sp.side) === 'vW';
  const vFar = (a, b) => (doorAtW ? [a, b] : [fr.W - b, fr.W - a]); // 문 반대쪽(창 쪽)에서 잰 v
  return { ...fr, put, solid, vFar, y, desks: [] };
}

// 책상(상판 + 다리 4개) — 방향 무관. 의자는 상판 앞뒤 중 u 가 작은 쪽(뒤)에
function desk(k, [u0, u1], [v0, v1], top, legMat = 'metal', topMat = 'wood') {
  const T = F().leg;
  k.put(topMat, [u0, u1], [v0, v1], [top - 0.03, top], {});
  for (const u of [u0 + 0.02, u1 - 0.02 - T]) for (const v of [v0 + 0.02, v1 - 0.02 - T]) k.put(legMat, [u, u + T], [v, v + T], [0, top - 0.03], { faces: 'nsew' });
}

// 의자: 앉는 판 + 다리 + 등받이 (back = 등받이가 u0 쪽이면 -1, u1 쪽이면 +1)
function chair(k, [u0, u1], [v0, v1], back = -1) {
  const C = F().chair;
  const T = F().leg;
  k.put('wood', [u0, u1], [v0, v1], [C.seat - 0.03, C.seat]);
  for (const u of [u0 + 0.02, u1 - 0.02 - T]) for (const v of [v0 + 0.02, v1 - 0.02 - T]) k.put('metal', [u, u + T], [v, v + T], [0, C.seat - 0.03], { faces: 'nsew' });
  const bu = back < 0 ? [u0, u0 + 0.03] : [u1 - 0.03, u1];
  k.put('wood', bu, [v0 + 0.03, v1 - 0.03], [C.seat + 0.18, C.back]);
  k.put('metal', bu, [v0 + 0.02, v0 + 0.02 + T], [C.seat, C.seat + 0.18], { faces: 'nsew' });
  k.put('metal', bu, [v1 - 0.02 - T, v1 - 0.02], [C.seat, C.seat + 0.18], { faces: 'nsew' });
}

// 칠판·게시판처럼 벽에 붙은 판 (front 벽 = uD, 뒤 벽 = u0)
function wallBoard(k, mat, wall, [v0, v1], [h0, h1], depth = 0.03) {
  const u = wall === 'uD' ? [k.D - depth, k.D] : [0, depth];
  k.put(mat, u, [v0, v1], [h0, h1], { local: true, tile: [v1 - v0, h1 - h0] });
}

function cabinet(k, mat, u, v, h, solid = true) {
  k.put(mat, u, v, [0, h], { local: true, tile: [Math.max(0.3, Math.abs(v[1] - v[0])), h] });
  if (solid) k.solid(u, v);
}

function classroom(k) {
  const C = F().classroom;
  const { D, W } = k;
  // 앞: 칠판 + 분필 받침 + 교탁 + 교사 책상(창 쪽 앞 구석)
  wallBoard(k, 'board', 'uD', [W / 2 - C.board / 2, W / 2 + C.board / 2], [0.85, 0.85 + C.boardH], 0.04);
  k.put('metal', [D - 0.1, D], [W / 2 - C.board / 2, W / 2 + C.board / 2], [0.8, 0.85]);
  k.put('wood', [D - 1.55, D - 1.0], [W / 2 - 0.4, W / 2 + 0.4], [0, 1.05]);
  k.solid([D - 1.55, D - 1.0], [W / 2 - 0.4, W / 2 + 0.4]);
  const tv = k.vFar(0.2, 1.5);
  desk(k, [D - 1.95, D - 1.2], tv, 0.74);
  chair(k, [D - 1.15, D - 0.75], [tv[0] + 0.4, tv[1] - 0.45], 1);
  k.solid([D - 1.95, D - 0.75], tv);
  // 학생 책상: 짝(2개) × 3줄 × rows 행. 앞줄 책상 앞 = D − C.front
  const pairW = C.desk.w * 2 + 0.06;
  const aisle = (W - 2 * C.margin - 3 * pairW) / 2;
  for (let r = 0; r < C.rows; r++) {
    const uc = D - C.front - C.desk.d - r * C.pitch; // 책상 뒤 모서리
    for (let p = 0; p < 3; p++) {
      const v0 = C.margin + p * (pairW + aisle);
      for (let s = 0; s < 2; s++) {
        const a = v0 + s * (C.desk.w + 0.06);
        desk(k, [uc, uc + C.desk.d], [a, a + C.desk.w], C.desk.h);
        chair(k, [uc - 0.42, uc - 0.04], [a + 0.11, a + C.desk.w - 0.11]);
        k.desks.push({ key: `${r},${p},${s}`, u: [uc, uc + C.desk.d], v: [a, a + C.desk.w], s });
      }
      k.solid([uc - 0.45, uc + C.desk.d], [v0, v0 + pairW]);
    }
  }
  // 뒤: 사물함 + 게시판 + 청소함(창 쪽 구석)
  const lv = k.vFar(1.0, W - 1.6);
  cabinet(k, 'locker', [0, F().lockerD], lv, C.lockerH);
  wallBoard(k, 'notice', 'u0', [1.2, W - 1.2], [1.45, 2.35]);
  cabinet(k, 'cabinet', [0, 0.5], k.vFar(0.1, 0.85), 1.8);
}

function counsel(k) {
  const { D, W } = k;
  const cu = D / 2 + 0.6;
  const cv = W / 2;
  // 가운데 탁자 + 의자 4개
  desk(k, [cu - 0.5, cu + 0.5], [cv - 0.5, cv + 0.5], 0.72, 'metal', 'wood');
  chair(k, [cu - 0.95, cu - 0.55], [cv - 0.2, cv + 0.2], -1);
  chair(k, [cu + 0.55, cu + 0.95], [cv - 0.2, cv + 0.2], 1);
  k.solid([cu - 0.95, cu + 0.95], [cv - 0.55, cv + 0.55]);
  // 뒤 벽 소파 + 낮은 탁자
  const sv = k.vFar(1.2, 4.2);
  k.put('fabric', [0.05, 0.85], sv, [0, 0.42]);
  k.put('fabric', [0.05, 0.3], sv, [0.42, 0.85]);
  k.solid([0.05, 0.85], sv);
  desk(k, [1.3, 1.9], [sv[0] + 0.7, sv[1] - 0.7], 0.4);
  k.solid([1.3, 1.9], [sv[0] + 0.7, sv[1] - 0.7]);
  // 창 쪽 낮은 장 + 앞 벽 책장 + 게시판
  cabinet(k, 'cabinet', [3.2, D - 0.6], k.vFar(0, 0.45), 0.85);
  cabinet(k, 'wood', [D - 0.4, D], [W / 2 - 1.5, W / 2 + 1.5], 1.8);
  wallBoard(k, 'notice', 'u0', k.vFar(4.6, 6.6), [1.2, 2.0]);
}

function admin(k) {
  const { D, W } = k;
  // 가운데 책상 섬: 3개 × 마주 보기 2줄 + 의자
  const v0 = W / 2 - 0.7;
  for (let i = 0; i < 3; i++) {
    const u = 2.2 + i * 1.2;
    desk(k, [u, u + 1.15], [v0, v0 + 0.7], 0.74);
    desk(k, [u, u + 1.15], [v0 + 0.7, v0 + 1.4], 0.74);
    chair(k, [u + 0.35, u + 0.8], [v0 - 0.45, v0 - 0.05]);
    chair(k, [u + 0.35, u + 0.8], [v0 + 1.45, v0 + 1.85]);
  }
  k.solid([2.2, 5.8], [v0 - 0.45, v0 + 1.85]);
  // 실장 책상 (앞, 뒤를 향함) + 복사기 + 뒤 벽 서류장
  desk(k, [D - 1.6, D - 0.85], [W / 2 - 0.8, W / 2 + 0.8], 0.74);
  chair(k, [D - 0.8, D - 0.4], [W / 2 - 0.22, W / 2 + 0.22], 1);
  k.solid([D - 1.6, D - 0.4], [W / 2 - 0.8, W / 2 + 0.8]);
  cabinet(k, 'cabinet', [D - 0.8, D - 0.1], k.vFar(0.2, 0.9), 1.0);
  cabinet(k, 'cabinet', [0, 0.45], k.vFar(0.4, W - 2.2), 1.85);
  wallBoard(k, 'notice', 'uD', k.vFar(1.2, 2.8), [1.2, 2.1]);
}

function staff(k) {
  const { D, W } = k;
  const S = F().staff;
  // 책상 섬 2줄 × 2개: 섬마다 마주 보는 책상 2줄 × 3개
  for (const vs of S.islands) {
    for (const [ua, ub] of S.runs) {
      for (let i = 0; i < 3; i++) {
        const u = ua + i * ((ub - ua) / 3);
        const u1 = u + (ub - ua) / 3 - 0.05;
        desk(k, [u, u1], [vs, vs + 0.7], 0.74);
        desk(k, [u, u1], [vs + 0.7, vs + 1.4], 0.74);
        chair(k, [u + 0.3, u1 - 0.3], [vs - 0.42, vs - 0.04]);
        chair(k, [u + 0.3, u1 - 0.3], [vs + 1.44, vs + 1.82]);
      }
      k.solid([ua, ub], [vs - 0.3, vs + 1.7]);
    }
  }
  // 앞(교감석, 뒤를 향함) + 칠판·게시판, 창 쪽 낮은 장, 뒤 벽 서류장
  desk(k, [D - 1.7, D - 0.95], [W / 2 - 0.8, W / 2 + 0.8], 0.74);
  chair(k, [D - 0.9, D - 0.5], [W / 2 - 0.22, W / 2 + 0.22], 1);
  k.solid([D - 1.7, D - 0.5], [W / 2 - 0.8, W / 2 + 0.8]);
  wallBoard(k, 'board', 'uD', [1.0, 4.0], [0.9, 2.1], 0.04);
  wallBoard(k, 'notice', 'uD', [4.5, 7.5], [1.0, 2.1]);
  cabinet(k, 'cabinet', [0.5, D - 0.3], [W - 0.45, W], 0.85);
  cabinet(k, 'cabinet', [0, 0.45], [1.5, W - 1.0], 1.85);
}

function duty(k) {
  const { D, W } = k;
  // 앞 벽(창 쪽 구석) 침대: 나무 틀 + 매트리스 + 베개
  const bv = k.vFar(0.05, 2.05);
  k.put('wood', [D - 0.95, D], bv, [0, 0.25]);
  k.put('fabric', [D - 0.92, D - 0.03], [bv[0] + 0.03, bv[1] - 0.03], [0.25, 0.45]);
  k.put('paper', [D - 0.8, D - 0.15], doorSide(k, bv, 0.45), [0.45, 0.55]);
  k.solid([D - 0.95, D], bv);
  // 뒤 벽 책상·의자, 키 큰 사물함, 냉장고
  const dv = k.vFar(2.5, 3.9);
  desk(k, [0, 0.65], dv, 0.74);
  chair(k, [0.75, 1.15], [dv[0] + 0.45, dv[1] - 0.45], 1);
  k.solid([0, 1.2], dv);
  cabinet(k, 'cabinet', [0, 0.45], k.vFar(0.3, 2.1), 1.85);
  cabinet(k, 'cabinet', [0, 0.6], k.vFar(W - 2.4, W - 1.8), 0.85);
  // 앞 벽 TV 장 + TV, 가운데 낮은 탁자
  const tv = k.vFar(4.5, 6.0);
  cabinet(k, 'wood', [D - 0.45, D], tv, 0.5);
  k.put('rubber', [D - 0.25, D - 0.17], [tv[0] + 0.3, tv[1] - 0.3], [0.5, 1.05]);
  desk(k, [D / 2 - 0.4, D / 2 + 0.4], k.vFar(3.4, 4.6), 0.35);
  k.solid([D / 2 - 0.4, D / 2 + 0.4], k.vFar(3.4, 4.6));
}

// [v0, v1] 중 문 쪽 끝에서 w 만큼 (베개 자리)
const doorSide = (k, [v0, v1], w) => (k.vFar(0, 1)[0] === 0 ? [v1 - w, v1] : [v0, v0 + w]);

// 책상 위 책 상자 (방 좌표 → 월드)
function bookOn(k, d) {
  const B = ANNEX.book;
  const uc = (d.u[0] + d.u[1]) / 2;
  const vc = (d.v[0] + d.v[1]) / 2;
  const top = F().classroom.desk.h;
  const [x0, z0, x1, z1] = k.R(uc - B.d / 2, uc + B.d / 2, vc - B.w / 2, vc + B.w / 2);
  return [x0, k.y + top, z0, x1, k.y + top + B.h, z1];
}

// 신관 2층 야자 교실 (단계 9): 교실 + 책상 위 책·책상 옆 고리에 건 가방 (extras.yaja: { books, bags } = [줄, 짝, 자리])
function yaja(k, extras) {
  classroom(k);
  const Y = extras.yaja ?? {};
  const at = (key) => k.desks.find((d) => d.key === key.join());
  for (const key of Y.books ?? []) {
    const d = at(key);
    if (d) k.items.push({ L: k.L, mat: 'book', b: bookOn(k, d) });
  }
  const G = ANNEX.bag;
  for (const key of Y.bags ?? []) {
    const d = at(key);
    if (!d) continue;
    const uc = (d.u[0] + d.u[1]) / 2;
    const v = d.s === 0 ? [d.v[0] - G.d, d.v[0]] : [d.v[1], d.v[1] + G.d]; // 짝의 바깥쪽 고리
    k.put('bag', [uc - G.w / 2, uc + G.w / 2], v, [0.28, 0.28 + G.h]);
  }
}

const LAYOUT = { classroom, counsel, admin, staff, duty, yaja };

// 천장 형광등 기구 (꺼져 있음): 복도는 가운데 줄, 방·홀은 격자
function fixtures(out, sp, top) {
  const X = F().fixture;
  const [x0, z0, x1, z1] = sp.rect;
  const y = ceilAt(sp.L, top);
  const alongX = x1 - x0 >= z1 - z0;
  const lay = (cx, cz) => {
    const [hx, hz] = alongX ? [X.l / 2, X.w / 2] : [X.w / 2, X.l / 2];
    out.items.push({ L: sp.L, mat: sp.lit ? 'fixtureLit' : 'fixture', b: [cx - hx, y - X.h, cz - hz, cx + hx, y, cz + hz], faces: 'bnsew' });
  };
  const grid = (n, a, b) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 0.5)) / n);
  if (sp.hall && sp.kind === 'corridor') {
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / X.every));
    for (const c of grid(n, alongX ? x0 : z0, alongX ? x1 : z1)) lay(alongX ? c : (x0 + x1) / 2, alongX ? (z0 + z1) / 2 : c);
    return;
  }
  const nx = Math.max(1, Math.round((x1 - x0) / X.room));
  const nz = Math.max(1, Math.round((z1 - z0) / X.room));
  for (const cx of grid(nx, x0, x1)) for (const cz of grid(nz, z0, z1)) lay(cx, cz);
}

// 현관 홀: 북쪽 벽 신발장 + 게시판
function lobby(out, sp) {
  const B = F().lobby;
  const y = yAt(sp.L);
  const z = sp.rect[1];
  out.items.push({ L: sp.L, mat: 'locker', b: [B.shoes[0], y, z, B.shoes[1], y + B.shoesH, z + B.shoesD], local: true, tile: [0.3, 0.3], faces: 'tsew' });
  out.solids.push({ rect: [B.shoes[0], z, B.shoes[1], z + B.shoesD], level: sp.L });
  out.items.push({ L: sp.L, mat: 'notice', b: [B.board[0], y + 1.2, z, B.board[1], y + 2.2, z + 0.03], local: true, tile: [B.board[1] - B.board[0], 1], faces: 's' });
}

// extras (신관 데이터): { yaja, spots } — spots 중 desk 가 있는 것은 그 책상 위에 책 자리를 만든다
export function furniturePlan(P, extras = {}) {
  const out = { items: [], solids: [], spots: [] };
  for (const sp of P.spaces) {
    if (!(sp.hall || sp.enter)) continue;
    fixtures(out, sp, P.top);
    if (sp.kind === 'lobby') lobby(out, sp);
    const lay = LAYOUT[sp.kind];
    if (!lay || !sp.enter) continue;
    const k = { ...roomKit(out, sp), items: out.items, L: sp.L };
    lay(k, extras);
    for (const s of (extras.spots ?? []).filter((t) => t.room === sp.id && t.desk)) {
      const d = k.desks.find((e) => e.key === s.desk.join());
      if (!d) throw new Error(`책상 없음: ${s.id} ${s.desk}`);
      const b = s.book ? bookOn(k, d) : null;
      const [x0, z0, x1, z1] = k.R(d.u[0], d.u[1], d.v[0], d.v[1]);
      out.spots.push({ id: s.id, room: sp.id, L: sp.L, pos: [(x0 + x1) / 2, (z0 + z1) / 2], book: b });
    }
  }
  return out;
}

export function addFurnitureCollision(col, FP) {
  for (const s of FP.solids) col.box(...s.rect, s.level);
}
