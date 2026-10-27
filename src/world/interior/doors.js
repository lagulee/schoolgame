// 본관 실내 문 (단계 8): 교실·교무실 미닫이 문짝(열면 벽 속으로 밀려 들어감)과 문틀, 연결통로 문(잠김).
// E 로 연다/닫는다. 잠긴 방은 덜컹거리고 안내만 띄운다 (data/mainInterior.json messages).
// 문짝은 InstancedMesh 하나, 문틀·연결통로 문은 정적 Batch. 충돌은 plan.js 가 만든 문 박스 핸들(on)을 켜고 끈다.
import * as THREE from 'three';
import { INTERIOR, PLAYER } from '../../config.js';
import { SIDE } from './rects.js';
import { mat4 } from '../geom.js';
import { doorSlide, doorRattle } from '../../audio/door.js';

const fill = (msg, name) => msg.replace('{name}', name);

export class Doors {
  // P: 평면, handles: 문 id → 충돌 박스, MI: 실내 재질, batch: 정적 면 모음 (문틀)
  constructor(P, handles, MI, batch) {
    this.P = P;
    this.list = [];
    const D = INTERIOR.door;
    const room = P.doors.filter((d) => d.kind === 'room');
    for (const d of P.doors) frameOf(d, batch);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MI.door, Math.max(1, room.length));
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.name = 'interiorDoors';
    room.forEach((d, i) => {
      const alongX = SIDE[d.side].along === 'x';
      const [bx, bz] = d.pos;
      this.list.push({ d, i, alongX, bx, bz, f: 0, target: 0, shake: 0, handle: handles.get(d.id), sound: new THREE.Vector3(bx, d.y + 1.2, bz) });
    });
    for (const s of this.list) this.place(s);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.exits = P.doors.filter((d) => d.kind === 'exit').map((d) => ({ d, sound: new THREE.Vector3(d.pos[0], d.y + 1.2, d.pos[1]) }));
  }

  // 열린 정도 f 만큼 벽 속으로 (끝 8 cm 는 보인다)
  place(s) {
    const D = INTERIOR.door;
    const off = s.d.slide * (s.f * D.w * 0.92 + s.shake);
    const x = s.alongX ? s.bx + off : s.bx;
    const z = s.alongX ? s.bz : s.bz + off;
    this.mesh.setMatrixAt(s.i, mat4(x, s.d.y + D.h / 2, z, s.alongX ? 0 : Math.PI / 2, D.w, D.h, D.leaf));
  }

  // 상호작용 등록 (E). ctx: { interactions, toast, audio, player }
  attach({ interactions, toast, audio, player }) {
    this.audio = audio;
    this.player = player;
    const M = this.P.messages;
    const R = INTERIOR.door.reach;
    this.interactions = interactions;
    for (const s of this.list) {
      const d = s.d;
      const label = () => fill(s.target ? M.doorClose : M.doorLabel, d.name);
      interactions.add({
        id: `door:${d.id}`, pos: d.pos, level: d.L, radius: R, get label() { return label(); },
        onUse: () => {
          if (d.locked) {
            s.shake = 0.0001;
            s.shakeT = 0;
            doorRattle(audio, s.sound);
            toast(fill(M.locked, d.name));
            return;
          }
          if (s.target && this.blocking(s)) return; // 문턱에 서 있으면 닫지 않는다
          s.target = s.target ? 0 : 1;
          if (s.target) s.handle.on = false;
          doorSlide(audio, s.sound, INTERIOR.door.time);
          interactions.refresh();
        },
      });
    }
    for (const e of this.exits) {
      interactions.add({
        id: `door:${e.d.id}`, pos: e.d.pos, level: e.d.L, radius: R, label: fill(M.doorLabel, e.d.name),
        onUse: () => {
          doorRattle(audio, e.sound);
          toast(M.bridgeLocked);
        },
      });
    }
  }

  // 플레이어 원이 문 자리 박스에 걸쳐 있나
  blocking(s) {
    const p = this.player?.pos;
    if (!p || Math.abs((this.player.level ?? 0) - s.d.L) > 0.01) return false;
    const [x0, z0, x1, z1] = s.d.block;
    const cx = Math.max(x0, Math.min(p.x, x1));
    const cz = Math.max(z0, Math.min(p.z, z1));
    return Math.hypot(p.x - cx, p.z - cz) < PLAYER.radius + 0.02;
  }

  update(dt) {
    const rate = dt / INTERIOR.door.time;
    let any = false;
    for (const s of this.list) {
      let dirty = false;
      if (s.f !== s.target) {
        s.f = s.target > s.f ? Math.min(1, s.f + rate) : Math.max(0, s.f - rate);
        if (s.f === 0 && s.target === 0) {
          if (this.blocking(s)) s.target = 1; // 닫히는 동안 들어섰으면 다시 연다
          else s.handle.on = true;
        }
        dirty = true;
      }
      if (s.shake) {
        // 덜컹: 2 cm 안에서 세 번 흔들리고 멈춘다 (0.3초, 깜빡임 아님)
        s.shakeT += dt;
        s.shake = s.shakeT > 0.3 ? 0 : 0.012 * Math.abs(Math.sin(s.shakeT * Math.PI * 10)) + 0.0001;
        dirty = true;
      }
      if (dirty) this.place(s);
      any ||= dirty;
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  // 열려 있는 문 id (디버그·스모크)
  get openIds() {
    return this.list.filter((s) => s.target === 1).map((s) => s.d.id);
  }
}

// 문틀: 양쪽 문설주 + 위 틀 (벽 두께보다 1 cm 씩 튀어나옴). 연결통로 문은 벽 마감 위 철문 + 손잡이 막대
function frameOf(d, batch) {
  const S = SIDE[d.side];
  const G = `L${d.L}`;
  const k = 0.05;
  if (d.kind === 'exit') {
    const n = d.normal; // 공간 안쪽을 향함
    const t = 0.04;
    const [px, pz] = d.pos;
    const box = (a0, a1, y0, y1, n0, n1, mat) => {
      if (S.along === 'x') batch.box(G, mat, a0, y0, Math.min(pz + n[1] * n0, pz + n[1] * n1), a1, y1, Math.max(pz + n[1] * n0, pz + n[1] * n1));
      else batch.box(G, mat, Math.min(px + n[0] * n0, px + n[0] * n1), y0, a0, Math.max(px + n[0] * n0, px + n[0] * n1), y1, a1);
    };
    box(d.c - d.w / 2, d.c + d.w / 2, d.y, d.y + d.h, 0, t, 'exitDoor');
    box(d.c - d.w / 2 - k, d.c - d.w / 2, d.y, d.y + d.h + k, 0, t + 0.01, 'doorFrame');
    box(d.c + d.w / 2, d.c + d.w / 2 + k, d.y, d.y + d.h + k, 0, t + 0.01, 'doorFrame');
    box(d.c - d.w / 2, d.c + d.w / 2, d.y + d.h, d.y + d.h + k, 0, t + 0.01, 'doorFrame');
    box(d.c - d.w * 0.4, d.c + d.w * 0.4, d.y + 1.0, d.y + 1.06, t, t + 0.07, 'railTop'); // 패닉바
    return;
  }
  const [x0, z0, x1, z1] = d.block;
  const pad = 0.01;
  const a = d.c - d.w / 2;
  const b = d.c + d.w / 2;
  const top = d.y + d.h;
  if (S.along === 'x') {
    batch.box(G, 'doorFrame', a, d.y, z0 - pad, a + k, top, z1 + pad, 'nse');
    batch.box(G, 'doorFrame', b - k, d.y, z0 - pad, b, top, z1 + pad, 'nsw');
    batch.box(G, 'doorFrame', a, top - k, z0 - pad, b, top, z1 + pad, 'nsb');
  } else {
    batch.box(G, 'doorFrame', x0 - pad, d.y, a, x1 + pad, top, a + k, 'wes');
    batch.box(G, 'doorFrame', x0 - pad, d.y, b - k, x1 + pad, top, b, 'wen');
    batch.box(G, 'doorFrame', x0 - pad, top - k, a, x1 + pad, top, b, 'web');
  }
}
