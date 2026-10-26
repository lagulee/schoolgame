import * as THREE from 'three';
import { AUDIO, STAMINA } from '../config.js';
import { Footsteps } from './footsteps.js';
import { Breath } from './breath.js';

// Web Audio 로만 만드는 소리 (파일 없음). 첫 클릭(사용자 제스처) 후 시작한다.
export function noiseBuffer(ctx, seconds, type = 'white') {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'pink') {
      // Paul Kellet 근사 핑크 노이즈 (1/f)
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else if (type === 'brown') {
      last = (last + 0.02 * w) / 1.02; // 적분된 노이즈 (1/f²)
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

export class AudioSystem {
  constructor(camera, scene) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.scene = scene;
    this.ctx = this.listener.context;
    this.started = false;
    this.muted = false;
    this.emitters = []; // 정적 구간에 함께 줄일 상시 공간음
  }

  start() {
    if (this.started) {
      this.ctx.resume();
      return;
    }
    this.started = true;
    this.ctx.resume();
    const ctx = this.ctx;
    this.listener.setMasterVolume(AUDIO.master);
    this.out = this.listener.getInput();
    this.bus = ctx.createGain(); // 앰비언트 버스 (정적 구간에 덕킹)
    this.bus.connect(this.out);

    // 바람: 핑크 노이즈 → 저역 통과, 느린 LFO 로 돌풍
    const wind = this.loop(noiseBuffer(ctx, 6, 'pink'));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const wg = ctx.createGain();
    wg.gain.value = AUDIO.wind;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = AUDIO.wind * 0.6;
    lfo.connect(lfoAmt).connect(wg.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.13;
    const lfo2Amt = ctx.createGain();
    lfo2Amt.gain.value = 180;
    lfo2.connect(lfo2Amt).connect(lp.frequency);
    wind.connect(lp).connect(wg).connect(this.bus);
    lfo.start();
    lfo2.start();

    // 전기 험: 50Hz + 100Hz
    const hum = ctx.createGain();
    hum.gain.value = AUDIO.hum;
    for (const [f, a] of [[50, 1], [100, 0.6], [150, 0.15]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = a;
      o.connect(g).connect(hum);
      o.start();
    }
    hum.connect(this.bus);

    // 먼 도시 소음: 브라운 노이즈 → 저역 통과
    const city = this.loop(noiseBuffer(ctx, 8, 'brown'));
    const clp = ctx.createBiquadFilter();
    clp.type = 'lowpass';
    clp.frequency.value = 260;
    const cg = ctx.createGain();
    cg.gain.value = AUDIO.city;
    city.connect(clp).connect(cg).connect(this.bus);

    this.footsteps = new Footsteps(ctx, this.out);
    this.breath = new Breath(ctx, this.out, STAMINA.BREATH);
    this.noise = noiseBuffer(ctx, 2, 'white');
    for (const fn of this.pending ?? []) fn();
    this.pending = null;
  }

  loop(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start();
    return s;
  }

  // 시작 전에 등록된 설정은 start() 때 실행
  whenStarted(fn) {
    if (this.started) fn();
    else (this.pending ??= []).push(fn);
  }

  // 위치 음원 (HRTF 패닝). 반환된 input 에 소리 노드를 연결한다.
  emitter(pos, { ref = 2, rolloff = 1.4, max = 60, volume = 1 } = {}) {
    const pa = new THREE.PositionalAudio(this.listener);
    const input = this.ctx.createGain();
    pa.setNodeSource(input);
    pa.panner.panningModel = 'HRTF';
    pa.setRefDistance(ref);
    pa.setRolloffFactor(rolloff);
    pa.setMaxDistance(max);
    pa.setDistanceModel('inverse');
    pa.setVolume(volume);
    pa.position.copy(pos);
    this.scene.add(pa);
    pa.updateMatrixWorld();
    return { pa, input, base: volume };
  }

  // LED 전광판 지직 소리: 희미한 100Hz 버즈 + 드문 잡음 크랙
  addLedBuzz(pos) {
    this.whenStarted(() => {
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * 4, sr);
      const d = buf.getChannelData(0);
      let crack = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        if (Math.random() < 0.00012) crack = 0.02 + Math.random() * 0.05;
        crack = Math.max(0, crack - 1 / sr);
        d[i] = (Math.sign(Math.sin(2 * Math.PI * 100 * t)) * 0.05 + (crack > 0 ? (Math.random() * 2 - 1) * 0.5 : 0)) * 0.6;
      }
      const src = this.loop(buf);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 0.7;
      const e = this.emitter(pos, { ref: 1.5, rolloff: 1.6, volume: 0.5 });
      src.connect(bp).connect(e.input);
      this.emitters.push(e);
    });
  }

  // 가로등 형광 버즈 (깜빡임과 동기: lamp.on 을 따라 볼륨)
  addLampBuzz(lamp) {
    this.whenStarted(() => {
      const ctx = this.ctx;
      const e = this.emitter(lamp.headPos, { ref: 1.2, rolloff: 1.8, volume: 0.35 });
      for (const [f, a] of [[120, 0.5], [240, 0.3], [360, 0.18], [480, 0.1]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f + Math.random() * 0.6;
        const g = ctx.createGain();
        g.gain.value = a * 0.12;
        o.connect(g).connect(e.input);
        o.start();
      }
      e.lamp = lamp;
      this.emitters.push(e);
    });
  }

  // 일회성 소리 -------------------------------------------------------
  oneShot(pos, build, opts) {
    if (!this.started) return;
    const e = this.emitter(pos, opts);
    const dur = build(this.ctx, e.input, this.ctx.currentTime);
    setTimeout(() => {
      this.scene.remove(e.pa);
      e.pa.gain.disconnect();
    }, (dur + 1) * 1000);
  }

  // 먼 문 닫힘: 낮은 쿵 + 짧은 덜컹 + 울림
  doorSlam(pos) {
    this.oneShot(pos, (ctx, out, t) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.23;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const mix = ctx.createGain();
      o.connect(g).connect(mix);
      n.connect(nf).connect(ng).connect(mix);
      mix.connect(out);
      mix.connect(delay).connect(fb).connect(delay);
      fb.connect(out);
      o.start(t);
      o.stop(t + 1);
      n.start(t);
      n.stop(t + 0.3);
      return 2.5;
    }, { ref: 6, rolloff: 0.8, max: 200, volume: 0.6 });
  }

  // 먼 금속 소리: 비조화 배음이 감쇠하는 '깡'
  metal(pos) {
    this.oneShot(pos, (ctx, out, t) => {
      const base = 380 + Math.random() * 300;
      for (const [r, a, dec] of [[1, 0.5, 1.6], [2.76, 0.3, 1.1], [5.4, 0.2, 0.7], [8.93, 0.12, 0.45]]) {
        const o = ctx.createOscillator();
        o.frequency.value = base * r;
        const g = ctx.createGain();
        g.gain.setValueAtTime(a * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dec + 0.05);
      }
      return 2;
    }, { ref: 8, rolloff: 0.7, max: 200, volume: 0.4 });
  }

  // 전광판 글리치 잡음: 띠대역 노이즈를 계단식으로 끊어서 (상태 변화는 초당 3회 미만)
  glitch(pos, dur) {
    this.oneShot(pos, (ctx, out, t) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      for (let s = 0; s < dur; s += 0.4) {
        g.gain.setValueAtTime(0.18 + Math.random() * 0.15, t + s);
        bp.frequency.setValueAtTime(900 + Math.random() * 2500, t + s);
        g.gain.setValueAtTime(0.03, t + s + 0.25);
      }
      g.gain.setValueAtTime(0, t + dur);
      n.connect(bp).connect(g).connect(out);
      n.start(t);
      n.stop(t + dur + 0.1);
      return dur + 0.5;
    }, { ref: 2, rolloff: 1.2, volume: 0.6 });
  }

  // 정적 구간: 환경음을 낮췄다가 복귀
  setSilence(on) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(on ? 0.08 : 1, t, on ? 1.5 : 2.5);
    this.silent = on;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.started) this.listener.setMasterVolume(this.muted ? 0 : AUDIO.master);
    return this.muted;
  }

  step(surface, running) {
    if (this.started && !this.muted) this.footsteps.play(surface, running);
  }

  // 탈진 숨소리 세기 (0~1, 플레이어의 tired)
  setBreath(level) {
    if (!this.started) return;
    const v = level < 0.01 ? 0 : level;
    if (v === this.breathLevel) return;
    this.breathLevel = v;
    this.breath.setLevel(v);
  }

  update() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const duck = this.silent ? 0.15 : 1;
    for (const e of this.emitters) {
      const on = e.lamp ? e.lamp.on : 1;
      e.pa.gain.gain.setTargetAtTime(e.base * on * duck, t, e.lamp ? 0.03 : 1.2);
    }
  }
}
