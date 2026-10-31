// 3층 연결통로 그리기 + 연결문 (단계 9 = 옛 1c). 평면·충돌·문 상태는 connector.js.
// 통로는 바깥(bridge.js)과 같은 자리의 실내 면: 타일 바닥·천장·옆벽(띠창 아래·위)·띠창(어두운 발광면 + 창살)·창가 달빛,
// 셸 구멍 안 문 양옆 벽·문 위 벽·문틀, 꺼진 형광등. 묶음 'bridge'. 연결문 문짝은 경첩 축으로 도는 메시 하나.
import * as THREE from 'three';
import { ANNEX, INTERIOR, SCHOOL } from '../../config.js';
import { instanced, mat4 } from '../geom.js';
import { ConnectorState, connectorFixtures } from './connector.js';
import { doorSwing, doorLocked } from '../../audio/door.js';

const G = 'bridge';

export function buildConnector(P, batch, MI) {
  const Br = SCHOOL.bridge;
  const { y, ceil } = P;
  const [x0, z0, x1, z1] = P.rect;
  const [oz0, oz1] = P.outer;
  batch.floor(G, 'floorTile', P.rect, y, true);
  batch.floor(G, 'ceiling', P.rect, ceil, false);
  const t = INTERIOR.lining;
  const winM = [];
  const glowM = [];
  const D = INTERIOR.windowGlow.depth * 0.6;
  for (const side of ['w', 'e']) {
    const inX = side === 'w' ? 1 : -1; // 통로 안쪽 방향
    const xw = side === 'w' ? x0 : x1;
    const [a, b] = side === 'w' ? [xw - t, xw] : [xw, xw + t];
    const face = side === 'w' ? 'e' : 'w';
    batch.box(G, 'wall', a, y, z0, b, y + Br.sill, z1, face); // 띠창 아래
    batch.box(G, 'wall', a, y + Br.head, z0, b, ceil, z1, face); // 띠창 위
    for (const [za, zb] of [[z0, oz0], [oz1, z1]]) batch.box(G, 'wall', a, y + Br.sill, za, b, y + Br.head, zb, face); // 셸 두께 구간
    const [sa, sb] = side === 'w' ? [xw - 0.02, xw + 0.1] : [xw - 0.1, xw + 0.02];
    batch.box(G, 'concrete', sa, y + Br.sill - 0.04, oz0, sb, y + Br.sill, oz1, `t${face}`); // 창턱
    const ry = Math.atan2(inX, 0);
    for (const w of P.windows.filter((v) => v.side === side)) {
      const zc = (w.z0 + w.z1) / 2;
      const len = w.z1 - w.z0 - 0.08;
      winM.push(mat4(xw - inX * 0.03, y + (Br.sill + Br.head) / 2, zc, ry, len, Br.head - Br.sill, 1));
      glowM.push(mat4(xw + (inX * D) / 2, y + 0.012, zc, ry, len * 1.1, 1, D));
    }
    for (const r of P.bars.filter((v) => v.side === side)) batch.box(G, 'railTop', xw - inX * 0.05 - 0.03, y + Br.sill, r.z - 0.04, xw - inX * 0.05 + 0.03, y + Br.head, r.z + 0.04, 'tnsew');
  }
  // 셸 구멍 안: 문 양옆 벽·문 위 벽, 문틀 (양면)
  const d = P.door;
  const top = d.y + d.h;
  for (const [a0, c0, a1, c1] of P.jambs) batch.box(G, 'wall', a0, y, c0, a1, ceil, c1, 'nsew');
  const [hx, hz] = d.hinge;
  const zIn = d.closed[3];
  batch.box(G, 'wall', hx, top, hz, hx + d.w, ceil, zIn, 'nsb');
  const k = ANNEX.connector.frame;
  for (const [za, zb] of [[hz - 0.02, hz + 0.01], [zIn - 0.01, zIn + 0.02]]) {
    batch.box(G, 'doorFrame', hx - k, d.y, za, hx, top + k, zb, 'nsew');
    batch.box(G, 'doorFrame', hx + d.w, d.y, za, hx + d.w + k, top + k, zb, 'nsew');
    batch.box(G, 'doorFrame', hx, top, za, hx + d.w, top + k, zb, 'nsb');
  }
  // 꺼진 형광등 (통로 가운데 줄)
  const X = INTERIOR.furniture.fixture;
  for (const [fx, fz] of connectorFixtures(P)) batch.box(G, 'fixture', fx - X.w / 2, ceil - X.h, fz - X.l / 2, fx + X.w / 2, ceil, fz + X.l / 2, 'bnsew');

  const extra = new THREE.Group();
  extra.name = 'connectorInstances';
  extra.add(instanced(new THREE.PlaneGeometry(1, 1), MI.window, winM, { cast: false }));
  const glow = instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MI.glow, glowM, { cast: false, receive: false });
  glow.renderOrder = 1;
  extra.add(glow);
  return extra;
}

const ease = (f) => f * f * (3 - 2 * f);

// 연결문: 셸 북쪽 면 경첩을 축으로 신관 쪽(−z)으로 90° 열린다. E 로 열고 닫기, 열쇠 없으면 덜컹 + 안내
export class ConnectorDoor {
  constructor(P, handles, MI) {
    this.P = P;
    this.hasKey = () => false;
    this.state = new ConnectorState(P, handles, (name) => this.hasKey(name));
    const d = P.door;
    this.pivot = new THREE.Group();
    this.pivot.name = 'connectorDoor';
    this.pivot.position.set(d.hinge[0], d.y, d.hinge[1]);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.leaf), MI.exitDoor);
    leaf.position.set(d.w / 2, d.h / 2, d.leaf / 2);
    leaf.castShadow = leaf.receiveShadow = true;
    this.pivot.add(leaf);
    const bar = new THREE.BoxGeometry(1, 1, 1);
    for (const zs of [-1, 1]) {
      const h = new THREE.Mesh(bar, MI.railTop);
      h.position.set(d.w - 0.16, 1.0, d.leaf / 2 + zs * (d.leaf / 2 + 0.03));
      h.scale.set(0.16, 0.035, 0.035); // 손잡이 (양면)
      this.pivot.add(h);
    }
    this.sound = new THREE.Vector3(d.pos[0], d.y + 1.2, d.pos[1]);
    this.shakeT = -1;
  }

  attach({ interactions, toast, audio, player, hasKey, lockSound = () => 'metal' }) {
    if (hasKey) this.hasKey = hasKey;
    this.player = player;
    const M = this.P.msg;
    const s = this.state;
    const C = ANNEX.connector;
    interactions.add({
      id: 'door:connector', pos: this.P.door.pos, level: this.P.L, radius: C.reach,
      get label() { return s.target ? M.close : M.label; },
      onUse: () => {
        const r = s.use(player);
        if (r === 'locked') {
          this.shakeT = 0;
          doorLocked(audio, this.sound, lockSound('door:connector'));
          toast(M.locked);
        } else if (r !== 'blocked') {
          doorSwing(audio, this.sound, C.time, r === 'close');
          interactions.refresh();
        }
      },
    });
  }

  update(dt) {
    this.state.update(dt, this.player);
    let a = ease(this.state.f) * (Math.PI / 2);
    if (this.shakeT >= 0) {
      // 덜컹: 0.3초 동안 1° 안에서 세 번 (깜빡임 아님)
      this.shakeT += dt;
      if (this.shakeT > 0.3) this.shakeT = -1;
      else a += 0.017 * Math.abs(Math.sin(this.shakeT * Math.PI * 10));
    }
    this.pivot.rotation.y = a;
  }

  // 스크린샷·사건용: 바로 열기/닫기
  set(open) {
    this.state.set(open);
    this.update(0);
  }
}
