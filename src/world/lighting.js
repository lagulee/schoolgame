import * as THREE from 'three';
import { LIGHTS, PALETTE } from '../config.js';
import { haloTexture } from '../materials/windowTex.js';

// 조명 배치. 그림자를 만드는 광원은 달과 손전등 2개뿐이다.
export function buildLighting(scene, ctx) {
  const L = LIGHTS;
  const out = { lamps: [], all: [] };

  // 달: 플레이어 주변 ±30m 그림자, 플레이어를 따라감
  const moon = new THREE.DirectionalLight(PALETTE.moon, L.moon.intensity);
  moon.castShadow = true;
  const sc = moon.shadow.camera;
  sc.left = sc.bottom = -L.moon.shadowRange;
  sc.right = sc.top = L.moon.shadowRange;
  sc.near = 1;
  sc.far = 140;
  moon.shadow.mapSize.set(L.moon.shadowRes, L.moon.shadowRes);
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);
  out.moon = moon;

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, L.hemi);
  scene.add(hemi);
  out.hemi = hemi;

  // 가로등: PointLight + 발광 렌즈 + 빛무리 Sprite
  const halo = haloTexture();
  const lampList = [...ctx.props.lamps, ...ctx.sur.parkLamps];
  for (const lamp of lampList) {
    const green = lamp.color.g > lamp.color.r;
    const p = new THREE.PointLight(lamp.color, green ? L.green.intensity : L.lamp.intensity,
      green ? L.green.distance : L.lamp.distance, L.lamp.decay);
    p.position.copy(lamp.headPos).add(new THREE.Vector3(0, -0.25, 0));
    scene.add(p);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: lamp.color.clone().multiplyScalar(green ? 0.55 : 0.7), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: true,
    }));
    spr.scale.setScalar(green ? 2.6 : 2.2);
    spr.position.copy(lamp.headPos).add(new THREE.Vector3(0, -0.08, 0));
    scene.add(spr);
    lamp.light = p;
    lamp.halo = spr;
    lamp.baseIntensity = p.intensity;
    lamp.baseHalo = spr.material.color.clone();
    out.lamps.push(lamp);
  }
  out.yardLamps = out.lamps.slice(0, ctx.props.lamps.length);

  // 필로티 너머 초록 (공원 쪽 보조광) → 붉은 전광판과 보색 대비
  const g2 = new THREE.PointLight(PALETTE.parkGreen, L.green.intensity * 0.8, L.green.distance, 2);
  g2.position.set(0.5, 3.2, -31.5);
  scene.add(g2);

  // 현관 실내광 (청백색, 약하게)
  const ent = new THREE.PointLight(PALETTE.entranceLight, L.entrance.intensity, L.entrance.distance, 2);
  ent.position.copy(ctx.entrance.lightPos);
  scene.add(ent);

  // 붉은 LED 번짐 (바닥·벽)
  const red1 = new THREE.PointLight(PALETTE.led, L.led.intensity * 1.6, L.led.distance * 1.2, 2);
  red1.position.copy(ctx.entrance.signPos).add(new THREE.Vector3(-0.6, -0.9, 0));
  red1.userData.base = red1.intensity;
  ctx.entrance.sign.light = red1;
  const red2 = new THREE.PointLight(PALETTE.led, L.led.intensity * 1.4, L.led.distance * 1.4, 2);
  red2.position.set(0, ctx.sur.sign.group.position.y - 0.4, ctx.sur.sign.group.position.z + 0.9);
  red2.userData.base = red2.intensity;
  ctx.sur.sign.light = red2;
  scene.add(red1, red2);

  // 점검 모드: 형태 확인용 밝은 보조광
  const inspect = new THREE.AmbientLight(0xffffff, 0);
  scene.add(inspect);
  out.setInspect = (on) => {
    inspect.intensity = on ? 1.6 : 0;
    hemi.intensity = on ? L.hemi * L.inspectBoost : L.hemi;
  };

  const tmp = new THREE.Vector3();
  const texel = (2 * L.moon.shadowRange) / L.moon.shadowRes;
  out.update = (playerPos) => {
    // 그림자 텍셀 단위로 스냅 → 이동 중 그림자 가장자리 떨림 감소
    tmp.set(Math.round(playerPos.x / texel) * texel, 0, Math.round(playerPos.z / texel) * texel);
    moon.target.position.copy(tmp);
    moon.position.copy(tmp).add(new THREE.Vector3(...L.moon.offset));
    moon.target.updateMatrixWorld();
  };
  out.setShadows = (on) => {
    moon.castShadow = on;
  };
  return out;
}
