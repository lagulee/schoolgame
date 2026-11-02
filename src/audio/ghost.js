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
