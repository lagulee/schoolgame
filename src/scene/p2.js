// P2 당직실 단서 (단계 15, three·DOM 없음): 퍼즐 P2 가 진행 중일 때 단서 3개(일지·달력·칠판 살펴보기)와 귀신 등장 간격을 맡는다.
// 시작·끝(다음 줄로)은 E2Scene 이 사건의 { do: 'puzzle' } 줄로 맡는다(모든 퍼즐 공통). 여기서는:
// - 단서를 얻을 때마다 귀신 등장을 줄 세운다. 등장과 등장 사이는 cfg.gap(90)초 이상 — 빨리 모으면 간격이 찰 때까지 미룬다.
// - 단서 3개 + 귀신 3번이 다 끝나면 정답(열쇠함 번호표 N)을 자동으로 넣어 퍼즐을 푼다.
// 귀신 모습: ghost = { def, phase: on | fade, t, alpha, n } 또는 null. 화면·소리는 p2View.js.
export class P2Duty {
  // puzzle: PuzzleSession, interactions: { add, remove }, text(s) = 자리표시자 채우기, cfg = SCENE.duty
  constructor({ runner, puzzle, interactions, toast = () => {}, text = (s) => s, cfg }) {
    Object.assign(this, { runner, puzzle, interactions, toast, text, cfg });
    this.def = puzzle.defs.get('P2');
    this.D = this.def?.duty ?? null;
    this.placed = new Set();
    this.reset();
  }

  reset() {
    this.clock = 0; // 퍼즐 시작 뒤 지난 시간
    this.lastShow = -Infinity; // 마지막으로 귀신이 나타난 때
    this.queue = 0; // 아직 나타나지 못한 귀신 수
    this.shown = 0; // 지금까지 나타난 귀신 수
    this.ghost = null;
    this.hinted = false;
    this.cur = null;
  }

  get active() {
    return !!this.D && this.puzzle.puzzle?.id === 'P2' && this.runner.action?.do === 'puzzle';
  }

  syncInteractions() {
    const p = this.active ? this.puzzle.puzzle : null;
    for (const id of [...this.placed]) {
      if (p && !p.has(id)) continue;
      this.interactions.remove(`p2:${id}`);
      this.placed.delete(id);
    }
    if (!p) return;
    for (const id of p.clueIds) {
      if (p.has(id) || this.placed.has(id)) continue;
      const c = this.D.clues[id];
      this.placed.add(id);
      this.interactions.add({ id: `p2:${id}`, pos: c.pos, level: this.D.level, label: c.label, onUse: () => this.use(id) });
    }
  }

  use(id) {
    const res = this.puzzle.gather(id);
    if (res !== 'new') return;
    this.toast(this.text(this.D.clues[id].text));
    this.queue++;
  }

  // 매 프레임. inView(def) = 그 귀신 자리가 지금 화면 안인가 (p2View). 나타날 때마다 { def, n } 을 돌려준다 (소리를 낼 차례)
  update(dt, inView = () => true) {
    this.syncInteractions();
    if (!this.active) {
      if (this.cur || this.clock) this.reset();
      return null;
    }
    this.cur = this.puzzle.puzzle;
    this.clock += dt;
    const C = this.cfg;
    let appeared = null;
    const g = this.ghost;
    if (g) {
      g.t += dt;
      if (g.phase === 'on') {
        g.seen ||= inView(g.def);
        if (g.t >= C.stay || (g.seen && !inView(g.def))) g.phase = 'fade';
      } else {
        g.alpha = Math.max(0, g.alpha - dt / C.fade);
        if (g.alpha === 0) this.ghost = null;
      }
    } else if (this.queue > 0 && this.clock - this.lastShow >= C.gap) {
      this.queue--;
      const def = this.D.ghosts[this.shown % this.D.ghosts.length];
      this.ghost = { def, phase: 'on', t: 0, alpha: 1, seen: false, n: this.shown };
      this.shown++;
      this.lastShow = this.clock;
      appeared = this.ghost;
    }
    // 단서를 다 모았고 귀신도 다 나타났다 사라졌다 → 정답
    const p = this.puzzle.puzzle;
    if (p.complete && !this.queue && !this.ghost && this.shown >= p.total) this.puzzle.submit(this.def.answer);
    else if (p.complete && !this.hinted) {
      this.hinted = true;
      this.toast(this.text(this.D.texts.waiting));
    }
    return appeared;
  }
}
