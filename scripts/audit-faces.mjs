// 겹친 면 점검 (v1.28.9): 같은 평면에 같은 쪽을 보는 면이 겹치면 깊이가 같아 지지직거린다(z-fighting).
// 장면의 모든 메시에서 축에 나란한 삼각형을 모아, 같은 평면(TOL m 이내)에서 서로 겹치는 넓이를 메시 쌍별로 합쳐 보여 준다.
// 사용: npm run build && node scripts/audit-faces.mjs [--min=0.01] [--open=1]  (min = 보고할 최소 겹침 넓이 m², open = 문을 모두 연 상태)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const PORT = 4184;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && res()); setTimeout(res, 8000); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 160, height: 90 } });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto(`http://localhost:${PORT}/?shot=1&q=low&frames=1`);
await page.waitForFunction(() => window.__READY === true, null, { timeout: 240000 });
const result = await page.evaluate(({ TOL, MIN, OPEN }) => {
  const D = window.__DEBUG;
  if (OPEN) { // 문을 모두 연 상태 (미닫이 문짝이 벽 속으로, 연결문은 90°)
    for (const set of [D.interior.doors, D.interior.doorsA]) { for (const d of set.list) { d.f = 1; set.place(d); } set.mesh.instanceMatrix.needsUpdate = true; }
    D.interior.connector.set(true); D.interior.connectorA.set(true);
    D.interior.snap(D.player, D.camera);
  }
  const M4 = D.scene.matrixWorld.constructor;
  const tris = []; // [axis, sign, plane, ax, ay, bx, by, cx, cy, meshIndex]
  const meshes = [];
  const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const pathOf = (o) => { const p = []; for (let q = o; q && q.parent; q = q.parent) if (q.name) p.unshift(q.name); return p.join('/'); };
  D.scene.updateMatrixWorld(true);
  D.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (/ghost|silhouette/i.test(pathOf(o))) return; // 숨겨 둔 귀신 모델들은 같은 자리에 겹쳐 있다
    const mats = [o.material].flat();
    if (mats.every((m) => !m || m.visible === false || m.depthWrite === false || m.polygonOffset || m.isShaderMaterial)) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
    const inst = o.isInstancedMesh ? o.count : 1;
    const mi = meshes.length;
    const c = mats[0]?.color;
    meshes.push({ path: pathOf(o) || o.type, mat: `${mats[0]?.type?.replace('Mesh', '').replace('Material', '')}#${c ? c.getHexString() : ''}${mats[0]?.map ? '+map' : ''}`, pos: null, double: mats.some((m) => m?.side === 2) });
    const m = new M4();
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, m); m.premultiply(o.matrixWorld); } else m.copy(o.matrixWorld);
      const e = m.elements;
      for (const grp of groups) {
        const mat = mats[grp.materialIndex ?? 0];
        if (!mat || mat.visible === false || mat.depthWrite === false || mat.polygonOffset) continue;
        const end = Math.min(n, grp.start + grp.count);
        for (let i = grp.start; i + 3 <= end; i += 3) {
          for (let j = 0; j < 3; j++) {
            const a = idx ? idx.getX(i + j) : i + j;
            const x = pos.getX(a), y = pos.getY(a), z = pos.getZ(a);
            v[j][0] = e[0] * x + e[4] * y + e[8] * z + e[12];
            v[j][1] = e[1] * x + e[5] * y + e[9] * z + e[13];
            v[j][2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          }
          const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
          const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
          const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          const len = Math.hypot(nx, ny, nz);
          if (len < 2e-4) continue; // 넓이 1 cm² 미만
          const nn = [nx / len, ny / len, nz / len];
          const ax = Math.abs(nn[0]) > 0.9995 ? 0 : Math.abs(nn[1]) > 0.9995 ? 1 : Math.abs(nn[2]) > 0.9995 ? 2 : -1;
          if (ax < 0) continue;
          const p = (ax + 1) % 3, q = (ax + 2) % 3;
          tris.push([ax, mat.side === 2 ? 0 : Math.sign(nn[ax]), (v[0][ax] + v[1][ax] + v[2][ax]) / 3, v[0][p], v[0][q], v[1][p], v[1][q], v[2][p], v[2][q], mi]);
        }
      }
    }
  });
  // 버킷: 축 + 평면 좌표(TOL 격자). 이웃 칸도 본다
  const buckets = new Map();
  tris.forEach((t, i) => {
    const k = `${t[0]}|${Math.round(t[2] / TOL)}`;
    (buckets.get(k) ?? buckets.set(k, []).get(k)).push(i);
  });
  const area = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const clip = (subj, cl) => { // Sutherland–Hodgman (cl 은 반시계)
    let out = subj;
    for (let i = 0; i < cl.length && out.length; i++) {
      const A = cl[i], B = cl[(i + 1) % cl.length];
      const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= -1e-9;
      const inp = out; out = [];
      for (let j = 0; j < inp.length; j++) {
        const P = inp[j], Q = inp[(j + 1) % inp.length];
        const pi = inside(P), qi = inside(Q);
        if (pi) out.push(P);
        if (pi !== qi) {
          const d1 = (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]);
          const d2 = (B[0] - A[0]) * (Q[1] - A[1]) - (B[1] - A[1]) * (Q[0] - A[0]);
          const t = d1 / (d1 - d2);
          out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
        }
      }
    }
    return out;
  };
  const poly = (t) => { const P = [[t[3], t[4]], [t[5], t[6]], [t[7], t[8]]]; return area(P) < 0 ? P.reverse() : P; };
  const pairs = new Map();
  let checked = 0;
  for (const [k, list] of buckets) {
    const [ax, cell] = k.split('|').map(Number);
    const other = buckets.get(`${ax}|${cell + 1}`) ?? [];
    const all = list.concat(other);
    if (all.length < 2) continue;
    // 평면 안 x 로 정렬해 훑기
    const items = all.map((i) => { const t = tris[i]; return { i, t, x0: Math.min(t[3], t[5], t[7]), x1: Math.max(t[3], t[5], t[7]), y0: Math.min(t[4], t[6], t[8]), y1: Math.max(t[4], t[6], t[8]) }; }).sort((a, b) => a.x0 - b.x0);
    for (let a = 0; a < items.length; a++) {
      const A = items[a];
      for (let b = a + 1; b < items.length && items[b].x0 < A.x1 - 1e-4; b++) {
        const B = items[b];
        if (B.y0 >= A.y1 - 1e-4 || B.y1 <= A.y0 + 1e-4) continue;
        if (a >= list.length && b >= list.length) continue; // 이웃 칸끼리는 그 칸 차례에
        if (Math.abs(A.t[2] - B.t[2]) > TOL) continue;
        if (A.t[1] !== 0 && B.t[1] !== 0 && A.t[1] !== B.t[1]) continue; // 서로 등진 면은 한쪽만 보인다
        checked++;
        const ov = clip(poly(A.t), poly(B.t));
        const s = ov.length >= 3 ? Math.abs(area(ov)) : 0;
        if (s < 1e-4) continue;
        const m1 = Math.min(A.t[9], B.t[9]), m2 = Math.max(A.t[9], B.t[9]);
        const key = `${m1}|${m2}|${ax}`;
        const r = pairs.get(key) ?? pairs.set(key, { a: m1, b: m2, ax, area: 0, n: 0, gap: 0, at: null }).get(key);
        r.area += s; r.n++; r.gap = Math.max(r.gap, Math.abs(A.t[2] - B.t[2]));
        if (!r.at) { const c = [0, 0, 0]; c[ax] = A.t[2]; c[(ax + 1) % 3] = ov[0][0]; c[(ax + 2) % 3] = ov[0][1]; r.at = c.map((x) => +x.toFixed(2)); }
      }
    }
  }
  const out = [...pairs.values()].filter((r) => r.area >= MIN).sort((x, y) => y.area - x.area).map((r) => ({ ...r, area: +r.area.toFixed(3), gap: +(r.gap * 1000).toFixed(2), a: `${meshes[r.a].path} [${meshes[r.a].mat}]`, b: r.a === r.b ? '(같은 메시)' : `${meshes[r.b].path} [${meshes[r.b].mat}]`, axis: 'xyz'[r.ax] }));
  return { tris: tris.length, meshes: meshes.length, checked, out };
}, { TOL: 0.003, MIN: parseFloat(args.min ?? '0.01'), OPEN: args.open === '1' });
console.log(`메시 ${result.meshes}  축에 나란한 삼각형 ${result.tris}  비교 ${result.checked}  겹친 쌍 ${result.out.length}`);
for (const r of result.out) console.log(`${String(r.area).padStart(9)} m²  ${r.axis}면 ×${r.n}  틈 ${r.gap}mm  @${r.at}  ${r.a}  ↔  ${r.b}`);
await browser.close(); server.kill(); process.exit(0);
