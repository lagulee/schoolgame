import { DIM, SCHOOL } from '../config.js';

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

// 본관 뒷부분(중정형 셸)의 바깥 벽 [x0, z0, x1, z1]
export function mainShellWalls() {
  const { outerX: X, backZ: B } = SCHOOL.main;
  const w = SCHOOL.shellWall;
  const F = DIM.backZ;
  return [
    [X - w, B, X, F], // 동
    [-X, B, -X + w, F], // 서
    [-X, B, X, B + w], // 북(뒷면)
  ];
}

// 본관 안쪽 중정 벽 (밖에서는 안 보이지만 단계 8 실내의 기준이 된다)
export function courtyardWalls() {
  const { outerX: X, backZ: B, ring } = SCHOOL.main;
  const w = SCHOOL.shellWall;
  const ix = X - ring;
  const iz = B + ring;
  return [
    [ix - w, iz, ix, DIM.backZ],
    [-ix, iz, -ix + w, DIM.backZ],
    [-ix, iz - w, ix, iz],
  ];
}

export function annexWalls() {
  const A = SCHOOL.annex;
  const w = SCHOOL.shellWall;
  return [
    [A.x0, A.z1 - w, A.x1, A.z1], // 남(교실 창)
    [A.x0, A.z0, A.x1, A.z0 + w], // 북(복도 창)
    [A.x0, A.z0, A.x0 + w, A.z1],
    [A.x1 - w, A.z0, A.x1, A.z1],
  ];
}

export function addSchoolCollision(col) {
  const { innerX: ix, outerX: ox, frontZ: fz, backZ: bz, wingSouthZ: wz, streetMaxZ, fenceZ } = DIM;
  const pw = DIM.piloti.halfW;

  // 본관 앞부분 (ㄷ자): 중앙 블록 좌우 + 동·서 날개, 필로티 막힌 끝
  col.box(-ox, bz, -pw, fz);
  col.box(pw, bz, ox, fz);
  col.box(-ox, fz, -ix, wz);
  col.box(ix, fz, ox, wz);
  col.box(-pw, bz, pw, pilotiBackZ());
  col.circle(0, DIM.piloti.colZ, DIM.piloti.colR);

  // 본관 뒷부분·신관 셸 + 연결통로 기둥
  for (const b of [...mainShellWalls(), ...annexWalls()]) col.box(...b);
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
