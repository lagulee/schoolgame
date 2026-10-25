import * as THREE from 'three';
import { createMaterials } from '../materials/library.js';
import { buildCourtyard } from './courtyard.js';
import { buildBuildings } from './buildings.js';
import { buildEntrance, buildWaveCorridor } from './entrance.js';
import { buildProps } from './props.js';
import { buildSurroundings } from './surroundings.js';
import { buildLighting } from './lighting.js';
import { buildSky, buildEnvironment } from './sky.js';
import { LIGHTS } from '../config.js';

// 월드 조립. 각 빌더는 (root, M, collision, ctx) 를 받고 필요한 핸들을 돌려준다.
export function buildWorld(scene, col, renderer) {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  const ctx = { M };
  ctx.yard = buildCourtyard(root, M, col);
  ctx.bld = buildBuildings(root, M, col);
  ctx.entrance = buildEntrance(root, M, col);
  ctx.wave = buildWaveCorridor(root, M, col);
  ctx.props = buildProps(root, M, col, ctx);
  ctx.sur = buildSurroundings(root, M, col, ctx);
  ctx.sky = buildSky(scene);
  buildEnvironment(renderer, scene, LIGHTS.envIntensity);
  ctx.lights = buildLighting(scene, ctx);
  const updaters = [];
  updaters.push((t, dt, camera) => ctx.lights.update(camera.position));
  updaters.push((t) => ctx.entrance.sign.update(t));
  updaters.push((t) => ctx.sur.sign.update(t));
  updaters.push((t, dt, camera) => ctx.props.cams.update(dt, camera.position));
  return {
    M,
    ctx,
    update(t, dt, camera) {
      for (const u of updaters) u(t, dt, camera);
    },
  };
}
