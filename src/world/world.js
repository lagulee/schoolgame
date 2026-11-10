import * as THREE from 'three';
import { createMaterials } from '../materials/library.js';
import { buildCourtyard } from './courtyard.js';
import { buildBuildings } from './buildings.js';
import { buildAnnex } from './annex.js';
import { buildBridge } from './bridge.js';
import { buildField } from './field.js';
import { addSchoolCollision } from './layout.js';
import { buildEntrance, buildWaveCorridor } from './entrance.js';
import { buildProps } from './props.js';
import { buildSurroundings } from './surroundings.js';
import { buildLighting } from './lighting.js';
import { buildSky, buildEnvironment } from './sky.js';
import { buildInterior } from './interior/index.js';
import { LIGHTS, PERF_TUNE } from '../config.js';

// 월드 조립. 각 빌더는 (root, M, collision, ctx) 를 받고 필요한 핸들을 돌려준다.
export function buildWorld(scene, col, renderer) {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  const ctx = { M, root };
  ctx.yard = buildCourtyard(root, M, col);
  addSchoolCollision(col); // 건물·담장·이동 경계 (단계 7)
  ctx.bld = buildBuildings(root, M, col);
  ctx.annex = buildAnnex(root, M);
  ctx.bridge = buildBridge(root, M);
  ctx.field = buildField(root, M, col);
  ctx.entrance = buildEntrance(root, M, col);
  ctx.wave = buildWaveCorridor(root, M, col);
  ctx.props = buildProps(root, M, col, ctx);
  ctx.sur = buildSurroundings(root, M, col, ctx);
  ctx.sky = buildSky(scene);
  buildEnvironment(renderer, scene, LIGHTS.envIntensity);
  ctx.lights = buildLighting(scene, ctx);
  ctx.interior = buildInterior(scene, M, col, ctx, renderer); // 단계 8: 본관 실내 (바깥과 한 월드)
  const updaters = [];
  updaters.push((t, dt, camera) => ctx.lights.update(camera.position, dt));
  // 전광판: 20fps 로 캔버스를 다시 그려 텍스처를 올린다 → 카메라 뒤에 있거나 멀면 건너뛴다 (렉 수정, v1.28.8)
  const signPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const signUpdate = (sign) => (t, dt, camera) => {
    sign.group.getWorldPosition(signPos).sub(camera.position);
    const d = signPos.length();
    camera.getWorldDirection(camDir);
    sign.hidden = d > PERF_TUNE.sign.far || (d > 1 && signPos.dot(camDir) / d < PERF_TUNE.sign.behind);
    sign.update(t);
  };
  updaters.push(signUpdate(ctx.entrance.sign));
  updaters.push(signUpdate(ctx.sur.sign));
  updaters.push((t, dt, camera) => ctx.props.cams.update(dt, camera.position));
  return {
    M,
    ctx,
    interior: ctx.interior,
    update(t, dt, camera) {
      for (const u of updaters) u(t, dt, camera);
    },
  };
}
