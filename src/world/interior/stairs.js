// ㄷ자로 꺾이는 계단실 (단계 8, three 없음). 칸 [x0, z0, x1, z1] 의 한쪽(open: 'w' | 'e')이 복도로 열려 있고
// 열린 쪽부터 계단 앞 층계참(near) → 계단 한 줄(오름) → 중간 계단참(far) → 다른 줄(오름) → 위층 계단 앞 층계참.
// 층 L 의 계단 앞 = level L, 중간 계단참 = level L + 0.5. 경사는 Collision.ramp 로, 가운데를 넘으면 층이 바뀐다.
// 1층에서는 내려가는 줄(B)을, 맨 위층에서는 올라가는 줄(A)을 막는다 (옥상 계단은 단계 8(옥상)에서).
import { DIM, INTERIOR } from '../../config.js';

export function stairPlan(def, levels, yAt) {
  const S = INTERIOR.stair;
  const t = INTERIOR.wall;
  const [x0, z0, x1, z1] = def.rect;
  if (def.open !== 'w' && def.open !== 'e') throw new Error(`계단 ${def.id}: open 은 w 또는 e`);
  const fromW = def.open === 'w';
  const D = x1 - x0 - t; // 열린 쪽에서 안쪽 벽까지
  const uf = D - S.far; // 계단 줄이 끝나는 자리
  const iz0 = z0 + t;
  const iz1 = z1 - t;
  const laneW = (iz1 - iz0 - S.divider) / 2;
  const laneB = [iz0, iz0 + laneW]; // 북쪽 줄: 중간 계단참 → 위층
  const laneA = [iz1 - laneW, iz1]; // 남쪽 줄: 이 층 → 중간 계단참
  const div = [laneB[1], laneA[0]];
  const xr = (u0, u1) => (fromW ? [x0 + u0, x0 + u1] : [x1 - u1, x1 - u0]);
  const rect = ([u0, u1], [za, zb]) => {
    const [xa, xb] = xr(u0, u1);
    return [xa, za, xb, zb];
  };
  const up = fromW ? 'x+' : 'x-'; // 열린 쪽에서 멀어질수록 오르는 방향
  const down = fromW ? 'x-' : 'x+';
  const half = DIM.floorH / 2;
  const top = levels - 1;
  const U = { near: [0, S.near], flight: [S.near, uf], far: [uf, D] };

  const out = {
    id: def.id, name: def.name, rect: def.rect, open: def.open, top,
    inner: rect([0, D], [iz0, iz1]),
    near: rect(U.near, [iz0, iz1]),
    far: rect(U.far, [iz0, iz1]),
    laneA: rect(U.flight, laneA),
    laneB: rect(U.flight, laneB),
    divider: rect(U.flight, div),
    walls: [], // 계단실 벽 [x0, z0, x1, z1] (모든 층)
    ramps: [],
    floors: [],
    blocks: [], // { rect, level }
    steps: [], // { L, rect, y0, y1 } 계단 한 단
    xr,
    U,
  };
  out.walls.push([x0, z0, x1, iz0], [x0, iz1, x1, z1]);
  out.walls.push(fromW ? [x1 - t, iz0, x1, iz1] : [x0, iz0, x0 + t, iz1]);

  const rise = half / S.steps;
  const run = (U.flight[1] - U.flight[0]) / S.steps;
  for (let L = 0; L <= top; L++) {
    out.floors.push({ rect: out.near, h: yAt(L), level: L });
    if (L === top) continue;
    const y = yAt(L);
    out.floors.push({ rect: out.far, h: y + half, level: L + 0.5 });
    out.ramps.push({ ...xz(out.laneA), dir: up, h0: y, h1: y + half, lo: L, hi: L + 0.5 });
    out.ramps.push({ ...xz(out.laneB), dir: down, h0: y + half, h1: yAt(L + 1), lo: L + 0.5, hi: L + 1 });
    for (let i = 0; i < S.steps; i++) {
      // A 줄: 열린 쪽에서 안쪽으로 오른다. B 줄: 안쪽에서 열린 쪽으로 오른다
      const ua = U.flight[0] + i * run;
      out.steps.push({ L, rect: rect([ua, ua + run], laneA), top: y + (i + 1) * rise });
      const ub = U.flight[1] - (i + 1) * run;
      out.steps.push({ L, rect: rect([ub, ub + run], laneB), top: y + half + (i + 1) * rise });
    }
  }
  out.blocks.push({ rect: out.laneB, level: 0, kind: 'under' }); // 1층: 계단 밑 (창고 벽)
  out.blocks.push({ rect: out.laneA, level: top, kind: 'rail' }); // 맨 위층: 오르는 줄 자리는 난간
  out.blocks.push({ rect: out.divider, level: [0, top], kind: 'divider' });
  return out;
}

const xz = ([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 });
