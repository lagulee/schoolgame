import * as THREE from 'three';
import { PHONE } from '../config.js';
import { flickerStep } from './phone.js';

// 손에 든 핸드폰 라이트 (이전 손전등을 약하게 바꾼 것). 방향은 시점 변화를 lerp 로 늦게 따라간다.
// 켜짐·저전력 여부는 Phone 상태를 매 프레임 sync() 로 받는다.
export class PhoneLight {
  constructor(scene, camera, rng = Math.random) {
    const c = PHONE.LIGHT;
    this.camera = camera;
    this.rng = rng;
    this.spot = new THREE.SpotLight(0xf4f2ff, c.intensity, c.distance, c.angle, c.penumbra, c.decay);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(c.shadowRes, c.shadowRes);
    this.spot.shadow.camera.near = 0.2;
    this.spot.shadow.camera.far = c.distance;
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.03;
    scene.add(this.spot, this.spot.target);
    this.offset = new THREE.Vector3(...c.offset);
    this.dir = new THREE.Vector3(0, 0, -1);
    this.tmp = new THREE.Vector3();
    this.low = false;
    this.flicker = { dim: false, left: c.flicker.every[0] };
    this.setOn(false);
    this.snap();
  }

  setOn(v) {
    this.on = v;
    this.spot.visible = v;
  }

  sync(phone) {
    if (phone.lightOn !== this.on) this.setOn(phone.lightOn);
    this.low = phone.low;
  }

  snap() {
    this.camera.getWorldDirection(this.dir);
    this.update(0);
  }

  update(dt) {
    const c = PHONE.LIGHT;
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.spot.position.copy(this.offset).applyMatrix4(cam.matrixWorld);
    cam.getWorldDirection(this.tmp);
    const k = dt > 0 ? 1 - Math.exp(-c.lag * dt) : 1;
    this.dir.lerp(this.tmp, k).normalize();
    this.spot.target.position.copy(this.spot.position).addScaledVector(this.dir, 6);
    this.spot.target.updateMatrixWorld();
    // 배터리 LOW_LEVEL 이하: 더 어둡게 + 가끔 잠깐 흐려짐 (초당 3회 미만)
    let f = 1;
    if (this.low) {
      if (dt > 0) this.flicker = flickerStep(this.flicker, dt, this.rng, c.flicker);
      f = c.lowDim * (this.flicker.dim ? c.flicker.dip : 1);
    }
    this.spot.intensity = c.intensity * f;
  }
}
