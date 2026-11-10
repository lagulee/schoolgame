// 벽 틈 점검 (v1.28.9): 평면(plan.js)의 벽·난간·기둥·문·유리·외벽 셸을 눈높이에서 5 cm 격자에 칠하고,
// 복도·방·계단 안에서 물을 채워(flood fill) 건물 공간 밖으로 새는 자리를 찾는다 → 벽이 뚫려 바깥이 보이는 곳.
// 사용: node scripts/audit-gaps.mjs [--shell=0]  (shell=0 이면 외벽 셸을 막힌 것으로 치지 않는다: 실내 벽만으로 닫혔는지)
import { readFileSync } from 'node:fs';
import { buildSite } from '../src/world/interior/site.js';
import { yAt } from '../src/world/interior/plan.js';
import { buildingShells, annexWalls } from '../src/world/layout.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const useShell = args.shell !== '0';
const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const site = buildSite(load('mainInterior.json'), load('annexInterior.json'));
const C = 0.05;
const EYE = 1.5;

export function findGaps(P, shells, name) {
  const out = [];
  for (let L = 0; L <= P.top; L++) {
    const eye = yAt(L) + EYE;
    const spaces = [...P.spaces.filter((s) => s.L === L).map((s) => s.rect), ...P.stairs.map((s) => s.rect), ...(P.court ? [P.court] : [])];
    const x0 = Math.min(...spaces.map((r) => r[0])) - 2, z0 = Math.min(...spaces.map((r) => r[1])) - 2;
    const x1 = Math.max(...spaces.map((r) => r[2])) + 2, z1 = Math.max(...spaces.map((r) => r[3])) + 2;
    const W = Math.ceil((x1 - x0) / C), H = Math.ceil((z1 - z0) / C);
    const grid = new Uint8Array(W * H); // 0 빈칸, 1 막힘, 2 공간 안, 4 채움
    const paint = (r, bit, grow = 0) => {
      const a = Math.max(0, Math.floor((r[0] - grow - x0) / C + 1e-6)), b = Math.min(W, Math.ceil((r[2] + grow - x0) / C - 1e-6));
      const c = Math.max(0, Math.floor((r[1] - grow - z0) / C + 1e-6)), d = Math.min(H, Math.ceil((r[3] + grow - z0) / C - 1e-6));
      for (let j = c; j < d; j++) for (let i = a; i < b; i++) grid[j * W + i] |= bit;
    };
    for (const r of spaces) paint(r, 2);
    const thin = (g) => (g.side === 'n' || g.side === 's' ? [g.a, g.at - 0.03, g.b, g.at + 0.03] : [g.at - 0.03, g.a, g.at + 0.03, g.b]);
    for (const w of P.walls) if (w.L === L && w.y0 <= eye && w.y1 >= eye) paint(w.rect, 1);
    for (const r of P.rails) if (r.L === L) paint(r.rect, 1);
    for (const c of P.columns) paint(c.rect, 1);
    for (const st of P.stairs) { for (const w of st.walls) paint(w, 1); paint(st.divider, 1); }
    for (const g of P.glass) if (g.L === L) paint(thin(g), 1);
    for (const d of P.doors) if (d.L === L && d.block) paint(d.block, 1);
    if (P.entrance && L === 0) paint(P.entrance.block, 1);
    if (useShell) for (const s of shells) paint(s, 1);
    const stack = [];
    const seed = (r) => { const i = Math.floor(((r[0] + r[2]) / 2 - x0) / C), j = Math.floor(((r[1] + r[3]) / 2 - z0) / C); if (!(grid[j * W + i] & 1)) stack.push(j * W + i); };
    for (const r of spaces) seed(r);
    const leaks = [];
    while (stack.length) {
      const k = stack.pop();
      if (grid[k] & 5) continue;
      if (!(grid[k] & 2)) { leaks.push(k); grid[k] |= 4; continue; }
      grid[k] |= 4;
      const i = k % W, j = (k - i) / W;
      if (i > 0) stack.push(k - 1);
      if (i < W - 1) stack.push(k + 1);
      if (j > 0) stack.push(k - W);
      if (j < H - 1) stack.push(k + W);
    }
    // 가까운 새는 칸끼리 묶기
    const groups = [];
    for (const k of leaks) {
      const x = x0 + ((k % W) + 0.5) * C, z = z0 + (Math.floor(k / W) + 0.5) * C;
      const g = groups.find((q) => Math.abs(q.x - x) < 1.2 && Math.abs(q.z - z) < 1.2);
      if (g) { g.n++; g.xa = Math.min(g.xa, x); g.xb = Math.max(g.xb, x); g.za = Math.min(g.za, z); g.zb = Math.max(g.zb, z); } else groups.push({ x, z, n: 1, xa: x, xb: x, za: z, zb: z });
    }
    for (const g of groups) out.push({ plan: name, L, x: +((g.xa + g.xb) / 2).toFixed(2), z: +((g.za + g.zb) / 2).toFixed(2), width: +(Math.max(g.xb - g.xa, g.zb - g.za) + C).toFixed(2) });
  }
  return out;
}

if (process.argv[1].endsWith('audit-gaps.mjs')) {
  const all = [...findGaps(site.main, buildingShells(), '본관'), ...findGaps(site.annex, annexWalls(), '신관')];
  console.log(`외벽 셸 ${useShell ? '포함' : '제외'}: 새는 자리 ${all.length}곳`);
  for (const g of all) console.log(`${g.plan} ${g.L + 1}층  x ${g.x}  z ${g.z}  폭 ${g.width} m`);
}
