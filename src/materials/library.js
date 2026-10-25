import * as THREE from 'three';
import { PALETTE } from '../config.js';

// 이름 → 재질. S7 에서 절차 텍스처로 고도화된다.
export function createMaterials() {
  const std = (color, rough = 0.85, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return {
    brick: std(PALETTE.brick),
    brickB: std(PALETTE.brick),
    paving: std(0x7a5a48, 0.5),
    concrete: std(0x6f6f6c, 0.9),
    asphalt: std(0x1d1e20, 0.8),
    grass: std(0x1f2b18, 1),
    gravel: std(0x5a5650, 1),
    soil: std(0x1e1611, 1),
    curb: std(0x9a968e, 0.8),
    redBand: std(PALETTE.redBand, 0.7),
    bluePanel: std(PALETTE.bluePanel, 0.55, 0.2),
    yellow: std(PALETTE.yellow, 0.55, 0.1),
    orange: std(PALETTE.orange, 0.55, 0.1),
    frame: std(PALETTE.frame, 0.5),
    canopy: std(PALETTE.canopy, 0.6, 0.1),
    granite: std(PALETTE.granite, 0.45),
    silver: std(PALETTE.silver, 0.35, 0.85),
    iron: std(PALETTE.iron, 0.55, 0.6),
    hedge: std(0x1b2c17, 1),
    planter: std(0xb7b2a8, 0.7),
    teal: std(PALETTE.teal, 0.2, 0.1, { transparent: true, opacity: 0.55 }),
    whiteWall: std(0xdedcd6, 0.8),
    waveRoof: std(0x1c2228, 0.3, 0.2, { transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    darkGlass: std(0x0a0d12, 0.08, 0.6),
    glass: std(0x10161d, 0.1, 0.3),
    glassCurtain: std(0x10161d, 0.1, 0.3),
    glassLit: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.litWindow, emissiveIntensity: 2.2 }),
    door: new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.1, metalness: 0.3,
      emissive: PALETTE.entranceLight, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }),
    black: std(0x070707, 0.6),
    metalBox: std(0xbfc2c4, 0.5, 0.3),
    pipe: std(0x8f9497, 0.5, 0.6),
    trunk: std(0x2a1d15, 1),
  };
}
