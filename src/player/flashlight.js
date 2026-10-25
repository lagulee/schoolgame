import * as THREE from 'three';
import { LIGHTS } from '../config.js';

// 카메라 우측 하단에 달린 손전등. 방향은 시점 변화를 lerp 로 늦게 따라간다.
export class Flashlight {
  constructor(scene, camera) {
    const c = LIGHTS.flashlight;
    this.camera = camera;
    this.spot = new THREE.SpotLight(0xfff0d6, c.intensity, c.distance, c.angle, c.penumbra, c.decay);
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
    this.on = true;
    this.baseIntensity = c.intensity;
    this.snap();
  }

  setOn(v) {
    this.on = v;
    this.spot.visible = v;
  }

  toggle() {
    this.setOn(!this.on);
    return this.on;
  }

  snap() {
    this.camera.getWorldDirection(this.dir);
    this.update(0);
  }

  update(dt) {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.spot.position.copy(this.offset).applyMatrix4(cam.matrixWorld);
    cam.getWorldDirection(this.tmp);
    const k = dt > 0 ? 1 - Math.exp(-LIGHTS.flashlight.lag * dt) : 1;
    this.dir.lerp(this.tmp, k).normalize();
    this.spot.target.position.copy(this.spot.position).addScaledVector(this.dir, 6);
    this.spot.target.updateMatrixWorld();
  }
}
