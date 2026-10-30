// 스태미나 순수 로직 (STORY 14-2). DOM·three 없음 → Node 테스트에서 그대로 쓴다.
// update(dt, mode): mode = 'run' | 'walk' | 'still' | 'hidden'
// - 'run' 이면 초당 RUN_COST 소모, 0 에 닿으면 탈진(exhausted). 탈진은 EXHAUST_CLEAR 이상 회복해야 풀린다.
// - 달리기를 멈춘 뒤 RECOVER_DELAY 초가 지나야 회복이 시작된다 (짧게 끊어 달려도 회복 대기가 매번 처음부터).
// - 회복 속도: 숨는 중 > 멈춤 > 걷기.
export class Stamina {
  constructor(cfg) {
    this.cfg = cfg;
    this.infinite = false; // 디버그: 무한 스태미나 (reset 이 끄지 않는다)
    this.reset();
  }

  reset() {
    this.value = this.cfg.MAX;
    this.exhausted = false;
    this.sinceRun = Infinity; // 마지막으로 달린 뒤 지난 시간 (초)
    this.draining = false;
    this.recovering = false;
  }

  // 체크포인트 (추격 시작 지점의 값으로 되돌림, 단계 0b-3). 회복 대기는 저장하지 않고 되돌린 순간부터 바로 회복 가능
  save() {
    return { value: this.value, exhausted: this.exhausted };
  }

  load(v) {
    this.reset();
    if (!v) return;
    this.value = Math.min(this.cfg.MAX, Math.max(0, v.value));
    this.exhausted = !!v.exhausted && this.value < this.cfg.EXHAUST_CLEAR;
  }

  // 지금 달릴 수 있는가 (탈진 아님 + 남은 양 > 0)
  get canRun() {
    return !this.exhausted && this.value > 0;
  }

  get ratio() {
    return this.value / this.cfg.MAX;
  }

  get low() {
    return this.ratio <= this.cfg.LOW;
  }

  get full() {
    return this.value >= this.cfg.MAX;
  }

  rateFor(mode) {
    const c = this.cfg;
    if (mode === 'hidden') return c.RECOVER_HIDDEN;
    if (mode === 'still') return c.RECOVER_STILL;
    return c.RECOVER_WALK;
  }

  update(dt, mode) {
    const c = this.cfg;
    this.draining = false;
    this.recovering = false;
    if (dt <= 0) return;
    if (this.infinite) {
      this.value = c.MAX;
      this.exhausted = false;
      return;
    }
    if (mode === 'run' && this.canRun) {
      this.sinceRun = 0;
      this.draining = true;
      this.value = Math.max(0, this.value - c.RUN_COST * dt);
      if (this.value <= 0) this.exhausted = true;
      return;
    }
    // 회복 대기: 대기 시간을 넘은 부분만 회복에 쓴다 (프레임 크기와 무관하게 같은 결과)
    const before = this.sinceRun;
    this.sinceRun += dt;
    const wait = Math.max(0, c.RECOVER_DELAY - before);
    const t = Math.max(0, dt - wait);
    if (t <= 0 || this.full) return;
    this.recovering = true;
    this.value = Math.min(c.MAX, this.value + this.rateFor(mode) * t);
    if (this.exhausted && this.value >= c.EXHAUST_CLEAR) this.exhausted = false;
  }
}
