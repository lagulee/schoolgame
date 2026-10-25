import * as THREE from 'three';

// 절차 텍스처 공용 도구: 타일링되는 value noise, 높이 → 법선(Sobel), 캔버스 텍스처 변환

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// period 마다 반복되는 2D value noise (텍스처 이음매 없음)
export function makeNoise(seed = 1) {
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, period) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const m = (v) => ((v % period) + period) % period;
    const x0 = m(xi);
    const x1 = m(xi + 1);
    const y0 = m(yi);
    const y1 = m(yi + 1);
    const a = hash2(x0, y0, seed);
    const b = hash2(x1, y0, seed);
    const c = hash2(x0, y1, seed);
    const d = hash2(x1, y1, seed);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  // u, v ∈ [0,1) 타일 좌표. base 주기에서 시작해 옥타브마다 두 배
  const fbm = (u, v, base = 4, oct = 4) => {
    let s = 0;
    let amp = 0.5;
    let p = base;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      s += noise(u * p, v * p, p) * amp;
      norm += amp;
      amp *= 0.5;
      p *= 2;
    }
    return s / norm;
  };
  // 가로·세로 주기가 다른 노이즈 (세로 물자국 등)
  const aniso = (u, v, px, py) => noise2(u * px, v * py, px, py);
  const noise2 = (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const mx = (v) => ((v % px) + px) % px;
    const my = (v) => ((v % py) + py) % py;
    const a = hash2(mx(xi), my(yi), seed + 7);
    const b = hash2(mx(xi + 1), my(yi), seed + 7);
    const c = hash2(mx(xi), my(yi + 1), seed + 7);
    const d = hash2(mx(xi + 1), my(yi + 1), seed + 7);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return { noise, fbm, aniso };
}

// 픽셀 함수로 RGB 버퍼, 높이, 거칠기를 동시에 채운다.
// fn(x, y, u, v, out) → out.r,g,b (0~255), out.h (0~1), out.rough (0~1)
export function generate(size, fn) {
  const n = size * size;
  const color = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const rough = new Uint8ClampedArray(n * 4);
  const out = { r: 0, g: 0, b: 0, h: 0, rough: 1 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, x / size, y / size, out);
      const i = y * size + x;
      color[i * 4] = out.r;
      color[i * 4 + 1] = out.g;
      color[i * 4 + 2] = out.b;
      color[i * 4 + 3] = 255;
      height[i] = out.h;
      const rv = out.rough * 255;
      rough[i * 4] = rv;
      rough[i * 4 + 1] = rv; // roughnessMap 은 G 채널을 읽는다
      rough[i * 4 + 2] = rv;
      rough[i * 4 + 3] = 255;
    }
  }
  return { size, color, height, rough };
}

// Sobel 필터로 높이 → 탄젠트 공간 법선 (가장자리는 감싸서 타일링 유지)
export function heightToNormal(height, size, strength = 2) {
  const out = new Uint8ClampedArray(size * size * 4);
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1);
      const gy = H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1);
      // 캔버스 y 는 아래로 증가, 텍스처 v 는 위로 → gy 부호 반전
      let nx = -gx * strength;
      let ny = gy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * size + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

export function dataTexture(rgba, size, srgb, anisotropy = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').putImageData(new ImageData(rgba, size, size), 0, 0);
  return canvasTexture(c, srgb, anisotropy);
}

export function canvasTexture(canvas, srgb, anisotropy = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// generate() 결과 → {map, normalMap, roughnessMap}
export function toMaps(gen, normalStrength = 2) {
  return {
    map: dataTexture(gen.color, gen.size, true),
    normalMap: dataTexture(heightToNormal(gen.height, gen.size, normalStrength), gen.size, false),
    roughnessMap: dataTexture(gen.rough, gen.size, false),
  };
}

export function hexRGB(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
