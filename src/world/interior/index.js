// 실내 조립 (단계 8 본관, 단계 9 신관·3층 연결통로): 평면 → 충돌 → 그리기(구조·가구·문) → 현관 자동문·연결문 → 분위기.
// 실내는 바깥 월드(root)와 같은 장면에 따로 묶어 둔다 (분위기가 서로를 숨길 수 있게). 외부와 한 월드 (결정 D2·D6).
// 묶음: 본관 L0…L4·shaft·extra, 신관 AL0…AL4·Ashaft·Aextra, 연결통로 bridge.
import * as THREE from 'three';
import mainData from '../../../data/mainInterior.json';
import annexData from '../../../data/annexInterior.json';
import { buildSite, addSiteCollision } from './site.js';
import { furniturePlan, addFurnitureCollision } from './furniture.js';
import { interiorMaterials } from './materials.js';
import { Batch } from './batch.js';
import { buildStructure } from './build.js';
import { Doors } from './doors.js';
import { EntranceDoor } from './lobby.js';
import { buildConnector, ConnectorDoor } from './connectorView.js';
import { Atmosphere } from './atmosphere.js';
import { doorLocked } from '../../audio/door.js';
import { pilotiBackZ } from '../layout.js';
import { SCHOOL } from '../../config.js';

// 그림자를 만들지 않는 면 (바닥·천장·형광등·유리·난간 살)
const NO_CAST = new Set(['floorTile', 'floorWood', 'floorStone', 'ceiling', 'court', 'fixture', 'fixtureLit', 'frosted', 'railBars', 'stair']);
const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

export function buildInterior(scene, M, col, ctx, renderer) {
  const site = buildSite(mainData, annexData);
  const P = site.main;
  const A = site.annex;
  const { doors: handles, connector: connectorHandles } = addSiteCollision(col, site);
  const FP = furniturePlan(P);
  const FA = furniturePlan(A, { yaja: annexData.yaja, spots: annexData.spots });
  addFurnitureCollision(col, FP);
  addFurnitureCollision(col, FA);
  const MI = interiorMaterials(M);

  const root = new THREE.Group();
  root.name = 'interior';
  scene.add(root);
  const groups = {};
  for (const g of ['', 'A']) {
    for (let L = 0; L <= P.top; L++) groups[`${g}L${L}`] = new THREE.Group();
    groups[`${g}shaft`] = new THREE.Group();
  }
  groups.bridge = new THREE.Group();
  for (const [name, g] of Object.entries(groups)) {
    g.name = `interior:${name}`;
    root.add(g);
  }

  const batch = new Batch();
  const extra = buildStructure(P, batch, MI);
  const extraA = buildStructure(A, batch, MI);
  for (const [plan, F] of [[P, FP], [A, FA]]) {
    for (const it of F.items) batch.box(`${plan.g}L${it.L}`, it.mat, ...it.b, it.faces, { local: it.local, tile: it.tile });
  }
  const doors = new Doors(P, handles, MI, batch);
  const doorsA = new Doors(A, handles, MI, batch);
  extra.add(doors.mesh);
  extraA.add(doorsA.mesh);
  groups.bridge.add(buildConnector(site.bridge, batch, MI));
  const connector = new ConnectorDoor(site.bridge, connectorHandles, MI);
  groups.bridge.add(connector.pivot);
  // 현관 문턱 (셸 벽 두께, 계단 위 높이)
  const e = P.entrance;
  batch.box('L0', 'floorStone', e.x - 0.05, 0, e.z0 - e.frame, e.x + SCHOOL.shellWall + 0.05, e.y, e.z1 + e.frame, 't');
  batch.build(MI, groups, { cast: (m) => !NO_CAST.has(m) });
  // 신관 책상 위 책 (사건에서 숨길 수 있게 따로)
  const books = FA.spots.filter((s) => s.book).map((s) => {
    const [x0, y0, z0, x1, y1, z1] = s.book;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), MI.book);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.rotation.y = 0.12; // 반듯하지 않게
    m.castShadow = true;
    extraA.add(m);
    return { id: s.id, mesh: m, interaction: annexData.spots.find((t) => t.id === s.id)?.interaction };
  });
  root.add(extra, extraA);
  groups.extra = extra;
  groups.Aextra = extraA;

  const entrance = new EntranceDoor(P, handles.get('entrance'), MI, M, ctx.entrance.group);
  const atmo = new Atmosphere({ site, renderer, lights: ctx.lights, scene, outdoor: ctx.root, groups });
  let audio = null;
  let runner = null;

  return {
    plan: P,
    annex: A,
    site,
    furniture: FP,
    doors,
    doorsA,
    connector,
    entrance,
    atmo,
    // 상호작용(E)·소리 연결 (main.js 에서 스토리 준비 뒤). hasKey(플래그 이름) = 열쇠 문, runner = 상호작용 사건(책),
    // lockSound(상호작용 id) = 잠긴 문 소리 종류 (data/map.json, 단계 10)
    attach({ interactions, toast, audio: a, player, hasKey, runner: r, lockSound }) {
      audio = a;
      runner = r ?? null;
      const ctx = { interactions, toast, audio, player, hasKey, lockSound };
      doors.attach(ctx);
      doorsA.attach(ctx);
      connector.attach(ctx);
      // 필로티 끝·출입문 홀 유리벽 (안팎 어디서나, 잠김)
      const pz = pilotiBackZ() - SCHOOL.shellWall / 2;
      const pos = new THREE.Vector3(0, 1.5, pz);
      interactions.add({
        id: 'door:pilotiGlass', pos: [0, pz], level: 0, label: P.messages.glassLabel,
        onUse: () => {
          doorLocked(audio, pos, lockSound?.('door:pilotiGlass'));
          toast(P.messages.glassLocked);
        },
      });
      // 신관 살펴보기 자리 (책상 위 책·배전반). 사건은 단계 13(2b)·14(3): 상호작용 사건이 열려 있으면 그것을, 아니면 임시 문구
      for (const s of annexData.spots) {
        const f = FA.spots.find((t) => t.id === s.id);
        const [x, z, d] = s.at ?? [];
        const at = f ? f.pos : [x + OUT[d][0] * 0.45, z + OUT[d][1] * 0.45];
        interactions.add({
          id: `spot:${s.id}`, pos: at, level: f ? f.L : s.level, label: s.label,
          onUse: () => {
            if (s.interaction && runner?.interact(s.interaction)) return;
            toast(s.text);
          },
        });
      }
    },
    update(dt, player, camera) {
      doors.update(dt);
      doorsA.update(dt);
      connector.update(dt);
      entrance.update(dt, player, audio);
      atmo.update(dt, player, camera);
      for (const b of books) b.mesh.visible = !(b.interaction && runner?.used?.has(b.interaction));
    },
    // 스크린샷 모드: 문·분위기를 바로 최종 상태로
    snap(player, camera) {
      entrance.update(0, player, null);
      entrance.snap();
      atmo.update(0, player, camera, true);
    },
  };
}
