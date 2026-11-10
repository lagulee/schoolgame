// 옥상 수영장 그리기·충돌 (단계 21, STORY 16장). 자리는 data/roof.json, 수치는 ROOF (src/config/roof.js).
// 본관 지붕 슬래브 위(같은 월드)의 나무 데크(층 ROOF.level) + 데크에 묻힌 수영장(바닥 타일 크레딧·물결·청록 조명) + 둘레 유리 난간
// + 계단탑(S2 계단실 위, 옥상 쪽 문) + 선베드·작은 등 + 입간판·네온 간판. 옥상 묶음은 옥상에 있을 때만 보인다 (scene/roofView.js 가 켠다
// — 바깥에서 보이지 않고, 광원 수가 바뀌는 셰이더 다시 짓기는 암전 속에서 한 번).
// 5층 옥상 문(철문·"옥상" 판)은 본관 5층 묶음(interior:L4)에 넣어 층과 함께 보이고 숨는다.
import * as THREE from 'three';
import { DIM, ROOF } from '../../config.js';
import { yAt } from '../interior/plan.js';
import { addBlock, addBlocks, instanced, mat4, boxGeo } from '../geom.js';
import { deckTexture, tileTexture, causticTexture } from './textures.js';
import { buildSigns, plateTexture } from './signs.js';

export const roofY = () => DIM.floors * DIM.floorH; // 지붕 슬래브 윗면
export const deckY = () => roofY() + ROOF.deckH;

// 사각형 D 에서 안쪽 사각형 P 를 뺀 4조각 [x0, z0, x1, z1]
export function ring(D, P) {
  return [
    [D[0], D[1], D[2], P[1]],
    [D[0], P[3], D[2], D[3]],
    [D[0], P[1], P[0], P[3]],
    [P[2], P[1], D[2], P[3]],
  ];
}
const grow = ([x0, z0, x1, z1], m) => [x0 - m, z0 - m, x1 + m, z1 + m];

// 충돌 (층 ROOF.level): 데크 바닥 + 둘레 막기 + 수영장(물에 들어가지 않음) + 선베드·입간판. 발소리: 데크 wood, 수영장 테 tile
export function addRoofCollision(col, def) {
  const L = ROOF.level;
  const D = def.deck;
  const y = deckY();
  col.floor(...D, y, L);
  const t = 0.3;
  col.box(D[0] - t, D[1] - t, D[0], D[3] + t, L); // 서쪽 (계단탑 벽 포함)
  col.box(D[2], D[1] - t, D[2] + t, D[3] + t, L);
  col.box(D[0] - t, D[1] - t, D[2] + t, D[1], L);
  col.box(D[0] - t, D[3], D[2] + t, D[3] + t, L);
  col.box(...def.pool, L);
  const W = ROOF.lounger;
  for (const [x, z] of def.loungers) col.box(x - W.w / 2, z - W.l / 2, x + W.w / 2, z + W.l / 2, L);
  for (const s of def.signs.filter((v) => v.kind === 'stand')) col.box(s.pos[0] - 0.45, s.pos[1] - 0.5, s.pos[0] + 0.45, s.pos[1] + 0.5, L);
  col.surface(...D, 'wood', L);
  col.surface(...grow(def.pool, ROOF.pool.coping), 'tile', L);
}

// 옥상 묶음. M = 월드 재질, credits = { entries }, text = 자리표시자 채우기, floor5 = 본관 5층 묶음 (옥상 문을 넣는다)
export function buildRoof(scene, M, { def, credits, text, floor5 }) {
  const g = new THREE.Group();
  g.name = 'roof';
  g.visible = false;
  scene.add(g);
  const yR = roofY();
  const yD = deckY();
  const P = def.pool;
  const C = ROOF.pool;
  const c = C.coping;

  // 데크 (수영장 자리를 비운 4조각, 판 1.6 m)
  const deck = deckTexture();
  const deckMat = new THREE.MeshStandardMaterial({ map: deck, roughness: 0.85 });
  addBlocks(g, deckMat, ring(def.deck, P).map(([x0, z0, x1, z1]) => [x0, yR, z0, x1, yD, z1]), { tile: 1.6, cast: false });
  // 수영장 테 (돌)
  addBlocks(g, M.granite, ring(grow(P, c), P).map(([x0, z0, x1, z1]) => [x0, yD - 0.02, z0, x1, yD + 0.04, z1]), { tile: 1, cast: false });

  // 수영장: 바닥(타일 + 크레딧 문구), 안쪽 벽(타일), 물
  const signs = buildSigns(g, def, credits, text, yD, M);
  const yW = yD - C.water;
  const yB = yW - C.depth;
  const [w, d] = [P[2] - P[0], P[3] - P[1]];
  const floorTex = signs.floor ?? tileTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, emissive: 0x9ff2ee, emissiveMap: floorTex, emissiveIntensity: C.glow, roughness: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((P[0] + P[2]) / 2, yB, (P[1] + P[3]) / 2);
  g.add(floor);
  const wallTex = tileTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, emissive: 0x9ff2ee, emissiveMap: wallTex, emissiveIntensity: C.glow * 0.7, roughness: 0.4, side: THREE.DoubleSide });
  const h = yD - yB;
  for (const [len, x, z, ry] of [[w, (P[0] + P[2]) / 2, P[1], 0], [w, (P[0] + P[2]) / 2, P[3], Math.PI], [d, P[0], (P[1] + P[3]) / 2, Math.PI / 2], [d, P[2], (P[1] + P[3]) / 2, -Math.PI / 2]]) {
    const geo = new THREE.PlaneGeometry(len, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * h);
    const m = new THREE.Mesh(geo, wallMat);
    m.rotation.y = ry;
    m.position.set(x + Math.sin(ry) * 0.006, yB + h / 2, z + Math.cos(ry) * 0.006); // 데크·테의 안쪽 면과 같은 평면이면 지지직거린다 → 수영장 안쪽으로 6 mm (v1.28.9)
    g.add(m);
  }
  const wave = causticTexture();
  wave.repeat.set(w / 2.5, d / 2.5);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1d7f8c, map: wave, emissive: 0x2fb7bd, emissiveMap: wave, emissiveIntensity: C.glow * 0.45,
    roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set((P[0] + P[2]) / 2, yW, (P[1] + P[3]) / 2);
  water.renderOrder = 1;
  g.add(water);
  const poolLight = new THREE.PointLight(C.light.color, C.light.intensity, C.light.distance, 2);
  poolLight.position.set((P[0] + P[2]) / 2, yD + C.light.y, (P[1] + P[3]) / 2);
  g.add(poolLight);

  // 둘레 난간 (기둥 + 위 손잡이 + 유리판). 계단탑이 막는 서쪽 구간은 비운다
  const F = ROOF.fence;
  const D = def.deck;
  const H = def.penthouse.rect;
  const posts = [];
  const rails = [];
  const glass = [];
  const edge = (a0, a1, fixed, alongX) => {
    const n = Math.max(1, Math.round((a1 - a0) / F.post));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      posts.push(alongX ? mat4(a, yD + F.h / 2, fixed) : mat4(fixed, yD + F.h / 2, a));
    }
    const mid = (a0 + a1) / 2;
    const len = a1 - a0;
    rails.push(alongX ? [a0, yD + F.h - 0.04, fixed - 0.04, a1, yD + F.h + 0.02, fixed + 0.04] : [fixed - 0.04, yD + F.h - 0.04, a0, fixed + 0.04, yD + F.h + 0.02, a1]);
    glass.push(alongX ? mat4(mid, yD + 0.08 + F.glass / 2, fixed, 0, len, F.glass, 1) : mat4(fixed, yD + 0.08 + F.glass / 2, mid, Math.PI / 2, len, F.glass, 1));
  };
  edge(D[0], D[2], D[1], true);
  edge(D[0], D[2], D[3], true);
  edge(D[1], H[1], D[0], false);
  edge(H[3], D[3], D[0], false);
  edge(D[1], D[3], D[2], false);
  g.add(instanced(new THREE.CylinderGeometry(F.t, F.t, F.h, 8), M.iron, posts));
  addBlocks(g, M.iron, rails, { cast: false });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  g.add(instanced(new THREE.PlaneGeometry(1, 1), glassMat, glass, { cast: false, receive: false }));

  // 계단탑 + 옥상 쪽 문 + 문 위 작은 등
  const PH = ROOF.penthouse;
  addBlock(g, M.concrete, H[0], yR, H[1], H[2], yD + PH.h, H[3], { tile: 3 });
  addBlock(g, M.concrete, H[0] - 0.15, yD + PH.h, H[1] - 0.15, H[2] + 0.15, yD + PH.h + 0.15, H[3] + 0.15, { tile: 3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d6a63, roughness: 0.55, metalness: 0.6 });
  const [hx, hz] = def.penthouse.door;
  addBlock(g, steel, hx, yD, hz - def.door.w / 2, hx + 0.05, yD + def.door.h, hz + def.door.w / 2);
  const warm = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffc777, emissiveIntensity: ROOF.bollard.glow });
  addBlock(g, warm, hx, yD + def.door.h + 0.2, hz - 0.15, hx + 0.08, yD + def.door.h + 0.3, hz + 0.15, { cast: false });

  // 선베드 (흰 틀 + 청록 쿠션), 데크 가장자리 작은 등
  const L = ROOF.lounger;
  const frame = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.6 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0x2f6f73, roughness: 0.9 });
  for (const [x, z] of def.loungers) {
    addBlock(g, frame, x - L.w / 2, yD + 0.1, z - L.l / 2, x + L.w / 2, yD + L.h - 0.1, z + L.l / 2);
    addBlock(g, cushion, x - L.w / 2 + 0.04, yD + L.h - 0.1, z - L.l / 2 + 0.05, x + L.w / 2 - 0.04, yD + L.h, z + L.l / 2 - 0.4);
    const back = new THREE.Mesh(boxGeo(L.w - 0.08, 0.06, 0.65), cushion);
    back.rotation.x = 0.9;
    back.position.set(x, yD + L.h + 0.22, z + L.l / 2 - 0.3);
    back.castShadow = true;
    g.add(back);
  }
  const B = ROOF.bollard;
  g.add(instanced(new THREE.CylinderGeometry(B.r, B.r * 1.2, B.h, 10), warm, def.bollards.map(([x, z]) => mat4(x, yD + B.h / 2, z)), { cast: false }));

  // 5층 옥상 문 (본관 5층 S2 계단 앞 층계참 북쪽 벽): 철문 + 문틀 + "옥상" 판
  const door = def.door;
  const y5 = yAt(door.level);
  const [dx, dz] = door.pos;
  const [nx, nz] = door.normal;
  const d5 = new THREE.Group();
  d5.name = 'roofDoor5F';
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(door.w, door.h, 0.05), steel);
  leaf.rotation.y = Math.atan2(nx, nz);
  leaf.position.set(dx + nx * 0.03, y5 + door.h / 2, dz + nz * 0.03);
  leaf.receiveShadow = true;
  d5.add(leaf);
  const fr = new THREE.MeshStandardMaterial({ color: 0x2b3030, roughness: 0.6, metalness: 0.5 });
  for (const [ox, oy, sw, sh] of [[-(door.w / 2 + 0.04), door.h / 2, 0.08, door.h + 0.08], [door.w / 2 + 0.04, door.h / 2, 0.08, door.h + 0.08], [0, door.h + 0.04, door.w + 0.16, 0.08]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.07), fr);
    m.rotation.y = leaf.rotation.y;
    m.position.set(dx + nz * ox + nx * 0.035, y5 + oy, dz - nx * ox + nz * 0.035);
    d5.add(m);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshStandardMaterial({ map: plateTexture(def.messages.plate), roughness: 0.7 }));
  plate.rotation.y = leaf.rotation.y;
  plate.position.set(dx + nx * 0.04, y5 + door.h + 0.3, dz + nz * 0.04);
  d5.add(plate);
  floor5?.add(d5);

  return {
    group: g,
    door5f: d5,
    poolLight,
    neon: signs.neon,
    texts: signs.texts,
    water: wave,
    update(dt) {
      wave.offset.x = (wave.offset.x + (dt * C.wave) / 2.5) % 1;
      wave.offset.y = (wave.offset.y + (dt * C.wave * 0.6) / 2.5) % 1;
    },
  };
}
