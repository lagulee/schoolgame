import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { PLAYER, STAMINA } from '../config.js';
import { HeadBob } from './headbob.js';
import { Stamina } from './stamina.js';

const DEG = Math.PI / 180;
const RUN_ON = 0.96; // 조이스틱을 이 이상 밀면 달리기 시작
const RUN_OFF = 0.86; // 이 아래로 돌아오면 걷기

export class Player {
  constructor(camera, dom, collision) {
    this.camera = camera;
    this.collision = collision;
    camera.rotation.order = 'YXZ';
    this.controls = new PointerLockControls(camera, dom);
    this.keys = new Set();
    this.vel = new THREE.Vector2();
    this.pos = new THREE.Vector3(PLAYER.start[0], 0, PLAYER.start[2]);
    this.floorY = 0;
    this.level = 0; // 층 (0 = 1층·바깥, 0.5 단위 = 계단참). 계단(경사)을 지나면 Collision.levelAt 이 바꾼다
    this.bob = new HeadBob();
    this.fov = PLAYER.fov;
    this.onStep = null; // (surface, running) => void
    this.frozen = false;
    this.analog = null;
    this.touchRun = false;
    this.speed = 0;
    this.running = false;
    this.wantRun = false; // 달리기 입력 (Shift·조이스틱 끝까지) — 실제 달리기는 스태미나·핸드폰 조건을 거친다
    this.stamina = new Stamina(STAMINA);
    this.hidden = false; // 숨는 중 (숨기 퍼즐 단계에서 켬) → 회복이 가장 빠름
    this.phoneOpen = () => false; // 핸드폰 화면 열림 여부 (main.js 가 연결)
    this.tired = 0; // 탈진 효과 0~1 (숨소리·흔들림, 부드럽게 켜지고 꺼짐)
    this.tiredT = 0;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  setView(pos, yawDeg, pitchDeg, level = 0) {
    this.pos.set(pos[0], 0, pos[2]);
    this.level = level;
    this.floorY = this.collision.floorHeight(pos[0], pos[2], level);
    this.camera.rotation.set(pitchDeg * DEG, yawDeg * DEG, 0, 'YXZ');
    this.camera.position.set(pos[0], this.floorY + (pos[1] ?? PLAYER.eye), pos[2]);
  }

  // 터치 드래그 시점 회전 (px → rad)
  look(dx, dy) {
    const r = this.camera.rotation;
    r.y -= dx * PLAYER.touchLook;
    r.x = Math.max(-1.5, Math.min(1.5, r.x - dy * PLAYER.touchLook));
  }

  update(dt) {
    const k = this.keys;
    let ix = 0;
    let iz = 0;
    const joy = this.analog; // 터치 조이스틱 {x, y} (y: 위가 +), 크기 0~1
    const amag = !this.frozen && joy ? Math.hypot(joy.x, joy.y) : 0;
    const analog = amag > 0.05;
    if (analog) {
      ix = joy.x;
      iz = joy.y;
      // 끝까지 밀면 달리기 (히스테리시스로 경계에서 떨리지 않게)
      this.touchRun = amag > (this.touchRun ? RUN_OFF : RUN_ON);
    } else {
      this.touchRun = false;
      if (!this.frozen) {
        if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
        if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
        if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
      }
    }
    const moving = ix !== 0 || iz !== 0;
    const st = this.stamina;
    const phoneOpen = this.phoneOpen();
    this.wantRun = moving && (analog ? this.touchRun : k.has('ShiftLeft') || k.has('ShiftRight'));
    // 탈진 중·핸드폰 화면이 열린 동안은 달리기 불가 (STORY 14-2)
    this.running = this.wantRun && st.canRun && !phoneOpen;
    const walkBase = st.exhausted ? STAMINA.EXHAUSTED_SPEED : PLAYER.walk;
    const walkSpeed = analog ? walkBase * Math.min(1, amag / RUN_OFF) : walkBase;
    const scale = phoneOpen ? STAMINA.PHONE_MOVE_SCALE : 1;
    const target = moving ? (this.running ? PLAYER.run : walkSpeed) * scale : 0;

    // 시선의 수평 성분 기준 전/우 벡터
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    this._right.set(-this._fwd.z, 0, this._fwd.x);
    const len = Math.hypot(ix, iz) || 1;
    const wx = (this._fwd.x * iz + this._right.x * ix) / len * target;
    const wz = (this._fwd.z * iz + this._right.z * ix) / len * target;
    const a = 1 - Math.exp(-PLAYER.accel * dt);
    this.vel.x += (wx - this.vel.x) * a;
    this.vel.y += (wz - this.vel.y) * a;
    this.speed = this.vel.length();
    const mode = this.hidden ? 'hidden' : this.running ? 'run' : moving || this.speed > STAMINA.STILL_SPEED ? 'walk' : 'still';
    st.update(dt, mode);
    this.tired += ((st.exhausted ? 1 : 0) - this.tired) * (1 - Math.exp(-STAMINA.TIRED_EASE * dt));

    const col = this.collision;
    col.move(this.pos, this.vel.x * dt, this.vel.y * dt, PLAYER.radius, this.level);
    this.level = col.levelAt(this.pos.x, this.pos.z, this.level);

    // 계단 높이는 부드럽게 따라간다
    const fh = col.floorHeight(this.pos.x, this.pos.z, this.level);
    this.floorY += (fh - this.floorY) * (1 - Math.exp(-12 * dt));

    const ref = this.running ? PLAYER.run : PLAYER.walk;
    const b = this.bob.update(dt, Math.min(1, this.speed / ref), this.running);
    if (b.stepped && this.onStep && this.speed > 0.3) {
      this.onStep(col.surfaceAt(this.pos.x, this.pos.z, this.level), this.running);
    }

    // 탈진: 느린 사인 두 개를 섞은 약한 흔들림 (위치만, 밝기 변화 없음)
    this.tiredT += dt;
    const sh = STAMINA.SHAKE;
    const tw = this.tired * sh.amp;
    const sx = tw * Math.sin(2 * Math.PI * sh.freq[0] * this.tiredT) * 0.6;
    const sy = tw * Math.sin(2 * Math.PI * sh.freq[1] * this.tiredT + 1.3);
    this.camera.position.set(
      this.pos.x + this._right.x * (b.x + sx),
      this.floorY + PLAYER.eye + b.y + sy,
      this.pos.z + this._right.z * (b.x + sx),
    );

    const fovTarget = PLAYER.fov + (this.running && this.speed > PLAYER.walk + 0.4 ? PLAYER.runFovAdd : 0);
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
