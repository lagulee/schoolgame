import { AUDIO } from '../config.js';
import { noiseBuffer } from './audio.js';

// 바닥 재질별 발소리: 짧은 노이즈 버스트 + 재질 필터. 보폭(헤드밥 최저점)에 맞춰 호출된다.
const SURF = {
  brick: { type: 'bandpass', f: 1300, q: 0.9, dec: 0.085, thump: 0.35, gain: 1 },
  stone: { type: 'bandpass', f: 2900, q: 1.8, dec: 0.055, thump: 0.25, gain: 1.15 },
  concrete: { type: 'bandpass', f: 850, q: 1.1, dec: 0.1, thump: 0.45, gain: 1, echo: 0.32 },
  grass: { type: 'lowpass', f: 650, q: 0.5, dec: 0.17, thump: 0.15, gain: 0.7 },
  dirt: { type: 'bandpass', f: 1500, q: 0.7, dec: 0.07, thump: 0.25, gain: 0.8, grains: 2 }, // 운동장 마사토
  gravel: { type: 'bandpass', f: 2200, q: 0.6, dec: 0.05, thump: 0.2, gain: 0.85, grains: 4 },
};

export class Footsteps {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.buf = noiseBuffer(ctx, 0.5, 'white');
    this.side = 1;
    // 필로티처럼 막힌 곳의 짧은 반향
    this.echo = ctx.createDelay(0.5);
    this.echo.delayTime.value = 0.085;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    this.echo.connect(lp).connect(fb).connect(this.echo);
    fb.connect(out);
  }

  play(surface, running) {
    const s = SURF[surface] ?? SURF.brick;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const vol = (running ? AUDIO.stepRun : AUDIO.stepWalk) * s.gain;
    this.side = -this.side;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.side * 0.12;
    pan.connect(this.out);
    if (s.echo) {
      const send = ctx.createGain();
      send.gain.value = s.echo;
      pan.connect(send).connect(this.echo);
    }
    const grains = s.grains ?? 1;
    for (let i = 0; i < grains; i++) {
      const g0 = t + i * 0.018 * (0.6 + Math.random());
      const src = ctx.createBufferSource();
      src.buffer = this.buf;
      src.playbackRate.value = 0.85 + Math.random() * 0.3;
      const f = ctx.createBiquadFilter();
      f.type = s.type;
      f.frequency.value = s.f * (0.9 + Math.random() * 0.2) * (running ? 1.1 : 1);
      f.Q.value = s.q;
      const g = ctx.createGain();
      const a = vol / Math.sqrt(grains);
      g.gain.setValueAtTime(0.0001, g0);
      g.gain.exponentialRampToValueAtTime(a, g0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, g0 + s.dec * (running ? 0.85 : 1));
      src.connect(f).connect(g).connect(pan);
      src.start(g0, Math.random() * 0.3);
      src.stop(g0 + s.dec + 0.05);
    }
    // 뒤꿈치 저음
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * s.thump, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(og).connect(pan);
    o.start(t);
    o.stop(t + 0.1);
  }
}
