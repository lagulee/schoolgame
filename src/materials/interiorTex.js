// 본관 실내 텍스처 (단계 8). 모두 코드로 그린다 (외부 에셋 없음). 글자는 쓰지 않는다 (게시물·칠판은 선과 얼룩만).
import * as THREE from 'three';
import { makeNoise, generate, toMaps, hash2, canvasTexture } from './texgen.js';
import { rng } from '../world/geom.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 테라조(인조석) 복도 바닥: 밝은 회색 바탕 + 색 돌 조각, 반들반들 (2 m 반복)
export function terrazzoMaps(size = 512) {
  const N = makeNoise(41);
  const gen = generate(size, (x, y, u, v, o) => {
    const f = N.fbm(u, v, 8, 4);
    const big = N.fbm(u, v, 2, 2);
    let r = 150;
    let g = 150;
    let b = 146;
    const k = 0.9 + f * 0.18 - sstep(0.55, 0.85, big) * 0.1;
    const chip = hash2(x >> 1, y >> 1, 9);
    if (chip < 0.05) [r, g, b] = [70, 72, 70];
    else if (chip > 0.965) [r, g, b] = [196, 190, 176];
    else if (chip > 0.95) [r, g, b] = [120, 96, 80];
    // 줄눈 (1 m 격자)
    const jx = (u * 2) % 1;
    const jy = (v * 2) % 1;
    const joint = Math.min(jx, 1 - jx) < 0.003 || Math.min(jy, 1 - jy) < 0.003;
    const kk = joint ? k * 0.55 : k;
    o.r = r * kk;
    o.g = g * kk;
    o.b = b * kk;
    o.h = joint ? 0.2 : 0.5 + (chip - 0.5) * 0.05;
    o.rough = 0.28 + f * 0.25 + (joint ? 0.4 : 0);
  });
  return toMaps(gen, 0.6);
}

// 교실 나무 바닥: 2 m 에 판 8장 (u 방향), 판마다 색·결이 다르다
export function woodFloorMaps(size = 512) {
  const N = makeNoise(17);
  const gen = generate(size, (x, y, u, v, o) => {
    const plank = Math.floor(u * 8);
    const pu = (u * 8) % 1;
    const off = hash2(plank, 3, 5);
    const pv = (v + off) % 1;
    const seam = pu < 0.02 || pu > 0.98 || Math.abs(((pv * 2) % 1) - 0.5) > 0.495;
    const tone = 0.78 + hash2(plank, Math.floor(pv * 2), 11) * 0.3;
    const grain = N.aniso(u, v, 64, 4) * 0.25 + N.fbm(u, v, 16, 3) * 0.15;
    const k = (seam ? 0.45 : 1) * tone * (0.85 + grain);
    o.r = 120 * k;
    o.g = 86 * k;
    o.b = 58 * k;
    o.h = seam ? 0.1 : 0.5 + grain * 0.2;
    o.rough = seam ? 0.95 : 0.55 + grain * 0.3;
  });
  return toMaps(gen, 1.2);
}

// 벽 도장: 거의 흰 미색, 약한 얼룩 (2 m 반복)
export function plasterMaps(size = 256) {
  const N = makeNoise(23);
  const gen = generate(size, (x, y, u, v, o) => {
    const f = N.fbm(u, v, 6, 4);
    const k = 0.94 + f * 0.08;
    o.r = 214 * k;
    o.g = 208 * k;
    o.b = 192 * k;
    o.h = f;
    o.rough = 0.8 + f * 0.15;
  });
  return toMaps(gen, 0.4);
}

// 텍스 천장: 0.6 m 판 2×2 (1.2 m 반복), 판 이음매 + 작은 구멍 무늬
export function ceilingTexture() {
  const S = 256;
  const [c, x] = canvas(S, S);
  x.fillStyle = '#d9d6cc';
  x.fillRect(0, 0, S, S);
  const R = rng(5);
  x.fillStyle = 'rgba(60,58,52,0.35)';
  for (let i = 0; i < 900; i++) x.fillRect(R() * S, R() * S, 1.4, 1.4);
  x.fillStyle = '#8f8b82';
  for (const p of [0, S / 2]) {
    x.fillRect(p, 0, 2, S);
    x.fillRect(0, p, S, 2);
  }
  return canvasTexture(c, true);
}

// 교실 미닫이 문: 미색 문틀, 위쪽 유리 2칸(어두운 복도·교실이 비침), 아래 판
export function classDoorTexture() {
  const W = 128;
  const H = 256;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#b9b19c';
  x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, H * 0.5);
  g.addColorStop(0, '#1d2630');
  g.addColorStop(1, '#0a0d11');
  x.fillStyle = g;
  x.fillRect(W * 0.14, H * 0.07, W * 0.72, H * 0.17);
  x.fillRect(W * 0.14, H * 0.27, W * 0.72, H * 0.17);
  x.fillStyle = 'rgba(255,255,255,0.08)';
  x.fillRect(W * 0.18, H * 0.08, W * 0.12, H * 0.34);
  x.strokeStyle = '#7d766a';
  x.lineWidth = 3;
  x.strokeRect(W * 0.12, H * 0.54, W * 0.76, H * 0.36);
  x.fillStyle = '#4a4740';
  x.fillRect(W * 0.8, H * 0.5, W * 0.06, H * 0.08); // 손잡이 홈
  return canvasTexture(c, true);
}

// 실내 쪽 창: 회색 알루미늄 미닫이 4칸, 밤 유리 (위쪽이 조금 밝고 먼 불빛 몇 점)
export function innerWindowTexture() {
  const W = 256;
  const H = 336;
  const [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a4a66');
  g.addColorStop(0.55, '#1a2232');
  g.addColorStop(1, '#0b0e15');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const R = rng(13);
  for (let i = 0; i < 6; i++) {
    x.fillStyle = `rgba(255,${190 + R() * 40},140,${0.3 + R() * 0.4})`;
    x.fillRect(R() * W, H * (0.55 + R() * 0.3), 2, 2);
  }
  x.fillStyle = '#6f757b';
  const f = 10;
  x.fillRect(0, 0, W, f);
  x.fillRect(0, H - f, W, f);
  x.fillRect(0, 0, f, H);
  x.fillRect(W - f, 0, f, H);
  x.fillRect(W / 2 - 4, 0, 8, H);
  x.fillRect(0, H * 0.62, W, 6);
  return canvasTexture(c, true);
}

// 칠판: 짙은 초록 + 분필 가루 얼룩 (글자 없음)
export function blackboardTexture() {
  const W = 512;
  const H = 160;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#1f3a2c';
  x.fillRect(0, 0, W, H);
  const R = rng(3);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(220,230,220,${0.02 + R() * 0.05})`;
    x.beginPath();
    x.ellipse(R() * W, R() * H, 20 + R() * 60, 6 + R() * 18, R() * 3, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = 'rgba(230,235,225,0.18)';
  x.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    x.beginPath();
    const y = H * (0.2 + R() * 0.6);
    x.moveTo(W * (0.1 + R() * 0.5), y);
    x.lineTo(W * (0.3 + R() * 0.6), y + (R() - 0.5) * 8);
    x.stroke();
  }
  return canvasTexture(c, true);
}

// 게시판: 코르크 바탕 + 붙은 종이 몇 장 (글자 대신 회색 줄)
export function noticeTexture(seed = 7) {
  const W = 256;
  const H = 192;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#7a5a3a';
  x.fillRect(0, 0, W, H);
  const R = rng(seed);
  for (let i = 0; i < 500; i++) {
    x.fillStyle = `rgba(40,25,10,${R() * 0.3})`;
    x.fillRect(R() * W, R() * H, 2, 2);
  }
  for (let i = 0; i < 6; i++) {
    const w = 40 + R() * 50;
    const h = 30 + R() * 50;
    const px = R() * (W - w);
    const py = R() * (H - h);
    x.fillStyle = ['#e8e4d8', '#d8dfe6', '#efe3c0', '#e6d0d0'][i % 4];
    x.fillRect(px, py, w, h);
    x.fillStyle = 'rgba(80,80,80,0.35)';
    for (let l = py + 8; l < py + h - 6; l += 7) x.fillRect(px + 5, l, w * (0.5 + R() * 0.4), 2);
  }
  x.strokeStyle = '#4b3a28';
  x.lineWidth = 8;
  x.strokeRect(0, 0, W, H);
  return canvasTexture(c, true);
}

// 비상구 유도등: 초록 바탕 + 흰 달리는 사람 + 문 (그림만, 글자 없음)
export function exitSignTexture() {
  const W = 256;
  const H = 100;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#18c060';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#f4fff6';
  x.fillRect(W * 0.62, H * 0.14, W * 0.22, H * 0.72); // 문
  x.fillStyle = '#18c060';
  x.fillRect(W * 0.66, H * 0.2, W * 0.14, H * 0.6);
  x.strokeStyle = '#f4fff6';
  x.lineCap = 'round';
  x.lineWidth = 9;
  const P = (a, b) => [W * a, H * b];
  x.beginPath();
  x.arc(...P(0.42, 0.22), 9, 0, Math.PI * 2);
  x.fillStyle = '#f4fff6';
  x.fill();
  for (const seg of [[[0.4, 0.33], [0.36, 0.58]], [[0.36, 0.58], [0.27, 0.82]], [[0.36, 0.58], [0.46, 0.7]], [[0.46, 0.7], [0.48, 0.86]], [[0.39, 0.38], [0.5, 0.48]], [[0.39, 0.38], [0.28, 0.46]]]) {
    x.beginPath();
    x.moveTo(...P(...seg[0]));
    x.lineTo(...P(...seg[1]));
    x.stroke();
  }
  // 화살표
  x.beginPath();
  x.moveTo(...P(0.08, 0.5));
  x.lineTo(...P(0.2, 0.5));
  x.moveTo(...P(0.08, 0.5));
  x.lineTo(...P(0.13, 0.36));
  x.moveTo(...P(0.08, 0.5));
  x.lineTo(...P(0.13, 0.64));
  x.stroke();
  return canvasTexture(c, true);
}

// 사물함 한 칸 (폭 1칸 × 높이 4칸): 회색 철판, 손잡이, 환기 구멍
export function lockerTexture() {
  const W = 64;
  const H = 256;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#8a9096';
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const y = (H / 4) * i;
    x.fillStyle = '#5e6469';
    x.fillRect(0, y, W, 2);
    x.fillRect(0, y, 2, H / 4);
    x.fillStyle = '#3a3e42';
    x.fillRect(W * 0.72, y + H * 0.1, 5, 14);
    x.fillStyle = 'rgba(30,30,30,0.6)';
    for (let k = 0; k < 3; k++) x.fillRect(W * 0.2, y + 10 + k * 5, W * 0.4, 2);
  }
  return canvasTexture(c, true);
}

// 난간 살: 세로 철봉이 12 cm 마다 (알파 마스크, 반복)
export function railBarsTexture() {
  const [c, x] = canvas(32, 8);
  x.fillStyle = '#000';
  x.fillRect(0, 0, 32, 8);
  x.fillStyle = '#fff';
  x.fillRect(13, 0, 6, 8);
  const t = canvasTexture(c, false, 4);
  return t;
}

// 출입문 홀 유리문 안쪽: 뿌연 유리 너머 필로티의 초록 번짐
export function frostedTexture() {
  const W = 128;
  const H = 128;
  const [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, '#1d4a32');
  g.addColorStop(0.5, '#0f2219');
  g.addColorStop(1, '#070b0c');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const R = rng(19);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(255,255,255,${R() * 0.04})`;
    x.fillRect(R() * W, R() * H, 2, 2);
  }
  return canvasTexture(c, true);
}

// 창가 바닥 달빛: 창 쪽(v = 1)에서 방 안쪽으로 옅어지고 좌우 끝이 부드러운 알파 마스크
export function windowGlowTexture() {
  const W = 64;
  const [c, x] = canvas(W, W);
  const img = x.createImageData(W, W);
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const v = 1 - (j + 0.5) / W; // 캔버스 위 = v 1
      const a = Math.pow(v, 1.6) * sstep(0, 0.22, u) * sstep(1, 0.78, u);
      const k = (j * W + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(a * 255);
      img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = canvasTexture(c, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
