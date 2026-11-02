// P2 화면·소리 (단계 15): 당직실에 나타났다 사라지는 귀신 실루엣(동쪽 창밖·칠판 앞)과 나타날 때의 소리.
// 점프스케어가 아니다: 먼 곳에 서 있다가 시선을 돌리거나 시간이 지나면 천천히 흐려진다(번쩍임 없음).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { silhouetteTexture } from './e2View.js';
import { ghostKnock, ghostStep } from '../audio/ghost.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

export class P2View {
  constructor({ scene, p2, collision, audio, camera, player }) {
    Object.assign(this, { p2, collision, audio, camera, player });
    const G = SCENE.ghost;
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: silhouetteTexture(), color: G.color, transparent: true, opacity: 0, depthWrite: false }));
    this.mesh.scale.set(G.w, G.h, 1);
    this.mesh.visible = false;
    this.mesh.name = 'dutyGhost';
    scene.add(this.mesh);
  }

  // 그 귀신 자리가 지금 화면 안(시야 반각·거리 안, 같은 층)인가
  inView(def) {
    const C = SCENE.duty;
    if (Math.abs(this.p2.D.level - this.player.level) > 0.5) return false;
    this.camera.getWorldDirection(_dir);
    _to.set(def.pos[0] - this.camera.position.x, 0, def.pos[1] - this.camera.position.z);
    const d = _to.length();
    if (d > C.range) return false;
    _dir.y = 0;
    return d < 1e-3 || _dir.normalize().dot(_to.normalize()) >= Math.cos((C.view * Math.PI) / 180);
  }

  sound(def) {
    if (!this.audio.started) return;
    const at = new THREE.Vector3(def.pos[0], this.camera.position.y, def.pos[1]);
    (def.cue === 'step' ? ghostStep : ghostKnock)(this.audio, at, SCENE.duty.gain);
  }

  update(dt) {
    const appeared = this.p2.update(dt, (d) => this.inView(d));
    if (appeared) this.sound(appeared.def);
    const g = this.p2.ghost;
    this.mesh.visible = !!g && g.alpha > 0;
    if (!g) return;
    const [x, z] = g.def.pos;
    this.mesh.position.set(x, this.collision.floorHeight(x, z, this.p2.D.level) + SCENE.ghost.h / 2, z);
    // 나타날 때 천천히 짙어지고(0.6초) 사라질 때 천천히 흐려진다
    const rise = Math.min(1, g.t / 0.6);
    this.mesh.material.opacity = SCENE.duty.opacity * g.alpha * rise;
  }
}
