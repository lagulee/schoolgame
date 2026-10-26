// 탈진 숨소리: 짧은 날숨·들숨(띠대역 노이즈 덩어리)을 한 주기로 만든 버퍼를 반복 재생하고, 세기(level 0~1)로 음량만 바꾼다.
// 파일 없음 (Web Audio 합성).
export class Breath {
  constructor(ctx, out, { volume, rate }) {
    this.ctx = ctx;
    this.volume = volume;
    const sr = ctx.sampleRate;
    const period = 1 / rate;
    const n = Math.floor(sr * period);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    // 날숨(앞 40%, 강하게) + 들숨(55~85%, 약하게), 각 구간은 sin² 포락선
    const puff = (x, a, b, amp) => (x < a || x > b ? 0 : amp * Math.sin(Math.PI * (x - a) / (b - a)) ** 2);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      lp += ((Math.random() * 2 - 1) - lp) * 0.35; // 거친 고역을 살짝 깎는다
      d[i] = lp * (puff(x, 0, 0.4, 1) + puff(x, 0.55, 0.85, 0.55));
    }
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.6;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(bp).connect(this.gain).connect(out);
    this.src.start();
  }

  setLevel(level) {
    this.gain.gain.setTargetAtTime(this.volume * level, this.ctx.currentTime, 0.15);
  }
}
