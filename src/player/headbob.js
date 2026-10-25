import { PLAYER } from '../config.js';

// 세로 y = A sin(2π f t), 좌우는 f/2 에 A/2, 숨쉬기 미세 상하.
// 세로 파형의 최저점(φ mod 1 = 0.75)을 발 디딤으로 보고 step 이벤트를 낸다.
export class HeadBob {
  constructor() {
    this.phase = 0;
    this.amp = 0;
    this.freq = PLAYER.bob.walk.freq;
    this.levelIndex = 0;
    this.breathT = 0;
  }

  get level() {
    return PLAYER.bob.levels[this.levelIndex];
  }

  cycleLevel() {
    this.levelIndex = (this.levelIndex + 1) % PLAYER.bob.levels.length;
    return this.level;
  }

  // moveFactor: 0~1 (현재 속도 / 목표 속도)
  update(dt, moveFactor, running) {
    const cfg = running ? PLAYER.bob.run : PLAYER.bob.walk;
    const k = 1 - Math.exp(-6 * dt);
    this.amp += (cfg.amp * moveFactor - this.amp) * k;
    this.freq += (cfg.freq - this.freq) * k;
    const prev = this.phase;
    if (moveFactor > 0.08) this.phase += this.freq * dt;
    const stepped = Math.floor(prev + 0.25) !== Math.floor(this.phase + 0.25);
    this.breathT += dt;
    const L = this.level;
    const y = Math.sin(2 * Math.PI * this.phase) * this.amp * L +
      Math.sin(2 * Math.PI * PLAYER.bob.breathFreq * this.breathT) * PLAYER.bob.breath * (L > 0 ? 1 : 0.5);
    const x = Math.sin(Math.PI * this.phase) * this.amp * 0.5 * L;
    return { x, y, stepped };
  }
}
