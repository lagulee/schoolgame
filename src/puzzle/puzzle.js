// 퍼즐 한 판의 상태: 단서 수집·번호 확인·틀린 시도. 순수 로직 (DOM·three·runner 없음).
// 체크포인트에 넣을 수 있게 save/load 는 JSON 값만 다룬다.

const same = (a, b) => String(a).trim() === String(b).trim();

export class Puzzle {
  // def: puzzles.json 의 퍼즐, defaults: PUZZLE (wrongLimit 기본값)
  constructor(def, defaults = {}) {
    this.def = def;
    this.clueIds = (def.clues ?? []).map((c) => c.id);
    this.wrongLimit = def.wrongLimit ?? defaults.wrongLimit ?? 3;
    this.got = []; // 얻은 단서 id (얻은 순서)
    this.wrong = 0;
    this.status = 'active'; // active | solved | failed
  }

  get id() {
    return this.def.id;
  }

  get total() {
    return this.clueIds.length;
  }

  // 단서가 없는 퍼즐은 처음부터 모은 것으로 본다
  get complete() {
    return this.got.length >= this.total;
  }

  get active() {
    return this.status === 'active';
  }

  has(clueId) {
    return this.got.includes(clueId);
  }

  // 'new' 처음 얻음 / 'dup' 이미 얻음(한 번만 센다) / 'unknown' 이 퍼즐의 단서가 아님 / 'closed' 끝난 퍼즐
  gather(clueId) {
    if (!this.active) return 'closed';
    if (!this.clueIds.includes(clueId)) return 'unknown';
    if (this.has(clueId)) return 'dup';
    this.got.push(clueId);
    return 'new';
  }

  // 아직 못 얻은 첫 단서 (디버그용)
  nextClue() {
    return this.clueIds.find((id) => !this.has(id)) ?? null;
  }

  // { ok, wrong, left, status } — 정답이면 solved, 틀린 시도가 한도에 닿으면 failed
  check(value) {
    if (!this.active) return { ok: false, closed: true, wrong: this.wrong, left: 0, status: this.status };
    if (this.def.answer == null) throw new Error(`퍼즐 ${this.id} 는 정답이 아직 없다 (pending)`);
    if (same(value, this.def.answer)) {
      this.status = 'solved';
      return { ok: true, wrong: this.wrong, left: this.wrongLimit - this.wrong, status: this.status };
    }
    this.wrong += 1;
    if (this.wrong >= this.wrongLimit) this.status = 'failed';
    return { ok: false, wrong: this.wrong, left: Math.max(0, this.wrongLimit - this.wrong), status: this.status };
  }

  save() {
    return { id: this.id, got: [...this.got], wrong: this.wrong, status: this.status };
  }

  load(s) {
    this.got = [...(s.got ?? [])];
    this.wrong = s.wrong ?? 0;
    this.status = s.status ?? 'active';
  }
}
