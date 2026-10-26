// 사건 등록기: 사건을 ID(E1~E15, R1-a~R1-h)로 등록하고, 같은 사건이 연속으로 발동하지 않게 막는다.
// 진행 중인 사건이 있으면 새 사건을 시작하지 않는다. 루트·skipIf 조건으로 나올 사건을 거른다.
// 같은 ID 를 루트별 변형으로 여러 번 등록할 수 있다 (STORY 6장의 R3 E13 / R2 E13 처럼). 변형끼리 routes 가 겹치면 오류.

export class EventRegistry {
  constructor(events) {
    this.byId = new Map(); // id → [변형, ...]
    this.order = []; // 처음 나온 순서의 고유 ID
    for (const ev of events) {
      const list = this.byId.get(ev.id);
      if (!list) {
        this.byId.set(ev.id, [ev]);
        this.order.push(ev.id);
        continue;
      }
      for (const other of list) {
        const overlap = !ev.routes || !other.routes || ev.routes.some((r) => other.routes.includes(r));
        if (overlap) throw new Error(`사건 ID 중복: ${ev.id} (루트가 겹침)`);
      }
      list.push(ev);
    }
    this.reset();
  }

  reset() {
    this.active = null; // 진행 중인 사건 ID
    this.last = null; // 직전에 발동한 사건 ID
    this.done = new Set();
    this.history = []; // 발동 순서 기록
  }

  // route 를 주면 그 루트의 변형, 없으면 첫 변형
  get(id, route) {
    const list = this.byId.get(id);
    if (!list) return null;
    if (route) return list.find((ev) => !ev.routes || ev.routes.includes(route)) ?? null;
    return list[0];
  }

  // 등록된 모든 사건 객체 (변형 포함)
  all() {
    return [...this.byId.values()].flat();
  }

  // 현재 플래그·루트에서 이 사건이 나오는가 (생략 조건 포함)
  isAvailable(id, flags, route) {
    const ev = this.get(id, route);
    if (!ev) return false;
    if (ev.skipIf && flags[ev.skipIf]) return false;
    return true;
  }

  // 발동 가능 여부와 이유 (UI·디버그 표시용)
  check(id) {
    if (!this.byId.has(id)) return { ok: false, reason: `없는 사건 ${id}` };
    if (this.active) return { ok: false, reason: `${this.active} 진행 중` };
    if (id === this.last) return { ok: false, reason: `${id} 연속 발동 금지` };
    return { ok: true, reason: '' };
  }

  // route 의 변형을 돌려준다. 그 루트에 변형이 없으면 첫 변형 (디버그로 루트 밖 사건을 부를 때)
  begin(id, route) {
    const c = this.check(id);
    if (!c.ok) return null;
    this.active = id;
    this.last = id;
    this.history.push(id);
    return this.get(id, route) ?? this.get(id);
  }

  end() {
    if (!this.active) return null;
    const id = this.active;
    this.done.add(id);
    this.active = null;
    return id;
  }

  // 순서상 다음에 나올 사건 (직전 사건 뒤에서부터, 조건에 맞지 않는 사건은 건너뜀). 없으면 null
  nextId(flags, route) {
    const from = this.last ? this.order.indexOf(this.last) + 1 : 0;
    for (let i = from; i < this.order.length; i++) {
      const id = this.order[i];
      if (this.isAvailable(id, flags, route)) return id;
    }
    return null;
  }

  // 체크포인트용 저장·복원 (진행 중인 사건은 러너가 따로 저장한다)
  snapshot() {
    return { done: [...this.done], last: this.last, history: [...this.history] };
  }

  restore(s) {
    this.active = null;
    this.done = new Set(s.done ?? []);
    this.last = s.last ?? null;
    this.history = [...(s.history ?? [])];
  }
}
