// 본관 실내 조립 (단계 8 = 옛 1b): 평면 → 충돌 → 그리기(구조·가구·문) → 현관 자동문 → 분위기.
// 실내는 바깥 월드(root)와 같은 장면에 따로 묶어 둔다 (분위기가 서로를 숨길 수 있게). 외부와 한 월드 (결정 D2·D6).
import * as THREE from 'three';
import data from '../../../data/mainInterior.json';
import { buildPlan, addInteriorCollision } from './plan.js';
import { furniturePlan, addFurnitureCollision } from './furniture.js';
import { interiorMaterials } from './materials.js';
import { Batch } from './batch.js';
import { buildStructure } from './build.js';
import { Doors } from './doors.js';
import { EntranceDoor } from './lobby.js';
import { Atmosphere } from './atmosphere.js';
import { doorRattle } from '../../audio/door.js';
import { pilotiBackZ } from '../layout.js';
import { SCHOOL } from '../../config.js';

// 그림자를 만들지 않는 면 (바닥·천장·형광등·유리·난간 살)
const NO_CAST = new Set(['floorTile', 'floorWood', 'floorStone', 'ceiling', 'court', 'fixture', 'frosted', 'railBars', 'stair']);

export function buildInterior(scene, M, col, ctx, renderer) {
  const P = buildPlan(data);
  const handles = addInteriorCollision(col, P);
  const FP = furniturePlan(P);
  addFurnitureCollision(col, FP);
  const MI = interiorMaterials(M);

  const root = new THREE.Group();
  root.name = 'interior';
  scene.add(root);
  const groups = {};
  for (let L = 0; L <= P.top; L++) groups[`L${L}`] = new THREE.Group();
  groups.shaft = new THREE.Group();
  for (const [name, g] of Object.entries(groups)) {
    g.name = `interior:${name}`;
    root.add(g);
  }

  const batch = new Batch();
  const extra = buildStructure(P, batch, MI);
  for (const it of FP.items) batch.box(`L${it.L}`, it.mat, ...it.b, it.faces, { local: it.local, tile: it.tile });
  const doors = new Doors(P, handles, MI, batch);
  extra.add(doors.mesh);
  // 현관 문턱 (셸 벽 두께, 계단 위 높이)
  const e = P.entrance;
  batch.box('L0', 'floorStone', e.x - 0.05, 0, e.z0 - e.frame, e.x + SCHOOL.shellWall + 0.05, e.y, e.z1 + e.frame, 't');
  batch.build(MI, groups, { cast: (m) => !NO_CAST.has(m) });
  root.add(extra);
  groups.extra = extra;

  const entrance = new EntranceDoor(P, handles.get('entrance'), MI, M, ctx.entrance.group);
  const atmo = new Atmosphere({ P, renderer, lights: ctx.lights, scene, outdoor: ctx.root, groups });
  let audio = null;

  return {
    plan: P,
    furniture: FP,
    doors,
    entrance,
    atmo,
    // 상호작용(E)·소리 연결 (main.js 에서 스토리 준비 뒤)
    attach({ interactions, toast, audio: a, player }) {
      audio = a;
      doors.attach({ interactions, toast, audio, player });
      // 필로티 끝·출입문 홀 유리벽 (안팎 어디서나, 잠김)
      const pz = pilotiBackZ() - SCHOOL.shellWall / 2;
      const pos = new THREE.Vector3(0, 1.5, pz);
      interactions.add({
        id: 'door:pilotiGlass', pos: [0, pz], level: 0, label: P.messages.glassLabel,
        onUse: () => {
          doorRattle(audio, pos);
          toast(P.messages.glassLocked);
        },
      });
    },
    update(dt, player, camera) {
      doors.update(dt);
      entrance.update(dt, player, audio);
      atmo.update(dt, player, camera);
    },
    // 스크린샷 모드: 문·분위기를 바로 최종 상태로
    snap(player, camera) {
      entrance.update(0, player, null);
      entrance.snap();
      atmo.update(0, player, camera, true);
    },
  };
}
