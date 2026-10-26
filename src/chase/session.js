// 추격 진행: Chase(gap 모델) 하나를 돌리고, 잡히면 추격 시작 체크포인트로 되돌려 다시 시작한다.
// DOM·three 없음 (Node 테스트에서 StoryRunner·Stamina 와 함께 그대로 쓴다).
// - start(id, { atExit }) : 추격 시작 지점을 체크포인트로 저장 (runner.checkpoints 의 모든 항목 + 'chase' 항목)
// - 잡힘 → 시도 횟수 +1 → runner.restore(체크포인트) → 'chase' 항목이 같은 추격을 새 시작 gap 으로 다시 만든다
// - 도착(exit)·트리거(trigger) → onResult(result) 후 끝. 결과의 finale 은 사건 finale.atExit (R2 트리거는 playerCaught)
// 시도 횟수는 체크포인트에 넣지 않는다 (되돌려도 늘어난 재시도 보너스가 남아야 하므로).
import { Chase } from './chase.js';

export class ChaseSession {
  // chases: chases.json 의 목록, cfg: CHASE, getSpeed: () => 플레이어 실제 속도
  // stamina: 마지막 추격 시작 때 가득 채움 (STORY 14-4 [가정]). pose: { get() → 저장값, set(v) } 시작 위치 (선택)
  constructor({ runner, chases, cfg, getSpeed, stamina = null, pose = null }) {
    this.runner = runner;
    this.defs = new Map(chases.map((c) => [c.id, c]));
    this.cfg = cfg;
    this.getSpeed = getSpeed;
    this.stamina = stamina;
    this.pose = pose;
    this.chase = null;
    this.current = null; // { id, atExit, pose } 진행 중인 추격 (체크포인트 'chase' 항목)
    this.snap = null; // 추격 시작 체크포인트
    this.attempts = new Map(); // 추격 키 → 잡힌 횟수 (체크포인트와 무관)
    this.last = null; // 마지막 결과
    this.onResult = null; // (result) => void   outcome: caught | exit | trigger
    runner.checkpoints.register('chase', {
      save: () => this.current,
      load: (v) => (v ? this.begin(v) : this.clear()),
    });
  }

  get active() {
    return !!this.chase;
  }

  // 출구를 여는 동안 조작 불가
  get locked() {
    return !!this.chase?.locked;
  }

  static key(id, atExit) {
    return `${id}:${atExit ?? '-'}`;
  }

  attemptOf(id, atExit) {
    return this.attempts.get(ChaseSession.key(id, atExit)) ?? 0;
  }

  start(id, { atExit = null } = {}) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`없는 추격 ${id}`);
    this.attempts.set(ChaseSession.key(id, atExit), 0);
    if (def.final) this.stamina?.reset();
    this.current = { id, atExit, pose: this.pose?.get() ?? null };
    this.snap = this.runner.snapshot();
    this.begin(this.current);
    return this.chase;
  }

  // 체크포인트에서 불러올 때도 여기로 온다
  begin(cur) {
    const def = this.defs.get(cur.id);
    this.current = cur;
    if (cur.pose) this.pose?.set(cur.pose);
    this.chase = new Chase(def, this.cfg, { attempt: this.attemptOf(cur.id, cur.atExit), trigger: cur.atExit === 'playerCaught' });
  }

  clear() {
    this.chase = null;
    this.current = null;
  }

  stop() {
    this.clear();
    this.snap = null;
  }

  update(dt) {
    const c = this.chase;
    if (!c) return null;
    c.update(dt, this.getSpeed());
    if (!c.done) return null;
    const res = c.result(this.current.atExit);
    this.last = res;
    if (res.outcome === 'caught') {
      const k = ChaseSession.key(this.current.id, this.current.atExit);
      this.attempts.set(k, (this.attempts.get(k) ?? 0) + 1);
      this.onResult?.(res);
      this.runner.restore(this.snap); // 'chase' 항목이 늘어난 시도 횟수로 다시 시작한다
    } else {
      this.onResult?.(res);
      this.stop();
    }
    return res;
  }

  // 디버그 HUD 한 줄
  hudLine() {
    const c = this.chase;
    if (!c) {
      const r = this.last;
      return r ? `추격: 없음 (직전 ${r.id} ${r.outcome}${r.finale ? ` → ${r.finale}` : ''}, 도착 gap ${r.arrivalGap?.toFixed(1) ?? '-'})` : '추격: 없음';
    }
    const exit = this.current.atExit ? `/${this.current.atExit}` : '';
    const phase = { kill: ' 일행 처리 중', unlock: ' 출구 여는 중', run: '' }[c.phase] ?? ` ${c.phase}`;
    return `추격 ${c.def.id}${exit} 시도 ${c.attempt + 1}${phase}  gap ${c.gap.toFixed(1)} m  귀신 ${c.ghostNow.toFixed(1)}/${c.ghostSpeed} m/s  남은 ${c.remaining.toFixed(1)} m  출구 기준 ${c.minExitGap.toFixed(1)} m`;
  }
}
