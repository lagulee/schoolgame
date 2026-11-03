// E2 진행 (단계 12, three·DOM 없음): 사건의 행동 줄 { do: 'chase' } → 추격 C1, { do: 'puzzle' } → P1 숨기.
// - 추격: 사건의 chase 를 시작하고, 플레이어 진행은 실제 경로(chases.json path)에 투영한 거리로 준다 (path.js).
//   목표 방(def.target)에 들어서면 바로 도착. 잡히면 ChaseSession 이 추격 시작 체크포인트로 되돌린다(재시도마다 gap +2 m).
// - 숨기: 퍼즐 P1 을 시작하면 훅 onStart 가 Hide 를 켠다. 결과 hidden → submit(정답) → 다음 줄, caught → submit(오답) → 퍼즐 시작 지점.
//   체크포인트 'hide' 항목이 퍼즐 시작 위치를 저장하고, 복원 때 숨기를 처음부터 다시 켠다.
// - E2 동안(숨기가 끝날 때까지) P1.hide.lockedRooms 의 문은 잠긴다. 화면(실루엣·발소리·비네팅)은 e2View.js 가 이 상태를 읽어 그린다.
import { ChasePath, PathProgress } from './path.js';
import { Hide } from './hide.js';
import { SCENE } from '../config.js';

export class E2Scene {
  // chase / puzzle: ChaseSession / PuzzleSession, pose: { get(), set(v) }, where(): { x, z, level },
  // doors: { roomClosed(room), setForced(rooms, on) }, locate(x, z, level) → { id } | null, light(): 라이트 켜짐, maxSpeed: 경로 진행 상한(m/s)
  constructor({ runner, chase, puzzle, pose, where, doors, locate, light, maxSpeed, toast = () => {} }) {
    Object.assign(this, { runner, chase, puzzle, pose, where, doors, locate, light, toast });
    this.maxSpeed = maxSpeed;
    this.path = null; // { def, path, progress, base }
    this.hide = null;
    this.hideDef = null;
    this.held = null; // R2 트리거 뒤 붙잡힘 장면: { path, def, at(귀신 경로 위치), player(플레이어 경로 위치) } — 귀신이 등 뒤로 다가온다 (단계 17)
    this.cache = null; // 이번 프레임 직전 추격의 { path, ghostAt, playerAt } (추격이 끝난 프레임에 Chase 가 이미 사라져 있으므로)
    this.seenChase = null; // 마지막으로 경로를 맞춘 Chase 객체 (복원으로 새로 만들어지면 다시 맞춘다)
    this.locked = false;
    this.enabled = true;
    this.own = { chase: false, puzzle: false }; // 사건이 시작한 것만 맡는다 (디버그 C·I 키로 시작한 추격·퍼즐은 건드리지 않음)

    const prevAction = runner.onAction;
    runner.onAction = (line, info) => {
      prevAction?.(line, info);
      if (this.enabled) this.action(line, info);
    };
    puzzle.hooks.register('onStart', ({ puzzle: id }) => this.beginHide(id));
    runner.checkpoints.register('hide', {
      save: () => (this.hidePuzzle() ? { pose: this.pose.get() } : null), // 퍼즐 시작 체크포인트 = 숨기 시작 위치 (숨기 퍼즐만, P3 는 p3.js)
      load: (v) => {
        if (v && this.hidePuzzle()) {
          this.pose.set(v.pose);
          this.hide?.begin();
        } else this.hide?.stop();
      },
    });
    const prevGet = chase.getSpeed;
    chase.getSpeed = () => (this.path ? this.path.progress.speed : prevGet());
  }

  // 지금 기다리는 퍼즐 줄이 숨기 퍼즐(P1)인가
  hidePuzzle() {
    const ev = this.runner.event;
    return this.runner.action?.do === 'puzzle' && !!this.puzzle.defs.get(ev?.puzzle)?.hide;
  }

  action(line, { event, restoring }) {
    if (restoring) return; // 추격·퍼즐 체크포인트 항목이 스스로 다시 시작한다
    if (line.do === 'chase' && event.chase) {
      this.own.chase = true;
      this.chase.start(event.chase, { atExit: event.finale?.atExit ?? null }); // 마지막 추격은 출구 결과(finale)를 함께 (단계 16)
    } else if (line.do === 'puzzle' && event.puzzle) {
      this.own.puzzle = true;
      this.puzzle.start(event.puzzle);
    }
  }

  beginHide(id) {
    const def = this.puzzle.defs.get(id);
    if (!def?.hide) return;
    this.hideDef = def.hide;
    this.hide ??= new Hide(def.hide);
    this.hide.def = def.hide;
    this.hide.begin();
  }

  // 지금 쓰는 경로 (추격 중일 때만)
  syncPath() {
    const c = this.own.chase ? this.chase.chase : null;
    const def = c?.def;
    if (!c || !def.path) {
      if (this.path) this.cache = { path: this.path, ghostAt: this.cache?.ghostAt ?? 0, playerAt: this.path.progress.best };
      this.path = null;
      this.seenChase = null;
      return;
    }
    if (this.seenChase === c) return;
    const path = new ChasePath(def.path);
    const progress = new PathProgress(path, this.maxSpeed);
    const p = this.where();
    progress.begin(p.x, p.z);
    this.path = { def, path, progress, base: progress.best };
    this.seenChase = c;
  }

  // 매 프레임 (추격 update 보다 먼저)
  update(dt) {
    if (!this.enabled) return;
    const p = this.where();
    let act = this.runner.action?.do ?? null;
    this.syncPath();
    if (this.path) {
      this.path.progress.update(p.x, p.z, dt);
      const ch = this.chase.chase;
      if (ch) this.cache = { path: this.path, ghostAt: this.path.base + ch.ghostPos, playerAt: this.path.progress.best };
      const t = this.path.def.target;
      if (t && this.locate(p.x, p.z, p.level)?.id === t) this.chase.reach();
    }
    // 추격이 끝났거나(도착) 퍼즐을 풀었으면 다음 줄로
    if (this.own.chase && act === 'chase' && !this.chase.active && ['exit', 'trigger'].includes(this.chase.last?.outcome)) {
      this.own.chase = false;
      // R2: 입구 5 m 앞 트리거 — 귀신이 등 뒤로 다가오는 붙잡힘 장면으로 (단계 17)
      if (this.chase.last.outcome === 'trigger' && this.cache) this.held = { path: this.cache.path.path, def: this.cache.path.def, at: this.cache.ghostAt, player: this.cache.playerAt };
      this.runner.resume('chase');
    }
    this.updateHeld(dt);
    if (this.own.puzzle && act === 'puzzle' && !this.puzzle.active && this.puzzle.last?.outcome === 'solved') {
      this.own.puzzle = false;
      this.runner.resume('puzzle');
    }
    // 행동 줄을 떠났는데 남은 것 정리 (디버그 건너뛰기·스토리 초기화). 위에서 다음 줄로 넘어갔을 수 있으니 다시 읽는다
    act = this.runner.action?.do ?? null;
    if (this.own.chase && act !== 'chase') {
      this.own.chase = false;
      this.chase.stop();
    }
    if (this.own.puzzle && act !== 'puzzle') {
      this.own.puzzle = false;
      this.puzzle.stop();
      this.hide?.stop();
    }

    if (this.hide?.active && act === 'puzzle') {
      const r = this.hide.update(dt, { roomClosed: this.doors.roomClosed(this.hideDef.room), lightOn: this.light(), ...p });
      if (r === 'hidden') this.puzzle.submit(this.puzzle.puzzle.def.answer);
      else if (r === 'caught') {
        this.toast(this.hideDef.hints.caught);
        this.puzzle.submit('caught');
      }
    }
    this.lockRooms();
  }

  // 붙잡힘 장면에서 귀신이 등 뒤에 다 왔는가 (장면이 아니면 항상 true) — Collapse 가 돌아보기 전에 기다린다
  get ghostArrived() {
    const h = this.held;
    return !h || h.at >= h.player - SCENE.caught.stopAt - 1e-6;
  }

  // 붙잡힘 장면: 귀신이 플레이어 뒤 stopAt 까지 closeSpeed 로 다가와 선다. 사건이 끝나면 사라진다
  updateHeld(dt) {
    const h = this.held;
    if (!h) return;
    if (!this.runner.busy || this.runner.event?.finale?.atExit !== 'playerCaught') {
      this.held = null;
      return;
    }
    const C = SCENE.caught;
    h.at = Math.min(h.at + C.closeSpeed * dt, h.player - C.stopAt);
  }

  // E2 의 숨기 줄까지는 열린 방 하나만 남기고 잠근다
  lockRooms() {
    const ev = this.runner.event;
    let on = false;
    let def = this.hideDef;
    if (ev?.kind === 'event' && ev.puzzle && this.runner.busy) {
      def ??= this.puzzle.defs.get(ev.puzzle)?.hide;
      const at = ev.lines.findIndex((l) => l.do === 'puzzle');
      on = !!def && at >= 0 && this.runner.lineIdx <= at;
    }
    if (on === this.locked) return;
    this.locked = on;
    if (def) this.doors.setForced(def.lockedRooms, on);
  }

  // ── 화면용 상태 (e2View.js) ──
  // 귀신 자리: { mode: chase | prep | pass, x, z, level } 또는 null
  get ghost() {
    const c = this.chase.chase;
    if (this.path && c) {
      const at = this.path.base + c.ghostPos;
      const [x, z, lv] = this.path.path.at(at);
      // hideBefore: 귀신 자리가 경로 시작 앞(아직 건물 밖)이면 실루엣은 그리지 않고 발소리만 (C2, 단계 15). stalled: 지형 지연으로 멈춰 서 있음
      return { mode: 'chase', x, z, level: lv ?? this.path.def.path.level ?? 0, gap: c.gap, locked: c.locked, unlockK: c.unlockTime > 0 ? 1 - c.unlockLeft / c.unlockTime : 0, stalled: c.stall > 0 && !!this.path.def.path.stallBang, hidden: !!this.path.def.path.hideBefore && at < 0 };
    }
    if (this.held) {
      const [x, z, lv] = this.held.path.at(this.held.at);
      return { mode: 'chase', x, z, level: lv ?? this.held.def.path.level ?? 0, gap: this.held.player - this.held.at, locked: false, unlockK: 0, stalled: false, hidden: false };
    }
    if (this.hide?.active && this.hideDef) {
      const d = this.hideDef;
      const k = this.hide.passT;
      const [ax, az] = d.passFrom;
      const [bx, bz] = d.passTo;
      return { mode: this.hide.phase, x: ax + (bx - ax) * k, z: az + (bz - az) * k, level: 0, gap: null };
    }
    return null;
  }

  // 숨기 중 아직 못 맞춘 조건의 안내 문구
  get hint() {
    if (!this.hide?.active || this.hide.phase !== 'prep') return '';
    return this.hideDef.hints[this.hide.missing] ?? '';
  }
}
