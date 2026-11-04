// 옥상 수영장 (단계 21, STORY 16장 엔딩 D, three·DOM 없음). 데이터 data/roof.json, 수치 ROOF (src/config/roof.js).
// 구관 5층 북서쪽 계단 맨 위 옥상 문(E): 옥상 열쇠(hasRoofKey, 엔딩 A·B·C 를 모두 본 판의 E1) + 구관 4층 이후(E11 / R1-c, story/roof.js)
// + 대화·추격·퍼즐 중이 아닐 때만 열린다. 열면 검은 막이 오르고(out) → 암전 속에서 옥상 계단탑 문 앞으로 옮기며 엔딩 D 를 기록하고
// (endingsSeen 'D', A·B·C 완주 판정에는 영향 없음) → 머물렀다(black) → 밝아진다(in). 그 뒤(free)는 귀신 없는 보너스 장면:
// 사건 진행(자리 진입 사건·혼자일 때 연출·이상 현상)은 멈추고(paused, scene/setup.js·main.js 가 본다), 걸어 다니며 간판 크레딧을 읽는다.
// 간판 3개를 모두 "읽으면"(반경 안에서 간판 쪽을 read.time 초) cardDelay 초 뒤 엔딩 D 카드(처음부터 다시 / E 둘러보기).
// 옥상 쪽 계단탑 문(E)은 내려가지 않고 엔딩 D 카드를 다시 띄운다. 검은 막은 한 번 오르고 내릴 뿐이다 (깜빡임 1회).
import { canEnterRoof } from '../story/roof.js';

const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};
const DEG = Math.PI / 180;

// 사각형까지의 거리 (안이면 0)
export function rectDistance([x0, z0, x1, z1], x, z) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

export class RoofScene {
  // def = data/roof.json, cfg = ROOF, pose = { get(), set(v) } (E2Scene.pose: yaw 라디안), where() = { x, z, level },
  // blocked() = 추격·퍼즐 중인가, endings = EndingsSeen, lockSound(pos) = 잠긴 문 소리 (없어도 됨)
  constructor({ runner, def, cfg, pose, where, interactions, toast, endings, blocked = () => false, lockSound = null }) {
    Object.assign(this, { runner, def, cfg, pose, where, interactions, toast, endings, blocked, lockSound });
    this.signs = def.signs;
    this.log = []; // 시험용 기록: 'open' | 'locked' | 'early' | 'busy' | 'arrive' | 'read:<id>' | 'card'
    this.stop();
  }

  stop() {
    if (this.runner.bonus === 'roofPool') this.runner.bonus = null;
    this.phase = 'idle'; // idle | out | black | in | free
    this.t = 0;
    this.since = 0; // 옥상에 온 뒤 흐른 시간 (네온이 서서히 켜짐)
    this.read = new Map(this.signs.map((s) => [s.id, 0])); // 간판 id → 읽은 시간
    this.done = new Set(); // 다 읽은 간판
    this.cardT = null; // 엔딩 D 카드까지 남은 시간
    this.carded = false;
  }

  // 옥상(보너스 장면)으로 가는 중이거나 옥상에 있다 → 사건 진행을 멈춘다
  get paused() {
    return this.phase !== 'idle';
  }

  get onRoof() {
    return this.phase === 'black' || this.phase === 'in' || this.phase === 'free';
  }

  // 조작을 멈춰야 하는 동안 (문을 열고 밝아질 때까지)
  get frozen() {
    return this.phase === 'out' || this.phase === 'black' || this.phase === 'in';
  }

  // 검은 막 0~1: out 동안 오르고, black 유지, in 동안 걷힌다 (한 방향씩)
  get veil() {
    const F = this.cfg.fade;
    if (this.phase === 'out') return ease(this.t / F.out);
    if (this.phase === 'black') return 1;
    if (this.phase === 'in') return 1 - ease(this.t / F.in);
    return 0;
  }

  // 핸드폰 목표 아래 한 줄 (옥상 열쇠를 가진 판, 옥상에 오기 전)
  keyNote() {
    return this.runner.flags.get('hasRoofKey') && !this.paused ? this.def.messages.keyNote : '';
  }

  // 옥상 문을 열 수 있는가: { ok, reason: 'locked' | 'early' | 'busy' | '' }
  check() {
    const r = this.runner;
    if (!r.flags.get('hasRoofKey')) return { ok: false, reason: 'locked' };
    if (!canEnterRoof(r)) return { ok: false, reason: 'early' };
    if (r.busy || r.pov !== 'player' || this.blocked() || this.paused) return { ok: false, reason: 'busy' };
    return { ok: true, reason: '' };
  }

  // 5층 옥상 문 E
  open() {
    const c = this.check();
    const M = this.def.messages;
    if (!c.ok) {
      this.log.push(c.reason);
      if (c.reason === 'locked') this.lockSound?.();
      this.toast(M[c.reason]);
      return false;
    }
    if (this.runner.mode === 'ending') this.runner.close();
    this.log.push('open');
    this.toast(M.open);
    this.phase = 'out';
    this.t = 0;
    return true;
  }

  // 옥상 쪽 계단탑 문 E: 엔딩 D 카드를 다시 (내려가지 않는다)
  back() {
    if (this.phase !== 'free' || this.runner.busy) return false;
    this.showCard();
    return true;
  }

  showCard() {
    this.carded = true;
    this.cardT = null;
    this.log.push('card');
    this.runner.showEnding('D');
  }

  // 상호작용 등록 (E): 5층 옥상 문, 옥상 계단탑 문
  attach() {
    const d = this.def.door;
    const P = this.def.penthouse;
    const M = this.def.messages;
    this.interactions.add({ id: `roof:${d.id}`, pos: d.use, level: d.level, radius: d.reach, label: M.label, onUse: () => this.open() });
    this.interactions.add({ id: 'roof:back', pos: P.use, level: this.cfg.level, radius: P.reach, label: M.backLabel, onUse: () => this.back() });
  }

  // 암전 속 자리 옮기기 + 엔딩 D 기록
  arrive() {
    const a = this.def.arrive;
    const base = this.pose.get();
    this.pose.set({ ...base, pos: [a.pos[0], base.pos[1], a.pos[1]], level: this.cfg.level, yaw: a.yaw * DEG, pitch: 0 });
    this.runner.bonus = 'roofPool'; // 핸드폰 목표 (story.json objectives)
    this.endings?.mark('D');
    this.log.push('arrive');
  }

  next(phase) {
    this.phase = phase;
    this.t = 0;
  }

  // 간판 하나를 지금 보고 있는가: 반경 안 + 앞면 쪽 + 시선이 angle 도 안
  looking(s, p, yaw) {
    const R = this.cfg.read;
    const [sx, sz] = s.pos;
    if (s.kind === 'tile') {
      if (rectDistance(this.def.pool, p.x, p.z) > s.radius) return false;
    } else {
      if (Math.hypot(sx - p.x, sz - p.z) > s.radius) return false;
      if ((p.x - sx) * s.normal[0] + (p.z - sz) * s.normal[1] <= 0) return false; // 뒤쪽
    }
    const dx = sx - p.x;
    const dz = sz - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return true;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    return (dx * fx + dz * fz) / len >= Math.cos(R.angle * DEG);
  }

  update(dt) {
    const F = this.cfg.fade;
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'out' && this.t >= F.out) {
      this.arrive();
      this.next('black');
    } else if (this.phase === 'black' && this.t >= F.black) this.next('in');
    else if (this.phase === 'in' && this.t >= F.in) this.next('free');
    if (!this.onRoof) return;
    this.since += dt;
    if (this.phase !== 'free') return;
    const p = this.where();
    if (p.level !== this.cfg.level) { // 디버그(유령 모드·자리 옮기기)로 옥상을 떠났다 → 보너스 장면 끝, 사건 진행 다시
      this.stop();
      return;
    }
    const yaw = this.pose.get().yaw;
    for (const s of this.signs) {
      if (this.done.has(s.id) || !this.looking(s, p, yaw)) continue;
      const v = this.read.get(s.id) + dt;
      this.read.set(s.id, v);
      if (v >= this.cfg.read.time) {
        this.done.add(s.id);
        this.log.push(`read:${s.id}`);
      }
    }
    if (!this.carded && this.cardT === null && this.done.size === this.signs.length) this.cardT = this.cfg.cardDelay;
    if (this.cardT !== null) {
      this.cardT -= dt;
      if (this.cardT <= 0 && !this.runner.busy) this.showCard();
    }
  }
}
