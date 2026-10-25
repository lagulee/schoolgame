import * as THREE from 'three';
import { PALETTE } from '../config.js';

// 밤하늘 돔: 지평선 쪽 도시광(주황 기운) → 천정 짙은 남색, 희미한 별, 구름 사이 달. 안개 영향 없음.
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x05070d) },
      uHorizon: { value: new THREE.Color(0x1a2130) },
      uGlow: { value: new THREE.Color(0x3a2c26) },
      uMoonDir: { value: new THREE.Vector3(0.45, 0.62, 0.64).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uGlow, uMoonDir;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        col += uGlow * pow(1.0 - clamp(h, 0.0, 1.0), 6.0) * 0.8;
        // 구름: 느린 저주파 노이즈로 달빛을 받은 흐린 띠
        float cl = vn(d * 3.0 + vec3(0.0, 0.0, 1.7)) * 0.6 + vn(d * 7.0) * 0.4;
        float cloud = smoothstep(0.45, 0.8, cl) * smoothstep(0.02, 0.25, h);
        // 별
        vec3 sp = floor(d * 380.0);
        float star = step(0.9975, hash(sp)) * smoothstep(0.08, 0.4, h) * (1.0 - cloud);
        col += vec3(0.55, 0.6, 0.7) * star * 0.5;
        // 달 + 달무리
        float md = dot(d, normalize(uMoonDir));
        col += vec3(0.75, 0.8, 0.9) * smoothstep(0.99955, 0.9997, md) * 1.6;
        col += vec3(0.18, 0.22, 0.3) * pow(max(md, 0.0), 120.0) * 0.6;
        col = mix(col, col * 0.6 + vec3(0.05, 0.06, 0.08), cloud * 0.8);
        col *= 1.0 - smoothstep(0.0, -0.2, d.y) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

// 어두운 그라데이션 환경을 PMREM 으로 변환 → scene.environment (젖은 듯한 은은한 반사)
export function buildEnvironment(renderer, scene, intensity) {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.attributes.position;
  const colors = [];
  const top = new THREE.Color(PALETTE.hemiSky);
  const hor = new THREE.Color(0x2b3446);
  const bot = new THREE.Color(PALETTE.hemiGround);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(hor).lerp(top, Math.min(1, y * 1.8));
    else c.copy(hor).lerp(bot, Math.min(1, -y * 4));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // 반사 속 가로등·창 빛 몇 점
  const blob = (color, x, y, z, s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    env.add(m);
  };
  blob(new THREE.Color(PALETTE.lampWarm).multiplyScalar(2.5), 6, 2.5, 4, 0.6);
  blob(new THREE.Color(PALETTE.lampWarm).multiplyScalar(2.5), -7, 2.2, 5, 0.5);
  blob(new THREE.Color(PALETTE.led).multiplyScalar(2), 7, 1.5, -6, 0.5);
  blob(new THREE.Color(PALETTE.parkGreen).multiplyScalar(1.5), 0, 1.2, -9, 0.7);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02, 0.1, 100);
  pmrem.dispose();
  scene.environment = rt.texture;
  scene.environmentIntensity = intensity;
  return rt.texture;
}
