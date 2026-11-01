// P1 숨기 (단계 12, three·DOM 없음): puzzles.json P1.hide 규칙.
// prep 초 안에 ① 방 문 모두 닫힘 ② 라이트 꺼짐 ③ 책상 사이(spot) 를 맞추면 그림자가 pass 초 동안 문 앞을 지나간다.
// 조건을 다 맞추지 못한 채 prep 이 끝나거나, 지나가는 동안 하나라도 깨지면 'caught'. 다 지나가면 'hidden'.
// 결과는 부르는 쪽(scene/e2.js)이 PuzzleSession.submit 으로 넘긴다 (caught → wrongLimit 1 → 퍼즐 시작 지점 체크포인트).
const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

export const HIDE_CONDS = ['door', 'light', 'spot'];

export class Hide {
  constructor(def) {
    this.def = def;
    this.stop();
  }

  stop() {
    this.phase = 'off'; // off | prep | pass | done
    this.t = 0;
    this.result = null; // hidden | caught
    this.cond = { door: false, light: false, spot: false };
  }

  begin() {
    this.stop();
    this.phase = 'prep';
  }

  get active() {
    return this.phase === 'prep' || this.phase === 'pass';
  }

  // 0~1: 그림자가 문 앞을 지나간 정도 (pass 동안만)
  get passT() {
    return this.phase === 'pass' ? Math.min(1, this.t / this.def.pass) : 0;
  }

  // 남은 준비 시간 (prep 동안만)
  get prepLeft() {
    return this.phase === 'prep' ? Math.max(0, this.def.prep - this.t) : 0;
  }

  get ok() {
    return HIDE_CONDS.every((k) => this.cond[k]);
  }

  // 아직 맞추지 못한 첫 조건 (힌트용)
  get missing() {
    return HIDE_CONDS.find((k) => !this.cond[k]) ?? null;
  }

  // s: { roomClosed, lightOn, x, z, level }. 반환: 이번 프레임에 끝났으면 결과(hidden | caught), 아니면 null
  update(dt, s) {
    if (!this.active) return null;
    this.cond = { door: !!s.roomClosed, light: !s.lightOn, spot: s.level === 0 && inRect(this.def.spot, s.x, s.z) };
    this.t += dt;
    if (this.phase === 'prep') {
      if (this.ok) {
        this.phase = 'pass';
        this.t = 0;
      } else if (this.t >= this.def.prep) return this.finish('caught');
      return null;
    }
    if (!this.ok) return this.finish('caught');
    if (this.t >= this.def.pass) return this.finish('hidden');
    return null;
  }

  finish(result) {
    this.phase = 'done';
    this.result = result;
    return result;
  }
}
