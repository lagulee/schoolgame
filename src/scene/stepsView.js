// 사건 안 작은 행동의 화면·소리 (단계 13): 교무실 열쇠함(pickups mesh), 원경 귀신 실루엣(sightings), 아래층 소리(sounds).
// 귀신 판은 E2 와 같은 실루엣 텍스처. 사라질 때는 천천히 흐려진다(번쩍임 없음).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { silhouetteTexture } from './e2View.js';
import { ghostBang } from '../audio/ghost.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

export class StepsView {
  constructor({ scene, steps, collision, audio, camera, player, story }) {
    Object.assign(this, { steps, collision, audio, camera, player });
    const G = SCENE.ghost;
    this.ghosts = steps.sightings.map((s) => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: silhouetteTexture(), color: G.color, transparent: true, opacity: 0, depthWrite: false }));
      m.scale.set(G.w, G.h, 1);
      m.visible = false;
      m.name = `sighting:${s.def.id}`;
      const [x, z] = s.def.pos;
      m.position.set(x, collision.floorHeight(x, z, s.def.level ?? 0) + G.h / 2, z);
      scene.add(m);
      return { s, m };
    });
    // 열쇠함: 벽에 붙은 철제 상자 (늘 그 자리에 있다)
    const K = SCENE.keybox;
    for (const p of story.pickups ?? []) {
      if (p.mesh !== 'keybox' || !p.mount) continue;
      const [x, z, axis] = p.mount;
      const [t, h, w] = K.size;
      const box = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? t : w, h, axis === 'x' ? w : t), new THREE.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.45, metalness: 0.6 }));
      box.position.set(x, collision.floorHeight(x, z, p.level ?? 0) + K.y, z);
      box.name = `pickup:${p.id}`;
      scene.add(box);
    }
    steps.sound = (def) => this.sound(def);
  }

  // 그 자리가 지금 화면 안(시야 반각·거리 안, 같은 층)인가
  inView(def) {
    const S = SCENE.sighting;
    if (Math.abs((def.level ?? 0) - this.player.level) > 0.5) return false;
    this.camera.getWorldDirection(_dir);
    _to.set(def.pos[0] - this.camera.position.x, 0, def.pos[1] - this.camera.position.z);
    const d = _to.length();
    if (d > S.range) return false;
    _dir.y = 0;
    return d < 1e-3 || _dir.normalize().dot(_to.normalize()) >= Math.cos((S.view * Math.PI) / 180);
  }

  sound(def) {
    if (!def || !this.audio.started) return;
    const p = this.player.pos;
    ghostBang(this.audio, new THREE.Vector3(p.x + (def.dx ?? 0), this.camera.position.y + (def.dy ?? 0), p.z + (def.dz ?? 0)), SCENE.bangGain);
  }

  update() {
    for (const { s, m } of this.ghosts) {
      m.visible = s.alpha > 0;
      m.material.opacity = SCENE.ghost.opacity * s.alpha;
    }
  }
}
