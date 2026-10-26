// 사건 등록기: 사건을 ID(E1~E15)로 등록하고, 같은 사건이 연속으로 발동하지 않게 막는다.
// 진행 중인 사건이 있으면 새 사건을 시작하지 않는다. 루트·skipIf 조건으로 나올 사건을 거른다.

export class EventRegistry {
  constructor(events) {
    this.byId = new Map();
    this.order = [];
    for (const ev of events) {
      if (this.byId.has(ev.id)) throw new Error(`사건 ID 중복: ${ev.id}`);
      this.byId.set(ev.id, ev);
      this.order.push(ev.id);
    }
    this.reset();
  }

  reset() {
    this.active = null; // 진행 중인 사건 ID
    this.last = null; // 직전에 발동한 사건 ID
    this.done = new Set();
    this.history = []; // 발동 순서 기록
  }

  get(id) {
    return this.byId.get(id) ?? null;
  }

  // 현재 플래그·루트에서 이 사건이 나오는가 (생략 조건 포함)
  isAvailable(id, flags, route) {
    const ev = this.get(id);
    if (!ev) return false;
    if (ev.routes && !ev.routes.includes(route)) return false;
    if (ev.skipIf && flags[ev.skipIf]) return false;
    return true;
  }

  // 발동 가능 여부와 이유 (UI·디버그 표시용)
  check(id) {
    if (!this.get(id)) return { ok: false, reason: `없는 사건 ${id}` };
    if (this.active) return { ok: false, reason: `${this.active} 진행 중` };
    if (id === this.last) return { ok: false, reason: `${id} 연속 발동 금지` };
    return { ok: true, reason: '' };
  }

  begin(id) {
    const c = this.check(id);
    if (!c.ok) return null;
    this.active = id;
    this.last = id;
    this.history.push(id);
    return this.get(id);
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
}
