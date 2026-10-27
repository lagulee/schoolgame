// 실내 분위기 (단계 8, STORY 15-2): 본관 안에 들어서면 3초에 걸쳐 노출을 낮추고 바깥 광원(달·하늘빛·가로등·붉은 LED)을 줄인다.
// 가까운 비상구 유도등·소화전 표시등 몇 개에만 점광원을 붙이고(서서히 옮겨 붙음, 깜빡임 없음),
// 실내·바깥 묶음을 보이거나 숨겨 그리는 양을 줄인다.
import * as THREE from 'three';
import { INTERIOR, LIGHTS, DIM } from '../../config.js';
import { spaceAt } from './plan.js';
import { contains } from './rects.js';

const SWAP = 0.35; // 표시등 점광원이 다른 표시등으로 옮겨 갈 때 줄었다 커지는 시간 (초)
const PICK_EVERY = 0.25;

export class Atmosphere {
  constructor({ P, renderer, lights, scene, outdoor, groups }) {
    this.P = P;
    this.renderer = renderer;
    this.lights = lights;
    this.outdoor = outdoor;
    this.groups = groups;
    this.k = -1; // 아직 적용 전
    this.t = 0;
    this.pickT = 0;
    this.inside = false;
    this.space = null;
    const S = INTERIOR.signLight;
    this.pool = Array.from({ length: S.pool }, () => {
      const l = new THREE.PointLight(S.exit.color, 0, S.exit.distance, 2);
      scene.add(l);
      return { l, sign: null, w: 0 };
    });
    this.want = [];
    const N = INTERIOR.nearSight;
    this.near = new THREE.PointLight(N.color, 0, N.distance, 2);
    scene.add(this.near);
    const e = P.entrance;
    this.door = new THREE.Vector3(e.x, e.y + 1.2, (e.z0 + e.z1) / 2);
  }

  // 본관 안인가: 실내 공간·계단·현관 문턱
  locate(player) {
    const p = player.pos;
    const lv = player.level ?? 0;
    this.space = spaceAt(this.P, p.x, p.z, lv);
    return !!this.space || (lv === 0 && contains(this.P.entrance.threshold, p.x, p.z) && p.x > this.P.entrance.x);
  }

  update(dt, player, camera, snap = false) {
    this.inside = this.locate(player);
    const target = this.inside ? 1 : 0;
    const prev = this.k;
    if (snap || this.k < 0) this.t = target;
    else this.t = target > this.t ? Math.min(1, this.t + dt / INTERIOR.inside.fade) : Math.max(0, this.t - dt / INTERIOR.inside.fade);
    this.k = this.t * this.t * (3 - 2 * this.t); // 부드럽게
    if (this.k !== prev) {
      this.renderer.toneMappingExposure = LIGHTS.exposure + (INTERIOR.inside.exposure - LIGHTS.exposure) * this.k;
      this.lights.setIndoor(this.k);
    }
    this.lights.freezeMoon(this.k > 0.98);
    this.near.position.copy(camera.position);
    this.near.intensity = INTERIOR.nearSight.intensity * this.k;
    this.visibility(player, camera);
    this.signs(dt, camera, snap);
  }

  // 바깥에서 멀면 실내를 숨기고, 가까우면 1층만. 안에서는 실내 전부 + (1층 현관 쪽에서만) 바깥
  visibility(player, camera) {
    const G = this.groups;
    const lv = player.level ?? 0;
    const p = player.pos;
    if (this.inside) {
      for (const g of Object.values(G)) g.visible = true;
      const ds = INTERIOR.doorSight;
      this.outdoor.visible = lv === ds.level && p.x > this.P.entrance.x - 0.1 && p.z > ds.z;
      return;
    }
    this.outdoor.visible = true;
    const near = camera.position.distanceTo(this.door) < INTERIOR.showOutside;
    for (const [name, g] of Object.entries(G)) g.visible = near && (name === 'L0' || name === 'extra');
  }

  // 가까운 표시등(같은 층 높이)에 점광원을 옮겨 붙인다
  signs(dt, camera, snap) {
    const S = INTERIOR.signLight;
    this.pickT -= dt;
    if (snap || this.pickT <= 0) {
      this.pickT = PICK_EVERY;
      const c = camera.position;
      const cand = this.inside
        ? this.P.signs.filter((s) => Math.abs(s.pos[2] - c.y) < DIM.floorH * 0.7).map((s) => ({ s, d: Math.hypot(s.pos[0] - c.x, s.pos[1] - c.z) }))
        : [];
      this.want = cand.sort((a, b) => a.d - b.d).slice(0, S.pool).map((x) => x.s);
    }
    for (const slot of this.pool) {
      const keep = slot.sign && this.want.includes(slot.sign);
      if (!keep && slot.w > 0) slot.w = snap ? 0 : Math.max(0, slot.w - dt / SWAP);
      if (!keep && slot.w === 0) {
        const free = this.want.find((s) => !this.pool.some((o) => o.sign === s));
        slot.sign = free ?? null;
        if (free) {
          const k = S[free.kind] ?? S.exit;
          const [x, z, y] = free.pos;
          const [nx, nz] = free.normal;
          slot.l.color.set(k.color);
          slot.l.distance = k.distance;
          slot.l.position.set(x + nx * 0.25, y - 0.1, z + nz * 0.25);
          slot.base = k.intensity;
        }
      }
      if (slot.sign && this.want.includes(slot.sign)) slot.w = snap ? 1 : Math.min(1, slot.w + dt / SWAP);
      slot.l.intensity = slot.sign ? slot.base * slot.w * this.k : 0;
    }
  }

  hudLine(player) {
    const s = this.space;
    const lv = player.level ?? 0;
    const floor = Number.isInteger(lv) ? `${lv + 1}층` : `${Math.floor(lv) + 1}층 위 계단참`;
    return `실내: ${this.inside ? `${floor} ${s?.name ?? '현관 문턱'}` : '바깥'}  노출 ${this.renderer.toneMappingExposure.toFixed(2)}  표시등 ${this.pool.filter((p) => p.l.intensity > 0).length}/${this.pool.length}`;
  }
}
