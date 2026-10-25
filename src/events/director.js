import * as THREE from 'three';
import { EVENTS, FIGURE_WINDOW, DIM, WINDOW_LOOK } from '../config.js';
import { figureWindowTexture } from '../materials/windowTex.js';

const rand = (a, b) => a + Math.random() * (b - a);

// 평가용 이상 현상 3종 + 상시 분위기 타이머(정적 구간, 먼 문 닫힘, 먼 금속 소리).
// 점프스케어·큰 소리·번쩍임 없음. 깜빡임 상태는 최소 0.36초 유지 → 초당 3회 미만.
export class Director {
  constructor({ scene, camera, lights, signs, audio, litInfo }) {
    this.camera = camera;
    this.lights = lights;
    this.signs = signs;
    this.audio = audio;
    this.t = 0;
    this.last = null;
    this.readyAt = { lamp: 20, led: 20, figure: 20 };
    this.cool = { lamp: EVENTS.lampCooldown, led: EVENTS.ledCooldown, figure: EVENTS.figureCooldown };
    this.nextAuto = rand(...EVENTS.autoInterval);
    this.nextSilence = rand(...EVENTS.silenceEvery);
    this.silenceEnd = -1;
    this.nextDoor = rand(...EVENTS.doorEvery);
    this.nextMetal = rand(...EVENTS.metalEvery);
    this.lampSeq = null;
    this.status = '대기';
    this.log = [];

    // 3층 불 켜진 창의 실루엣
    const info = litInfo[FIGURE_WINDOW];
    const W = DIM.window;
    const mat = new THREE.MeshBasicMaterial({ map: figureWindowTexture(), transparent: true, color: new THREE.Color().setScalar(WINDOW_LOOK.litEmissive), opacity: 1 });
    this.figure = new THREE.Mesh(new THREE.PlaneGeometry(W.w, W.h), mat);
    this.figure.position.copy(info.pos);
    this.figure.rotation.y = info.ry;
    this.figure.visible = false;
    this.figureNormal = info.normal.clone();
    scene.add(this.figure);
    this.fig = null;
    this.frustum = new THREE.Frustum();
    this.m = new THREE.Matrix4();
    this.v = new THREE.Vector3();
  }

  get active() {
    return !!this.lampSeq || this.signs.some((s) => s.glitching) || !!this.fig;
  }

  note(msg) {
    this.status = msg;
    this.log.unshift(`${this.t.toFixed(0)}s ${msg}`);
    this.log.length = Math.min(this.log.length, 4);
  }

  // E 키: 쿨다운 무시, 직전 이벤트와 진행 중인 이벤트만 제외
  force() {
    const ids = ['lamp', 'led', 'figure'].filter((id) => id !== this.last && !this.isRunning(id));
    if (ids.length) this.trigger(ids[Math.floor(Math.random() * ids.length)]);
  }

  isRunning(id) {
    if (id === 'lamp') return !!this.lampSeq;
    if (id === 'led') return this.signs.some((s) => s.glitching);
    return !!this.fig;
  }

  trigger(id) {
    this.last = id;
    this.readyAt[id] = this.t + this.cool[id];
    if (id === 'lamp') this.startLamp();
    else if (id === 'led') this.startLed();
    else this.startFigure();
  }

  // 1) 가로등: 깜빡임 → 5초 꺼짐 → 복귀
  startLamp() {
    const lamps = this.lights.yardLamps;
    const p = this.camera.position;
    const sorted = [...lamps].sort((a, b) => a.headPos.distanceToSquared(p) - b.headPos.distanceToSquared(p));
    const lamp = sorted[Math.floor(Math.random() * Math.min(2, sorted.length))];
    const m = EVENTS.flickerMinState;
    const steps = [];
    for (let i = 0; i < 4; i++) {
      steps.push([0.12, m + Math.random() * 0.2]);
      steps.push([0.75 + Math.random() * 0.25, m + Math.random() * 0.3]);
    }
    steps.push([0, EVENTS.lampOff]);
    steps.push([0.35, m + 0.1]);
    steps.push([0.05, m]);
    steps.push([1, 0]);
    this.lampSeq = { lamp, steps, i: 0, until: this.t + steps[0][1] };
    this.setLamp(lamp, steps[0][0]);
    this.note('가로등 깜빡임');
  }

  setLamp(lamp, on) {
    lamp.on = on;
    lamp.light.intensity = lamp.baseIntensity * on;
    lamp.lensMat.color.copy(lamp.baseLens).multiplyScalar(0.04 + 0.96 * on);
    lamp.halo.material.color.copy(lamp.baseHalo).multiplyScalar(on);
  }

  // 2) LED: 1.5초간 글자 일부 사라짐·뒤바뀜 + 지직 소리
  startLed() {
    const p = this.camera.position;
    const sign = [...this.signs].sort((a, b) => a.group.position.distanceToSquared(p) - b.group.position.distanceToSquared(p))[0];
    sign.glitch(this.t, EVENTS.ledGlitch);
    const wp = new THREE.Vector3();
    sign.group.getWorldPosition(wp);
    this.audio.glitch(wp, EVENTS.ledGlitch);
    this.note('전광판 글리치');
  }

  // 3) 3층 창 실루엣: 시야에 누적 3초 들어오면 사라짐
  startFigure() {
    this.figure.visible = true;
    this.figure.material.opacity = 1;
    this.fig = { seen: 0, fade: -1, expire: this.t + 75 };
    this.note('3층 창 실루엣');
  }

  figureVisible() {
    const cam = this.camera;
    this.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    const pos = this.figure.position;
    if (!this.frustum.containsPoint(pos)) return false;
    this.v.copy(cam.position).sub(pos);
    if (this.v.dot(this.figureNormal) <= 0) return false; // 창 뒤쪽
    if (this.v.length() > 48) return false;
    // 화면 중앙 근처(시야각 안쪽)일 때만 '보았다'로 친다
    cam.getWorldDirection(this.v);
    const to = pos.clone().sub(cam.position).normalize();
    return this.v.dot(to) > Math.cos(THREE.MathUtils.degToRad(cam.fov * 0.5));
  }

  update(t, dt) {
    this.t = t;
    // 자동 발동
    if (t >= this.nextAuto) {
      this.nextAuto = t + rand(...EVENTS.autoInterval);
      const ids = ['lamp', 'led', 'figure'].filter((id) => id !== this.last && t >= this.readyAt[id] && !this.isRunning(id));
      if (ids.length) this.trigger(ids[Math.floor(Math.random() * ids.length)]);
    }

    // 가로등 시퀀스
    const s = this.lampSeq;
    if (s && t >= s.until) {
      s.i++;
      if (s.i >= s.steps.length) {
        this.setLamp(s.lamp, 1);
        this.lampSeq = null;
      } else {
        this.setLamp(s.lamp, s.steps[s.i][0]);
        s.until = t + s.steps[s.i][1];
      }
    }

    // 실루엣
    const f = this.fig;
    if (f) {
      if (f.fade < 0) {
        if (this.figureVisible()) f.seen += dt;
        if (f.seen >= EVENTS.figureSeen || t > f.expire) f.fade = t;
      } else {
        const k = (t - f.fade) / 0.6;
        this.figure.material.opacity = Math.max(0, 1 - k);
        if (k >= 1) {
          this.figure.visible = false;
          this.fig = null;
        }
      }
    }

    // 정적 구간
    if (this.silenceEnd < 0 && t >= this.nextSilence) {
      this.silenceEnd = t + EVENTS.silenceLength;
      this.audio.setSilence(true);
      this.note('정적 구간');
    } else if (this.silenceEnd > 0 && t >= this.silenceEnd) {
      this.silenceEnd = -1;
      this.nextSilence = t + rand(...EVENTS.silenceEvery);
      this.audio.setSilence(false);
    }

    // 먼 문 닫힘 / 먼 금속 소리 (정적 구간이 끝난 직후가 가장 효과적이지만 무작위로 둔다)
    if (t >= this.nextDoor) {
      this.nextDoor = t + rand(...EVENTS.doorEvery);
      const pos = Math.random() < 0.5 ? new THREE.Vector3(24, 2, -8) : new THREE.Vector3(-22, 2, -24);
      this.audio.doorSlam(pos);
      this.note('먼 문 닫힘');
    }
    if (t >= this.nextMetal) {
      this.nextMetal = t + rand(...EVENTS.metalEvery);
      const a = Math.random() * Math.PI * 2;
      this.audio.metal(new THREE.Vector3(Math.cos(a) * 45, 3, Math.sin(a) * 45 - 10));
    }
  }
}
