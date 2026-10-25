import * as THREE from 'three';
import { LIGHTS, PALETTE } from '../config.js';
import { U } from './shared.js';
import { puddleTexture } from '../materials/windowTex.js';

const NOISE_GLSL = /* glsl */ `
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += vn2(p) * a; p *= 2.03; a *= 0.5; } return s; }`;

// 바닥 안개 층: 노이즈가 천천히 흐르는 반투명 평면. radius > 0 이면 원형으로 가장자리가 사라지는 국소 패치
function fogLayer(cx, cz, w, d, y, density, radius, speed) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: U.time,
      uColor: { value: new THREE.Color(0x6d7a8c) },
      uDensity: { value: density },
      uCenter: { value: new THREE.Vector2(cx, cz) },
      uRadius: { value: radius },
      uSpeed: { value: speed },
      uFog: { value: 0.02 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDensity, uRadius, uSpeed, uFog;
      uniform vec3 uColor;
      uniform vec2 uCenter;
      varying vec3 vW;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vW.xz * 0.16 + vec2(uTime * 0.035, uTime * 0.015) * uSpeed + vW.y * 3.1;
        float n = fbm2(p + fbm2(p * 0.7 - uTime * 0.02) * 1.3);
        float a = smoothstep(0.38, 0.85, n) * uDensity;
        if (uRadius > 0.0) a *= 1.0 - smoothstep(uRadius * 0.45, uRadius, distance(vW.xz, uCenter));
        float dc = distance(cameraPosition, vW);
        a *= smoothstep(0.6, 3.5, dc);                 // 카메라 근처에서 단면이 보이지 않게
        a *= exp(-pow(uFog * dc * 0.7, 2.0));          // 먼 곳은 장면 안개에 녹아들게
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, y, cz);
  m.renderOrder = 2;
  return m;
}

// 원뿔 빛줄기 셰이더 (손전등 볼류메트릭 콘, 가로등 빛줄기 공용). 가장자리·끝으로 갈수록 사라짐, 가산 혼합
function beamMaterial(color, alpha, length, nearFade) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uLen: { value: length }, uNear: { value: nearFade } },
    vertexShader: /* glsl */ `
      varying float vZ; varying vec3 vN; varying vec3 vV;
      void main() {
        vZ = position.z;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha, uLen, uNear;
      varying float vZ; varying vec3 vN; varying vec3 vV;
      void main() {
        float t = clamp(vZ / uLen, 0.0, 1.0);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = uAlpha * edge * pow(1.0 - t, 1.6) * smoothstep(0.0, uNear, vZ);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}

function coneGeo(length, angle) {
  const g = new THREE.ConeGeometry(Math.tan(angle) * length, length, 40, 1, true);
  g.translate(0, -length / 2, 0); // 꼭짓점을 원점으로
  g.rotateX(-Math.PI / 2); // 축을 +z 로
  return g;
}

export function buildFx(scene, ctx, flashlight) {
  const groups = { 0: new THREE.Group(), 1: new THREE.Group(), 2: new THREE.Group() };
  for (const g of Object.values(groups)) scene.add(g);
  const fogMats = [];
  const addFog = (lvl, ...a) => {
    const m = fogLayer(...a);
    fogMats.push(m.material);
    groups[lvl].add(m);
  };
  // 전역 얇은 층
  addFog(0, 0, -10, 70, 80, 0.45, 0.14, 0, 1);
  addFog(1, 0, -10, 70, 80, 0.9, 0.08, 0, 0.7);
  // 필로티 주변 + 화단 근처 + 공원에 짙게
  addFog(1, 0, -19, 22, 22, 0.35, 0.34, 11, 1.2);
  addFog(2, 0, -19, 22, 22, 0.75, 0.26, 10, 0.9);
  addFog(2, 0, -21, 18, 18, 1.15, 0.16, 8, 0.8);
  for (const b of ctx.yard.beds) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const r = Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.7 + 1.5;
    addFog(1, cx, cz, r * 2, r * 2, 0.4, 0.3, r, 1.1);
    addFog(2, cx, cz, r * 2, r * 2, 0.8, 0.18, r, 0.8);
  }
  addFog(1, 0, -38, 40, 30, 0.5, 0.36, 15, 1);
  addFog(2, 0, -38, 40, 30, 1.0, 0.24, 15, 0.8);

  // 손전등 볼류메트릭 콘 (알파 ≈ 0.06)
  const F = LIGHTS.flashlight;
  const coneLen = 9;
  const cone = new THREE.Mesh(coneGeo(coneLen, F.angle * 0.92), beamMaterial(0xfff0d6, 0.06, coneLen, 1.8));
  cone.renderOrder = 3;
  cone.frustumCulled = false;
  scene.add(cone);

  // 빔 안에서만 보이는 먼지 입자 (Points 300)
  const N = 300;
  const base = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = Math.random();
    base[i * 3 + 1] = Math.random();
    base[i * 3 + 2] = Math.random();
    seed[i] = Math.random() * 100;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(base, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: U.time, uCenter: { value: new THREE.Vector3() }, uBox: { value: 8 },
      uSpotPos: { value: new THREE.Vector3() }, uSpotDir: { value: new THREE.Vector3(0, 0, -1) },
      uCos: { value: Math.cos(F.angle) }, uOn: { value: 1 }, uPx: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uBox, uCos, uOn, uPx;
      uniform vec3 uCenter, uSpotPos, uSpotDir;
      varying float vA;
      void main() {
        vec3 drift = vec3(sin(uTime * 0.11 + aSeed), sin(uTime * 0.07 + aSeed * 1.3) - uTime * 0.02, cos(uTime * 0.09 + aSeed)) * 0.6;
        vec3 w = uCenter + mod(position * uBox + drift - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 d = w - uSpotPos;
        float dist = length(d);
        float c = dot(d / max(dist, 1e-3), uSpotDir);
        vA = smoothstep(uCos, mix(uCos, 1.0, 0.35), c) * smoothstep(7.5, 1.0, dist) * smoothstep(0.3, 0.9, dist) * uOn;
        vA *= 0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 5.0);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_PointSize = uPx * 22.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vA * 0.55;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, 1.0);
      }`,
  });
  const dust = new THREE.Points(dg, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // 가로등 빛줄기 + 날벌레(공전하는 Points)
  const shafts = [];
  for (const lamp of ctx.lights.yardLamps) {
    const h = lamp.headPos.y - 0.1;
    const shaft = new THREE.Mesh(coneGeo(h, 0.42), beamMaterial(PALETTE.lampWarm, 0.035, h, 0.15));
    shaft.position.copy(lamp.headPos).add(new THREE.Vector3(0, -0.1, 0));
    shaft.lookAt(shaft.position.x, 0, shaft.position.z);
    shaft.renderOrder = 3;
    scene.add(shaft);
    const M = 26;
    const ph = new Float32Array(M * 3);
    for (let i = 0; i < M * 3; i++) ph[i] = Math.random();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(ph, 3));
    const bugMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.time, uC: { value: lamp.headPos.clone() }, uOn: { value: 1 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uOn, uPx; uniform vec3 uC; varying float vA;
        void main() {
          float a = position.x * 6.283 + uTime * (1.2 + position.y * 2.0);
          float r = 0.25 + position.z * 0.7;
          vec3 w = uC + vec3(cos(a) * r, -0.35 + sin(uTime * 2.3 + position.y * 9.0) * 0.3, sin(a * 1.3) * r);
          vA = uOn * (0.6 + 0.4 * sin(uTime * 7.0 + position.x * 40.0));
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_PointSize = uPx * 9.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * smoothstep(0.5, 0.1, r) * vA, 1.0); }`,
    });
    const bugs = new THREE.Points(bg, bugMat);
    bugs.frustumCulled = false;
    scene.add(bugs);
    shafts.push({ lamp, shaft, bugMat });
  }

  // 웅덩이 (거칠기 0.1 이하, 강한 환경 반사)
  const pudMat = new THREE.MeshStandardMaterial({
    color: 0x15181d, roughness: 0.06, metalness: 0.1, envMapIntensity: 3, transparent: true, opacity: 0.85,
    alphaMap: puddleTexture(3), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  for (const [x, z, s] of [[-3, 4, 3.2], [4.5, -4.5, 2.6], [-8.4, -2.8, 2.2], [2.2, -11, 2.8], [10.8, 5.6, 2.0], [1.5, -20, 3]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.8), pudMat);
    p.rotation.set(-Math.PI / 2, 0, x * 0.7);
    p.position.set(x, 0.006, z);
    p.receiveShadow = true;
    scene.add(p);
  }

  const tmp = new THREE.Vector3();
  return {
    setLevel(lvl) {
      groups[1].visible = lvl >= 1;
      groups[2].visible = lvl >= 2;
      dust.visible = lvl >= 1;
    },
    setFogDensity(d) {
      for (const m of fogMats) m.uniforms.uFog.value = d;
    },
    setPixelRatio(pr) {
      dustMat.uniforms.uPx.value = pr;
      for (const s of shafts) s.bugMat.uniforms.uPx.value = pr;
    },
    update(camera) {
      const on = flashlight.on;
      cone.visible = on;
      cone.position.copy(flashlight.spot.position);
      cone.lookAt(tmp.copy(flashlight.spot.position).add(flashlight.dir));
      const u = dustMat.uniforms;
      u.uCenter.value.copy(camera.position);
      u.uSpotPos.value.copy(flashlight.spot.position);
      u.uSpotDir.value.copy(flashlight.dir);
      u.uOn.value = on ? 1 : 0;
      for (const s of shafts) {
        s.shaft.material.uniforms.uAlpha.value = 0.035 * s.lamp.on;
        s.bugMat.uniforms.uOn.value = s.lamp.on;
      }
    },
  };
}
