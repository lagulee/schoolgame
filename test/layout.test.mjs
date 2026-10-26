// 단계 7(외부 확장): 건물·담장·이동 경계 충돌. layout.js 를 실제 Collision 에 올려
// 시작 지점에서 걸어서 갈 수 있는 곳(격자 탐색)과 막혀야 하는 곳을 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collision } from '../src/player/collision.js';
import { addSchoolCollision, pilotiBackZ, mainShellWalls, annexWalls } from '../src/world/layout.js';
import { DIM, PLAYER, SCHOOL } from '../src/config.js';

const R = PLAYER.radius;
const STEP = 0.5;
const AREA = { x0: -60, x1: 130, z0: -130, z1: 30 };

function world() {
  const col = new Collision();
  addSchoolCollision(col);
  return col;
}

// 시작 지점에서 반지름 R 원이 지나갈 수 있는 격자 칸 (4방향, 칸 사이 선분도 막힘 검사)
function reachable(col, start) {
  const nx = Math.round((AREA.x1 - AREA.x0) / STEP);
  const nz = Math.round((AREA.z1 - AREA.z0) / STEP);
  const seen = new Uint8Array(nx * nz);
  const idx = (x, z) => Math.round((z - AREA.z0) / STEP) * nx + Math.round((x - AREA.x0) / STEP);
  const sx = AREA.x0 + Math.round((start[0] - AREA.x0) / STEP) * STEP;
  const sz = AREA.z0 + Math.round((start[1] - AREA.z0) / STEP) * STEP;
  assert.equal(col.hit(sx, sz, R), false, '시작 칸이 막혀 있음');
  const q = [[sx, sz]];
  seen[idx(sx, sz)] = 1;
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const x2 = x + dx;
      const z2 = z + dz;
      if (x2 < AREA.x0 || x2 >= AREA.x1 || z2 < AREA.z0 || z2 >= AREA.z1) continue;
      const k = idx(x2, z2);
      if (seen[k] || col.hit(x2, z2, R) || col.hit(x + dx / 2, z + dz / 2, R)) continue;
      seen[k] = 1;
      q.push([x2, z2]);
    }
  }
  return (x, z) => {
    const gx = AREA.x0 + Math.round((x - AREA.x0) / STEP) * STEP;
    const gz = AREA.z0 + Math.round((z - AREA.z0) / STEP) * STEP;
    return seen[idx(gx, gz)] === 1;
  };
}

const col = world();
const can = reachable(col, [PLAYER.start[0], PLAYER.start[2]]);
const F = SCHOOL.field;
const T = F.track;

test('시작 지점에서 옆길을 지나 운동장까지 걸어갈 수 있다', () => {
  assert.ok(can(0, 0), '앞마당');
  assert.ok(can(24, 11.5), '옆길 (동쪽 날개 남쪽)');
  assert.ok(can(T.cx + T.r + 2, T.cz), '트랙 위');
  assert.ok(can(T.cx, T.cz + 4), '운동장 가운데');
  assert.ok(can(F.x1 - 1, F.z0 + 1), '운동장 북동쪽 끝');
  assert.ok(can(F.x0 + 1, SCHOOL.path.z0 - 1), '운동장 남서쪽 (스탠드 앞)');
  assert.ok(can(0, DIM.streetMaxZ - 0.5), '정문 밖 보도 (기존과 같음)');
});

test('건물 안·건물 사이·담장 밖으로는 갈 수 없다', () => {
  const blocked = {
    '필로티 유리문 너머 (본관 1층)': [0, pilotiBackZ() - 1],
    '본관 중정': [0, -40],
    '본관 뒷부분 동쪽 동': [21, -45],
    '본관–신관 사이 (연결통로 아래)': [18.5, -72],
    '본관 뒤 잔디': [0, -70],
    '신관 안': [0, (SCHOOL.annex.z0 + SCHOOL.annex.z1) / 2],
    '신관 뒤': [0, SCHOOL.annex.z0 - 5],
    '본관 서쪽 바깥': [-40, -20],
    '도로 (담장 밖)': [0, DIM.streetMaxZ + 3],
    '운동장 동쪽 그물 밖': [F.x1 + 3, T.cz],
    '운동장 북쪽 그물 밖': [T.cx, F.z0 - 3],
    '운동장 서쪽 울타리 너머 (건물 옆 틈)': [F.x0 - 2, -40],
    '동쪽 보도 끝 너머': [40, DIM.fenceZ + 2],
  };
  for (const [name, [x, z]] of Object.entries(blocked)) assert.equal(can(x, z), false, name);
});

test('필로티는 얕은 입구: 유리문에서 멈춘다', () => {
  const pos = { x: 0.8, z: DIM.frontZ + 1 };
  for (let i = 0; i < 400; i++) col.move(pos, 0, -0.05, R);
  assert.ok(Math.abs(pos.z - (pilotiBackZ() + R)) < 0.05, `멈춘 z = ${pos.z}`);
  assert.equal(DIM.frontZ - pilotiBackZ(), DIM.piloti.depth);
});

test('본관 뒷부분은 중정형(ㅁ자)이고 앞부분보다 좌우가 안쪽이다 (앞쪽 좌우 돌출)', () => {
  const { outerX, backZ, ring } = SCHOOL.main;
  assert.ok(outerX < DIM.outerX, '앞부분이 좌우로 튀어나옴');
  const ix = outerX - ring;
  assert.ok(ix > 0 && backZ + ring < DIM.backZ, '중정이 남는다');
  // 셸 벽이 앞부분 뒷면(z = DIM.backZ)에서 뒷면까지 이어진다
  const walls = mainShellWalls();
  assert.ok(walls.some(([x0, z0, x1, z1]) => x1 === outerX && z0 === backZ && z1 === DIM.backZ));
  assert.ok(walls.some(([x0, z0, x1, z1]) => x0 === -outerX && z0 === backZ && z1 === DIM.backZ));
});

test('신관은 본관 뒤, 본관보다 살짝 작고, 연결통로가 두 건물 사이를 잇는다', () => {
  const A = SCHOOL.annex;
  const Br = SCHOOL.bridge;
  assert.ok(A.z1 < SCHOOL.main.backZ, '본관 뒤쪽');
  assert.ok(A.x1 - A.x0 < SCHOOL.main.outerX * 2, '본관보다 작다');
  assert.equal(A.classes.length, 3, '층당 반 3개');
  for (const [a, b] of A.classes) assert.ok(a >= A.x0 && b <= A.x1 && b > a);
  assert.equal(Br.floor, 2, '3층');
  assert.ok(Br.x0 > A.x0 && Br.x1 < A.x1 && Br.x1 < SCHOOL.main.outerX && Br.x0 > -SCHOOL.main.outerX, '두 건물 폭 안');
  assert.ok(Br.pillarZ < SCHOOL.main.backZ && Br.pillarZ > A.z1, '기둥은 두 건물 사이');
  assert.equal(annexWalls().length, 4);
});

test('운동장은 본관 오른쪽(+x), 트랙과 골대가 운동장 안에 들어간다', () => {
  assert.ok(F.x0 > DIM.outerX, '본관 오른쪽');
  const ox = T.r + T.w;
  assert.ok(T.cx - ox > F.x0 + F.standD + 0.6 && T.cx + ox < F.x1, '트랙 x');
  assert.ok(T.cz - T.straight / 2 - ox > F.z0 && T.cz + T.straight / 2 + ox < F.z1, '트랙 z');
  assert.ok(F.goalZ + F.goal.d < T.straight / 2 + T.r, '골대는 트랙 안쪽');
});
