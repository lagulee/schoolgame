// 체크포인트: 여러 부분(플래그·사건 기록·러너 상태 …)의 상태를 하나의 저장 객체로 모으고 되돌린다.
// 부분은 register(name, { save, load }) 로 붙인다. 단계 0b 에서 배터리·보조배터리를 같은 방식으로 더한다.
// 저장 객체는 JSON 으로 바꿀 수 있는 값만 담는다 (깊은 복사로 원본과 분리).

export const CHECKPOINT_VERSION = 1;

const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export class Checkpoints {
  constructor() {
    this.parts = new Map(); // name → { save, load }
  }

  register(name, part) {
    if (this.parts.has(name)) throw new Error(`체크포인트 항목 중복: ${name}`);
    this.parts.set(name, part);
  }

  // { v, parts: { name: 저장값 } }
  snapshot() {
    const parts = {};
    for (const [name, p] of this.parts) parts[name] = copy(p.save());
    return { v: CHECKPOINT_VERSION, parts };
  }

  // 저장에 없는 항목은 건드리지 않고, 모르는 항목은 무시한다 (예전 저장과 새 항목이 섞여도 동작)
  // order: 먼저 되돌릴 항목 이름 (나머지는 등록 순서)
  restore(snap, order = []) {
    if (!snap || snap.v !== CHECKPOINT_VERSION) throw new Error('체크포인트 형식이 맞지 않음');
    const names = [...order, ...[...this.parts.keys()].filter((n) => !order.includes(n))];
    for (const name of names) {
      const p = this.parts.get(name);
      if (p && name in snap.parts) p.load(copy(snap.parts[name]));
    }
  }
}
