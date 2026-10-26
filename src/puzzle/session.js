// 퍼즐 진행: Puzzle 하나를 돌리고, 틀린 시도가 한도에 닿으면 퍼즐 시작 체크포인트로 되돌려 다시 시작한다.
// DOM·three 없음 (Node 테스트에서 StoryRunner 와 함께 그대로 쓴다). 추격 세션(src/chase/session.js)과 같은 방식:
// - start(id) : 새 퍼즐을 만들고 runner.snapshot() 을 퍼즐 시작 체크포인트로 저장 ('puzzle' 항목이 단서·틀린 횟수를 담는다)
// - 실패 → 시도 +1 → runner.restore(체크포인트) → 'puzzle' 항목이 같은 퍼즐을 단서·틀린 횟수 0 으로 다시 만든다
// - 시도 횟수는 체크포인트에 넣지 않는다 (되돌려도 남아야 하므로)
// 호출 순서: 훅(귀신 연출) → 콜백(사건 진행). 사건 진행에 알릴 자리는 onStart·onClue·onComplete·onWrong·onSuccess·onFail.
import { Puzzle } from './puzzle.js';

export class PuzzleSession {
  // puzzles: 퍼즐 정의 목록 (P1~P4 + 디버그), cfg: PUZZLE, hooks: GhostHooks
  constructor({ runner, puzzles, cfg = {}, hooks }) {
    this.runner = runner;
    this.defs = new Map(puzzles.map((p) => [p.id, p]));
    this.cfg = cfg;
    this.hooks = hooks;
    this.puzzle = null;
    this.snap = null; // 퍼즐 시작 체크포인트
    this.attempts = new Map(); // 퍼즐 id → 실패한 횟수 (체크포인트와 무관)
    this.last = null; // 마지막 결과 { id, outcome: solved | failed }
    this.onStart = null; // (info) => void   info: { id, attempt }
    this.onClue = null; // ({ id, clue, n, total, dup })
    this.onComplete = null; // ({ id }) 단서를 모두 모음
    this.onWrong = null; // ({ id, wrong, limit })
    this.onSuccess = null; // ({ id, attempt })
    this.onFail = null; // ({ id, attempt }) 다시 시작되기 전에 불린다
    runner.checkpoints.register('puzzle', {
      save: () => this.puzzle?.save() ?? null,
      load: (v) => (v ? this.begin(v) : this.clear()),
    });
  }

  get active() {
    return !!this.puzzle;
  }

  attemptOf(id) {
    return this.attempts.get(id) ?? 0;
  }

  start(id) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`없는 퍼즐 ${id}`);
    this.attempts.set(id, 0);
    this.begin({ id });
    this.snap = this.runner.snapshot();
    this.emit(def, 'onStart', { id, attempt: 0 });
    return this.puzzle;
  }

  // 체크포인트에서 불러올 때도 여기로 온다 (저장값이 단서·틀린 횟수를 담는다)
  begin(saved) {
    const p = new Puzzle(this.defs.get(saved.id), this.cfg);
    p.load(saved);
    this.puzzle = p;
  }

  clear() {
    this.puzzle = null;
  }

  stop() {
    this.clear();
    this.snap = null;
  }

  // 훅(연출) 다음 콜백(사건 진행)
  emit(def, name, info) {
    this.hooks.call(def, name, info);
    this[name]?.(info);
  }

  gather(clueId) {
    const p = this.puzzle;
    if (!p) return null;
    const res = p.gather(clueId);
    if (res === 'new' || res === 'dup') {
      this.emit(p.def, 'onClue', { id: p.id, clue: clueId, n: p.got.length, total: p.total, dup: res === 'dup' });
      if (res === 'new' && p.complete && p.total > 0) this.emit(p.def, 'onComplete', { id: p.id });
    }
    return res;
  }

  // 번호 입력. 틀려서 한도에 닿으면 체크포인트로 되돌리고 같은 퍼즐을 새로 시작한다
  submit(value) {
    const p = this.puzzle;
    if (!p) return null;
    const res = p.check(value);
    if (res.ok) {
      this.last = { id: p.id, outcome: 'solved' };
      this.emit(p.def, 'onSuccess', { id: p.id, attempt: this.attemptOf(p.id) });
      this.stop();
      return res;
    }
    this.emit(p.def, 'onWrong', { id: p.id, wrong: res.wrong, limit: p.wrongLimit });
    if (res.status === 'failed') {
      const attempt = this.attemptOf(p.id) + 1;
      this.attempts.set(p.id, attempt);
      this.last = { id: p.id, outcome: 'failed' };
      this.emit(p.def, 'onFail', { id: p.id, attempt });
      this.runner.restore(this.snap); // 'puzzle' 항목이 단서·틀린 횟수 0 의 새 퍼즐을 만든다
    }
    return res;
  }

  // 디버그 HUD 한 줄
  hudLine() {
    const p = this.puzzle;
    const hook = this.hooks.history.at(-1);
    if (!p) return `퍼즐: 없음${this.last ? ` (직전 ${this.last.id} ${this.last.outcome})` : ''}`;
    return `퍼즐 ${p.id} 시도 ${this.attemptOf(p.id) + 1}  단서 ${p.got.length}/${p.total}  틀림 ${p.wrong}/${p.wrongLimit}${hook ? `  ${hook}` : ''}`;
  }
}
