import * as THREE from 'three';
import { createMaterials } from '../materials/library.js';
import { buildCourtyard } from './courtyard.js';
import { buildBuildings } from './buildings.js';
import { buildEntrance, buildWaveCorridor } from './entrance.js';

// 월드 조립. 각 빌더는 (root, M, collision, ctx) 를 받고 필요한 핸들을 돌려준다.
export function buildWorld(scene, col) {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  const ctx = { M };
  ctx.yard = buildCourtyard(root, M, col);
  ctx.bld = buildBuildings(root, M, col);
  ctx.entrance = buildEntrance(root, M, col);
  ctx.wave = buildWaveCorridor(root, M, col);
  const updaters = [];
  updaters.push((t) => ctx.entrance.sign.update(t));
  return {
    M,
    ctx,
    update(t, dt, camera) {
      for (const u of updaters) u(t, dt, camera);
    },
  };
}
