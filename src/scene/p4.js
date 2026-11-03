// P4 교무실 열쇠 찾기 (단계 16, three·DOM 없음): 퍼즐 P4 가 진행 중일 때 열쇠 걸이의 열쇠 5개(살펴보기 E)와 다가오는 귀신을 맡는다.
// 시작·끝(다음 줄로)은 E2Scene 이 사건의 { do: 'puzzle' } 줄로 맡는다(모든 퍼즐 공통). 여기서는:
// - 열쇠마다 살펴보기를 만든다. 라이트가 꺼져 있으면 번호표가 안 읽혀 꽂아 볼 수 없다(안내 문구만).
// - 열쇠를 꽂으면 submit(번호): 정답이면 풀림, 틀리면 소리(wrong 이벤트)와 함께 귀신이 한 걸음 다가온다(steps[틀린 횟수]).
//   틀린 횟수가 wrongLimit 에 닿으면 PuzzleSession 이 퍼즐 시작 체크포인트로 되돌린다(잡힘).
// - 체크포인트 'p4' 항목이 퍼즐 시작 자리(pose)를 저장하고, 복원 때 귀신 상태를 처음으로 되돌린다.
// 귀신 모습: ghost = { x, z, alpha } 또는 null (걸어서 steps 자리로 다가간다). 화면·소리는 p4View.js.
export class P4Keys {
  // puzzle: PuzzleSession, pose: { get(), set(v) }, interactions: { add, remove, refresh }, light(): 라이트 켜짐, text(s) = 자리표시자 채우기, cfg = SCENE.p4
  constructor({ runner, puzzle, pose, interactions, light = () => true, toast = () => {}, text = (s) => s, cfg }) {
    Object.assign(this, { runner, puzzle, pose, interactions, light, toast, text, cfg });
    this.def = puzzle.defs.get('P4');
    this.K = this.def?.keys ?? null;
    this.placed = false;
    this.lightSeen = null;
    this.events = []; // 화면이 읽고 비우는 일: { kind: 'wrong' | 'caught' }
    this.reset();
    runner.checkpoints.register('p4', {
      save: () => (this.active ? { pose: this.pose.get() } : null),
      load: (v) => {
        this.reset();
        if (v && this.active) this.pose.set(v.pose);
      },
    });
    puzzle.hooks.register('onWrong', ({ puzzle: id, wrong, limit }) => {
      if (id !== 'P4') return;
      if (wrong < limit) {
        this.toast(this.text(this.texts.wrong));
        this.events.push({ kind: 'wrong' });
      }
    });
    puzzle.hooks.register('onFail', ({ puzzle: id }) => {
      if (id !== 'P4') return;
      this.toast(this.text(this.texts.failed));
      this.events.push({ kind: 'caught' });
    });
  }

  reset() {
    this.ghost = null;
    this.walked = 0; // 이번 걸음에서 막 걸은 거리 (발소리 간격용, 화면이 읽는다)
    this.moving = false;
  }

  // 안내 문구. 당직과 함께(R2, dutyCompanion)면 textsDuty 가 덮어쓴다 (단계 17: 퍼즐은 같고 말만 다르다)
  get texts() {
    return this.runner.flags.get('dutyCompanion') ? { ...this.K.texts, ...this.K.textsDuty } : this.K.texts;
  }

  get active() {
    return !!this.K && this.puzzle.puzzle?.id === 'P4' && this.runner.action?.do === 'puzzle';
  }

  // 귀신이 서 있어야 할 자리 (틀린 횟수 = 단계). 한도에 닿으면 퍼즐이 되돌아가므로 마지막 단계 그대로
  target() {
    const steps = this.K.ghost.steps;
    const w = this.puzzle.puzzle?.wrong ?? 0;
    return steps[Math.min(w, steps.length - 1)];
  }

  // 열쇠를 꽂아 본다 (n: 번호표). 라이트가 꺼져 있으면 읽을 수 없다
  tryKey(n) {
    if (!this.active) return null;
    if (!this.light()) {
      this.toast(this.text(this.texts.dark));
      return 'dark';
    }
    return this.puzzle.submit(n);
  }

  syncInteractions() {
    const want = this.active;
    if (want !== this.placed) {
      this.placed = want;
      for (const h of this.K?.hooks ?? []) {
        const id = `p4:key:${h.n}`;
        if (!want) {
          this.interactions.remove(id);
          continue;
        }
        const self = this;
        this.interactions.add({
          id, pos: [this.K.pos, h.z], level: this.K.level, radius: this.K.radius,
          get label() {
            return self.light() ? `${h.n}번 열쇠 꽂아 보기` : '열쇠 번호표를 읽을 수 없다';
          },
          onUse: () => this.tryKey(h.n),
        });
      }
      this.lightSeen = null;
    }
    if (want) {
      const on = this.light();
      if (on !== this.lightSeen) {
        this.lightSeen = on;
        this.interactions.refresh?.(); // 라이트를 켜고 끌 때 안내 문구를 다시 쓴다
      }
    }
  }

  // 매 프레임. 반환: 이번 프레임에 귀신이 걸었으면 true (화면이 발소리를 낸다)
  update(dt) {
    this.syncInteractions();
    if (!this.active) {
      if (this.ghost) this.reset();
      return false;
    }
    const G = this.K.ghost;
    const to = this.target();
    if (!this.ghost) this.ghost = { x: G.steps[0][0], z: G.steps[0][1], alpha: 0 };
    const g = this.ghost;
    g.alpha = Math.min(1, g.alpha + dt / G.fadeIn);
    const dx = to[0] - g.x;
    const dz = to[1] - g.z;
    const d = Math.hypot(dx, dz);
    this.moving = d > 0.02;
    if (this.moving) {
      const s = Math.min(d, G.speed * dt);
      g.x += (dx / d) * s;
      g.z += (dz / d) * s;
      this.walked += s;
      if (this.walked >= G.speed * G.stepEvery) {
        this.walked = 0;
        return true;
      }
    }
    return false;
  }
}
