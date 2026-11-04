// P3 흩어진 일행 찾기 (단계 14, three·DOM 없음): 퍼즐 P3 이 진행 중일 때 교실 수색을 맡는다.
// 시작·끝(다음 줄로)은 E2Scene 이 사건의 { do: 'puzzle' } 줄로 맡고(모든 퍼즐 공통), 여기서는 단서·정답·틀린 교실만 판단한다.
// - 단서 순서: 소지품(살펴보기 E) → 젖은 발자국(소지품 뒤에 보이고, 가까이 가면 단서) → 노크(발자국 뒤 들리고, 가까이 가면 단서)
// - 정답 방에 들어서면 submit(정답). 틀린 방에 들어서면 pull 상태(연기·실루엣)로 SCENE.p3.pullAfter 초를 보낸 뒤
//   복도로 끌려 나오고 submit(방 id) = 틀림 1회. 한도에 닿으면 PuzzleSession 이 퍼즐 시작 체크포인트로 되돌린다.
// - 체크포인트 'p3' 항목이 퍼즐 시작 자리(pose)를 저장하고, 복원 때 수색 상태를 처음으로 되돌린다.
import { PLAYER } from '../config.js';

export class P3Search {
  // puzzle: PuzzleSession, pose: { get(), set(v) }, where(): { x, z, level }, locate(x, z, level) → { id } | null,
  // interactions: { add, remove }, text(s) = 자리표시자 채우기, cfg = SCENE.p3
  constructor({ runner, puzzle, pose, where, locate, interactions, toast = () => {}, text = (s) => s, cfg }) {
    Object.assign(this, { runner, puzzle, pose, where, locate, interactions, toast, text, cfg });
    this.def = puzzle.defs.get('P3');
    this.S = this.def?.search ?? null;
    this.prints = this.S ? footprintPoints(this.S.footprints) : [];
    this.reset();
    this.placed = false;
    this.shown = 0; // 지금까지 보여 준 틀린 교실 연출 수 (shows 를 차례로)
    runner.checkpoints.register('p3', {
      save: () => (this.active ? { pose: this.pose.get() } : null),
      load: (v) => {
        this.reset();
        if (v && this.active) this.pose.set(v.pose);
      },
    });
    puzzle.hooks.register('onWrong', ({ puzzle: id, wrong, limit }) => {
      if (id !== 'P3' || wrong >= limit) return false;
      this.toast(this.text(this.S.texts.pulled));
      return true;
    });
    puzzle.hooks.register('onFail', ({ puzzle: id }) => {
      if (id !== 'P3') return false;
      this.toast(this.text(this.S.texts.failed));
      return true;
    });
  }

  reset() {
    this.room = null; // 지금 들어가 있는 방 id
    this.pull = null; // 틀린 방 연출 { room, t, show }
    this.knockT = 0;
  }

  // P3 이 진행 중이고 사건이 그 퍼즐 줄을 기다리는 중
  get active() {
    return !!this.S && this.puzzle.puzzle?.id === 'P3' && this.runner.action?.do === 'puzzle';
  }

  has(clue) {
    return this.puzzle.puzzle?.got.includes(clue) ?? false;
  }

  // 화면용: 발자국이 보이는가, 노크가 들리는가
  get printsVisible() {
    return this.active && this.has('belongings');
  }

  get knocking() {
    return this.active && this.has('footprints');
  }

  syncInteraction() {
    const want = this.active && !this.has('belongings');
    if (want === this.placed) return;
    this.placed = want;
    const id = 'p3:belongings';
    if (!want) return this.interactions.remove(id);
    const b = this.S.belongings;
    this.interactions.add({
      id, pos: b.pos, level: b.level, label: b.label,
      onUse: () => {
        if (this.puzzle.gather('belongings') === 'new') this.toast(this.text(b.text));
      },
    });
  }

  // 매 프레임. 노크를 낼 차례면 true (화면이 소리를 낸다)
  update(dt) {
    this.syncInteraction();
    if (!this.active) {
      if (this.room || this.pull) this.reset();
      return false;
    }
    const S = this.S;
    const p = this.where();
    // 틀린 방 연출 중: 시간이 지나면 끌려 나오고 틀림 1회
    if (this.pull) {
      this.pull.t += dt;
      if (this.pull.t >= this.cfg.pullAfter) {
        const room = this.pull.room;
        const [x, z, yaw] = S.pullTo[room];
        this.pull = null;
        this.room = null;
        this.pose.set({ pos: [x, PLAYER.eye, z], level: p.level, yaw: (yaw * Math.PI) / 180, pitch: 0 });
        this.puzzle.submit(room); // 한도면 여기서 체크포인트로 되돌아간다
      }
      return false;
    }
    // 단서: 발자국·노크 (가까이 가면)
    if (this.has('belongings') && !this.has('footprints') && this.prints.some((q) => q[2] === p.level && Math.hypot(q[0] - p.x, q[1] - p.z) <= S.footprints.radius)) {
      if (this.puzzle.gather('footprints') === 'new') this.toast(this.text(S.footprints.text));
    }
    const K = S.knock;
    if (this.has('footprints') && !this.has('knock') && p.level === K.level && Math.hypot(K.pos[0] - p.x, K.pos[1] - p.z) <= K.radius) {
      if (this.puzzle.gather('knock') === 'new') this.toast(this.text(K.text));
    }
    // 방에 들어섬
    const id = this.locate(p.x, p.z, p.level)?.id ?? null;
    const entered = id !== this.room ? id : null;
    this.room = id;
    if (entered === this.def.answer) {
      this.puzzle.submit(entered);
      return false;
    }
    if (entered && S.wrong.includes(entered)) {
      this.pull = { room: entered, t: 0, show: S.shows[this.shown % S.shows.length] };
      this.shown++;
      return false;
    }
    // 노크: 발자국을 찾은 뒤 일정 간격
    if (!this.knocking) {
      this.knockT = 0;
      return false;
    }
    this.knockT -= dt;
    if (this.knockT > 0) return false;
    this.knockT = this.cfg.knockEvery;
    return true;
  }
}

// 발자국 자리: 경로 점들 사이를 step 간격으로 [x, z, 층, 방향(라디안), 왼발/오른발]
export function footprintPoints(F) {
  const out = [];
  if (!F) return out;
  for (const path of F.paths) {
    let side = 0;
    for (let i = 0; i + 1 < path.points.length; i++) {
      const [ax, az] = path.points[i];
      const [bx, bz] = path.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.floor(len / F.step));
      const dir = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const off = (side++ % 2 ? 1 : -1) * 0.12; // 좌우 발
        out.push([ax + (bx - ax) * t + Math.cos(dir) * off, az + (bz - az) * t - Math.sin(dir) * off, path.level, dir, side % 2]);
      }
    }
  }
  return out;
}
