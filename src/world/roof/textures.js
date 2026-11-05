// 옥상 수영장 절차 텍스처 (단계 21, 외부 에셋 없음): 데크 나무 판, 수영장 타일(+ 바닥 크레딧 문구), 물결 무늬, 글자 판.
// 모두 캔버스로 그린다. 글꼴은 시스템 글꼴(ROOF.sign.font) — 한글 글꼴이 없는 환경이면 대체 글꼴로 그려진다.
import * as THREE from 'three';
import { canvasTexture } from '../../materials/texgen.js';
import { rng } from '../geom.js';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// 데크 나무 판: 가로로 긴 판 8줄, 판마다 색이 조금씩 다르고 틈은 어둡다 (1 타일 = 1.6 m)
export function deckTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const r = rng(21);
  const rows = 8;
  const h = 512 / rows;
  for (let i = 0; i < rows; i++) {
    const base = 70 + r() * 26;
    g.fillStyle = `rgb(${base + 22}, ${base * 0.72}, ${base * 0.5})`;
    g.fillRect(0, i * h, 512, h);
    g.globalAlpha = 0.18;
    for (let k = 0; k < 26; k++) {
      g.fillStyle = r() < 0.5 ? '#2a1a10' : '#c9a07a';
      g.fillRect(r() * 512, i * h + r() * h, 60 + r() * 160, 1 + r() * 1.5);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#120c08';
    g.fillRect(0, i * h, 512, 3);
    const cut = r() * 512; // 판 이음매
    g.fillRect(cut, i * h, 3, h);
  }
  return canvasTexture(c, true);
}

// 수영장 타일 격자 (1 타일 = 1 m, 칸 0.25 m). 벽면용
export function tileTexture() {
  const c = canvas(256, 256);
  drawTiles(c.getContext('2d'), 256, 256, 64, rng(5));
  return canvasTexture(c, true);
}

function drawTiles(g, w, h, cell, r) {
  g.fillStyle = '#0e3f4a';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const v = 0.85 + r() * 0.3;
      g.fillStyle = `rgb(${46 * v}, ${150 * v}, ${168 * v})`;
      g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    }
  }
}

// 수영장 바닥: 타일 + 크레딧 문구 (진한 남색 타일로 박은 글자). size = [가로 m, 세로 m], lines = [{ text, h (글자 높이 m) }]
// 글자는 수영장 남쪽(데크 쪽)에서 북쪽을 보며 읽히게 놓는다 (캔버스 위 = 북쪽)
export function poolFloorTexture(size, lines, font) {
  const ppm = 96; // 1 m 당 픽셀
  const W = Math.round(size[0] * ppm);
  const H = Math.round(size[1] * ppm);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  drawTiles(g, W, H, ppm / 4, rng(9));
  const total = lines.reduce((a, l) => a + l.h * 1.35, 0);
  let y = (H - total * ppm) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const l of lines) {
    g.font = `bold ${Math.round(l.h * ppm)}px ${font}`;
    g.fillStyle = l.color ?? '#082a52';
    g.fillText(l.text, W / 2, y, W * 0.94);
    y += l.h * 1.35 * ppm;
  }
  const t = canvasTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 물결 무늬 (밝은 그물 선, 반복). 물 표면 map 으로 천천히 흐른다 — 밝기는 일정하다
export function causticTexture() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#5fc9cf';
  g.fillRect(0, 0, S, S);
  const r = rng(13);
  g.strokeStyle = 'rgba(220, 255, 250, 0.55)';
  g.lineWidth = 2.2;
  for (let k = 0; k < 34; k++) {
    const x = r() * S;
    const y = r() * S;
    const pts = Array.from({ length: 7 }, (_, a) => {
      const rr = 14 + r() * 16;
      return [x + Math.cos((a / 6) * Math.PI * 2) * rr, y + Math.sin((a / 6) * Math.PI * 2) * rr];
    });
    pts[6] = pts[0];
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      g.beginPath();
      pts.forEach(([px, py], a) => (a ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)));
      g.stroke();
    }
  }
  return canvasTexture(c, true);
}

// 글자 판: w×h m 판 위에 줄들(가운데 정렬). lines = [{ text, h (m), color, glow }], bg = 바탕색 (null 이면 투명)
export function textPanel(w, h, lines, { font, bg = null, ppm = 256, border = null } = {}) {
  const W = Math.round(w * ppm);
  const H = Math.round(h * ppm);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = Math.max(4, ppm * 0.025);
    g.strokeRect(g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2);
  }
  const total = lines.reduce((a, l) => a + l.h * 1.4, 0);
  let y = (H - total * ppm) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const l of lines) {
    g.font = `bold ${Math.round(l.h * ppm)}px ${font}`;
    g.fillStyle = l.color;
    if (l.glow) {
      g.shadowColor = l.color;
      g.shadowBlur = ppm * 0.08;
    }
    g.fillText(l.text, W / 2, y + l.h * 0.2 * ppm, W * 0.92);
    g.shadowBlur = 0;
    y += l.h * 1.4 * ppm;
  }
  const t = canvasTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
