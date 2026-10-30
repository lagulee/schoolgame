import { DIM, SCHOOL, INTERIOR } from '../config.js';

// 학교 배치의 큰 충돌(건물·담장·보이지 않는 경계). three 를 쓰지 않는 순수 모듈이라 Node 테스트에서
// 그대로 Collision 에 올려 이동 경계를 검사한다 (test/layout.test.mjs). 작은 소품(화단·나무·가로등)은 각 빌더가 넣는다.

// 철제 담장 구간 [시작, 끝, 생울타리 방향]. 시각(courtyard.js)과 충돌이 같은 목록을 쓴다.
export function fenceRuns() {
  const { innerX, wingSouthZ, fenceZ, gateHalf } = DIM;
  const F = SCHOOL.field;
  return [
    [[-innerX, fenceZ], [-gateHalf - 0.4, fenceZ], [0, 1]],
    [[gateHalf + 0.4, fenceZ], [F.x1, fenceZ], [0, 1]], // 앞 담장: 단계 7에서 운동장 끝까지 연장
    [[-innerX, wingSouthZ], [-innerX, fenceZ], [-1, 0]],
    // 동쪽(x = innerX) 담장은 없앴다: 마당 → 옆길 → 운동장
  ];
}

// 운동장 서쪽 낮은 울타리 (건물 쪽으로 못 넘어감). 옆길과 만나는 모서리까지
export function fieldFenceRuns() {
  const F = SCHOOL.field;
  const P = SCHOOL.path;
  return [
    [[DIM.outerX, P.z0], [F.x0, P.z0]],
    [[F.x0, P.z0], [F.x0, F.z0]],
  ];
}

// 필로티(얕은 입구)의 막힌 끝 z
export const pilotiBackZ = () => DIM.frontZ - DIM.piloti.depth;
// 파라펫 꼭대기
export const buildingTop = () => DIM.floors * DIM.floorH + DIM.parapet;

// 현관 유리문 자리 (동쪽 날개 안쪽 면 x = innerX). z0~z1 = 문짝, frame = 은색 틀 두께, y = 문 아래(계단 위), top = 틀 꼭대기
export function entranceOpening() {
  const S = DIM.steps;
  const E = DIM.entranceDoor;
  const y = S.count * S.rise;
  return { x: DIM.innerX, z0: S.z0 + E.inset, z1: S.z1 - E.inset, frame: E.frame, y, h: E.h, top: y + E.top };
}

// 본관 앞부분(ㄷ자) 셸 벽: { r: [x0, z0, x1, z1], y0, y1 }. 단계 8부터 속이 빈 셸이라 현관 홀·출입문 홀이 안에 들어간다.
// 모서리끼리 겹치지 않게 나눠 바깥 면이 겹쳐 그려지지 않는다 (z-fighting 방지)
export function frontShellWalls() {
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz } = DIM;
  const w = SCHOOL.shellWall;
  const rx = SCHOOL.main.outerX;
  const pw = DIM.piloti.halfW;
  const top = buildingTop();
  const e = entranceOpening();
  const ez0 = e.z0 - e.frame;
  const ez1 = e.z1 + e.frame;
  const full = (r) => ({ r, y0: 0, y1: top });
  return [
    full([ox - w, bz, ox, wz]), // 동쪽 옆면 (중앙 블록 + 날개)
    full([-ox, bz, -ox + w, wz]),
    full([rx, bz, ox - w, bz + w]), // 중앙 블록 뒷면 중 뒷부분보다 튀어나온 양끝
    full([-ox + w, bz, -rx, bz + w]),
    full([ix, wz - w, ox - w, wz]), // 날개 남쪽 면
    full([-ox + w, wz - w, -ix, wz]),
    full([ix, fz, ix + w, ez0]), // 동쪽 날개 안쪽 면 (현관 문 자리 비움)
    full([ix, ez1, ix + w, wz - w]),
    { r: [ix, ez0, ix + w, ez1], y0: e.top, y1: top }, // 현관 문 위
    full([-ix - w, fz, -ix, wz - w]), // 서쪽 날개 안쪽 면
    full([-ix, fz - w, -pw, fz]), // 중앙 블록 앞면 (필로티 양옆)
    full([pw, fz - w, ix, fz]),
    { r: [-pw, fz - w, pw, fz], y0: DIM.piloti.h, y1: top }, // 필로티 위
  ];
}

// 필로티 양옆 벽 + 막힌 끝 유리벽 (높이는 필로티 높이)
export function pilotiWalls() {
  const pw = DIM.piloti.halfW;
  const w = SCHOOL.shellWall;
  const pz = pilotiBackZ();
  const fz = DIM.frontZ - w;
  return [
    [-pw - w, pz, -pw, fz],
    [pw, pz, pw + w, fz],
    [-pw, pz - w, pw, pz], // 유리문 (잠김)
  ];
}

// 3층 연결통로 (단계 9 = 옛 1c): 바닥 = 실내 3층 바닥 (interior/plan.js yAt 과 같은 식)
export const bridgeFloorY = () => INTERIOR.base + SCHOOL.bridge.floor * DIM.floorH;

// 연결통로가 본관 뒷면·신관 남쪽 면 셸 벽을 지나는 구멍: x = 통로 안쪽 폭, y = 바닥 ~ 천장(지붕 아래), level = 통로 층
export function bridgeOpening() {
  const Br = SCHOOL.bridge;
  const y0 = bridgeFloorY();
  return { x0: Br.x0 + Br.wall, x1: Br.x1 - Br.wall, y0, y1: y0 + Br.h, level: Br.floor };
}

const ALL = () => [0, DIM.floors - 1];

// x 를 따라 놓인 셸 벽 [x0, z0, x1, z1] 을 연결통로 구멍으로 나눈 조각 { r, y0, y1, level }.
// 구멍 기둥은 아래(층 0 ~ 통로 층 − 0.5)·위(통로 층 + 0.5 ~ 맨 위층) 둘로 나눠 통로 층만 트인다
function cutForBridge([x0, z0, x1, z1]) {
  const o = bridgeOpening();
  const top = buildingTop();
  const all = ALL();
  return [
    { r: [x0, z0, o.x0, z1], y0: 0, y1: top, level: all },
    { r: [o.x0, z0, o.x1, z1], y0: 0, y1: o.y0, level: [0, o.level - 0.5] },
    { r: [o.x0, z0, o.x1, z1], y0: o.y1, y1: top, level: [o.level + 0.5, all[1]] },
    { r: [o.x1, z0, x1, z1], y0: 0, y1: top, level: all },
  ];
}

// 본관 뒷부분(중정형 셸)의 바깥 벽 [x0, z0, x1, z1]
export function mainShellWalls() {
  const { outerX: X, backZ: B } = SCHOOL.main;
  const w = SCHOOL.shellWall;
  const F = DIM.backZ;
  return [
    [X - w, B, X, F], // 동
    [-X, B, -X + w, F], // 서
    [-X + w, B, X - w, B + w], // 북(뒷면)
  ];
}

// 본관 뒷부분 셸 벽 조각 { r, y0, y1, level } — 뒷면(북)에 3층 연결통로 구멍 (충돌·그리기 공용)
export function mainShellPieces() {
  const [e, w, n] = mainShellWalls();
  const full = (r) => ({ r, y0: 0, y1: buildingTop(), level: ALL() });
  return [full(e), full(w), ...cutForBridge(n)];
}

// 본관 셸 전체 바닥 자리 (실내 벽을 만들 때 셸과 겹치는 부분을 뺀다)
export const buildingShells = () => [...frontShellWalls().map((s) => s.r), ...pilotiWalls(), ...mainShellWalls()];

// 본관이 덮는 바닥 자리 [x0, z0, x1, z1] (필로티는 바깥). 바깥 효과(바닥 안개)를 실내에서 지울 때 쓴다
export function mainFootprints() {
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz } = DIM;
  const { outerX: X, backZ: B } = SCHOOL.main;
  const pw = DIM.piloti.halfW;
  const pz = pilotiBackZ();
  return [[-X, B, X, bz], [-ox, bz, ox, pz], [-ox, pz, -pw, fz], [pw, pz, ox, fz], [-ox, fz, -ix, wz], [ix, fz, ox, wz]];
}

// 외벽 면: origin [x, z] 에서 법선 normal [nx, nz] 의 오른쪽(u)으로 length m. openings 는 창을 내지 않는 자리 (u, v = 높이).
// FacadeKit(외벽 창·띠)과 실내 창(interior/plan.js)이 같은 면을 쓴다
export function facadeFaces() {
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz } = DIM;
  const top = buildingTop();
  const pw = DIM.piloti.halfW;
  const ph = DIM.piloti.h;
  const fl = DIM.floorH;
  const C = DIM.canopy;
  const { outerX: X, backZ: B } = SCHOOL.main;
  const Br = SCHOOL.bridge;
  const bv = bridgeFloorY();
  return {
    front: {
      origin: [-ix, fz], normal: [0, 1], length: ix * 2,
      openings: [
        { u0: ix - pw - 0.3, u1: ix + pw + 0.3, v0: 0, v1: ph + 0.1 },
        { u0: ix - 4.2, u1: ix + 4.2, v0: 3 * fl + 0.45, v1: 4 * fl - 0.1 }, // LED 전광판 자리
        { u0: ix * 2 - 3.1, u1: ix * 2, v0: 0, v1: top + 1 }, // 계단실
      ],
    },
    west: { origin: [-ix, wz], normal: [1, 0], length: wz - fz, openings: [{ u0: 0, u1: 3.7, v0: 0, v1: top + 1 }] },
    east: { origin: [ix, fz], normal: [-1, 0], length: wz - fz, openings: [{ u0: C.z0 - fz - 0.2, u1: C.z1 - fz + 0.2, v0: 0, v1: C.colH + 0.6 }] },
    eastSouth: { origin: [ix, wz], normal: [0, 1], length: ox - ix },
    westSouth: { origin: [-ox, wz], normal: [0, 1], length: ox - ix },
    // 중앙 블록 뒷면은 단계 7부터 중정형 뒷부분에 붙는다: 뒷부분보다 튀어나온 양끝 2 m 만 보인다
    backE: { origin: [ox, bz], normal: [0, -1], length: ox - X, noWindows: true },
    backW: { origin: [-X, bz], normal: [0, -1], length: ox - X, noWindows: true },
    sideE: { origin: [ox, wz], normal: [1, 0], length: wz - bz }, // 운동장에서 보이므로 창을 낸다
    sideW: { origin: [-ox, bz], normal: [-1, 0], length: wz - bz, noWindows: true },
    rearE: { origin: [X, bz], normal: [1, 0], length: bz - B },
    rearW: { origin: [-X, B], normal: [-1, 0], length: bz - B },
    rearN: {
      origin: [X, B], normal: [0, -1], length: X * 2,
      openings: [{ u0: X - Br.x1 - 0.3, u1: X - Br.x0 + 0.3, v0: bv - 0.2, v1: bv + Br.h + 0.4 }], // 연결통로가 붙는 자리
    },
  };
}

// 면 위 u 의 바닥 좌표 [x, z]
export const facePoint = (f, u) => [f.origin[0] + f.normal[1] * u, f.origin[1] - f.normal[0] * u];

// 면의 floor 층(0 = 1층) 창 가운데 u 목록. FacadeKit 의 창 배치와 같은 규칙 (bay 당 2개, 열린 자리는 건너뜀)
export function windowSlots(f, floor) {
  if (f.noWindows) return [];
  const W = DIM.window;
  const bays = Math.floor(f.length / DIM.bay);
  const off = (f.length - bays * DIM.bay) / 2;
  const v = floor * DIM.floorH + W.sill + W.h / 2;
  const hit = (u) => (f.openings ?? []).some((o) => u + W.w / 2 + 0.1 > o.u0 && u - W.w / 2 - 0.1 < o.u1 && v + W.h / 2 + 0.1 > o.v0 && v - W.h / 2 - 0.1 < o.v1);
  const out = [];
  for (let b = 0; b < bays; b++) {
    for (const k of [0.3, 0.7]) {
      const u = off + b * DIM.bay + DIM.bay * k;
      if (!hit(u)) out.push(u);
    }
  }
  return out;
}

export function annexWalls() {
  const A = SCHOOL.annex;
  const w = SCHOOL.shellWall;
  return [
    [A.x0, A.z1 - w, A.x1, A.z1], // 남(교실 창)
    [A.x0, A.z0, A.x1, A.z0 + w], // 북(복도 창)
    [A.x0, A.z0 + w, A.x0 + w, A.z1 - w], // 서 (남북 벽과 겹치지 않게)
    [A.x1 - w, A.z0 + w, A.x1, A.z1 - w], // 동
  ];
}

// 신관 셸 벽 조각 { r, y0, y1, level } — 남쪽 면에 3층 연결통로 구멍. 단계 9부터 실내가 있어 모든 층을 막는다
export function annexShellPieces() {
  const [s, n, w, e] = annexWalls();
  const full = (r) => ({ r, y0: 0, y1: buildingTop(), level: ALL() });
  return [...cutForBridge(s), full(n), full(w), full(e)];
}

// 신관 외벽 면 (FacadeKit 과 실내 창(interior/annexPlan.js)이 같은 면을 쓴다). 남쪽 = 교실 창, 북쪽 = 복도 창
export function annexFaces() {
  const A = SCHOOL.annex;
  const Br = SCHOOL.bridge;
  const bv = bridgeFloorY();
  const len = A.x1 - A.x0;
  const depth = A.z1 - A.z0;
  return {
    annexS: { origin: [A.x0, A.z1], normal: [0, 1], length: len, openings: [{ u0: Br.x0 - A.x0 - 0.3, u1: Br.x1 - A.x0 + 0.3, v0: bv - 0.2, v1: bv + Br.h + 0.4 }] },
    annexN: { origin: [A.x1, A.z0], normal: [0, -1], length: len },
    annexE: { origin: [A.x1, A.z1], normal: [1, 0], length: depth },
    annexW: { origin: [A.x0, A.z0], normal: [-1, 0], length: depth },
  };
}

export function addSchoolCollision(col) {
  const { outerX: ox, wingSouthZ: wz, streetMaxZ, fenceZ } = DIM;
  const all = [0, DIM.floors - 1]; // 셸 벽은 모든 층·계단참을 막는다

  // 본관 앞부분 (ㄷ자 셸): 바닥부터 올라가는 벽은 1층(바깥)부터, 필로티·현관 문 위 벽은 2층부터
  for (const s of frontShellWalls()) col.box(...s.r, s.y0 > 0 ? [1, all[1]] : all);
  for (const r of pilotiWalls()) col.box(...r, all);
  col.circle(0, DIM.piloti.colZ, DIM.piloti.colR);

  // 본관 뒷부분·신관 셸 (3층 연결통로 구멍만 트임) + 연결통로 기둥
  for (const p of [...mainShellPieces(), ...annexShellPieces()]) col.box(...p.r, p.level);
  const Br = SCHOOL.bridge;
  for (const x of [Br.x0 + 0.4, Br.x1 - 0.4]) col.circle(x, Br.pillarZ, Br.pillarR);

  // 담장 (두께 0.2)
  for (const [a, b] of [...fenceRuns(), ...fieldFenceRuns()]) {
    col.box(Math.min(a[0], b[0]) - 0.1, Math.min(a[1], b[1]) - 0.1, Math.max(a[0], b[0]) + 0.1, Math.max(a[1], b[1]) + 0.1);
  }
  for (const s of [-1, 1]) {
    const x = s * (DIM.gateHalf + 0.05);
    col.box(x - 0.35, fenceZ - 0.35, x + 0.35, fenceZ + 0.35); // 정문 기둥
  }

  // 보이지 않는 경계: 정문 밖 보도(z ≤ streetMaxZ) 까지, 운동장 동·북쪽 끝
  const F = SCHOOL.field;
  col.box(-80, streetMaxZ, 140, streetMaxZ + 2);
  col.box(-32, fenceZ, -30, streetMaxZ);
  col.box(30, fenceZ, 32, streetMaxZ);
  col.box(-ox - 2, wz - 0.1, -ox, fenceZ + 0.1); // 서쪽 날개 남쪽 생울타리 뒤 → 본관 서쪽 바깥으로 돌아 나가지 못하게
  col.box(F.x1, F.z0 - 2, F.x1 + 2, fenceZ + 0.2);
  col.box(F.x0, F.z0 - 2, F.x1 + 2, F.z0);
}
