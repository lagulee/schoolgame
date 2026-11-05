// 검은 연기로 사라짐 (단계 18, R1-d, three·DOM 없음): 행동 줄 { do: 'vanish', id } (story.vanishes).
// 그 자리에서 검은 연기가 피어올라 흩어진다. 실루엣은 없고 점프스케어로 세지 않는다 (STORY 2장 "검은 연기" 모티프).
// 짙기(density)는 0 → 1 → 0 으로 한 번만 오르내린다(깜빡임 0회). 시간이 다 되면 다음 줄로.
// 모든 판단은 update() 에서 지금 상태(runner.action)를 보고 하므로 체크포인트 복원·디버그 건너뛰기에도 따로 맞출 것이 없다.
const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};

export class Vanish {
  // cfg = SCENE.vanish
  constructor({ runner, story, cfg }) {
    Object.assign(this, { runner, cfg });
    this.defs = story.vanishes ?? {};
    this.line = null;
    this.def = null;
    this.t = 0;
    this.started = false; // 소리를 낼 차례 (화면이 읽고 끈다)
  }

  get active() {
    return this.runner.action?.do === 'vanish' && !!this.def;
  }

  // 진행 0~1
  get k() {
    return this.def ? Math.min(1, this.t / this.cfg.time) : 0;
  }

  // 연기 짙기 0~1: peak 까지 짙어지고 그 뒤 옅어진다
  get density() {
    if (!this.def) return 0;
    const { peak } = this.cfg;
    const k = this.k;
    return k < peak ? ease(k / peak) : 1 - ease((k - peak) / (1 - peak));
  }

  update(dt) {
    const a = this.runner.action;
    if (a?.do !== 'vanish') {
      this.line = null;
      this.def = null;
      return;
    }
    if (this.line !== a) {
      this.line = a;
      this.def = this.defs[a.id] ?? null;
      this.t = 0;
      this.started = !!this.def;
      if (!this.def) this.runner.resume('vanish'); // 자리가 없으면 막히지 않게 넘긴다
      return;
    }
    this.t += dt;
    if (this.t >= this.cfg.time) {
      this.line = null;
      this.def = null;
      this.runner.resume('vanish');
    }
  }
}
