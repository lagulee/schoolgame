// 마지막 장면의 행동 줄 (단계 16, three·DOM 없음): { do: 'look', id } 시선 돌리기(E14), { do: 'collapse', id } 쓰러짐(E15, 엔딩 C).
// 모든 판단은 update() 에서 지금 상태(runner.action)를 보고 하므로 체크포인트 복원·디버그 건너뛰기에도 따로 맞출 것이 없다 (faint.js 와 같은 방식).
// 화면(검은 막·붉은 막·눈높이·고개)은 finaleView.js 가 이 상태를 읽어 그린다. 막은 한 방향으로만 변한다(깜빡임 0회).
const PI2 = Math.PI * 2;

const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x); // smoothstep
};

// (px, pz) 에서 (x, z) 를 바라보는 yaw (rad, 0 = 북(−z), −π/2 = 동)
export const yawTo = (px, pz, x, z) => Math.atan2(-(x - px), -(z - pz));

// 가장 짧은 회전 방향으로 a → b 의 차이
const turnDelta = (a, b) => ((((b - a) % PI2) + PI2 + Math.PI) % PI2) - Math.PI;

// 조작이 멈춘 채 시선을 돌린다. 끝나면 다음 줄로
export class Look {
  // pose: { get(), set(v) } (E2Scene.pose)
  constructor({ runner, story, pose }) {
    Object.assign(this, { runner, pose });
    this.defs = story.looks ?? {};
    this.line = null;
    this.t = 0;
  }

  get active() {
    return this.runner.action?.do === 'look';
  }

  update(dt) {
    const a = this.runner.action;
    if (a?.do !== 'look') {
      this.line = null;
      return;
    }
    const def = this.defs[a.id] ?? { yaw: 0, time: 0.4 };
    if (this.line !== a) {
      this.line = a;
      this.t = 0;
      this.base = this.pose.get();
      const to = def.at ? yawTo(this.base.pos[0], this.base.pos[2], def.at[0], def.at[1]) : ((def.yaw ?? 0) * Math.PI) / 180;
      this.from = this.base.yaw;
      this.delta = turnDelta(this.from, to);
    } else this.t += dt;
    const k = ease(this.t / def.time);
    this.pose.set({ ...this.base, yaw: this.from + this.delta * k, pitch: this.base.pitch * (1 - k) });
    if (this.t >= def.time) {
      this.line = null;
      this.runner.resume('look');
    }
  }
}

// 엔딩 C: 문 쪽으로 돌아서(turn) → 주저앉으며 시야 가장자리부터 붉은 막이 번지고(sag) → 어두워져 암전(dark) → 암전을 유지(hold) → 다음 줄(사건이 끝나며 엔딩 카드).
// 엔딩 카드를 닫으면(recover) 막과 눈높이가 천천히 돌아온다.
export class Collapse {
  // cfg = SCENE.collapse
  constructor({ runner, story, pose, cfg }) {
    Object.assign(this, { runner, pose, cfg });
    this.defs = story.collapses ?? {};
    this.phase = 'idle'; // idle | turn | sag | dark | hold | end | recover
    this.t = 0;
    this.line = null;
    this.rec = 0; // recover 시작 때의 값 (blood, veil, rise)
  }

  get active() {
    return this.phase !== 'idle';
  }

  // 붉은 막 0~blood: sag 동안 번지고 그 뒤 유지, recover 에서 줄어든다
  get blood() {
    const C = this.cfg;
    if (this.phase === 'sag') return C.blood * ease(this.t / C.sag);
    if (this.phase === 'dark' || this.phase === 'hold' || this.phase === 'end') return C.blood;
    if (this.phase === 'recover') return C.blood * (1 - ease(this.t / C.recover));
    return 0;
  }

  // 검은 막 0~1: dark 동안 짙어지고 유지, recover 에서 걷힌다
  get veil() {
    const C = this.cfg;
    if (this.phase === 'dark') return ease(this.t / C.dark);
    if (this.phase === 'hold' || this.phase === 'end') return 1;
    if (this.phase === 'recover') return 1 - ease(this.t / C.recover);
    return 0;
  }

  // 주저앉은 정도 0(섬) ~ 1(쓰러짐)
  get sink() {
    const C = this.cfg;
    if (this.phase === 'sag') return ease(this.t / C.sag);
    if (this.phase === 'dark' || this.phase === 'hold' || this.phase === 'end') return 1;
    if (this.phase === 'recover') return 1 - ease(this.t / C.recover);
    return 0;
  }

  get eyeDrop() {
    return this.cfg.eyeDrop * this.sink;
  }

  // 고개 숙임 (주저앉는 동안만 카메라가 따른다). 아니면 null
  get pitch() {
    return this.sink > 0 ? -this.cfg.pitch * this.sink : null;
  }

  get breath() {
    return this.active && this.phase !== 'recover' ? this.cfg.breath * Math.max(0.3, this.sink) : 0;
  }

  // 조작을 막아야 하는 동안 (엔딩 카드를 닫은 뒤 recover 에서 풀린다)
  get frozen() {
    return this.active && this.phase !== 'recover';
  }

  begin(line) {
    this.line = line;
    this.phase = 'turn';
    this.t = 0;
    this.base = this.pose.get();
    const d = this.defs[line.id];
    const to = d?.at ? yawTo(this.base.pos[0], this.base.pos[2], d.at[0], d.at[1]) : this.base.yaw;
    this.from = this.base.yaw;
    this.delta = turnDelta(this.from, to);
  }

  stop() {
    this.phase = 'idle';
    this.t = 0;
    this.line = null;
  }

  update(dt) {
    const a = this.runner.action;
    const C = this.cfg;
    if (a?.do === 'collapse') {
      if (this.line !== a) this.begin(a);
      else this.t += dt;
      if (this.phase === 'turn') {
        const k = ease(this.t / C.turn);
        this.pose.set({ ...this.base, yaw: this.from + this.delta * k, pitch: this.base.pitch * (1 - k) });
        if (this.t >= C.turn) this.next('sag');
      } else if (this.phase === 'sag' && this.t >= C.sag) this.next('dark');
      else if (this.phase === 'dark' && this.t >= C.dark) this.next('hold');
      else if (this.phase === 'hold' && this.t >= C.hold) {
        this.phase = 'end';
        this.t = 0;
        this.line = null;
        this.runner.resume('collapse'); // 사건이 끝나며 엔딩 카드가 뜬다
      }
      return;
    }
    if (this.phase === 'end') {
      // 엔딩 카드가 떠 있는 동안은 암전 그대로, 카드를 닫으면 천천히 돌아온다
      if (this.runner.mode !== 'ending') {
        this.phase = 'recover';
        this.t = 0;
      }
      return;
    }
    if (this.phase === 'recover') {
      this.t += dt;
      if (this.t >= C.recover) this.stop();
      return;
    }
    if (this.active) this.stop(); // 행동 줄을 떠났다 (디버그 건너뛰기·스토리 초기화)
  }

  next(phase) {
    this.phase = phase;
    this.t = 0;
  }
}
