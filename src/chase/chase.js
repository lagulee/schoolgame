// 추격 거리(gap) 모델 (STORY 10-2·14-3·14-4). 순수 로직: DOM·three 없음 → Node 테스트와 시뮬레이터가 그대로 쓴다.
// 플레이어와 귀신을 경로 하나 위의 점으로 보고, 둘 사이 거리 gap 만 계산한다 (길찾기 없음).
// - 매 프레임 gap += (플레이어 속도 − 귀신 속도) × dt
// - 지연(일행 처리 companionKillDelay, 지형 delays)은 "그 시간 동안 귀신이 멈춤"으로 처리한다.
//   지연이 끝난 뒤의 gap 은 STORY 의 gap += ghostSpeed × 시간 과 같고, 귀신 위치가 뒤로 튀지 않는다.
// - gap ≤ catchDistance 면 잡힘.
// - 마지막 추격(final): 출구 도착 시 gap ≥ ghostSpeed × unlockTime + catchDistance 면 통과,
//   unlockTime 동안 조작 불가(출구 열기). 통과하지 못하면 문을 여는 동안 잡힌다.
// - triggerAt(선택): 그 경로 위치에 잡히지 않고 닿으면 'trigger' 로 끝난다 (R2 의 입구 직전 붙잡힘 연출 전환).

import { exitMinGap } from '../story/chases.js';

export const PHASES = ['kill', 'run', 'unlock', 'caught', 'exit', 'trigger'];

// 재시도 시작 gap 보너스 (STORY 14-4): 시도마다 +step, 최대 +max. attempt 는 0 부터 (첫 시도 = 0)
export function retryBonus(attempt, cfg) {
  return Math.min(Math.max(0, attempt) * cfg.retryGapStep, cfg.retryGapMax);
}

export class Chase {
  // def: data/chases.json 의 항목, cfg: src/config.js 의 CHASE
  // opts.attempt: 재시도 횟수 (0 = 첫 시도), opts.trigger: true 면 def.triggerBeforeExit 지점에서 'trigger' 로 끝냄 (R2)
  constructor(def, cfg, { attempt = 0, trigger = false } = {}) {
    if (!(def.pathLength > 0)) throw new Error(`${def.id}: pathLength 가 정해지지 않음`);
    this.def = def;
    this.cfg = cfg;
    this.attempt = attempt;
    this.ghostSpeed = def.ghostSpeed ?? cfg.ghostSpeedDefault;
    this.startGap = (def.startGap ?? cfg.startGapDefault) + retryBonus(attempt, cfg);
    this.pathLength = def.pathLength;
    this.final = !!def.final;
    this.unlockTime = this.final ? def.unlockTime ?? 0 : 0;
    this.minExitGap = this.final ? exitMinGap({ ghostSpeed: this.ghostSpeed, unlockTime: this.unlockTime }, cfg.catchDistance) : cfg.catchDistance;
    this.triggerAt = trigger ? this.pathLength - (def.triggerBeforeExit ?? 0) : null;
    if (trigger && !(def.triggerBeforeExit > 0)) throw new Error(`${def.id}: triggerBeforeExit 없음`);
    this.delays = [...(def.delays ?? [])].sort((a, b) => a.at - b.at);
    this.t = 0;
    this.dist = 0; // 플레이어가 경로를 따라 간 거리
    this.gap = this.startGap;
    this.minGap = this.gap;
    this.stall = this.final ? def.companionKillDelay ?? 0 : 0; // 귀신이 멈춰 있는 남은 시간
    this.nextDelay = 0; // 아직 일어나지 않은 첫 지연의 번호
    this.unlockLeft = 0;
    this.arrivalGap = null; // 출구(또는 트리거 지점)에 닿았을 때의 gap
    this.arriveT = null; // 그때의 시각
    this.passed = null; // 마지막 추격: 출구 통과 조건을 만족했는가
    this.phase = this.stall > 0 ? 'kill' : 'run';
  }

  get done() {
    return this.phase === 'caught' || this.phase === 'exit' || this.phase === 'trigger';
  }

  // 플레이어 조작 불가 구간 (출구 열기)
  get locked() {
    return this.phase === 'unlock';
  }

  // 지금 귀신 속도 (멈춰 있으면 0)
  get ghostNow() {
    return this.stall > 0 ? 0 : this.ghostSpeed;
  }

  // 목적지(R2 는 트리거 지점)까지 남은 거리
  get remaining() {
    return Math.max(0, (this.triggerAt ?? this.pathLength) - this.dist);
  }

  // 귀신의 경로 위 위치 (연출·발소리용, 시작 지점 기준. 음수면 시작 지점 뒤)
  get ghostPos() {
    return this.dist - this.gap;
  }

  // playerSpeed: 이번 프레임 플레이어 실제 속도 (m/s). 끝났으면 아무것도 하지 않는다. 반환: phase
  update(dt, playerSpeed) {
    if (this.done || dt <= 0) return this.phase;
    // 지연 시작·끝, 도착, 잡힘이 프레임 가운데에서 일어나도 프레임 크기와 무관하게 같은 결과가 되도록 구간을 나눠 진행한다
    let left = dt;
    for (let i = 0; i < 64 && left > 1e-9 && !this.done; i++) left -= this.step(left, this.locked ? 0 : Math.max(0, playerSpeed));
    return this.phase;
  }

  // 귀신 속도·플레이어 속도가 일정한 한 구간을 진행하고 쓴 시간을 돌려준다
  step(maxDt, v) {
    const goal = this.triggerAt ?? this.pathLength;
    let h = maxDt;
    if (this.stall > 0) h = Math.min(h, this.stall);
    if (this.locked) h = Math.min(h, this.unlockLeft);
    else if (v > 0) {
      h = Math.min(h, (goal - this.dist) / v);
      const d = this.delays[this.nextDelay];
      if (d) h = Math.min(h, (d.at - this.dist) / v);
    }
    const close = this.ghostNow - v; // gap 이 줄어드는 속도
    const catchable = !this.locked || !this.passed; // 통과 조건을 만족했으면 문을 여는 동안은 잡히지 않는다
    if (close > 0 && catchable) h = Math.min(h, (this.gap - this.cfg.catchDistance) / close);
    h = Math.max(0, h);

    this.t += h;
    this.dist += v * h;
    this.gap += (v - this.ghostNow) * h;
    this.minGap = Math.min(this.minGap, this.gap);
    if (this.stall > 0) {
      this.stall = Math.max(0, this.stall - h);
      if (this.stall < 1e-9) this.stall = 0;
      if (this.stall === 0 && this.phase === 'kill') this.phase = 'run';
    }
    if (catchable && this.gap <= this.cfg.catchDistance + 1e-9) {
      this.phase = 'caught';
      return h;
    }
    if (this.locked) {
      this.unlockLeft -= h;
      if (this.unlockLeft <= 1e-9) this.phase = this.passed ? 'exit' : 'caught';
      return h;
    }
    while (this.delays[this.nextDelay] && this.dist >= this.delays[this.nextDelay].at - 1e-9) {
      this.stall += this.delays[this.nextDelay].seconds;
      this.nextDelay++;
    }
    if (this.dist >= goal - 1e-9) this.arrive();
    return h;
  }

  arrive() {
    this.dist = this.triggerAt ?? this.pathLength;
    this.arrivalGap = this.gap;
    this.arriveT = this.t;
    if (this.triggerAt !== null) {
      this.phase = 'trigger';
      return;
    }
    if (!this.final) {
      this.phase = 'exit';
      return;
    }
    this.passed = this.gap >= this.minExitGap - 1e-9;
    this.unlockLeft = this.unlockTime;
    this.phase = this.unlockTime > 0 ? 'unlock' : this.passed ? 'exit' : 'caught';
  }

  // 끝난 결과. atExit: 사건 finale.atExit (escape / playerCaught / collapse), 일반 추격은 없음
  // outcome: caught(잡힘 → 체크포인트 재시작) | exit(목적지 도착) | trigger(R2 붙잡힘 연출로 전환)
  result(atExit = null) {
    if (!this.done) return null;
    const finale = this.phase === 'caught' ? null : this.phase === 'trigger' ? 'playerCaught' : atExit;
    return { id: this.def.id, outcome: this.phase, finale, arrivalGap: this.arrivalGap, minGap: this.minGap, time: this.t, attempt: this.attempt };
  }
}
