// 기절·각성 (단계 15, E10 끝, three·DOM 없음): 사건의 행동 줄 { do: 'faint', id } (story.faints).
// 어두워짐(out) → 완전히 어두움(black, 이 시작에 깨어날 자리로 옮김) → 밝아짐(in, 처음엔 누워서 천장을 올려다보다가 일어남) → 다음 줄.
// 밝기는 한 방향으로 부드럽게만 변한다(깜빡임 0회). 화면(검은 막·눈높이·고개)은 faintView.js 가 이 상태를 읽어 그린다.
// 모든 판단은 update() 에서 지금 상태(runner.action)를 보고 하므로 체크포인트 복원·디버그 건너뛰기에도 따로 맞출 것이 없다.
import { PLAYER } from '../config.js';

const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x); // smoothstep: 시작과 끝이 부드럽다
};

export class Faint {
  // pose: { set(v) } (E2Scene.pose), cfg = SCENE.faint
  constructor({ runner, story, pose, cfg }) {
    Object.assign(this, { runner, pose, cfg });
    this.defs = story.faints ?? {};
    this.phase = 'idle'; // idle | out | black | in
    this.t = 0;
    this.line = null; // 진행 중인 행동 줄 (같은 줄을 두 번 시작하지 않으려고)
    this.bang = false; // 쓰러지는 소리를 낼 차례 (화면이 읽고 끈다)
  }

  get active() {
    return this.phase !== 'idle';
  }

  get veil() {
    if (this.phase === 'out') return ease(this.t / this.cfg.out);
    if (this.phase === 'black') return 1;
    if (this.phase === 'in') return 1 - ease(this.t / this.cfg.in);
    return 0;
  }

  // 일어나는 정도 0(누움) ~ 1(섬)
  get rise() {
    if (this.phase === 'in') return ease((this.t - this.cfg.riseFrom) / this.cfg.rise);
    return this.phase === 'idle' ? 1 : 0;
  }

  get eyeDrop() {
    return this.cfg.eyeDrop * (1 - this.rise) * (this.phase === 'out' ? 0 : 1);
  }

  // 누워서 올려다보는 각도 (밝아지는 동안만 카메라가 따른다). 아니면 null
  get pitch() {
    return this.phase === 'in' ? this.cfg.pitch * (1 - this.rise) : null;
  }

  get breath() {
    return this.active ? this.cfg.breath * (this.phase === 'in' ? 1 - this.rise : 1) : 0;
  }

  begin(line) {
    this.line = line;
    this.phase = 'out';
    this.t = 0;
  }

  stop() {
    this.phase = 'idle';
    this.t = 0;
    this.line = null;
  }

  update(dt) {
    const a = this.runner.action;
    if (a?.do !== 'faint') {
      if (this.active) this.stop(); // 행동 줄을 떠났다 (디버그 건너뛰기·스토리 초기화)
      return;
    }
    if (this.line !== a) this.begin(a);
    else this.t += dt;
    const C = this.cfg;
    if (this.phase === 'out' && this.t >= C.out) {
      this.phase = 'black';
      this.t = 0;
      this.bang = true;
      const w = this.defs[a.id];
      if (w) this.pose.set({ pos: [w.pos[0], PLAYER.eye, w.pos[1]], level: w.level, yaw: (w.yaw * Math.PI) / 180, pitch: 0 });
    } else if (this.phase === 'black' && this.t >= C.black) {
      this.phase = 'in';
      this.t = 0;
    } else if (this.phase === 'in' && this.t >= C.in) {
      this.stop();
      this.runner.resume('faint');
    }
  }
}
