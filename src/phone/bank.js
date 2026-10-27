// 보조배터리 PB1~PB9 줍기 (data/powerbanks.json). 좌표 배치는 맵 단계(1d)에서 place() 로 붙인다.
// 지금은 디버그 U 키(터치 메뉴)로 플레이어 앞에 다음 보조배터리를 놓고 E 상호작용으로 줍는다.
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
  }

  // 월드에 놓기 (맵 단계에서는 powerbanks.json 좌표로 호출). level = 층 (0 = 1층)
  place(id, pos, level = 0) {
    if (this.phone.picked.has(id)) return false;
    this.placed.add(id);
    this.interactions.add({ id, pos, level, label: this.msgs.bankLabel, onUse: () => this.pick(id) });
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
      this.toast?.(fmt(this.msgs.bankPicked, { n: this.gain, level: this.phone.level }));
    }
    return r;
  }

  // 디버그: 아직 줍지도 놓지도 않은 첫 보조배터리를 (x, z, 층) 에 놓는다
  debugPlaceNext(x, z, level = 0) {
    const def = [...this.defs.values()].find((d) => !this.phone.picked.has(d.id) && !this.placed.has(d.id));
    if (!def) {
      this.toast?.(this.msgs.bankNone);
      return null;
    }
    this.place(def.id, [x, z], level);
    this.toast?.(fmt(this.msgs.bankPlaced, { id: def.id }));
    return def.id;
  }

  // 체크포인트 복원·초기화 뒤: 이미 주운 것은 월드에서 뺀다
  sync() {
    for (const id of [...this.placed]) {
      if (this.phone.picked.has(id)) {
        this.interactions.remove(id);
        this.placed.delete(id);
      }
    }
  }

  clear() {
    for (const id of this.placed) this.interactions.remove(id);
    this.placed.clear();
  }
}
