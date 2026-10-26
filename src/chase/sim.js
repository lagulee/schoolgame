// 추격 자동 시뮬레이터 (STORY 14-4 "구현 후 세 플레이 유형을 자동 시뮬레이션으로 확인").
// 실제 Stamina 모듈과 컨트롤러와 같은 속도 규칙(달리기·걷기·탈진, 가속 lerp)으로 플레이어를 움직이고 Chase 에 속도를 넣는다.
// 플레이 유형(정책)은 src/config.js CHASE.SIM 의 값으로 만든다.
import { Chase } from './chase.js';
import { Stamina } from '../player/stamina.js';

// 정책: ({ t, dist, stamina, remaining, run }) => 달리기 입력 여부
export function makePolicy(profile, staminaCfg) {
  if (profile.kind === 'walk') return () => false;
  if (profile.kind === 'burst') return ({ t }) => t < profile.runFor;
  if (profile.kind === 'pace') {
    // 처음 runFor 초 달린 뒤, "그 시점 위치 + pace × 지난 시간" 을 목표로 뒤처지면 달리고 앞서면 걷는다 (band 만큼 여유를 둔 전환)
    let base = null;
    let on = false;
    return ({ t, dist }) => {
      if (t < profile.runFor) return true;
      base ??= { t, dist };
      const lag = base.dist + profile.pace * (t - base.t) - dist;
      on = on ? lag > -profile.band : lag > profile.band;
      return on;
    };
  }
  if (profile.kind === 'sprint') {
    // 처음 runFor 초 달린 뒤 걷다가, 남은 스태미나로 남은 거리를 끝까지 달릴 수 있게 되면 마지막 질주
    let sprint = false;
    return ({ t, stamina, remaining, run }) => {
      if (t < profile.runFor) return true;
      if (!sprint) sprint = (stamina.value / staminaCfg.RUN_COST) * run >= remaining;
      return sprint;
    };
  }
  throw new Error(`모르는 플레이 유형 ${profile.kind}`);
}

// def: chases.json 항목, profile: CHASE.SIM.profiles 의 하나
// cfg: { chase: CHASE, stamina: STAMINA, player: PLAYER }, opts: Chase 옵션(attempt, trigger) + dt
export function simulate(def, profile, cfg, opts = {}) {
  const dt = opts.dt ?? cfg.chase.SIM.dt;
  const chase = new Chase(def, cfg.chase, opts);
  const stamina = new Stamina(cfg.stamina);
  const want = makePolicy(profile, cfg.stamina);
  const { walk, run, accel } = cfg.player;
  let v = 0;
  let runTime = 0;
  let exhaustedTime = 0;
  let afterStart = null; // runFor 이후 구간의 평균 속도 측정 시작점
  const maxT = cfg.chase.SIM.maxTime;
  while (!chase.done && chase.t < maxT) {
    const wantRun = !chase.locked && want({ t: chase.t, dist: chase.dist, stamina, remaining: chase.remaining, run });
    const running = wantRun && stamina.canRun;
    const target = chase.locked ? 0 : running ? run : stamina.exhausted ? cfg.stamina.EXHAUSTED_SPEED : walk;
    v += (target - v) * (1 - Math.exp(-accel * dt));
    const mode = running ? 'run' : v > cfg.stamina.STILL_SPEED || target > 0 ? 'walk' : 'still';
    stamina.update(dt, mode);
    if (running) runTime += dt;
    if (stamina.exhausted) exhaustedTime += dt;
    if (afterStart === null && profile.runFor !== undefined && chase.t >= profile.runFor) afterStart = { t: chase.t, dist: chase.dist };
    chase.update(dt, v);
  }
  const res = chase.result();
  const arriveT = chase.arriveT ?? chase.t;
  const avgAfter = afterStart && chase.arrivalGap !== null ? (chase.dist - afterStart.dist) / (arriveT - afterStart.t) : null;
  return { ...res, outcome: res?.outcome ?? 'timeout', dist: chase.dist, runTime, exhaustedTime, avgAfter, arriveT, staminaEnd: stamina.value };
}

// 세 플레이 유형 + 걷기만 (보고·튜닝용 표)
export function simulateAll(def, cfg, opts = {}) {
  const out = {};
  for (const [name, profile] of Object.entries(cfg.chase.SIM.profiles)) out[name] = simulate(def, profile, cfg, opts);
  return out;
}
