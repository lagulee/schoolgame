// 문 소리 (단계 8·9·10, 파일 없음): 교실 미닫이 드르륵, 잠긴 문 덜컹(문 종류별, 단계 10), 현관 자동문 모터, 연결문 경첩 삐걱임. AudioSystem.oneShot 으로 3D 위치에서 낸다.

// 짧은 두드림: 노이즈 버스트(대역 통과) + 낮은 쿵
function knock(ctx, out, noise, t, gain, freq) {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(bp).connect(g).connect(out);
  n.start(t, Math.random() * 1.5);
  n.stop(t + 0.1);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain * 0.6, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.1);
}

// 레일 위로 미끄러지는 소리: 노이즈 + 이음매 덜컹(진폭 변조), 끝에 탁
function slide(audio, pos, dur, { freq = 520, rumble = 22, end = 0.35, gain = 0.22 } = {}) {
  audio.oneShot(pos, (ctx, out, t) => {
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.06);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rumble;
    const la = ctx.createGain();
    la.gain.value = gain * 0.35;
    lfo.connect(la).connect(g.gain);
    n.connect(bp).connect(g).connect(out);
    n.start(t);
    n.stop(t + dur + 0.05);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    if (end) knock(ctx, out, audio.noise, t + dur, end, 900);
    return dur + 0.6;
  }, { ref: 3, rolloff: 1.2, volume: 0.8 });
}

// 교실 미닫이 열고 닫기
export function doorSlide(audio, pos, dur) {
  slide(audio, pos, dur);
}

// 잠긴 문: 손잡이를 당겨 덜컹덜컹 (세 번, 0.3초 안)
export function doorRattle(audio, pos) {
  audio.oneShot(pos, (ctx, out, t) => {
    for (const [dt, g] of [[0, 0.5], [0.11, 0.38], [0.24, 0.3]]) knock(ctx, out, audio.noise, t + dt, g, 700 + Math.random() * 300);
    return 0.8;
  }, { ref: 3, rolloff: 1.2, volume: 0.9 });
}

// 잠긴 문 소리 (단계 10, data/map.json lockSounds): rattle = 교실 미닫이 덜컹, metal = 철문(연결문) 묵직하게, glass = 유리문 가볍게 높게
const LOCKED = {
  metal: { hits: [[0, 0.6], [0.14, 0.45], [0.3, 0.34]], freq: [380, 160] },
  glass: { hits: [[0, 0.32], [0.1, 0.24]], freq: [1700, 500] },
};
export function doorLocked(audio, pos, kind = 'rattle') {
  const L = LOCKED[kind];
  if (!L) return doorRattle(audio, pos);
  audio.oneShot(pos, (ctx, out, t) => {
    for (const [dt, g] of L.hits) knock(ctx, out, audio.noise, t + dt, g, L.freq[0] + Math.random() * L.freq[1]);
    return 0.9;
  }, { ref: 3, rolloff: 1.2, volume: 0.9 });
}

// 현관 자동문: 낮은 모터 소리 + 부드러운 미끄럼 (끝 탁 없음)
export function autoDoor(audio, pos, dur) {
  audio.oneShot(pos, (ctx, out, t) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(120, t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(90, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.setValueAtTime(0.05, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.15);
    return dur + 0.4;
  }, { ref: 3, rolloff: 1.2, volume: 0.8 });
  slide(audio, pos, dur, { freq: 380, rumble: 9, end: 0, gain: 0.08 });
}

// 여닫이 철문 (연결문, 단계 9): 경첩 삐걱임(좁은 대역 노이즈의 높낮이가 천천히 오르내림) + 끝에 묵직한 쿵 (닫을 때 더 세게)
export function doorSwing(audio, pos, dur, closing = false) {
  audio.oneShot(pos, (ctx, out, t) => {
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 9;
    bp.frequency.setValueAtTime(620, t);
    bp.frequency.linearRampToValueAtTime(880, t + dur * 0.35);
    bp.frequency.linearRampToValueAtTime(540, t + dur * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
    g.gain.setValueAtTime(0.16, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(out);
    n.start(t);
    n.stop(t + dur + 0.05);
    knock(ctx, out, audio.noise, t + dur, closing ? 0.6 : 0.25, 420);
    return dur + 0.7;
  }, { ref: 3, rolloff: 1.2, volume: 0.8 });
}
