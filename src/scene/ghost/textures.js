// 귀신 모델 절차 텍스처: 교복 재킷·소매·바지(젖은 얼룩·먼지), 피부(얼룩덜룩한 잿빛), 눈(뿌옇게 흐린 눈동자), 젖은 머리카락 다발.
// 외부 이미지 없이 픽셀 함수로 만든다 (texgen). 처음 한 번만 만들고 모든 귀신이 나눠 쓴다.
import * as THREE from 'three';
import { makeNoise, generate, toMaps, canvasTexture } from '../../materials/texgen.js';
import { smooth } from './loft.js';

const N = makeNoise(41);
const lerp = (a, b, t) => a + (b - a) * t;
let cache = null;

// 남색 모직 + 젖은 얼룩(짙고 덜 거칠다) + 아래쪽 먼지
function fabric(u, v, o, base, wetAt = 0.55) {
  const weave = (Math.sin(u * 900) * Math.sin(v * 900)) * 0.5 + 0.5;
  const n = N.fbm(u, v, 8, 4);
  const wet = smooth(wetAt, wetAt + 0.12, N.fbm(u + 0.3, v * 0.8 + 0.1, 3, 4));
  const dirt = smooth(0.35, 0, v) * smooth(0.45, 0.6, N.fbm(u * 2, v, 6, 3));
  let k = (0.82 + 0.3 * n) * (1 - 0.45 * wet);
  o.r = base[0] * k + dirt * 22;
  o.g = base[1] * k + dirt * 20;
  o.b = base[2] * k + dirt * 16;
  o.h = 0.5 + 0.04 * weave + 0.2 * N.fbm(u, v * 3, 4, 3);
  o.rough = lerp(0.85, 0.4, wet);
  return wet;
}

// 재킷 몸판: u = 둘레(0.25 = 정면), v = 아래(0) → 위(1)
function jacket() {
  const navy = [27, 33, 50];
  return toMaps(generate(512, (x, y, u, v0, o) => {
    const v = 1 - v0;
    fabric(u, v, o, navy);
    const du = u - 0.25;
    const vHalf = lerp(0.005, 0.034, smooth(0.5, 0.95, v)) * (v > 0.5 ? 1 : 0);
    // 앞 여밈: V 자 사이로 셔츠·넥타이
    if (Math.abs(du) < vHalf) {
      const dirty = N.fbm(u * 3, v * 2, 5, 3);
      const sh = 112 + 34 * dirty;
      o.r = sh * 0.95; o.g = sh * 0.97; o.b = sh * 0.92;
      o.h = 0.4; o.rough = 0.6;
      if (Math.abs(du) < 0.009 * (0.6 + 0.4 * smooth(0.5, 0.9, v))) { o.r = 22; o.g = 24; o.b = 34; o.h = 0.55; } // 넥타이
    } else if (Math.abs(Math.abs(du) - vHalf) < 0.004 && v > 0.5) {
      o.r *= 1.5; o.g *= 1.5; o.b *= 1.5; o.h = 0.95; // 깃 가장자리
    }
    // 여밈 선·단추 2개
    if (v <= 0.5 && Math.abs(du) < 0.0025) { o.r *= 0.5; o.g *= 0.5; o.b *= 0.5; o.h = 0.2; }
    for (const bv of [0.42, 0.26]) {
      const d = Math.hypot((du + 0.008) * 2.2, v - bv);
      if (d < 0.012) { o.r = 40; o.g = 44; o.b = 56; o.h = 1 - d * 30; }
    }
    // 아래 주머니 덮개 2개, 오른쪽 가슴 빈 이름표
    for (const pu of [0.15, 0.35]) if (Math.abs(u - pu) < 0.05 && Math.abs(v - 0.2) < 0.004) { o.r *= 0.4; o.g *= 0.4; o.b *= 0.4; o.h = 0.2; }
    if (Math.abs(u - 0.19) < 0.022 && Math.abs(v - 0.74) < 0.016) { o.r = 92; o.g = 96; o.b = 100; o.h = 0.7; o.rough = 0.5; }
    // 허리 주름
    o.h += 0.06 * Math.sin(v * 60 + N.noise(u * 20, v * 4, 20) * 4) * smooth(0.45, 0.3, Math.abs(v - 0.3));
  }), 1.6);
}

// 소매: 끝(v=1)에 셔츠 소맷부리가 조금 보인다
function sleeve() {
  const navy = [26, 32, 48];
  return toMaps(generate(256, (x, y, u, v0, o) => {
    const v = 1 - v0;
    fabric(u, v + 0.3, o, navy, 0.5);
    o.h += 0.08 * Math.sin(v * 40 + 3 * N.noise(u * 8, v * 3, 8)) * smooth(0.3, 0.1, Math.abs(v - 0.45)); // 팔꿈치 주름
    if (v > 0.955) { const s = 140 + 30 * N.fbm(u, v, 6, 2); o.r = s; o.g = s * 1.01; o.b = s * 0.95; o.h = 0.6; o.rough = 0.6; }
  }), 1.6);
}

// 바지: 앞 주름선, 아래쪽이 젖어 짙음
function trousers() {
  const navy = [20, 25, 38];
  return toMaps(generate(256, (x, y, u, v0, o) => {
    const v = 1 - v0;
    fabric(u, 1 - v, o, navy, lerp(0.35, 0.65, v));
    if (Math.abs(u - 0.25) < 0.004) { o.r *= 1.3; o.g *= 1.3; o.b *= 1.3; o.h = 0.9; }
    o.h += 0.06 * Math.sin(v * 50 + 4 * N.noise(u * 6, v * 5, 6)) * smooth(0.2, 0, Math.abs(v - 0.33));
  }), 1.6);
}

// 피부: 핏기 없는 잿빛, 푸르스름한 얼룩과 아주 옅은 핏줄 자국 (피가 아니라 탁한 회청색)
function skin() {
  return toMaps(generate(256, (x, y, u, v, o) => {
    const n = N.fbm(u, v, 4, 4);
    const blot = smooth(0.55, 0.75, N.fbm(u + 0.5, v + 0.2, 2, 3));
    const vein = smooth(0.035, 0, Math.abs(N.fbm(u * 2, v * 2, 4, 4) - 0.5)) * 0.5;
    const k = 0.95 + 0.08 * n;
    o.r = (176 - 30 * blot - 26 * vein) * k;
    o.g = (182 - 22 * blot - 18 * vein) * k;
    o.b = (178 - 6 * blot + 4 * vein) * k;
    o.h = 0.5 + 0.12 * N.fbm(u, v, 24, 3);
    o.rough = 0.42 + 0.2 * n; // 축축해 약간 번들거린다
  }), 1.2);
}

// 눈: 노랗게 탁한 흰자 + 뿌옇게 흐린 회색 눈동자 + 작은 동공. 정면(+z)은 u = 0.25, v = 0.5
function eye() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#a9a796';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(110,96,96,0.5)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 26; i++) { // 흰자의 탁한 실핏줄 (회갈색)
    const a = (i / 26) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 50);
    g.quadraticCurveTo(64 + Math.cos(a + 0.3) * 40, 64 + Math.sin(a + 0.3) * 30, 64 + Math.cos(a) * 22, 64 + Math.sin(a) * 20);
    g.stroke();
  }
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 22);
  r.addColorStop(0, '#0e0f10');
  r.addColorStop(0.1, '#1d2021');
  r.addColorStop(0.16, '#b9bfbf');
  r.addColorStop(0.7, '#c9cdcb');
  r.addColorStop(0.9, '#7c8384');
  r.addColorStop(1, 'rgba(169,167,150,0)');
  g.fillStyle = r;
  g.beginPath();
  g.ellipse(64, 64, 24, 46, 0, 0, Math.PI * 2);
  g.fill();
  return canvasTexture(c, true, 4);
}

// 머리카락 다발 한 장: 가는 세로 줄 여러 개(알파), 끝으로 갈수록 가늘고 듬성듬성
function hair() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = 2 + Math.random() * 60;
    const end = 256 * (0.7 + Math.random() * 0.3);
    const a = 0.55 + Math.random() * 0.45;
    const grad = g.createLinearGradient(0, 0, 0, end);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.8, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad;
    g.lineWidth = 1 + Math.random() * 2.2;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 8, end / 2, x + (Math.random() - 0.5) * 14, end);
    g.stroke();
  }
  const t = canvasTexture(c, false, 4);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function ghostTextures() {
  if (!cache) cache = { jacket: jacket(), sleeve: sleeve(), trousers: trousers(), skin: skin(), eye: eye(), hair: hair() };
  return cache;
}
