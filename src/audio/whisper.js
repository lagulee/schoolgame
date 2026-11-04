// 귀 가까운 속삭임 (단계 20, STORY 13-3 혼자일 때 연출, 파일 없음): 숨소리 섞인 노이즈를 두 개의 좁은 대역(말소리 울림 자리)으로 걸러
// 짧은 음절 5~8개처럼 끊어 낸다. 알아들을 수 있는 말은 없다. AudioSystem.oneShot 으로 머리 뒤쪽 가까운 자리(HRTF)에서 낸다.
export function whisper(audio, pos, { gain = 0.3, len = 1.5 } = {}) {
  audio.oneShot(pos, (ctx, out, t) => {
    const n = Math.max(5, Math.min(8, Math.round(len / 0.22)));
    let s = t;
    for (let i = 0; i < n; i++) {
      const d = 0.09 + Math.random() * 0.14; // 음절 길이
      const src = ctx.createBufferSource();
      src.buffer = audio.noise;
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 650 + Math.random() * 450;
      f1.Q.value = 4;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1700 + Math.random() * 1500, s);
      f2.frequency.linearRampToValueAtTime(1500 + Math.random() * 1800, s + d);
      f2.Q.value = 5;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 400;
      const g = ctx.createGain();
      const peak = gain * (0.55 + Math.random() * 0.45);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(peak, s + d * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, s + d);
      src.connect(hp);
      hp.connect(f1).connect(g);
      hp.connect(f2).connect(g);
      g.connect(out);
      src.start(s, Math.random() * 1.5);
      src.stop(s + d + 0.02);
      s += d + 0.03 + Math.random() * 0.12; // 음절 사이 숨
    }
    return s - t + 0.1;
  }, { ref: 0.6, rolloff: 1.5, max: 8 });
}
