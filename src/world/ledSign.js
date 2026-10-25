import * as THREE from 'three';
import { rng } from './geom.js';

// 붉은 점광 LED 전광판. 글자를 저해상도 비트맵으로 래스터화한 뒤 점(dot) 격자로 그려 스크롤한다.
export class LedSign {
  constructor({ cols, rows, width, height, lines, speeds, dotPx = 6, glow = 2.6 }) {
    this.cols = cols;
    this.rows = rows;
    this.lines = lines.map((text, i) => this.rasterize(text, Math.floor(rows / lines.length)));
    this.speeds = speeds ?? lines.map(() => 9);
    this.dotPx = dotPx;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cols * dotPx;
    this.canvas.height = rows * dotPx;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(glow, glow, glow) });
    this.baseGlow = glow;

    this.group = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, height + 0.24, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5, metalness: 0.3 }));
    back.position.z = -0.08;
    back.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.mat);
    face.position.z = 0.002;
    this.group.add(back, face);

    this.glitchUntil = 0;
    this.lastDraw = -1;
    this.offsets = this.lines.map(() => 0);
    this.light = null; // 외부에서 붙이는 붉은 PointLight
    this.onGlitch = null;
    this.draw(0);
  }

  rasterize(text, h) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `bold ${h}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 2;
    c.width = w;
    c.height = h;
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 1, h / 2 + 1);
    const data = ctx.getImageData(0, 0, w, h).data;
    const bits = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bits[i] = data[i * 4 + 3] > 110 ? 1 : 0;
    return { bits, w: w + this.cols, srcW: w, h };
  }

  glitch(now, dur) {
    this.glitchUntil = now + dur;
  }

  get glitching() {
    return this.lastT < this.glitchUntil;
  }

  update(t) {
    this.lastT = t;
    // 20fps 로 다시 그림, 글리치 중에는 상태를 0.4초 단위로만 바꿔 깜빡임을 초당 3회 미만으로 유지
    if (t - this.lastDraw < 0.05) return;
    this.lastDraw = t;
    this.draw(t);
    if (this.light) {
      const g = t < this.glitchUntil ? 0.6 : 1;
      this.light.intensity = this.light.userData.base * g;
    }
  }

  draw(t) {
    const { ctx, cols, rows, dotPx: d } = this;
    const glitch = t < this.glitchUntil;
    const R = glitch ? rng(Math.floor(t / 0.4) * 977 + 3) : null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cols * d, rows * d);
    const lineH = Math.floor(rows / this.lines.length);
    const drop = new Uint8Array(cols);
    let shift = 0;
    if (glitch) {
      for (let c = 0; c < cols; c++) drop[c] = R() < 0.32 ? 1 : 0;
      shift = Math.floor(R() * 40) - 20;
    }
    for (let li = 0; li < this.lines.length; li++) {
      const L = this.lines[li];
      const off = Math.floor(t * this.speeds[li]) + (glitch && li === 0 ? shift : 0);
      for (let r = 0; r < lineH; r++) {
        const y = (li * lineH + r) * d;
        for (let c = 0; c < cols; c++) {
          let sx = (((c + off) % L.w) + L.w) % L.w;
          if (glitch && R() < 0.04) sx = (sx + 37) % L.w; // 일부 글자 뒤바뀜
          const on = sx < L.srcW && L.bits[r * L.srcW + sx] && !drop[c];
          ctx.fillStyle = on ? '#ff3b1f' : '#1c0503';
          ctx.fillRect(c * d + 1, y + 1, d - 2, d - 2);
        }
      }
    }
    this.tex.needsUpdate = true;
  }
}
