import { canvasTexture } from './texgen.js';
import { rng } from '../world/geom.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// 격자창 유리: 흰 창살(세로 1, 가로 1) + 유리면 반사 그라데이션. kind: dark | curtain | lit
export function windowTexture(kind) {
  const W = 256;
  const H = 336;
  const [c, x] = canvas(W, H);
  const R = rng(kind.length * 7);
  if (kind === 'lit') {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#dff0ff');
    g.addColorStop(1, '#9fc4e6');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // 블라인드 살
    x.fillStyle = 'rgba(40,60,80,0.35)';
    for (let y = 6; y < H * 0.55; y += 11) x.fillRect(0, y, W, 4);
    // 형광등 줄
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.fillRect(W * 0.15, H * 0.62, W * 0.7, 6);
  } else {
    const g = x.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, '#2a3440');
    g.addColorStop(0.45, '#0b0f15');
    g.addColorStop(0.55, '#141b24');
    g.addColorStop(1, '#06080b');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // 대각 반사 줄
    x.fillStyle = 'rgba(160,180,210,0.06)';
    x.beginPath();
    x.moveTo(W * 0.1, H);
    x.lineTo(W * 0.35, H);
    x.lineTo(W * 0.9, 0);
    x.lineTo(W * 0.65, 0);
    x.fill();
    if (kind === 'curtain') {
      // 커튼 주름 실루엣 (한쪽에 모인 천)
      const side = R() < 0.5 ? 0 : 1;
      const cw = W * (0.3 + R() * 0.25);
      const x0 = side ? W - cw : 0;
      for (let i = 0; i < 12; i++) {
        const fx = x0 + (i / 12) * cw;
        x.fillStyle = i % 2 ? 'rgba(70,72,80,0.55)' : 'rgba(40,42,48,0.55)';
        x.fillRect(fx, 0, cw / 12 + 1, H);
      }
      // 반쯤 내린 블라인드
      x.fillStyle = 'rgba(80,84,90,0.5)';
      for (let y = 4; y < H * 0.3; y += 9) x.fillRect(0, y, W, 4);
    }
  }
  // 창살 (흰 프레임)
  x.fillStyle = '#e8ebee';
  x.fillRect(0, 0, W, 10);
  x.fillRect(0, H - 10, W, 10);
  x.fillRect(0, 0, 10, H);
  x.fillRect(W - 10, 0, 10, H);
  x.fillRect(W / 2 - 5, 0, 10, H);
  x.fillRect(0, H * 0.34, W, 9);
  return canvasTexture(c, true, 4);
}

// 서 있는 사람 실루엣 (알파)
export function silhouetteTexture() {
  const [c, x] = canvas(128, 256);
  x.fillStyle = '#000';
  x.beginPath();
  x.ellipse(64, 46, 17, 21, 0, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.moveTo(44, 70);
  x.quadraticCurveTo(64, 62, 84, 70);
  x.lineTo(98, 120);
  x.lineTo(92, 256);
  x.lineTo(36, 256);
  x.lineTo(30, 120);
  x.closePath();
  x.fill();
  const t = canvasTexture(c, true, 1);
  return t;
}

// 빛무리 스프라이트 (방사형 그라데이션)
export function haloTexture() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return canvasTexture(c, true, 1);
}

// 웅덩이 알파 (불규칙한 원)
export function puddleTexture(seed = 1) {
  const [c, x] = canvas(256, 256);
  const R = rng(seed);
  x.fillStyle = '#fff';
  x.filter = 'blur(6px)';
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.ellipse(128 + (R() - 0.5) * 90, 128 + (R() - 0.5) * 90, 30 + R() * 45, 20 + R() * 35, R() * 3, 0, Math.PI * 2);
    x.fill();
  }
  return canvasTexture(c, false, 1);
}
