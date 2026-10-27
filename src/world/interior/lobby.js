// 현관 유리 자동문 (단계 8): 1층에서 문 가까이(INTERIOR.entrance.reach) 오면 두 짝이 셸 벽 속으로 열리고,
// 멀어지면 닫힌다. 잠금은 사건 단계에서 붙인다. 은색 바깥 틀·위 유리는 entrance.js.
import * as THREE from 'three';
import { INTERIOR, SCHOOL, PLAYER } from '../../config.js';
import { autoDoor } from '../../audio/door.js';

export class EntranceDoor {
  // P: 평면, handle: 'entrance' 충돌 박스, MI: 실내 재질, M: 공용 재질, parent: 현관 묶음 (바깥과 함께 보임)
  constructor(P, handle, MI, M, parent) {
    const e = P.entrance;
    const E = INTERIOR.entrance;
    this.e = e;
    this.handle = handle;
    this.x = e.x + SCHOOL.shellWall / 2; // 셸 벽 두께 가운데 (열면 벽 속으로)
    this.zc = (e.z0 + e.z1) / 2;
    this.half = (e.z1 - e.z0) / 2;
    const h = e.h;
    const w = this.half;
    const bar = new THREE.BoxGeometry(1, 1, 1);
    this.leaves = [-1, 1].map((sgn) => {
      const g = new THREE.Group();
      g.name = 'entranceLeaf';
      const pane = new THREE.Mesh(new THREE.BoxGeometry(E.leafT, h - 0.16, w - 0.1), MI.clearGlass);
      pane.position.set(0, h / 2, 0);
      pane.renderOrder = 2;
      g.add(pane);
      for (const [y, z, sy, sz] of [[0.04, 0, 0.08, w], [h - 0.04, 0, 0.08, w], [h / 2, -w / 2 + 0.025, h, 0.05], [h / 2, w / 2 - 0.025, h, 0.05]]) {
        const m = new THREE.Mesh(bar, M.silver);
        m.position.set(0, y, z);
        m.scale.set(E.leafT + 0.02, sy, sz);
        m.castShadow = true;
        g.add(m);
      }
      parent.add(g);
      return { g, sgn };
    });
    this.f = 0;
    this.target = 0;
    this.sound = new THREE.Vector3(this.x, e.y + 1.6, this.zc);
    this.place();
  }

  place() {
    for (const { g, sgn } of this.leaves) g.position.set(this.x, this.e.y, this.zc + sgn * this.half * (0.5 + 0.95 * this.f));
  }

  // 문 자리 박스에 플레이어가 걸쳐 있나 (닫다가 끼지 않게)
  blocking(player) {
    const [x0, z0, x1, z1] = this.e.block;
    const p = player.pos;
    const cx = Math.max(x0, Math.min(p.x, x1));
    const cz = Math.max(z0, Math.min(p.z, z1));
    return (player.level ?? 0) === 0 && Math.hypot(p.x - cx, p.z - cz) < PLAYER.radius + 0.05;
  }

  update(dt, player, audio) {
    const E = INTERIOR.entrance;
    const near = (player.level ?? 0) === 0 && Math.hypot(player.pos.x - this.x, player.pos.z - this.zc) < E.reach;
    const want = near || this.blocking(player) ? 1 : 0;
    if (want !== this.target) {
      this.target = want;
      if (want) this.handle.on = false;
      if (audio) autoDoor(audio, this.sound, E.time);
    }
    if (this.f === this.target) return;
    const r = dt / E.time;
    this.f = this.target > this.f ? Math.min(1, this.f + r) : Math.max(0, this.f - r);
    if (this.f === 0) this.handle.on = true;
    this.place();
  }

  snap() {
    this.f = this.target;
    this.handle.on = this.f === 0;
    this.place();
  }
}
