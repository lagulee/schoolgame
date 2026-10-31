// 보조배터리 PB1~PB9 줍기 (data/powerbanks.json). 단계 10 부터 데이터 좌표(level·pos)에 placeAll() 로 놓고 E 상호작용으로 줍는다.
// 디버그 U 키(터치 메뉴)는 아직 줍지 않은 다음 보조배터리를 플레이어 앞으로 옮긴다. 물체 그리기는 bankView.js (at 을 따라감).
// 줍는 시점: from 의 사건 중 하나가 시작된 뒤부터 (그 전에는 줍지 못하고 안내만).
import { fmt } from './ui.js';

// 사건이 시작됐거나 (jump 로) 지나갔는지
export const seenBy = (registry) => (id) => registry.history.includes(id) || registry.done.has(id);

export function bankOpen(def, seen) {
  return !def.from?.length || def.from.some(seen);
}

export class PowerBanks {
  // defs: powerbanks.json 의 powerbanks, msgs: phone.json 의 messages
  constructor({ phone, defs, interactions, seen, msgs, toast, gain }) {
    Object.assign(this, { phone, interactions, seen, msgs, toast, gain });
    this.defs = new Map(defs.map((d) => [d.id, d]));
    this.placed = new Set();
    this.at = new Map(); // id → { pos, level } 지금 놓인 자리
    this.moved = new Set(); // 디버그로 옮긴 것
  }

  // 데이터 좌표가 있는 것 중 아직 줍지도 놓지도 않은 것을 전부 놓는다 (시작·초기화·체크포인트 복원 뒤)
  placeAll() {
    for (const d of this.defs.values()) if (d.pos && !this.placed.has(d.id)) this.place(d.id, d.pos, d.level ?? 0);
  }

  // 월드에 놓기 (맵 단계에서는 powerbanks.json 좌표로 호출). level = 층 (0 = 1층)
  place(id, pos, level = 0) {
    if (this.phone.picked.has(id)) return false;
    this.placed.add(id);
    this.at.set(id, { pos, level });
    const label = this.defs.get(id)?.label ?? this.msgs.bankLabel; // 서랍·사물함 안(hidden)은 살펴보기 문구
    this.interactions.add({ id, pos, level, label, onUse: () => this.pick(id) });
    return true;
  }

  // { ok, reason } — reason: pov | picked | early | unknown
  pick(id) {
    const def = this.defs.get(id);
    if (!def) return { ok: false, reason: 'unknown' };
    if (!bankOpen(def, this.seen)) {
      this.toast?.(fmt(this.msgs.bankTooEarly, { id, event: def.from.join('/') }));
      return { ok: false, reason: 'early' };
    }
    const r = this.phone.pickBank(id);
    if (r.reason === 'pov') this.toast?.(this.msgs.bankPov);
    if (r.ok) {
      this.interactions.remove(id);
      this.placed.delete(id);
      this.at.delete(id);
      this.toast?.(fmt(this.msgs.bankPicked, { n: this.gain, level: this.phone.level }));
    }
    return r;
  }

  // 디버그: 아직 줍지 않았고 디버그로 옮기지 않은 첫 보조배터리를 (x, z, 층) 에 놓는다 (맵 자리에 놓여 있었으면 옮긴다)
  debugPlaceNext(x, z, level = 0) {
    const def = [...this.defs.values()].find((d) => !this.phone.picked.has(d.id) && !this.moved.has(d.id));
    if (!def) {
      this.toast?.(this.msgs.bankNone);
      return null;
    }
    this.interactions.remove(def.id);
    this.placed.delete(def.id);
    this.moved.add(def.id);
    this.place(def.id, [x, z], level);
    this.toast?.(fmt(this.msgs.bankPlaced, { id: def.id }));
    return def.id;
  }

  // 체크포인트 복원 뒤: 이미 주운 것은 월드에서 빼고, 복원으로 줍기 전이 된 것은 데이터 자리에 다시 놓는다
  sync() {
    for (const id of [...this.placed]) {
      if (this.phone.picked.has(id)) {
        this.interactions.remove(id);
        this.placed.delete(id);
        this.at.delete(id);
      }
    }
    this.placeAll();
  }

  clear() {
    for (const id of this.placed) this.interactions.remove(id);
    this.placed.clear();
    this.at.clear();
    this.moved.clear();
  }
}
