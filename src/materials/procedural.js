import { makeNoise, generate, toMaps, hash2, hexRGB } from './texgen.js';
import { PALETTE } from '../config.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// 벽돌 1024² (2m × 2m 타일): 줄눈, 벽돌별 색 변화, 세로 물자국, 때 얼룩. 높이 → 법선, 거칠기
export function brickMaps(seed = 1, size = 1024) {
  const N = makeNoise(seed);
  const courses = 24;
  const perRow = 8;
  const ch = size / courses;
  const bw = size / perRow;
  const mortar = 0.11; // 비율
  const [br, bg, bb] = hexRGB(PALETTE.brick).map((c, i) => c * [0.97, 0.95, 0.97][i]);
  const [mr, mg, mb] = hexRGB(PALETTE.mortar);
  const gen = generate(size, (x, y, u, v, o) => {
    const row = Math.floor(y / ch);
    const off = (row % 2) * bw * 0.5;
    const bx = Math.floor((x + off) / bw);
    const lx = ((x + off) % bw) / bw;
    const ly = (y % ch) / ch;
    const mx = Math.min(lx, 1 - lx) * bw / ch; // 가로 줄눈 거리를 세로 단위로 환산
    const my = Math.min(ly, 1 - ly);
    const edge = Math.min(mx, my);
    const isMortar = edge < mortar * 0.5;
    const id = hash2((bx % perRow + perRow) % perRow, row, seed);
    const id2 = hash2(row, (bx % perRow + perRow) % perRow, seed + 3);
    const fine = N.fbm(u, v, 64, 3);
    const grime = N.fbm(u, v, 4, 4);
    const streak = N.aniso(u, v, 48, 3) * 0.6 + N.aniso(u, v, 96, 5) * 0.4;
    const streakDark = sstep(0.55, 0.85, streak) * 0.35;
    let r, g, b, h, rough;
    if (isMortar) {
      const k = 0.85 + fine * 0.3;
      r = mr * k; g = mg * k; b = mb * k;
      h = 0.25 + fine * 0.1;
      rough = 0.95;
    } else {
      let k = 0.82 + id * 0.3;
      if (id2 < 0.07) k *= 0.72; // 가끔 짙은 벽돌
      const warm = (id2 - 0.5) * 18;
      const speck = fine > 0.68 ? 0.85 : 1;
      r = (br + warm) * k * speck; g = bg * k * speck; b = (bb - warm * 0.5) * k * speck;
      h = 0.75 + sstep(0, mortar * 1.4, edge) * 0.2 + fine * 0.08;
      rough = 0.82 + fine * 0.12;
    }
    const dirt = 1 - streakDark - sstep(0.5, 0.8, grime) * 0.22;
    o.r = r * dirt; o.g = g * dirt; o.b = b * dirt * 0.97;
    o.h = h;
    o.rough = clamp01(rough - streakDark * 0.5);
  });
  return toMaps(gen, 2.2);
}

// 헤링본 포장 1024² (4m 타일, 벽돌 0.2×0.1m). 군데군데 베이지·갈색 색 타일.
export function pavingMaps(seed = 4, size = 1024) {
  const N = makeNoise(seed);
  const P = 40; // 0.1m 단위 주기
  const s = size / P;
  const gap = 0.07;
  const cols = [[0x7d, 0x4f, 0x3e], [0x86, 0x58, 0x44], [0x6e, 0x44, 0x36], [0xb3, 0x98, 0x76], [0x4c, 0x34, 0x28]];
  const gen = generate(size, (x, y, u, v, o) => {
    const U = x / s;
    const V = y / s;
    const k = Math.floor(V);
    const m4 = (a) => ((a % 4) + 4) % 4;
    let lx, ly, id, w, hgt;
    if (m4(U - k) < 2) {
      lx = m4(U - k); ly = V - k; w = 2; hgt = 1;
      id = hash2(((Math.floor(U - m4(U - k) + 0.5) % P) + P) % P, ((k % P) + P) % P, seed);
    } else {
      const fu = Math.floor(U);
      const t = m4(fu - (k - 2)) === 0 ? k - 2 : k - 1;
      lx = U - fu; ly = V - (t + 1); w = 1; hgt = 2;
      id = hash2(((fu % P) + P) % P, ((t % P) + P) % P, seed + 9);
    }
    const ex = Math.min(lx, w - lx);
    const ey = Math.min(ly, hgt - ly);
    const edge = Math.min(ex, ey);
    const fine = N.fbm(u, v, 128, 2);
    const blot = N.fbm(u, v, 8, 4);
    const c = cols[id < 0.45 ? 0 : id < 0.76 ? 1 : id < 0.9 ? 2 : id < 0.955 ? 3 : 4];
    if (edge < gap * 0.5) {
      const kk = 0.35 + fine * 0.2;
      o.r = 70 * kk; o.g = 66 * kk; o.b = 60 * kk;
      o.h = 0.2;
      o.rough = 0.9;
    } else {
      const kk = (0.85 + hash2(Math.floor(id * 1e6), 1) * 0.25) * (0.9 + fine * 0.2) * (1 - sstep(0.55, 0.85, blot) * 0.25);
      o.r = c[0] * kk; o.g = c[1] * kk; o.b = c[2] * kk;
      o.h = 0.7 + sstep(0, 0.12, edge) * 0.25 + fine * 0.05;
      o.rough = 0.35 + N.fbm(u, v, 16, 3) * 0.25; // 0.35 ~ 0.6
    }
  });
  return toMaps(gen, 2.5);
}

// 범용 노이즈 표면 (콘크리트, 아스팔트, 잔디, 자갈, 화강암, 생울타리, 도장 패널 때)
export function noiseMaps(kind, size = 512) {
  const N = makeNoise(kind.length * 13 + 5);
  const presets = {
    concrete: { c: [0x74, 0x73, 0x6f], var: 0.22, base: 8, rough: [0.8, 0.95], nstr: 1.2, joints: 4 },
    asphalt: { c: [0x26, 0x27, 0x29], var: 0.35, base: 32, rough: [0.65, 0.9], nstr: 2.2, speck: 0.12 },
    grass: { c: [0x24, 0x33, 0x1a], var: 0.5, base: 32, rough: [0.9, 1], nstr: 3 },
    gravel: { c: [0x5e, 0x59, 0x52], var: 0.45, base: 64, rough: [0.85, 1], nstr: 3.5, speck: 0.3 },
    granite: { c: [0x92, 0x92, 0x90], var: 0.25, base: 64, rough: [0.35, 0.55], nstr: 0.6, speck: 0.25 },
    hedge: { c: [0x1d, 0x30, 0x18], var: 0.7, base: 24, rough: [0.85, 1], nstr: 4 },
    panel: { c: [0xff, 0xff, 0xff], var: 0.18, base: 4, rough: [0.45, 0.7], nstr: 0.3, streak: true },
    shop: { c: [0x30, 0x2f, 0x30], var: 0.3, base: 4, rough: [0.8, 0.95], nstr: 1 },
  };
  const p = presets[kind];
  const gen = generate(size, (x, y, u, v, o) => {
    const f = N.fbm(u, v, p.base, 4);
    const big = N.fbm(u, v, 3, 3);
    let k = 1 - p.var / 2 + f * p.var - sstep(0.55, 0.85, big) * 0.15;
    let h = f;
    if (p.speck) {
      const sp = hash2(x, y, 3);
      if (sp < p.speck * 0.3) k *= 0.6;
      else if (sp > 1 - p.speck * 0.2) k *= 1.35;
      h += (sp - 0.5) * 0.15;
    }
    if (p.streak) {
      const st = N.aniso(u, v, 40, 2);
      k -= sstep(0.6, 0.9, st) * 0.25;
    }
    if (p.joints) {
      const jx = (u * p.joints) % 1;
      const jy = (v * p.joints * 0.5) % 1;
      if (Math.min(jx, 1 - jx) < 0.004 || Math.min(jy, 1 - jy) < 0.006) {
        k *= 0.7;
        h -= 0.3;
      }
      // 거푸집 구멍
      const hx = (u * p.joints * 2) % 1;
      const hy = (v * p.joints) % 1;
      if (Math.hypot(hx - 0.5, hy - 0.5) < 0.025) { k *= 0.55; h -= 0.4; }
    }
    o.r = p.c[0] * k; o.g = p.c[1] * k; o.b = p.c[2] * k;
    o.h = h;
    o.rough = p.rough[0] + (p.rough[1] - p.rough[0]) * f;
  });
  return toMaps(gen, p.nstr);
}

// 나무껍질 512²: 세로로 갈라진 홈과 융기. 높이 → 법선, 홈은 더 거칠다.
export function barkMaps(seed = 31, size = 512) {
  const N = makeNoise(seed);
  const gen = generate(size, (x, y, u, v, o) => {
    const ridge = N.aniso(u, v, 12, 2) * 0.6 + N.aniso(u, v, 34, 5) * 0.4;
    const f = N.fbm(u, v, 16, 3);
    const crest = sstep(0.38, 0.6, ridge);
    const k = 0.5 + crest * 0.55 + f * 0.3;
    o.r = 0x4c * k;
    o.g = 0x3b * k;
    o.b = 0x2e * k;
    o.h = 0.25 + crest * 0.6 + f * 0.12;
    o.rough = 0.82 + (1 - crest) * 0.15;
  });
  return toMaps(gen, 3.2);
}
