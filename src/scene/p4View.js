// P4 화면·소리 (단계 16): 교무실 서쪽 벽의 열쇠 걸이(열쇠 5개 + 번호표), 다가오는 귀신 실루엣, 발소리·열쇠 소리·잡혔을 때의 쿵.
// 열쇠 걸이는 늘 그 자리에 있다(퍼즐 밖에서도 보인다). 귀신은 퍼즐 중에만 나타나며 점프스케어가 아니다(느리게 다가오고 번쩍임 없음).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { canvasTexture } from '../materials/texgen.js';
import { silhouetteTexture } from './e2View.js';
import { ghostBang, ghostKnock, ghostStep } from '../audio/ghost.js';

// 종이 번호표: 누런 종이에 어두운 숫자
function tagTexture(n) {
  const c = document.createElement('canvas');
  c.width = 104;
  c.height = 60;
  const g = c.getContext('2d');
  g.fillStyle = '#d9cfae';
  g.fillRect(0, 0, 104, 60);
  g.strokeStyle = '#7d7254';
  g.lineWidth = 3;
  g.strokeRect(2, 2, 100, 56);
  g.fillStyle = '#2b2418';
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 52, 32);
  return canvasTexture(c, true, 1);
}

export class P4View {
  constructor({ scene, p4, collision, audio, camera }) {
    Object.assign(this, { p4, collision, audio, camera });
    const K = p4.K;
    this.lvl = K?.level ?? 1;
    const G = SCENE.ghost;
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: silhouetteTexture(), color: G.color, transparent: true, opacity: 0, depthWrite: false }));
    this.mesh.scale.set(G.w, G.h, 1);
    this.mesh.visible = false;
    this.mesh.name = 'keyGhost';
    scene.add(this.mesh);
    if (!K) return;
    // 열쇠 걸이: 벽에 박은 못 + 열쇠(작은 금속 판) + 번호표
    const [tw, th] = SCENE.p4.tag;
    const metal = new THREE.MeshStandardMaterial({ color: 0x8c8470, roughness: 0.4, metalness: 0.7 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, K.hooks.at(-1).z - K.hooks[0].z + 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 0.8 }));
    const zc = (K.hooks[0].z + K.hooks.at(-1).z) / 2;
    const yh = 1.25;
    plank.position.set(K.wall + 0.015, collision.floorHeight(K.wall, zc, this.lvl) + yh + 0.07, zc);
    plank.name = 'keyRack';
    scene.add(plank);
    for (const h of K.hooks) {
      const base = collision.floorHeight(K.wall, h.z, this.lvl) + yh;
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.035), metal);
      key.position.set(K.wall + 0.04, base - 0.02, h.z);
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.006, th, tw), new THREE.MeshStandardMaterial({ map: tagTexture(h.n), roughness: 0.9 }));
      tag.position.set(K.wall + 0.036, base - 0.12, h.z);
      tag.name = `keyTag:${h.n}`;
      scene.add(key, tag);
    }
  }

  update(dt) {
    const p4 = this.p4;
    const step = p4.update(dt);
    const P = SCENE.p4;
    const g = p4.ghost;
    this.mesh.visible = !!g && g.alpha > 0;
    if (g) {
      this.mesh.position.set(g.x, this.collision.floorHeight(g.x, g.z, this.lvl) + SCENE.ghost.h / 2, g.z);
      this.mesh.material.opacity = P.opacity * g.alpha;
      if (step && this.audio.started) ghostStep(this.audio, new THREE.Vector3(g.x, 0.1, g.z), P.gain);
    }
    for (const e of p4.events.splice(0)) {
      if (!this.audio.started) continue;
      const rack = p4.K.hooks[2];
      const at = new THREE.Vector3(p4.K.wall + 0.6, this.camera.position.y, rack.z);
      if (e.kind === 'wrong') ghostKnock(this.audio, at, P.wrongGain);
      else ghostBang(this.audio, at, P.caughtGain);
    }
  }
}
