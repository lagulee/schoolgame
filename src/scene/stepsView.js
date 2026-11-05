// 사건 안 작은 행동의 화면·소리 (단계 13): 교무실 열쇠함(pickups mesh), 원경 귀신 실루엣(sightings), 아래층 소리(sounds).
// 귀신 판은 E2 와 같은 실루엣 텍스처. 사라질 때는 천천히 흐려진다(번쩍임 없음).
// 단계 14: 점프스케어(steps.scare) — 시선 정면에 어두운 실루엣이 나타나고 날카로운 소리. 화면을 밝히는 연출은 없다.
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { GhostFigure } from './ghost/figure.js';
import { ghostBang, ghostSting } from '../audio/ghost.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

export class StepsView {
  // light = 핸드폰 라이트 (PhoneLight, dim 배율)
  constructor({ scene, steps, collision, audio, camera, player, story, threatEl = null, light = null }) {
    Object.assign(this, { steps, collision, audio, camera, player, threatEl, light });
    const G = SCENE.ghost;
    this.ghosts = steps.sightings.map((s) => {
      const m = new GhostFigure({ name: `sighting:${s.def.id}` });
      m.material.opacity = 0;
      m.visible = false;
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
    // 점프스케어: 고개를 들고 똑바로 보는 자세. 라이트 번짐(반투명) 위에 그린다 (벽에서 SCENE.scare.inset 떨어져 서므로 깊이 검사는 그대로)
    this.scareMesh = new GhostFigure({ pose: 'stare', name: 'scareSilhouette', front: true });
    this.scareMesh.material.opacity = 0;
    this.scareMesh.visible = false;
    scene.add(this.scareMesh);
    this.scareSeen = null; // 자리를 정한 점프스케어 (steps.scare 객체)
  }

  // 점프스케어 실루엣 자리: 시선 정면 dist m, clamp 사각형 안으로
  placeScare(sc) {
    const S = SCENE.scare;
    this.camera.getWorldDirection(_dir);
    _dir.y = 0;
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
    _dir.normalize();
    const dist = sc.def.dist ?? S.dist; // 장면마다 거리를 달리할 수 있다 (J3: 복도 저편)
    let x = this.camera.position.x + _dir.x * dist;
    let z = this.camera.position.z + _dir.z * dist;
    const r = sc.def.clamp;
    if (r) {
      x = Math.min(r[2] - S.inset, Math.max(r[0] + S.inset, x));
      z = Math.min(r[3] - S.inset, Math.max(r[1] + S.inset, z));
    }
    const lv = sc.def.level ?? this.player.level;
    this.scareMesh.position.set(x, this.collision.floorHeight(x, z, lv) + SCENE.ghost.h / 2, z);
    if (this.audio.started) ghostSting(this.audio, this.scareMesh.position.clone(), S.gain);
  }

  // 점프스케어 불투명도: rise 동안 나타나고 hold 동안 머문 뒤 fade 동안 흐려진다 (0~1)
  static scareAlpha(t) {
    const S = SCENE.scare;
    if (t < S.rise) return t / S.rise;
    if (t < S.rise + S.hold) return 1;
    return Math.max(0, 1 - (t - S.rise - S.hold) / S.fade);
  }

  updateScare() {
    const sc = this.steps.scare;
    if (sc && this.scareSeen !== sc) {
      this.scareSeen = sc;
      this.placeScare(sc);
    }
    if (!sc) this.scareSeen = null;
    const a = sc ? StepsView.scareAlpha(sc.t) : 0;
    this.scareMesh.visible = a > 0;
    this.scareMesh.material.opacity = SCENE.scare.opacity * a;
    if (this.light) this.light.dim = 1 - SCENE.scare.lightDip * a;
    if (sc && this.threatEl) this.threatEl.style.opacity = Math.max(+this.threatEl.style.opacity || 0, SCENE.scare.threat * a).toFixed(3);
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
    const at = new THREE.Vector3(p.x + (def.dx ?? 0), this.camera.position.y + (def.dy ?? 0), p.z + (def.dz ?? 0));
    if (def.kind === 'sting') ghostSting(this.audio, at, def.gain ?? SCENE.scare.gain); // 날카로운 소리 (단계 16, 등 뒤 가까이)
    else ghostBang(this.audio, at, SCENE.bangGain);
  }

  update() {
    this.updateScare();
    for (const { s, m } of this.ghosts) {
      m.visible = s.alpha > 0;
      m.material.opacity = SCENE.ghost.opacity * s.alpha;
    }
  }
}
