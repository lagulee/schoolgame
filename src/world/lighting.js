import * as THREE from 'three';
import { LIGHTS, PALETTE, YAJA_LIGHT, INTERIOR } from '../config.js';
import { pilotiBackZ } from './layout.js';
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
  const lampList = [...ctx.props.lamps, ...ctx.field.lamps];
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

  // 필로티 막힌 끝 유리문 안쪽 초록 유도등 번짐 → 붉은 전광판과 보색 대비 (단계 7: 공원 대신)
  const g2 = new THREE.PointLight(PALETTE.parkGreen, L.pilotiGreen.intensity, L.pilotiGreen.distance, 2);
  g2.position.set(0, L.pilotiGreen.y, pilotiBackZ() - L.pilotiGreen.behind);
  scene.add(g2);

  // 신관 2층 야자 교실 창 밖 번짐 (깜빡이지 않음)
  const yaja = new THREE.PointLight(YAJA_LIGHT.color, YAJA_LIGHT.intensity, YAJA_LIGHT.distance, 2);
  yaja.position.copy(ctx.annex.yajaLightPos);
  scene.add(yaja);
  out.yaja = yaja;

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
  let inspectOn = false;
  let indoor = 0; // 0 = 바깥, 1 = 본관 안 (단계 8, atmosphere.js 가 3초에 걸쳐 바꾼다)
  const I = INTERIOR.inside;
  const mix = (a, b) => a + (b - a) * indoor;
  const sky = [new THREE.Color(PALETTE.hemiSky), new THREE.Color(I.hemiSky)];
  const ground = [new THREE.Color(PALETTE.hemiGround), new THREE.Color(I.hemiGround)];
  let dark = 1; // 정전 뒤 실내 하늘빛 배율 (단계 14, atmosphere.js)
  const applyHemi = () => {
    hemi.intensity = mix(L.hemi, I.hemi * dark) * (inspectOn ? L.inspectBoost : 1);
    hemi.color.lerpColors(sky[0], sky[1], indoor);
    hemi.groundColor.lerpColors(ground[0], ground[1], indoor);
  };
  out.setInspect = (on) => {
    inspectOn = on;
    inspect.intensity = on ? 1.6 : 0;
    applyHemi();
  };
  out.setDark = (f) => {
    dark = f;
    applyHemi();
  };
  // 실내: 하늘빛을 STORY 15-2 값으로, 달·가로등·붉은 LED 번짐은 배율로 줄인다 (벽을 뚫고 비치지 않게)
  out.setIndoor = (k) => {
    indoor = k;
    applyHemi();
    moon.intensity = L.moon.intensity * mix(1, I.moon);
    for (const lamp of out.lamps) {
      lamp.dim = mix(1, I.lamps);
      lamp.light.intensity = lamp.baseIntensity * (lamp.on ?? 1) * lamp.dim;
    }
    for (const r of [red1, red2]) {
      r.userData.dim = mix(1, I.red);
      r.intensity = r.userData.base * r.userData.dim;
    }
  };
  // 실내(k > 0.98)에서는 가로등 점광원을 아예 끈다 (실내 배율 12 % 라 거의 안 보이고, 점광원 하나마다 모든 재질의 계산이 늘어난다).
  // 켜고 끌 때 셰이더가 다시 컴파일되므로 main.js prewarmShaders 가 두 상태를 미리 만들어 둔다
  out.setOutdoorLamps = (on) => {
    if (on === outdoor) return; // 매 프레임 불리므로 바뀔 때만 (예산 정렬을 다시 하지 않게)
    for (const lamp of out.lamps) lamp.light.userData.forceOff = !on;
    outdoor = on;
    applyBudget(lastCam);
  };

  // 점광원 예산 (렉 점검, v1.28.6): three 의 앞쪽 렌더링은 켜진(visible) 점광원 전부를 모든 재질의 픽셀 셰이더에서 돌린다.
  // 장면에는 점광원이 18개(가로등 6·현관·LED 2·필로티·야자·실내 표시등·눈앞 빛·옥상 2…)인데 플레이어 근처에서 실제로 쓰이는 건 몇 개뿐이라,
  // 카메라에 영향이 큰 순서로 K 개만 켠다. 켜진 개수가 늘 같아서 셰이더가 다시 컴파일되지 않는다 (바깥/실내 두 값만 main.js prewarmShaders 가 미리 만든다)
  const B = LIGHTS.budget;
  const lightList = [];
  let outdoor = true;
  const lastCam = new THREE.Vector3();
  let listAge = Infinity;
  const wp = new THREE.Vector3();
  const collect = () => {
    lightList.length = 0;
    scene.traverse((o) => { if (o.isPointLight) lightList.push(o); });
    listAge = 0;
  };
  // 켜진 개수를 정확히 k 로 맞추기 위한 빈 점광원(세기 0). 숨긴 묶음(다른 층·옥상) 안의 광원은 그려지지 않으므로 세지 않고,
  // 모자란 만큼은 이것으로 채운다 → 광원 수가 바깥 k·실내 k 두 값뿐이라 미리 만든 셰이더(prewarm.js)와 항상 맞는다 (v1.28.8)
  for (let i = 0; i < Math.max(B.outdoor, B.indoor); i++) {
    const pad = new THREE.PointLight(0x000000, 0, 0.01);
    pad.visible = false;
    scene.add(pad);
  }
  const shown = (l) => { for (let p = l.parent; p; p = p.parent) if (!p.visible) return false; return true; };
  const score = (l, cam) => {
    if (l.userData.forceOff || !shown(l)) return -1;
    l.getWorldPosition(wp);
    const over = Math.max(0, wp.distanceTo(cam) - l.distance * B.reach); // 이 반경 안이면 거리 무관, 밖이면 급히 줄어든다
    return (l.intensity * (l.visible ? B.keep : 1)) / (1 + over * over);
  };
  const applyBudget = (cam) => {
    lastCam.copy(cam);
    if (!lightList.length) collect();
    const k = outdoor ? B.outdoor : B.indoor;
    const ranked = lightList.map((l) => [score(l, cam), l]).sort((a, b) => b[0] - a[0]);
    ranked.forEach(([sc, l], i) => { l.visible = i < k && sc >= 0; });
  };
  out.applyBudget = applyBudget;
  out.outdoorLamps = () => outdoor;
  out.redrawMoon = () => { moon.shadow.needsUpdate = true; };
  // 실내에서는 달 그림자를 마지막 자리에 고정해 매 프레임 다시 그리지 않는다
  let frozen = false;
  out.freezeMoon = (on) => {
    if (on === frozen) return;
    frozen = on;
    moon.shadow.needsUpdate = true; // 얼리기 직전·풀린 직후 한 번은 다시 그린다
  };

  // 달 그림자는 매 프레임이 아니라 (1) 플레이어가 그림자 칸(SNAP m)을 벗어났을 때 (2) 움직이는 그림자(귀신·문)를 위해
  // REFRESH 초마다 다시 그린다. 그림자 행렬은 다시 그릴 때만 갱신되므로 그림자와 행렬은 항상 맞는다 (성능: 바깥 그림자 비용 약 1/6)
  const tmp = new THREE.Vector3();
  const texel = (2 * L.moon.shadowRange) / L.moon.shadowRes;
  const snap = Math.max(1, Math.round(L.moon.snap / texel)) * texel; // 텍셀의 배수로 맞춰 가장자리 떨림도 없다
  let lastX = NaN;
  let lastZ = NaN;
  let since = 0;
  moon.shadow.autoUpdate = false;
  moon.shadow.needsUpdate = true;
  let budgetT = 0;
  out.update = (playerPos, dt = 1 / 60) => {
    budgetT += dt;
    listAge += dt;
    if (budgetT >= B.every) {
      budgetT = 0;
      if (listAge > B.rescan) collect();
      applyBudget(playerPos);
    }
    if (frozen) return;
    since += dt;
    const x = Math.round(playerPos.x / snap) * snap;
    const z = Math.round(playerPos.z / snap) * snap;
    if (x !== lastX || z !== lastZ) {
      lastX = x;
      lastZ = z;
      tmp.set(x, 0, z);
      moon.target.position.copy(tmp);
      moon.position.copy(tmp).add(new THREE.Vector3(...L.moon.offset));
      moon.target.updateMatrixWorld();
      moon.shadow.needsUpdate = true;
      since = 0;
    } else if (since >= L.moon.refresh) {
      moon.shadow.needsUpdate = true;
      since = 0;
    }
  };
  out.setShadows = (on) => {
    moon.castShadow = on;
    moon.shadow.needsUpdate = true;
  };
  return out;
}
