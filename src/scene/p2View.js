// P2 화면·소리 (단계 15): 당직실에 나타났다 사라지는 귀신 실루엣(동쪽 창밖·칠판 앞)과 나타날 때의 소리.
// 점프스케어가 아니다: 먼 곳에 서 있다가 시선을 돌리거나 시간이 지나면 천천히 흐려진다(번쩍임 없음).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { GhostFigure } from './ghost/figure.js';
import { ghostKnock, ghostStep } from '../audio/ghost.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

export class P2View {
  constructor({ scene, p2, collision, audio, camera, player }) {
    Object.assign(this, { p2, collision, audio, camera, player });
    this.mesh = new GhostFigure({ name: 'dutyGhost' });
    this.mesh.material.opacity = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);
    // 다음에 나타날 귀신이 단서를 얻기 전부터 그 자리에 미리 서 있다 (퍼즐 진행 중에만, 점프스케어 아님). 나타날 때는 같은 자리에서 이어진다
    this.standing = new GhostFigure({ name: 'dutyStanding' });
    this.standing.material.opacity = 0;
    this.standing.visible = false;
    scene.add(this.standing);
    this.standAlpha = 0;
  }

  // 미리 서 있는 귀신: 아직 안 나타난 귀신이 남았고 지금 나타난 귀신이 없을 때 다음 자리에 1.5초에 걸쳐 짙어진다
  updateStanding(dt) {
    const p2 = this.p2;
    const want = p2.active && !p2.ghost && p2.shown < (p2.puzzle.puzzle?.total ?? 0);
    this.standAlpha = want ? Math.min(1, this.standAlpha + dt / 1.5) : 0;
    this.standing.visible = this.standAlpha > 0;
    if (!this.standing.visible) return;
    const [x, z] = p2.D.ghosts[p2.shown % p2.D.ghosts.length].pos;
    this.standing.position.set(x, this.collision.floorHeight(x, z, p2.D.level) + SCENE.ghost.h / 2, z);
    this.standing.material.opacity = SCENE.duty.opacity * this.standAlpha;
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
    this.updateStanding(dt);
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
