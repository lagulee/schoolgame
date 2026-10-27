// 본관 실내 재질 (단계 8). 텍스처는 materials/interiorTex.js 에서 코드로 만든다.
// 벽은 월드 높이로 걸레받이·허리 띠를 칠하는 셰이더를 덧붙인다 (층마다 같은 높이).
import * as THREE from 'three';
import { DIM, INTERIOR } from '../../config.js';
import {
  terrazzoMaps, woodFloorMaps, plasterMaps, ceilingTexture, classDoorTexture, innerWindowTexture,
  blackboardTexture, noticeTexture, exitSignTexture, lockerTexture, railBarsTexture, frostedTexture, windowGlowTexture,
} from '../../materials/interiorTex.js';

// 월드 UV 반복 길이 (m). 배치(batch.js)가 면의 월드 좌표 / tile 로 UV 를 만든다
export const TILE = { floorTile: 2, floorWood: 2, floorStone: 2, ceiling: 1.2, wall: 2, concrete: 2, court: 3, stair: 2, wood: 1, metal: 1, cabinet: 1, rubber: 1 };

// 벽 아래 띠: 바닥에서 wainscot m 까지 어두운 회녹색, 그 위 얇은 몰딩, 맨 아래 걸레받이
function wainscot(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBase = { value: INTERIOR.base };
    sh.uniforms.uFloorH = { value: DIM.floorH };
    sh.uniforms.uBand = { value: INTERIOR.wainscot };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uBase, uFloorH, uBand;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float yr = mod(vWY - uBase + 0.001, uFloorH);
        if (yr < uBand) diffuseColor.rgb *= vec3(0.52, 0.58, 0.55);
        if (yr > uBand && yr < uBand + 0.04) diffuseColor.rgb *= 0.45;
        if (yr < 0.1) diffuseColor.rgb *= 0.35;
      }`);
  };
  mat.customProgramCacheKey = () => 'wainscot';
  return mat;
}

export function interiorMaterials(M) {
  const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const terrazzo = terrazzoMaps();
  const wood = woodFloorMaps();
  const plaster = plasterMaps();
  const bars = railBarsTexture();
  return {
    floorTile: std(0xffffff, 1, 0, { ...terrazzo, envMapIntensity: 0.6 }),
    floorWood: std(0xffffff, 1, 0, { ...wood, envMapIntensity: 0.4 }),
    floorStone: M.granite,
    stair: std(0xd8d4cc, 1, 0, { ...terrazzo, envMapIntensity: 0.5 }),
    ceiling: std(0xffffff, 0.95, 0, { map: ceilingTexture() }),
    wall: wainscot(std(0xffffff, 1, 0, { ...plaster, normalScale: new THREE.Vector2(0.5, 0.5) })),
    concrete: M.concrete,
    court: M.gravel,
    railTop: std(0x3c4146, 0.45, 0.7),
    railBars: std(0x3c4146, 0.5, 0.7, { alphaMap: bars, alphaTest: 0.5, side: THREE.DoubleSide }),
    door: std(0xffffff, 0.75, 0, { map: classDoorTexture() }),
    doorFrame: std(0x6f6a60, 0.6, 0.3),
    exitDoor: std(0x55606a, 0.55, 0.5),
    window: new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.25, metalness: 0.2, emissive: 0xffffff, emissiveMap: innerWindowTexture(), emissiveIntensity: 0.32 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x7f9cd0, alphaMap: windowGlowTexture(), transparent: true, opacity: INTERIOR.windowGlow.opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    frosted: new THREE.MeshStandardMaterial({ color: 0x0a0d0e, roughness: 0.6, emissive: 0xffffff, emissiveMap: frostedTexture(), emissiveIntensity: 0.6 }),
    board: std(0xffffff, 0.9, 0, { map: blackboardTexture() }),
    notice: std(0xffffff, 0.95, 0, { map: noticeTexture() }),
    locker: std(0xffffff, 0.55, 0.45, { map: lockerTexture() }),
    hydrant: std(0xa3221a, 0.45, 0.3),
    extinguisher: std(0xb3241b, 0.35, 0.2),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(1.6) }),
    exit: new THREE.MeshBasicMaterial({ map: exitSignTexture(), color: new THREE.Color(1.4, 1.4, 1.4) }), // 블룸으로 살짝 번지게
    wood: std(0x9a7550, 0.7),
    metal: std(0x5a5f64, 0.5, 0.6),
    cabinet: std(0x8c9298, 0.6, 0.4),
    rubber: std(0x22262a, 0.9),
    fabric: std(0x3a3f48, 1),
    paper: std(0xd8d4c8, 0.95),
    fixture: std(0xdfe3e6, 0.35, 0.1, { emissive: 0x9aa4ad, emissiveIntensity: 0.04 }), // 꺼진 형광등 기구 (희미하게 하얀 윤곽)
    clearGlass: new THREE.MeshPhysicalMaterial({ color: 0x9fb4c0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.2, depthWrite: false }),
  };
}
