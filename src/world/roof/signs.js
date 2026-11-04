// 옥상 크레딧 간판 (단계 21, STORY 16장 확정: 입간판·네온 간판·풀 바닥 타일 문구). 문구는 data/credits.json (+ 있으면 credits.local.json),
// 인물은 {id} 자리표시자 → text() 가 가명(또는 로컬 덮어쓰기 이름)으로 채운다. 자리·종류는 data/roof.json signs.
// 입간판 = 데크에 세운 A자 판(앞면 글자, 약하게 스스로 빛남), 네온 = 북쪽 난간 위 검은 판에 빛나는 글자(처음 한 번 서서히 켜짐),
// 바닥 타일 = 수영장 바닥 텍스처(poolFloorTexture, build.js 가 바닥에 깐다).
import * as THREE from 'three';
import { ROOF } from '../../config.js';
import { textPanel, poolFloorTexture } from './textures.js';
import { addBlock } from '../geom.js';

// 크레딧 항목 → 간판 줄 (글자 높이 m)
export function creditLines(entry, kind, text = (s) => s) {
  const S = ROOF.sign;
  const names = entry.names.map((n) => text(n));
  if (kind === 'stand') return [{ text: entry.label, h: S.stand.label, color: '#5a4b3c' }, ...names.map((n) => ({ text: n, h: S.stand.name, color: '#1d1712' }))];
  if (kind === 'neon') return [{ text: entry.label, h: S.neon.label, color: S.neon.label2, glow: true }, ...names.map((n) => ({ text: n, h: S.neon.name, color: S.neon.color, glow: true }))];
  return [{ text: entry.label, h: S.tile.sub * 0.7, color: S.tile.label }, ...names.map((n, i) => ({ text: n, h: i ? S.tile.sub : S.tile.name, color: S.tile.color }))];
}

// 앞면이 normal [nx, nz] 쪽을 보게 하는 y 회전 (PlaneGeometry 앞면 = +z)
const faceYaw = ([nx, nz]) => Math.atan2(nx, nz);

// 입간판: 앞판(글자) + 뒤판, 위가 서로 기대는 A자. y = 데크 높이
function standSign(g, s, entry, text, y, M) {
  const S = ROOF.sign.stand;
  const tex = textPanel(S.w, S.h, creditLines(entry, 'stand', text), { font: ROOF.sign.font, bg: '#efe8dc', ppm: 512, border: '#3b3027' });
  const front = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22, roughness: 0.8 });
  const back = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.9 });
  const yaw = faceYaw(s.normal);
  const half = (S.h / 2) * Math.cos(S.tilt);
  const lean = (S.h / 2) * Math.sin(S.tilt);
  const [x, z] = s.pos;
  const [nx, nz] = s.normal;
  for (const [mat, side] of [[front, 1], [back, -1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(S.w, S.h, 0.025), side > 0 ? [back, back, back, back, front, back] : back);
    m.rotation.order = 'YXZ';
    m.rotation.set(-S.tilt * side, yaw, 0);
    m.position.set(x + nx * lean * side, y + S.legH + half, z + nz * lean * side);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  addBlock(g, M.iron, x - 0.05, y + S.legH + S.h * 0.35, z - 0.05, x + 0.05, y + S.legH + S.h * 0.38, z + 0.05, { cast: false }); // 가운데 걸쇠
}

// 네온 간판: 검은 판 + 빛나는 글자 판 + 받침 기둥 2개. 반환 글자 재질 (밝기 = 켜짐 정도)
function neonSign(g, s, entry, text, y, M) {
  const S = ROOF.sign.neon;
  const tex = textPanel(S.w, S.h, creditLines(entry, 'neon', text), { font: ROOF.sign.font, ppm: 160 });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0x000000, toneMapped: true });
  const yaw = faceYaw(s.normal);
  const [x, z] = s.pos;
  const [nx, nz] = s.normal;
  const y0 = y + S.y;
  const board = new THREE.Mesh(new THREE.BoxGeometry(S.w + 0.2, S.h + 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.6, metalness: 0.4 }));
  board.rotation.y = yaw;
  board.position.set(x - nx * 0.05, y0 + S.h / 2, z - nz * 0.05);
  board.castShadow = true;
  g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.h), mat);
  face.rotation.y = yaw;
  face.position.set(x, y0 + S.h / 2, z);
  face.renderOrder = 2;
  g.add(face);
  const ax = Math.abs(nz) > 0.5 ? 1 : 0; // 판이 놓인 방향 (기둥은 판 양끝)
  for (const k of [-1, 1]) {
    const px = x - nx * 0.12 + ax * k * (S.w / 2 - 0.2);
    const pz = z - nz * 0.12 + (1 - ax) * k * (S.w / 2 - 0.2);
    addBlock(g, M.iron, px - 0.04, y, pz - 0.04, px + 0.04, y0, pz + 0.04);
  }
  const light = new THREE.PointLight(S.light.color, 0, S.light.distance, 2);
  light.position.set(x + nx * 0.8, y0 + S.h / 2, z + nz * 0.8);
  g.add(light);
  return { mat, light };
}

// 간판 전부. credits = { entries }, text = 자리표시자 채우기. 반환 { neon: { mat, light } | null, floor: 수영장 바닥 텍스처 | null }
export function buildSigns(g, def, credits, text, y, M) {
  const byId = new Map(credits.entries.map((e) => [e.id, e]));
  const out = { neon: null, floor: null, texts: {} };
  for (const s of def.signs) {
    const entry = byId.get(s.credit);
    if (!entry) throw new Error(`옥상 간판 ${s.id}: credits.json 에 ${s.credit} 없음`);
    out.texts[s.id] = creditLines(entry, s.kind, text).map((l) => l.text);
    if (s.kind === 'stand') standSign(g, s, entry, text, y, M);
    else if (s.kind === 'neon') out.neon = neonSign(g, s, entry, text, y, M);
    else if (s.kind === 'tile') {
      const [x0, z0, x1, z1] = def.pool;
      out.floor = poolFloorTexture([x1 - x0, z1 - z0], creditLines(entry, 'tile', text), ROOF.sign.font);
    }
  }
  return out;
}

// 5층 옥상 문 위 "옥상" 글자 판
export function plateTexture(label) {
  return textPanel(0.46, 0.17, [{ text: label, h: 0.1, color: '#e8ece6' }], { font: ROOF.sign.font, bg: '#1f5a3a', ppm: 400 });
}
