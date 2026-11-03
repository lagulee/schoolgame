// 시점 전환 (단계 19, R1-e·R1-h, three·DOM 없음): 행동 줄 { do: 'switch', id } (story.switches).
// 어두워짐(out) → 완전히 어두움(black) → 밝아짐(in) → 다음 줄. 밝기는 한 방향으로 부드럽게만 변한다(깜빡임 0회).
// black 이 시작될 때 "몸"을 바꾼다: 떠나는 시점의 자리·스태미나를 저장하고(플레이어 스냅샷 bodies),
// 새 시점의 자리(def.pos·level·yaw, 없으면 저장해 둔 자리)로 옮기고 그 시점의 스태미나를 되살린다(처음이면 가득).
// 논리상 시점(runner.pov)과 핸드폰은 사건 시작 때 이미 바뀐다(runner.start → onPov, 핸드폰 화면은 닫힘). 그 순간은
// 사건의 freezeUntil 로 조작이 멈춰 있고 화면에 달라지는 것이 없어서 보이지 않는다.
// 체크포인트 'pov' 항목이 몸·저장한 자리를 함께 저장한다. 모든 판단은 update() 에서 지금 상태(runner.action)를 보고 한다.
import { PLAYER } from '../config.js';

const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};
const copy = (v) => JSON.parse(JSON.stringify(v));

export class PovSwitch {
  // pose: { get(), set(v) } (E2Scene.pose), stamina: { save(), load(v), reset() } (없어도 됨), cfg = SCENE.pov
  constructor({ runner, story, pose, stamina = null, cfg }) {
    Object.assign(this, { runner, pose, stamina, cfg });
    this.defs = story.switches ?? {};
    this.body = 'player'; // 지금 카메라가 맡은 몸(시점)
    this.bodies = {}; // 시점 → { pose, stamina } 그 시점을 떠날 때의 상태
    this.card = null; // 암전 동안 보일 글자 (없으면 null, 화면이 읽고 비운다)
    this.stop();
    runner.checkpoints.register('pov', {
      save: () => ({ body: this.body, bodies: this.bodies }),
      load: (v) => {
        this.body = v?.body ?? 'player';
        this.bodies = copy(v?.bodies ?? {});
        this.stop();
      },
    });
  }

  get active() {
    return this.phase !== 'idle';
  }

  // 지금 쓰는 시간 (def 가 SCENE.pov 를 덮어쓸 수 있다)
  time(name) {
    return this.def?.[name] ?? this.cfg[name];
  }

  get veil() {
    if (this.phase === 'out') return ease(this.t / this.time('out'));
    if (this.phase === 'black') return 1;
    if (this.phase === 'in') return 1 - ease(this.t / this.time('in'));
    return 0;
  }

  stop() {
    this.phase = 'idle'; // idle | out | black | in
    this.t = 0;
    this.line = null;
    this.def = null;
  }

  // 몸 바꾸기: 떠나는 몸의 자리·스태미나를 저장하고, 새 몸으로 옮긴다
  swap(def) {
    const to = def.pov ?? this.runner.pov;
    if (this.body === to) return;
    this.bodies[this.body] = { pose: this.pose.get(), stamina: this.stamina?.save() ?? null };
    const back = this.bodies[to];
    if (def.pos) this.pose.set({ pos: [def.pos[0], PLAYER.eye, def.pos[1]], level: def.level ?? 0, yaw: ((def.yaw ?? 0) * Math.PI) / 180, pitch: 0 });
    else if (back) this.pose.set(back.pose);
    if (back?.stamina) this.stamina?.load(back.stamina);
    else this.stamina?.reset();
    this.body = to;
  }

  update(dt) {
    const a = this.runner.action;
    if (a?.do !== 'switch') {
      if (this.active) this.stop(); // 행동 줄을 떠났다 (디버그 건너뛰기·스토리 초기화)
      // 디버그로 다른 시점 사건에 바로 들어갔거나 스토리를 초기화했으면 몸을 지금 시점에 맞춘다 (옮기지 않음)
      if (this.body !== this.runner.pov) this.body = this.runner.pov;
      const reg = this.runner.registry;
      if (!reg.history.length && !reg.done.size) this.bodies = {};
      return;
    }
    if (this.line !== a) {
      this.line = a;
      this.def = this.defs[a.id] ?? null;
      this.phase = 'out';
      this.t = 0;
      if (!this.def) {
        this.stop();
        this.runner.resume('switch'); // 정의가 없으면 막히지 않게 넘긴다
      }
      return;
    }
    this.t += dt;
    if (this.phase === 'out' && this.t >= this.time('out')) {
      this.phase = 'black';
      this.t = 0;
      this.swap(this.def);
      this.card = this.def.card ?? null;
    } else if (this.phase === 'black' && this.t >= this.time('black')) {
      this.phase = 'in';
      this.t = 0;
    } else if (this.phase === 'in' && this.t >= this.time('in')) {
      this.stop();
      this.runner.resume('switch');
    }
  }
}
