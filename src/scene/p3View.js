// P3 화면·소리 (단계 14): 젖은 발자국(소지품 뒤), 3-10 문 노크, 틀린 교실의 검은 연기·실루엣.
// 연출은 shows 를 차례로 쓴다 — far(교실 안쪽 끝에 선 실루엣) / sound(실루엣 없이 바로 뒤 발소리) / near(코앞 실루엣).
// 모두 어두운 판이 천천히 짙어졌다 사라지는 것이라 화면이 밝게 번쩍이지 않는다.
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { canvasTexture } from '../materials/texgen.js';
import { silhouetteTexture } from './e2View.js';
import { ghostKnock, ghostStep } from '../audio/ghost.js';

const _dir = new THREE.Vector3();

// 젖은 발자국 하나 (발바닥 + 발가락 자국, 흰 모양 × 재질 색)
function printTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d');
  g.filter = 'blur(1.5px)';
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(16, 40, 9, 18, 0, 0, Math.PI * 2);
  g.fill();
  for (const [x, y, r] of [[9, 14, 3.5], [15, 11, 3.5], [21, 12, 3], [25, 16, 2.5]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return canvasTexture(c, true, 1);
}

// 위로 피어오르는 검은 연기 (가운데 진하고 가장자리 흐림)
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 70, 6, 64, 64, 60);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c, true, 1);
}

export class P3View {
  // p3: P3Search, map: MapData (방 사각형), threatEl: 화면 가장자리 (E2View 가 먼저 쓴다)
  constructor({ scene, p3, collision, audio, camera, player, map, threatEl = null }) {
    Object.assign(this, { p3, collision, audio, camera, player, map, threatEl });
    const C = SCENE.p3;
    const prints = p3.prints;
    const geo = new THREE.PlaneGeometry(C.printSize[0], C.printSize[1]);
    geo.rotateX(-Math.PI / 2);
    // 물기: 거의 검고 반들거리는 자국 (라이트를 비추면 반사로 보인다)
    const mat = new THREE.MeshStandardMaterial({ map: printTexture(), color: 0x0d0f12, roughness: 0.08, metalness: 0.2, transparent: true, opacity: C.printOpacity, depthWrite: false });
    this.prints = new THREE.InstancedMesh(geo, mat, Math.max(1, prints.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    prints.forEach(([x, z, lv, dir], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dir);
      m.compose(new THREE.Vector3(x, collision.floorHeight(x, z, lv) + 0.012, z), q, one);
      this.prints.setMatrixAt(i, m);
    });
    this.prints.count = prints.length;
    this.prints.visible = false;
    this.prints.name = 'p3Footprints';
    scene.add(this.prints);
    const G = SCENE.ghost;
    this.ghost = new THREE.Sprite(new THREE.SpriteMaterial({ map: silhouetteTexture(), color: G.color, transparent: true, opacity: 0, depthWrite: false }));
    this.ghost.scale.set(G.w, G.h, 1);
    this.ghost.visible = false;
    this.ghost.renderOrder = 10;
    this.ghost.name = 'p3Ghost';
    this.smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    this.smoke.visible = false;
    scene.add(this.ghost, this.smoke);
    this.pullSeen = null;
    this.stepDone = false;
  }

  // 틀린 교실에 들어선 순간: 연기·실루엣 자리를 정한다
  begin(pull) {
    const r = this.map.resolve(pull.room)?.item?.rect;
    const lv = this.player.level;
    const p = this.player.pos;
    const [x0, z0, x1, z1] = r ?? [p.x - 1, p.z - 1, p.x + 1, p.z + 1];
    const floor = (x, z) => this.collision.floorHeight(x, z, lv);
    this.smokeAt = new THREE.Vector3((x0 + x1) / 2, floor((x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2);
    this.camera.getWorldDirection(_dir);
    _dir.y = 0;
    _dir.normalize();
    const near = new THREE.Vector3(p.x + _dir.x * 1.3, 0, p.z + _dir.z * 1.3);
    // 교실 안쪽: 시선 방향 SCENE.p3.farDist m (라이트가 비추는 쪽이라 검은 실루엣이 보인다), 교실 사각형 안으로
    const F = SCENE.p3.farDist;
    const far = new THREE.Vector3(Math.min(x1 - 0.6, Math.max(x0 + 0.6, p.x + _dir.x * F)), 0, Math.min(z1 - 0.6, Math.max(z0 + 0.6, p.z + _dir.z * F)));
    const at = pull.show === 'near' ? near : far;
    at.y = floor(at.x, at.z) + SCENE.ghost.h / 2;
    this.ghost.position.copy(at);
    this.stepDone = false;
  }

  update() {
    const p3 = this.p3;
    const C = SCENE.p3;
    this.prints.visible = p3.printsVisible;
    const pull = p3.pull;
    if (pull && this.pullSeen !== pull) {
      this.pullSeen = pull;
      this.begin(pull);
    }
    if (!pull) this.pullSeen = null;
    const k = pull ? Math.min(1, pull.t / C.pullAfter) : 0;
    const a = pull ? Math.sin(Math.PI * Math.min(1, k * 1.15)) : 0; // 짙어졌다가 끌려 나올 때쯤 옅어짐
    this.smoke.visible = a > 0;
    if (pull) {
      const s = C.smokeSize * (0.6 + 0.6 * k);
      this.smoke.scale.set(s, s, 1);
      this.smoke.position.set(this.smokeAt.x, this.smokeAt.y + 0.3 + C.smokeRise * k, this.smokeAt.z);
      this.smoke.material.opacity = C.smokeMax * a;
    }
    const ghostOn = pull && pull.show !== 'sound';
    this.ghost.visible = !!ghostOn && a > 0;
    this.ghost.material.opacity = ghostOn ? SCENE.ghost.opacity * a : 0;
    // sound: 실루엣 없이 바로 뒤에서 한 걸음
    if (pull?.show === 'sound' && !this.stepDone && pull.t > 0.3) {
      this.stepDone = true;
      this.camera.getWorldDirection(_dir);
      const p = this.player.pos;
      if (this.audio.started) ghostStep(this.audio, new THREE.Vector3(p.x - _dir.x * 0.9, this.camera.position.y - 1.4, p.z - _dir.z * 0.9), SCENE.steps.gain);
    }
    if (pull && this.threatEl) this.threatEl.style.opacity = Math.max(+this.threatEl.style.opacity || 0, SCENE.threat.pass * a).toFixed(3);
  }

  // 노크 한 번 (p3.update 가 true 를 돌려줄 때)
  knock() {
    const K = this.p3.S?.knock;
    if (!K || !this.audio.started) return;
    const [x, z] = K.pos;
    ghostKnock(this.audio, new THREE.Vector3(x, this.collision.floorHeight(x, z, K.level) + 1.2, z), SCENE.p3.knockGain);
  }
}
