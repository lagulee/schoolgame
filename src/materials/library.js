import * as THREE from 'three';
import { PALETTE, WINDOW_LOOK, YAJA_LIGHT } from '../config.js';
import { brickMaps, pavingMaps, noiseMaps, barkMaps } from './procedural.js';
import { windowTexture, doorTexture } from './windowTex.js';

const STAIN_GLSL = /* glsl */ `
varying vec3 vWPos;
uniform float uStain;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

// 월드 좌표 기반 얼룩 오버레이: 큰 얼룩 + 세로 물자국 + 바닥 쪽 습기. 텍스처 반복 티를 깬다.
export function addWorldStain(mat, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStain = { value: strength };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      {
        vec4 wpS = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpS = instanceMatrix * wpS;
        #endif
        vWPos = (modelMatrix * wpS).xyz;
      }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + STAIN_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float st = vnoise(vWPos * 0.32) * 0.6 + vnoise(vWPos * 1.4) * 0.4;
        float streak = vnoise(vec3((vWPos.x + vWPos.z) * 2.3, vWPos.y * 0.11, 3.0));
        float damp = 1.0 - smoothstep(0.0, 1.3, vWPos.y);
        float dark = smoothstep(0.5, 0.82, st) * 0.3 + smoothstep(0.62, 0.92, streak) * 0.25 + damp * 0.28;
        diffuseColor.rgb *= 1.0 - clamp(dark, 0.0, 0.7) * uStain;
      }`);
  };
  mat.customProgramCacheKey = () => `stain${strength}`;
  return mat;
}

const ANISO = 8;
function withRepeat(maps, rx = 1, ry = rx) {
  for (const t of Object.values(maps)) {
    t.repeat.set(rx, ry);
    t.anisotropy = ANISO;
  }
  return maps;
}

// 이름 → 재질. 텍스처는 모두 코드로 생성한다.
export function createMaterials() {
  const std = (color, rough = 0.85, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const basic = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

  const brickA = brickMaps(1);
  const brickB = brickMaps(2);
  const paving = pavingMaps(4);
  const concrete = noiseMaps('concrete');
  const asphalt = withRepeat(noiseMaps('asphalt'));
  const grass = noiseMaps('grass');
  const gravel = noiseMaps('gravel');
  const dirt = noiseMaps('dirt');
  const granite = noiseMaps('granite');
  const hedge = noiseMaps('hedge');
  const panel = noiseMaps('panel', 256);
  const shop = noiseMaps('shop', 256);
  const nScale = (k) => ({ normalScale: new THREE.Vector2(k, k) });

  const painted = (color, rough = 0.6, metal = 0.15) =>
    std(color, 1, metal, { map: panel.map, roughnessMap: panel.roughnessMap, roughness: rough / 0.6 });

  const glassBase = { roughness: 0.16, metalness: 0.4, envMapIntensity: WINDOW_LOOK.glassEnv };

  return {
    brick: addWorldStain(std(0xffffff, 1, 0, { ...brickA, ...nScale(1) })),
    brickB: addWorldStain(std(0xf4f0ea, 1, 0, { ...brickB, ...nScale(1) })),
    paving: std(0x9a9692, 1, 0, { ...paving, ...nScale(0.9), envMapIntensity: 1.2 }),
    concrete: addWorldStain(std(0xffffff, 1, 0, { ...concrete }), 0.8),
    asphalt: std(0xffffff, 1, 0, { ...asphalt }),
    grass: std(0xffffff, 1, 0, { ...grass }),
    gravel: std(0xffffff, 1, 0, { ...gravel }),
    soil: std(0x1e1611, 1),
    curb: std(0xb0aca4, 1, 0, { ...granite, roughness: 1.4 }),
    sill: std(WINDOW_LOOK.sill, 1, 0, { ...granite, roughness: 1.4 }),
    redBand: painted(PALETTE.redBand, 0.7),
    bluePanel: painted(PALETTE.bluePanel, 0.5, 0.3),
    yellow: painted(PALETTE.yellow, 0.5),
    orange: painted(PALETTE.orange, 0.5),
    frame: painted(WINDOW_LOOK.frameColor, 0.62, 0.05),
    canopy: painted(PALETTE.canopy, 0.55, 0.2),
    granite: std(0xffffff, 1, 0, { ...granite }),
    silver: std(PALETTE.silver, 0.3, 0.9, { envMapIntensity: 1.5 }),
    iron: std(PALETTE.iron, 0.5, 0.7),
    hedge: std(0xffffff, 1, 0, { ...hedge }),
    shrub: std(0xffffff, 1, 0, { map: hedge.map }),
    planter: std(0xc2bdb3, 1, 0, { map: concrete.map, roughnessMap: concrete.roughnessMap }),
    teal: std(PALETTE.teal, 0.15, 0.3, { transparent: true, opacity: 0.6, envMapIntensity: 1.5 }),
    whiteWall: addWorldStain(std(0xe2e0da, 1, 0, { map: panel.map, roughnessMap: panel.roughnessMap }), 0.7),
    waveRoof: std(0x1a2026, 0.25, 0.3, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, envMapIntensity: 1.4 }),
    darkGlass: std(0x05070a, 0.06, 0.85, { envMapIntensity: 2.2 }),
    glass: std(0xffffff, 1, 0, { ...glassBase, map: windowTexture('dark') }),
    glassCurtain: std(0xffffff, 1, 0, { ...glassBase, map: windowTexture('curtain') }),
    glassLit: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2, emissive: 0xffffff,
      emissiveMap: windowTexture('lit'), emissiveIntensity: WINDOW_LOOK.litEmissive }),
    glassYaja: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2, emissive: 0xffffff,
      emissiveMap: windowTexture('yaja'), emissiveIntensity: YAJA_LIGHT.emissive }),
    glassLeak: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2, emissive: 0xffffff,
      emissiveMap: windowTexture('yaja'), emissiveIntensity: YAJA_LIGHT.leak }),
    dirt: std(0xffffff, 1, 0, { ...dirt }),
    lineWhite: std(0xd9d6cc, 0.95),
    goalWhite: std(0xe4e6e8, 0.5, 0.2),
    net: std(0x1c2024, 0.8, 0.3, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    door: new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.08, metalness: 0.3,
      emissive: 0xffffff, emissiveMap: doorTexture(), emissiveIntensity: 0.75 }),
    black: std(0x070707, 0.6),
    metalBox: std(0xbfc2c4, 1, 0.3, { map: panel.map, roughnessMap: panel.roughnessMap }),
    pipe: std(0x8f9497, 0.45, 0.6),
    trunk: std(0x2a1d15, 1),
    bark: std(0xffffff, 1, 0, { ...withRepeat(barkMaps(), 2, 2), normalScale: new THREE.Vector2(1, 1) }),
    pavilion: std(0x1a120e, 0.9),
    roofTile: std(0x14161a, 0.8),
    farBuilding: std(0x07090c, 1),
    shopWall: std(0xffffff, 1, 0, { ...shop }),
    lampPole: std(0x23262a, 0.5, 0.6),
    bikeFrame: std(0x6a1c1c, 0.4, 0.5),
    cctvDome: std(0x0c0f12, 0.05, 0.4, { transparent: true, opacity: 0.85, envMapIntensity: 2 }),
    shopWinWarm: basic(0xffc98a, 0.55),
    shopWinCool: basic(0xa8d8ff, 0.45),
    exitSign: basic(PALETTE.exitSign, 1.6),
    readerLed: basic(0x30ff60, 2),
    tubeLight: basic(0xd8f0e8, 0.9),
    downLight: basic(0xfff2dc, 1.4),
  };
}
