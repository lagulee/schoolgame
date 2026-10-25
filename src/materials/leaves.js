import { canvasTexture } from './texgen.js';
import { rng } from '../world/geom.js';

// 잎이 달린 잔가지 한 덩어리 (알파 컷아웃). 카드 수백 장을 수관 곳곳에 흩어 듬성듬성 비치는 나뭇잎을 만든다.
function drawLeaf(ctx, x, y, ang, len, w, hue, light) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, `hsl(${hue - 6}, 42%, ${light - 7}%)`);
  g.addColorStop(1, `hsl(${hue + 6}, 48%, ${light + 6}%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(w * 0.95, -len * 0.22, w * 0.7, -len * 0.78, 0, -len);
  ctx.bezierCurveTo(-w * 0.7, -len * 0.78, -w * 0.95, -len * 0.22, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,20,6,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue + 10}, 40%, ${light + 18}%, 0.45)`; // 잎맥
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -len * 0.9);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    const yy = -len * (0.2 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w * 0.5, yy - len * 0.12);
    ctx.moveTo(0, yy);
    ctx.lineTo(-w * 0.5, yy - len * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

export function leafClusterTexture(seed = 3) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const R = rng(seed);
  // 잔가지: 아래 중앙에서 위로 살짝 휘어 올라감
  const bend = (R() - 0.5) * 40;
  const stemX = (t) => S / 2 + bend * Math.sin(t * Math.PI * 0.8);
  ctx.strokeStyle = '#2b2218';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(stemX(0), S * 0.98);
  for (let t = 0.05; t <= 1; t += 0.05) ctx.lineTo(stemX(t), S * (0.98 - 0.9 * t));
  ctx.stroke();
  // 잎 24장: 줄기 양쪽으로 어긋나게, 끝으로 갈수록 작게
  for (let i = 0; i < 24; i++) {
    const t = 0.08 + (i / 24) * 0.9;
    const side = i % 2 ? 1 : -1;
    const len = (56 - t * 22) * (0.8 + R() * 0.4);
    drawLeaf(ctx, stemX(t), S * (0.98 - 0.9 * t), side * (0.55 + R() * 0.7), len, len * (0.36 + R() * 0.1), 92 + R() * 26, 19 + R() * 11);
  }
  drawLeaf(ctx, stemX(1), S * 0.08, 0, 52, 19, 100, 26); // 끝 잎
  return canvasTexture(c, true, 4);
}
