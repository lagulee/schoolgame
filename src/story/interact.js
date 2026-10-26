// E 키 상호작용: 플레이어 근처의 대상(문·열쇠·책 등)을 등록해 두고, 가장 가까운 대상에 안내를 띄운다.
// 단계 0 에서는 등록된 대상이 없다. 실내 맵(단계 1~) 에서 add() 로 대상을 붙인다.
// 터치 기기에서는 안내 자체가 누를 수 있는 버튼이 된다.
import { onTap } from '../ui/tap.js';

export class Interactions {
  // opts: { radius (기본 반경 m), touch }
  constructor(opts) {
    this.opts = opts;
    this.items = new Map();
    this.current = null;
    this.enabled = true;
    this.prompt = document.createElement('button');
    this.prompt.type = 'button';
    this.prompt.id = 'interact';
    this.prompt.style.display = 'none';
    onTap(this.prompt, () => this.use());
    document.body.append(this.prompt);
  }

  // item: { id, pos: [x, z], radius?, label, onUse }
  add(item) {
    this.items.set(item.id, item);
  }

  remove(id) {
    this.items.delete(id);
  }

  update(x, z) {
    let best = null;
    let bestD = Infinity;
    if (this.enabled) {
      for (const it of this.items.values()) {
        const d = Math.hypot(it.pos[0] - x, it.pos[1] - z);
        if (d <= (it.radius ?? this.opts.radius) && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    if (best !== this.current) {
      this.current = best;
      this.prompt.style.display = best ? '' : 'none';
      if (best) this.prompt.textContent = `${this.opts.touch ? '✋' : 'E'}  ${best.label}`;
    }
  }

  use() {
    if (!this.current) return false;
    this.current.onUse();
    return true;
  }
}
