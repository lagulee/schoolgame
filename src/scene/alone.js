// 혼자일 때 환경 연출 (단계 20, STORY 13-3 복선 [가정]): 플레이어가 사실상 혼자인 구간(data/story.json alone.windows,
// 예: E2 가 끝난 뒤 ~ E7 시작 전 = 진짜 {gyuha}가 떠나고 가짜만 곁에 있는 동안)에서, 사건·추격·퍼즐이 없고 건물 안일 때만
// 쿨다운을 두고 속삭임(whisper)·조명 떨림(dim)을 번갈아 한 번씩 낸다. 구간마다 max 번까지 (같은 연출을 계속 반복하지 않는다).
// three·DOM 없음. 화면·소리는 scene/setup.js 가 fired 를 읽어 낸다 (속삭임 = audio/whisper.js, 떨림 = atmosphere.tremble).
// 떨림은 한 번 어두워졌다(down) 머물고(hold) 돌아올(up) 뿐이라 깜빡임이 아니다 (한 번 ≈ 2.2초, 초당 3회 미만).
export class AloneAmbience {
  // def = story.json alone { windows: [{ after, until }], max }, cfg = FINISH.alone, inside() = 지금 건물 안인가
  constructor({ runner, def, cfg, inside = () => true, rand = Math.random }) {
    Object.assign(this, { runner, cfg, inside, rand });
    this.windows = def?.windows ?? [];
    this.max = def?.max ?? Infinity;
    this.enabled = true;
    this.reset();
  }

  reset() {
    this.key = null; // 지금 구간 (after 사건 id)
    this.wait = 0; // 다음 연출까지 남은 시간 (조건이 맞을 때만 줄어든다)
    this.count = 0; // 이번 구간에서 낸 수
    this.next = 'whisper';
    this.fired = null; // 이번 프레임에 낸 연출 { kind, side } (한 프레임만)
    this.log = []; // 낸 연출 기록 { kind, key, at }
    this.dimT = -1; // 떨림 진행 시간 (−1 = 없음)
    this.dim = 1;
    this.clock = 0;
  }

  started(id) {
    const reg = this.runner.registry;
    return reg.active === id || reg.done.has(id) || reg.history.includes(id);
  }

  // 지금 혼자인 구간 (없으면 null)
  get window() {
    const done = this.runner.registry.done;
    return this.windows.find((w) => done.has(w.after) && !this.started(w.until)) ?? null;
  }

  range([a, b]) {
    return a + (b - a) * this.rand();
  }

  update(dt) {
    this.clock += dt;
    this.fired = null;
    this.updateDim(dt);
    const w = this.enabled ? this.window : null;
    if (!w) {
      if (this.runner.registry.done.size === 0) this.key = null; // 스토리 초기화
      return null;
    }
    if (w.after !== this.key) {
      this.key = w.after;
      this.count = 0;
      this.wait = this.range(this.cfg.first);
    }
    if (this.count >= this.max || this.runner.busy || !this.inside()) return null;
    this.wait -= dt;
    if (this.wait > 0) return null;
    const kind = this.next;
    this.next = kind === 'whisper' ? 'dim' : 'whisper';
    this.count++;
    this.wait = this.range(this.cfg.gap);
    this.fired = { kind, side: this.rand() < 0.5 ? -1 : 1 };
    this.log.push({ kind, key: this.key, at: this.clock });
    if (kind === 'dim') this.dimT = 0;
    return this.fired;
  }

  // 떨림: 1 → to (down 초, 부드럽게) → hold → 1 (up 초). 끝나면 1
  updateDim(dt) {
    if (this.dimT < 0) return;
    const D = this.cfg.dim;
    this.dimT += dt;
    const t = this.dimT;
    const ease = (x) => x * x * (3 - 2 * x);
    let k;
    if (t < D.down) k = ease(t / D.down);
    else if (t < D.down + D.hold) k = 1;
    else if (t < D.down + D.hold + D.up) k = 1 - ease((t - D.down - D.hold) / D.up);
    else {
      this.dimT = -1;
      this.dim = 1;
      return;
    }
    this.dim = 1 + (D.to - 1) * k;
  }
}
