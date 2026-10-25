import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { PLAYER } from '../config.js';
import { HeadBob } from './headbob.js';

const DEG = Math.PI / 180;

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
    this.bob = new HeadBob();
    this.fov = PLAYER.fov;
    this.onStep = null; // (surface, running) => void
    this.frozen = false;
    this.speed = 0;
    this.running = false;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  setView(pos, yawDeg, pitchDeg) {
    this.pos.set(pos[0], 0, pos[2]);
    this.floorY = this.collision.floorHeight(pos[0], pos[2]);
    this.camera.rotation.set(pitchDeg * DEG, yawDeg * DEG, 0, 'YXZ');
    this.camera.position.set(pos[0], this.floorY + (pos[1] ?? PLAYER.eye), pos[2]);
  }

  update(dt) {
    const k = this.keys;
    let ix = 0;
    let iz = 0;
    if (!this.frozen) {
      if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    }
    const moving = ix !== 0 || iz !== 0;
    this.running = moving && (k.has('ShiftLeft') || k.has('ShiftRight'));
    const target = moving ? (this.running ? PLAYER.run : PLAYER.walk) : 0;

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

    this.collision.move(this.pos, this.vel.x * dt, this.vel.y * dt, PLAYER.radius);

    // 계단 높이는 부드럽게 따라간다
    const fh = this.collision.floorHeight(this.pos.x, this.pos.z);
    this.floorY += (fh - this.floorY) * (1 - Math.exp(-12 * dt));

    const ref = this.running ? PLAYER.run : PLAYER.walk;
    const b = this.bob.update(dt, Math.min(1, this.speed / ref), this.running);
    if (b.stepped && this.onStep && this.speed > 0.3) {
      this.onStep(this.collision.surfaceAt(this.pos.x, this.pos.z), this.running);
    }

    this.camera.position.set(
      this.pos.x + this._right.x * b.x,
      this.floorY + PLAYER.eye + b.y,
      this.pos.z + this._right.z * b.x,
    );

    const fovTarget = PLAYER.fov + (this.running && this.speed > PLAYER.walk + 0.4 ? PLAYER.runFovAdd : 0);
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
