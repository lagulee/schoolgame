// 귀신 소리 (단계 12, 파일 없음): 맨발로 질질 끄는 듯한 발소리 한 걸음. AudioSystem.oneShot 으로 3D 위치에서 낸다.
// 박자(걸음 간격)는 부르는 쪽(scene/e2View.js)이 거리에 따라 정한다: 가까울수록 빨라진다 (STORY 10-3).
export function ghostStep(audio, pos, gain = 0.5) {
  audio.oneShot(pos, (ctx, out, t) => {
    // 바닥에 닿는 낮은 쿵
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.22);
    // 끌리는 소리: 저역 노이즈를 짧게 쓸어 내림
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(250, t + 0.38);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(gain * 0.45, t + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    n.connect(lp).connect(ng).connect(out);
    n.start(t + 0.03, Math.random() * 1.5);
    n.stop(t + 0.42);
    return 0.45;
  }, { ref: 3, rolloff: 1.2, max: 45 });
}

// 아래층에서 무언가 넘어지는 쿵 소리 (단계 13, E6): 낮고 긴 울림 + 짧은 덜컹 두 번
export function ghostBang(audio, pos, gain = 0.8) {
  audio.oneShot(pos, (ctx, out, t) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.95);
    for (const [dt, g] of [[0.02, 0.6], [0.32, 0.3]]) {
      const n = ctx.createBufferSource();
      n.buffer = audio.noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + dt);
      ng.gain.exponentialRampToValueAtTime(gain * g, t + dt + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25);
      n.connect(lp).connect(ng).connect(out);
      n.start(t + dt, Math.random() * 1.5);
      n.stop(t + dt + 0.3);
    }
    return 1.0;
  }, { ref: 6, rolloff: 0.8, max: 60 });
}

// 점프스케어 #1 (단계 14, E7): 날카로운 쇳소리 — 어긋난 두 높은 음 + 쓸어 내리는 노이즈. 밝기 변화 없이 소리로만 놀라게 한다
export function ghostSting(audio, pos, gain = 0.9) {
  audio.oneShot(pos, (ctx, out, t) => {
    for (const [f, d] of [[1180, -260], [1243, -300]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f + d, t + 0.8);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.95);
    }
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3000, t);
    hp.frequency.exponentialRampToValueAtTime(600, t + 0.6);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(gain * 0.4, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    n.connect(hp).connect(ng).connect(out);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.7);
    return 1.0;
  }, { ref: 3, rolloff: 1, max: 30 });
}

// 문 두드리는 소리 (단계 14, P3): 나무 문을 세 번 똑똑똑
export function ghostKnock(audio, pos, gain = 0.7) {
  audio.oneShot(pos, (ctx, out, t) => {
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.22;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(190, s);
      o.frequency.exponentialRampToValueAtTime(110, s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(gain, s + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
      o.connect(g).connect(out);
      o.start(s);
      o.stop(s + 0.14);
    }
    return 0.8;
  }, { ref: 3, rolloff: 1, max: 30 });
}

// 검은 연기로 흩어지는 소리 (단계 18, R1-d): 낮게 깔린 바람 같은 쉿 소리가 천천히 일었다 잦아든다 (날카로운 소리 없음)
export function ghostHiss(audio, pos, gain = 0.35, dur = 2.6) {
  audio.oneShot(pos, (ctx, out, t) => {
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.4);
    bp.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(out);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + 0.05);
    return dur;
  }, { ref: 3, rolloff: 1, max: 30 });
}
