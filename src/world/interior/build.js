// 실내 구조 그리기 (단계 8 본관, 단계 9 신관): plan.js 결과 → 바닥·천장·벽·난간·기둥·계단·창·유리벽·복도 소품·유도등.
// 묶음 이름은 P.g 앞머리 + 층 (본관 L0…, 신관 AL0…).
// 정적 면은 Batch 로 층·재질별 메시 하나씩, 반복되는 작은 것(창·유도등·소화기)은 인스턴싱.
// 잠긴 방은 안이 보이지 않으므로(문·창이 불투명) 바닥·천장·창을 만들지 않는다. 벽은 복도 쪽 면 때문에 만든다.
import * as THREE from 'three';
import { DIM, INTERIOR, ANNEX } from '../../config.js';
import { instanced, mat4 } from '../geom.js';
import { yAt, ceilAt } from './plan.js';
import { SIDE } from './rects.js';

const ry = ([nx, nz]) => Math.atan2(nx, nz);

export function buildStructure(P, batch, MI) {
  const top = P.top;
  const roof = ceilAt(top, top);
  const G = (L) => `${P.g}L${Math.floor(L)}`;
  const SH = `${P.g}shaft`;
  const shown = (sp) => sp.hall || sp.enter;
  const spaceOf = (id, L) => P.spaces.find((s) => s.id === id && s.L === L);

  for (const f of P.floors) {
    const sp = P.spaces.find((s) => s.L === f.L && s.rect === f.rect);
    if (shown(sp)) batch.floor(G(f.L), f.mat, f.rect, f.y, true);
  }
  for (const c of P.ceilings) {
    const sp = P.spaces.find((s) => s.L === c.L && s.rect === c.rect);
    if (shown(sp)) batch.floor(G(c.L), 'ceiling', c.rect, c.y, false);
  }
  for (const w of P.walls) {
    const [x0, z0, x1, z1] = w.rect;
    const ground = w.L === 0 && w.y0 <= yAt(0) + 1e-6; // 1층 바닥에서 서는 벽은 땅까지 (바닥 슬래브 옆면 가림). 문 위 벽은 그대로
    batch.box(G(w.L), w.mat, x0, ground ? 0 : w.y0, z0, x1, w.y1, z1, ground ? 'nsew' : 'nsewb');
  }
  // 중정 쪽 슬래브 끝면 (중정을 향함)
  for (const e of P.edges) {
    const S = SIDE[e.side];
    const [x0, z0, x1, z1] = S.along === 'x' ? [e.a, e.at, e.b, e.at] : [e.at, e.a, e.at, e.b];
    const face = { n: 'n', s: 's', w: 'w', e: 'e' }[e.side];
    batch.box(G(e.L), 'concrete', x0, e.y0, z0, x1, e.y1, z1, face);
  }
  // 난간: 아래 턱 + 철봉 살(알파) + 손잡이 + 기둥
  const RL = INTERIOR.rail;
  for (const r of P.rails) {
    const [x0, z0, x1, z1] = r.rect;
    const y = r.y;
    batch.box(G(r.L), 'concrete', x0, y, z0, x1, y + 0.12, z1, 'tnsew');
    batch.box(G(r.L), 'railTop', x0 - 0.01, y + RL.h - 0.05, z0 - 0.01, x1 + 0.01, y + RL.h, z1 + 0.01);
    const alongX = SIDE[r.side].along === 'x';
    const mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const [a, b] = alongX ? [x0, x1] : [z0, z1];
    const pts = alongX ? [[a, y + 0.12, mid], [b, y + 0.12, mid], [b, y + RL.h - 0.05, mid], [a, y + RL.h - 0.05, mid]]
      : [[mid, y + 0.12, a], [mid, y + 0.12, b], [mid, y + RL.h - 0.05, b], [mid, y + RL.h - 0.05, a]];
    batch.quad(G(r.L), 'railBars', pts, alongX ? [0, 0, 1] : [1, 0, 0], (p) => [(alongX ? p[0] : p[2]) / 0.12, 0.5]);
    const n = Math.max(1, Math.round((b - a) / RL.post));
    for (let i = 1; i < n; i++) {
      const c = a + ((b - a) * i) / n;
      if (alongX) batch.box(G(r.L), 'railTop', c - 0.03, y + 0.12, z0, c + 0.03, y + RL.h - 0.05, z1, 'nsew');
      else batch.box(G(r.L), 'railTop', x0, y + 0.12, c - 0.03, x1, y + RL.h - 0.05, c + 0.03, 'nsew');
    }
  }
  for (const c of P.columns) {
    const [x0, z0, x1, z1] = c.rect;
    batch.box(SH, 'wall', x0, INTERIOR.courtyardFloor, z0, x1, roof, z1, 'nsew');
  }
  // 중정: 1층 화단 바닥 + 지붕 아래 천장 (본관만)
  if (P.court) {
    batch.floor(G(0), 'court', P.court, INTERIOR.courtyardFloor, true);
    batch.floor(SH, 'ceiling', P.court, roof, false);
  }
  for (const st of P.stairs) buildStair(st, batch, top, roof, P.g);

  // 유리벽 (출입문 홀 남쪽): 안쪽에서 본 뿌연 유리 + 틀
  for (const g of P.glass) {
    const S = SIDE[g.side];
    const at = g.at - S.out * 0.002;
    const pts = S.along === 'x' ? [[g.a, g.y0, at], [g.b, g.y0, at], [g.b, g.y1, at], [g.a, g.y1, at]] : [[at, g.y0, g.a], [at, g.y0, g.b], [at, g.y1, g.b], [at, g.y1, g.a]];
    const n = S.along === 'x' ? [0, 0, -S.out] : [-S.out, 0, 0];
    batch.quad(G(g.L), 'frosted', pts, n, (p) => [(S.along === 'x' ? p[0] - g.a : p[2] - g.a) / (g.b - g.a), (p[1] - g.y0) / (g.y1 - g.y0)]);
    for (let i = 0; i <= 4; i++) {
      const c = g.a + ((g.b - g.a) * i) / 4;
      if (S.along === 'x') batch.box(G(g.L), 'railTop', c - 0.045, g.y0, at - 0.06, c + 0.045, g.y1, at);
    }
    if (S.along === 'x') batch.box(G(g.L), 'railTop', g.a, g.y0 + 2.3, at - 0.06, g.b, g.y0 + 2.38, at);
  }

  // 창 (실내 쪽) + 창가 바닥의 희미한 빛 — 보이는 방만
  const W = DIM.window;
  const winM = [];
  const glowM = [];
  const D = INTERIOR.windowGlow.depth;
  for (const w of P.windows) {
    const sp = spaceOf(w.room, w.L);
    if (!shown(sp)) continue;
    const [nx, nz] = w.normal;
    winM.push(mat4(w.pos[0] + nx * 0.004, w.y, w.pos[1] + nz * 0.004, ry(w.normal), W.w, W.h, 1));
    glowM.push(mat4(w.pos[0] + (nx * D) / 2, yAt(w.L) + 0.012, w.pos[1] + (nz * D) / 2, ry(w.normal), W.w * 1.25, 1, D));
  }
  const extra = new THREE.Group();
  extra.name = 'interiorInstances';
  extra.add(instanced(new THREE.PlaneGeometry(1, 1), MI.window, winM, { cast: false }));
  const glow = instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MI.glow, glowM, { cast: false, receive: false }); // 바닥에 누운 면, v = 1 이 창 쪽
  glow.renderOrder = 1;
  extra.add(glow);

  buildProps(P, batch, MI, extra);
  return extra;
}

// ㄷ자 계단: 계단실 벽·칸막이(모든 층 한 번에), 층마다 계단 앞 슬래브·중간 계단참·계단 단
function buildStair(st, batch, top, roof, g = '') {
  const G = (L) => `${g}L${L}`;
  for (const [x0, z0, x1, z1] of st.walls) batch.box(`${g}shaft`, 'wall', x0, 0, z0, x1, roof, z1, 'nsew');
  const [dx0, dz0, dx1, dz1] = st.divider;
  batch.box(`${g}shaft`, 'wall', dx0, yAt(0), dz0, dx1, roof, dz1, 'nsew');
  const into = st.open === 'w' ? 'e' : 'w'; // 계단 앞 슬래브 끝면이 향하는 쪽 (계단 안)
  batch.floor(G(0), 'stair', st.inner, yAt(0), true);
  batch.floor(G(top), 'ceiling', st.rect, roof, false);
  for (let L = 1; L <= top; L++) {
    const [x0, z0, x1, z1] = st.near;
    const y = yAt(L);
    batch.box(G(L), 'stair', x0, y - INTERIOR.slab, z0, x1, y, z1, 't');
    batch.box(G(L), 'ceiling', x0, y - INTERIOR.slab, z0, x1, y, z1, 'b');
    batch.box(G(L), 'concrete', x0, y - INTERIOR.slab, z0, x1, y, z1, into);
  }
  for (let L = 0; L < top; L++) {
    const [x0, z0, x1, z1] = st.far;
    const y = yAt(L) + DIM.floorH / 2;
    batch.box(G(L), 'stair', x0, y - 0.2, z0, x1, y, z1, 't');
    batch.box(G(L), 'concrete', x0, y - 0.2, z0, x1, y, z1, 'bnsew');
  }
  for (const s of st.steps) {
    const [x0, z0, x1, z1] = s.rect;
    batch.box(G(s.L), 'stair', x0, s.top - 0.35, z0, x1, s.top, z1, 'tnsew');
    batch.box(G(s.L), 'concrete', x0, s.top - 0.35, z0, x1, s.top, z1, 'b');
  }
  // 1층 계단 밑 창고 벽, 맨 위층 오르는 줄 자리 난간
  const under = st.blocks.find((b) => b.kind === 'under').rect;
  const [ux0, ux1] = st.xr(st.U.near[1], st.U.near[1] + 0.12);
  batch.box(G(0), 'wall', ux0, yAt(0), under[1], ux1, yAt(1) - 0.35, under[3], 'nsew');
  const rail = st.blocks.find((b) => b.kind === 'rail').rect;
  const [rx0, rx1] = st.xr(st.U.near[1], st.U.near[1] + INTERIOR.rail.t);
  const y = yAt(top);
  batch.box(G(top), 'railTop', rx0, y, rail[1], rx1, y + INTERIOR.rail.h, rail[3]);
  // 방화셔터 (신관 2층 → 1층): 내려가는 줄 위끝을 바닥에서 위층 계단 밑까지 막는다. 셔터 살 + 위 셔터 상자
  const sh = st.blocks.find((b) => b.kind === 'shutter');
  if (!sh) return;
  const T = ANNEX.shutter;
  const [sx0, sx1] = st.xr(st.U.near[1] - 0.06, st.U.near[1]);
  const [, z0, , z1] = sh.rect;
  const y0 = yAt(sh.L);
  const y1 = Math.min(y0 + T.h, yAt(sh.L + 1) - 0.35);
  const face = st.open === 'w' ? 'w' : 'e'; // 계단 앞(복도) 쪽을 향한 면
  batch.box(G(sh.L), 'shutter', sx0, y0, z0, sx1, y1, z1, 'nsew', { local: true, tile: [z1 - z0, T.slat * 2] });
  batch.box(G(sh.L), 'metal', sx0 - 0.04, y1, z0, sx1 + 0.04, yAt(sh.L + 1) - 0.35, z1, `nsb${face}`);
}

// 복도 소품: 소화전함(+ 붉은 표시등), 사물함, 게시판, 소화기, 유도등
function buildProps(P, batch, MI, extra) {
  const lampM = [];
  const extM = [];
  const exitM = [];
  const S = INTERIOR.props;
  for (const p of P.props) {
    const [x0, z0, x1, z1] = p.rect;
    const g = `${P.g}L${p.L}`;
    if (p.type === 'hydrant') batch.box(g, 'hydrant', x0, p.y0, z0, x1, p.y1, z1);
    else if (p.type === 'locker') batch.box(g, 'locker', x0, p.y0, z0, x1, p.y1, z1, 'tnsew', { local: true, tile: [S.locker.cell, S.locker.h] });
    else if (p.type === 'board') batch.box(g, 'notice', x0, p.y0, z0, x1, p.y1, z1, 'nsew', { local: true, tile: [Math.max(x1 - x0, z1 - z0), p.y1 - p.y0] });
    else if (p.type === 'extinguisher') extM.push(mat4((x0 + x1) / 2, p.y0 + S.extinguisher.h / 2, (z0 + z1) / 2, 0, 1, 1, 1));
    else if (p.type === 'switchboard') batch.box(g, 'switchboard', x0, p.y0, z0, x1, p.y1, z1, 'tbnsew', { local: true, tile: [Math.max(x1 - x0, z1 - z0), p.y1 - p.y0] });
  }
  for (const s of P.signs) {
    const [x, z, y] = s.pos;
    if (s.kind === 'hydrant') lampM.push(mat4(x, y, z));
    else {
      const [nx, nz] = s.normal;
      const off = s.hang ? 0 : S.sign.d / 2 + 0.01;
      exitM.push(mat4(x + nx * off, y, z + nz * off, ry(s.normal), S.sign.w, S.sign.h, S.sign.d));
    }
  }
  const E = S.extinguisher;
  extra.add(instanced(new THREE.CylinderGeometry(E.r, E.r, E.h, 12), MI.extinguisher, extM));
  extra.add(instanced(new THREE.SphereGeometry(0.05, 10, 8), MI.lamp, lampM, { cast: false }));
  extra.add(instanced(new THREE.BoxGeometry(1, 1, 1), MI.exit, exitM, { cast: false }));
}
