// 탈출 (단계 19, R1-h 엔딩 A, three·DOM 없음): 행동 줄 { do: 'escape', id } (story.escapes).
// 문 쪽으로 돌아서고(turn) → 문을 지나 밖(to)으로 걸어 나가며 어두워지고(walk) → 마저 어두워져(dark) → 암전 유지(hold) → 다음 줄(사건이 끝나며 엔딩 카드).
// 엔딩 카드를 닫으면(recover) 학교 밖에서 천천히 밝아진다. 검은 막은 한 방향으로만 변한다(깜빡임 0회). 붉은 막·주저앉음 없음.
// 걸어 나가는 동안은 조작이 멈춘 채 자리를 옮긴다(현관 자동문은 가까이 오면 스스로 열린다). 화면(검은 막)은 finaleView.js 가 그린다.
import { yawTo } from './finale.js';

const PI2 = Math.PI * 2;
const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};
const turnDelta = (a, b) => ((((b - a) % PI2) + PI2 + Math.PI) % PI2) - Math.PI;

export class Escape {
  // pose: { get(), set(v) } (E2Scene.pose), cfg = SCENE.escape
  constructor({ runner, story, pose, cfg }) {
    Object.assign(this, { runner, pose, cfg });
    this.defs = story.escapes ?? {};
    this.stop();
  }

  get active() {
    return this.phase !== 'idle';
  }

  // 조작을 막아야 하는 동안 (엔딩 카드를 닫은 뒤 recover 에서 풀린다)
  get frozen() {
    return this.active && this.phase !== 'recover';
  }

  // 검은 막 0~1: 걷기 시작부터 walk + dark 동안 짙어지고 유지, recover 에서 걷힌다
  get veil() {
    const C = this.cfg;
    const span = C.walk + C.dark;
    if (this.phase === 'walk') return ease(this.t / span);
    if (this.phase === 'dark') return ease((C.walk + this.t) / span);
    if (this.phase === 'hold' || this.phase === 'end') return 1;
    if (this.phase === 'recover') return 1 - ease(this.t / C.recover);
    return 0;
  }

  stop() {
    this.phase = 'idle'; // idle | turn | walk | dark | hold | end | recover
    this.t = 0;
    this.line = null;
  }

  begin(line) {
    this.line = line;
    this.phase = 'turn';
    this.t = 0;
    this.def = this.defs[line.id] ?? null;
    this.base = this.pose.get();
    const d = this.def;
    const [x, , z] = this.base.pos;
    const to = d?.at ? yawTo(x, z, d.at[0], d.at[1]) : this.base.yaw;
    this.from = this.base.yaw;
    this.delta = turnDelta(this.from, to);
  }

  next(phase) {
    this.phase = phase;
    this.t = 0;
  }

  update(dt) {
    const a = this.runner.action;
    const C = this.cfg;
    if (a?.do === 'escape') {
      if (this.line !== a) this.begin(a);
      else this.t += dt;
      const d = this.def;
      if (this.phase === 'turn') {
        const k = ease(this.t / C.turn);
        this.pose.set({ ...this.base, yaw: this.from + this.delta * k, pitch: this.base.pitch * (1 - k) });
        if (this.t >= C.turn) {
          this.base = this.pose.get();
          this.next('walk');
        }
      } else if (this.phase === 'walk') {
        const k = ease(this.t / C.walk);
        const [x, y, z] = this.base.pos;
        const [tx, tz] = d?.to ?? [x, z];
        this.pose.set({ ...this.base, pos: [x + (tx - x) * k, y, z + (tz - z) * k], level: d?.level ?? this.base.level });
        if (this.t >= C.walk) this.next('dark');
      } else if (this.phase === 'dark' && this.t >= C.dark) this.next('hold');
      else if (this.phase === 'hold' && this.t >= C.hold) {
        this.next('end');
        this.line = null;
        this.runner.resume('escape'); // 사건이 끝나며 엔딩 카드가 뜬다
      }
      return;
    }
    if (this.phase === 'end') {
      if (this.runner.mode !== 'ending') this.next('recover'); // 카드를 닫으면 밖에서 천천히 밝아진다
      return;
    }
    if (this.phase === 'recover') {
      this.t += dt;
      if (this.t >= C.recover) this.stop();
      return;
    }
    if (this.active) this.stop(); // 행동 줄을 떠났다 (디버그 건너뛰기·스토리 초기화)
  }
}
