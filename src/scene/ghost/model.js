// 귀신 3D 모델 (교복을 입은 죽은 학생): 몸통·팔·다리·맨발·손은 loft, 머리는 깎은 구, 젖은 머리카락은 띠 묶음.
// 발바닥이 y = 0, 앞이 +z. 외부 에셋 없이 절차 도형·텍스처만 쓴다.
import * as THREE from 'three';
import { loft, merge } from './loft.js';
import { headGeometry, EYES } from './head.js';
import { hairGeometry } from './hair.js';
import { ghostTextures } from './textures.js';

const P = (x, y, z, rx, rz = rx) => ({ p: [x, y, z], rx, rz });

// 몸통(재킷): 아래단 → 허리 → 가슴 → 어깨 → 목둘레. 등은 조금 납작하다
const TORSO = [P(0, 0.78, 0.005, 0.188, 0.128), P(0, 0.86, 0.0, 0.176, 0.116), P(0, 0.98, 0.0, 0.164, 0.104), P(0, 1.12, 0.005, 0.178, 0.114), P(0, 1.26, 0.012, 0.196, 0.122), P(0, 1.35, 0.014, 0.204, 0.116), P(0, 1.395, 0.013, 0.2, 0.108), P(0, 1.43, 0.012, 0.185, 0.098), P(0, 1.455, 0.012, 0.155, 0.088), P(0, 1.475, 0.013, 0.112, 0.074), P(0, 1.495, 0.014, 0.07, 0.062)];
// 단면은 조금 각진 타원(초타원), 등은 조금 납작하다
const torsoShape = (th) => {
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  const sq = 1 / Math.pow(Math.pow(c, 2.6) + Math.pow(s, 2.6), 1 / 2.6);
  return sq * (Math.sin(th) < 0 ? 1 - 0.1 * -Math.sin(th) : 1);
};

const arm = (sx, drop) => [P(sx * 0.165, 1.405 - drop, 0.012, 0.045), P(sx * 0.2, 1.37 - drop, 0.008, 0.056), P(sx * 0.214, 1.28 - drop, 0.0, 0.051, 0.053), P(sx * 0.222, 1.13 - drop, -0.008, 0.043, 0.046), P(sx * 0.214, 0.98 - drop, 0.008, 0.039, 0.041), P(sx * 0.205, 0.85 - drop, 0.028, 0.035, 0.037)];

// 손: 손바닥이 허벅지를 향해 늘어지고 손가락이 살짝 굽는다
function handGeometry(sx, drop) {
  const y0 = 0.85 - drop;
  const x = sx * 0.205;
  const parts = [loft([P(x, y0 + 0.01, 0.028, 0.026, 0.03), P(x, y0 - 0.01, 0.03, 0.017, 0.042), P(x + sx * 0.002, y0 - 0.06, 0.032, 0.015, 0.044), P(x + sx * 0.001, y0 - 0.085, 0.034, 0.013, 0.04)], { seg: 12, capEnd: true })];
  [[-0.026, 0.074], [-0.009, 0.086], [0.009, 0.083], [0.026, 0.068]].forEach(([dz, L]) => {
    const z = 0.034 + dz;
    const top = y0 - 0.085;
    const curl = -sx * 0.012;
    parts.push(loft([P(x, top + 0.004, z, 0.0085), P(x + curl * 0.3, top - L * 0.4, z + 0.002, 0.0078), P(x + curl * 0.8, top - L * 0.78, z + 0.004, 0.0068), P(x + curl, top - L, z + 0.004, 0.0055)], { seg: 8, capEnd: true }));
  });
  parts.push(loft([P(x - sx * 0.004, y0 - 0.03, 0.06, 0.011), P(x - sx * 0.008, y0 - 0.07, 0.074, 0.0085), P(x - sx * 0.01, y0 - 0.1, 0.078, 0.007)], { seg: 8, capEnd: true }));
  return merge(parts);
}

const leg = (sx) => [P(sx * 0.094, 0.86, 0.0, 0.09, 0.094), P(sx * 0.097, 0.62, 0.004, 0.077, 0.082), P(sx * 0.1, 0.47, 0.01, 0.062, 0.066), P(sx * 0.101, 0.27, 0.0, 0.059, 0.061), P(sx * 0.101, 0.12, -0.006, 0.057, 0.059), P(sx * 0.101, 0.075, -0.006, 0.058, 0.06)];

// 맨발: 발목 → 뒤꿈치 → 발등 → 발가락
function footGeometry(sx) {
  const x = sx * 0.101;
  const ankle = loft([P(x, 0.14, -0.01, 0.032, 0.034), P(x, 0.07, -0.012, 0.034, 0.038)], { seg: 12 });
  const foot = loft([P(x, 0.04, -0.07, 0.022, 0.022), P(x, 0.042, -0.05, 0.033, 0.036), P(x + sx * 0.003, 0.038, 0.02, 0.04, 0.034), P(x + sx * 0.006, 0.028, 0.1, 0.044, 0.024), P(x + sx * 0.008, 0.018, 0.155, 0.042, 0.014), P(x + sx * 0.008, 0.014, 0.172, 0.03, 0.01)], { seg: 14, capStart: true, capEnd: true });
  return merge([ankle, foot]);
}

// pose: idle = 고개를 떨굼(평소), stare = 고개를 들고 똑바로 봄(점프스케어)
const POSES = { idle: [0.42, -0.13], stare: [0.06, -0.2] };

// 눈꺼풀: 눈알보다 조금 큰 구에서 앞쪽 아몬드 모양만 뚫는다 (크게 뜬 눈)
function lidGeometry() {
  const g = new THREE.SphereGeometry(0.0138, 28, 20);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const open = (i) => {
    v.fromBufferAttribute(p, i).normalize();
    return v.z > 0.3 && (v.x / 0.8) ** 2 + ((v.y + 0.02) / 0.5) ** 2 < 0.66;
  };
  const src = g.index.array;
  const keep = [];
  for (let i = 0; i < src.length; i += 3) if (!(open(src[i]) && open(src[i + 1]) && open(src[i + 2]))) keep.push(src[i], src[i + 1], src[i + 2]);
  g.setIndex(keep);
  return g;
}

export function buildGhostModel({ pose = 'idle' } = {}) {
  const [pitch, roll] = POSES[pose] ?? POSES.idle;
  const T = ghostTextures();
  const root = new THREE.Group();
  root.name = 'ghostModel';
  const rep = (maps, x, y) => Object.fromEntries(Object.entries(maps).map(([k, t]) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return [k, c]; }));
  const mats = {
    jacket: new THREE.MeshStandardMaterial({ ...T.jacket, normalScale: new THREE.Vector2(0.8, 0.8) }),
    sleeve: new THREE.MeshStandardMaterial({ ...T.sleeve }),
    trousers: new THREE.MeshStandardMaterial({ ...T.trousers }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x8e918d, roughness: 0.7 }),
    skin: new THREE.MeshStandardMaterial({ ...rep(T.skin, 2, 2), color: 0x99a09b }),
    face: new THREE.MeshStandardMaterial({ ...rep(T.skin, 3, 2), color: 0xa3aaa5, vertexColors: true }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x030303 }),
    lid: new THREE.MeshStandardMaterial({ ...rep(T.skin, 1, 1), color: 0x6e7470 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.08 }), // 흰자 없이 새까만 눈 (젖어 번들거림)
    hair: new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.5, alphaMap: T.hair, alphaTest: 0.35, side: THREE.DoubleSide }),
  };
  const add = (geo, mat, name, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  add(loft(TORSO, { seg: 28, shape: torsoShape, capStart: true }), mats.jacket, 'torso');
  // 오른쪽(−x) 어깨가 조금 처졌다
  add(merge([loft(arm(1, 0), { seg: 16, capStart: true }), loft(arm(-1, 0.022), { seg: 16, capStart: true })]), mats.sleeve, 'arms');
  add(merge([handGeometry(1, 0), handGeometry(-1, 0.022), footGeometry(1), footGeometry(-1)]), mats.skin, 'handsFeet');
  add(merge([loft(leg(1), { seg: 18, capStart: true }), loft(leg(-1), { seg: 18, capStart: true })]), mats.trousers, 'legs');
  add(loft([P(0, 1.462, 0.014, 0.068, 0.06), P(0, 1.52, 0.03, 0.06, 0.056)], { seg: 18 }), mats.shirt, 'collar');
  add(loft([P(0, 1.47, 0.012, 0.05, 0.046), P(0, 1.53, 0.03, 0.047, 0.044), P(0, 1.57, 0.045, 0.043, 0.042)], { seg: 16 }), mats.skin, 'neck');
  // 머리: 목 위에서 앞으로 떨구고 오른쪽으로 조금 기울어짐
  const neck = new THREE.Group();
  neck.position.set(0, 1.565, 0.045);
  neck.rotation.set(pitch, 0, roll);
  root.add(neck);
  const head = add(headGeometry(), mats.face, 'head', neck);
  head.position.set(0, 0.082, 0.022);
  head.scale.set(0.073, 0.118, 0.1);
  for (const e of EYES) {
    const m = add(new THREE.SphereGeometry(0.0125, 20, 14), mats.eye, 'eye', head);
    m.position.copy(e);
    m.scale.set(1 / 0.073, 1 / 0.118, 1 / 0.1);
    m.rotation.x = 0.06 - pitch; // 떨군 고개에서도 눈동자는 앞(보는 사람)을 똑바로 본다
    const lid = add(lidGeometry(), mats.lid, 'lid', head); // 눈꺼풀: 아몬드 모양 틈으로만 눈알이 보인다
    lid.position.copy(e);
    lid.scale.copy(m.scale);
  }
  // 살짝 벌어진 입 안 (검은 틈)
  const mouth = add(new THREE.SphereGeometry(1, 20, 12), mats.mouth, 'mouth', head);
  mouth.position.set(0, -0.56, 0.74);
  mouth.scale.set(0.2, 0.026, 0.12);
  root.updateMatrixWorld(true);
  const hair = add(hairGeometry(head.matrixWorld.clone()), mats.hair, 'hair');
  hair.castShadow = false;
  root.userData.mats = mats;
  return root;
}
