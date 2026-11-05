// 검은 연기 화면·소리 (단계 18, R1-d): Vanish 의 자리에서 검은 연기 덩이 몇 개가 위로 피어오르며 커지고, 짙기는 Vanish.density 를 따른다.
// 어두운 판이 짙어졌다 옅어지기만 하므로 화면이 밝게 번쩍이지 않는다. 연기가 피는 동안 조작을 멈춘다 (시선은 앞 줄의 look 이 돌려 둔다).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { canvasTexture } from '../materials/texgen.js';
import { ghostHiss } from '../audio/ghost.js';

// 가운데 진하고 가장자리 흐린 연기 덩이 (흰 모양 × 검은 재질 색)
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 66, 4, 64, 64, 60);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c, true, 1);
}

export class VanishView {
  constructor({ scene, vanish, collision, audio, player }) {
    Object.assign(this, { vanish, collision, audio, player });
    const C = SCENE.vanish;
    const tex = puffTexture();
    this.puffs = [];
    for (let i = 0; i < C.puffs; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false;
      s.name = 'vanishSmoke';
      const a = (i / C.puffs) * Math.PI * 2;
      // 덩이마다 처음 자리(둘레)·높이·오르는 속도를 조금씩 다르게 (판마다 같은 모양, 무작위 없음)
      s.userData = { dx: Math.cos(a) * C.spread * (0.4 + 0.6 * ((i * 7) % 5) / 4), dz: Math.sin(a) * C.spread * 0.6, y0: 0.4 + (i % 3) * 0.45, up: 0.7 + ((i * 3) % 4) * 0.15 };
      scene.add(s);
      this.puffs.push(s);
    }
  }

  update() {
    const v = this.vanish;
    const C = SCENE.vanish;
    const on = v.active;
    if (on) this.player.frozen = true; // finaleView 뒤에 불러 덮어쓴다
    if (on && v.started) {
      v.started = false;
      const [x, z] = v.def.pos;
      if (this.audio.started) ghostHiss(this.audio, new THREE.Vector3(x, this.collision.floorHeight(x, z, v.def.level ?? 0) + 1.2, z), C.gain, C.time * 0.85);
    }
    const d = on ? v.density : 0;
    for (const s of this.puffs) {
      s.visible = d > 0.001;
      if (!s.visible) continue;
      const u = s.userData;
      const [x, z] = v.def.pos;
      const floor = this.collision.floorHeight(x, z, v.def.level ?? 0);
      const k = v.k;
      const size = C.size[0] + (C.size[1] - C.size[0]) * k;
      s.scale.set(size, size * 1.2, 1);
      s.position.set(x + u.dx * (1 + k), floor + u.y0 + C.rise * u.up * k, z + u.dz * (1 + k));
      s.material.opacity = C.max * d;
    }
  }
}
