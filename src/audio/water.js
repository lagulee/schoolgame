// 수영장 물소리 (단계 21 옥상, 파일 없음): 분홍 잡음을 낮게 걸러 천천히 일렁이게 한 고리 소리. 수영장 가운데 위치음(HRTF).
// 옥상에 있을 때만 들린다 (setLevel 0~1, 부드럽게).
export function poolWater(audio, pos, { gain = 0.16, ref = 3 } = {}) {
  const h = { level: 0, set: null };
  audio.whenStarted(() => {
    const ctx = audio.ctx;
    const e = audio.emitter(pos, { ref, rolloff: 1.2, max: 40, volume: 0 });
    const src = audio.loop(audio.noise);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = gain;
    // 아주 느린 일렁임 (0.13 Hz, 소리 크기만)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = ctx.createGain();
    depth.gain.value = gain * 0.35;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    src.connect(lp).connect(g);
    const fizz = ctx.createGain(); // 잔물결 (조금만)
    fizz.gain.value = 0.35;
    src.connect(bp).connect(fizz).connect(g);
    g.connect(e.input);
    h.set = (v) => e.pa.setVolume(v);
    h.set(h.level);
  });
  return {
    setLevel(v) {
      if (Math.abs(v - h.level) < 1e-3) return;
      h.level = v;
      h.set?.(v);
    },
  };
}
