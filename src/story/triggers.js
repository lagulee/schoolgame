// 자리 진입 사건 (단계 12, three 없음): story.json triggers — 앞 사건(after)이 끝난 뒤 그 자리에 들어서면 사건을 한 번 시작한다.
// 자리는 map.json 공간 id(space) 또는 사각형 rect [x0, z0, x1, z1], 층은 level. E1 은 시작 전 탐색 구간이라 prelude.js 가 맡는다.
const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

export class EventTriggers {
  // defs = story.triggers, locate(x, z, level) → { id } | null (MapData.locate)
  constructor({ runner, defs = [], locate = () => null }) {
    this.runner = runner;
    this.defs = defs;
    this.locate = locate;
    this.enabled = true; // 촬영 모드·자동 점검에서 끈다
  }

  // 아직 시작하지 않았고 앞 사건이 끝났으면 true
  armed(def) {
    const reg = this.runner.registry;
    if (reg.history.includes(def.event) || reg.done.has(def.event)) return false;
    // 그 루트에 없거나 생략 조건(skipIf)에 걸린 사건은 걸지 않는다 (단계 14: R1 의 E8, earlyBook 의 E9)
    if (!reg.isAvailable(def.event, this.runner.flags.values, this.runner.route)) return false;
    return !def.after || reg.done.has(def.after);
  }

  at(def, x, z, level) {
    if (Math.abs(level - (def.level ?? 0)) > 1e-6) return false;
    if (def.rect) return inRect(def.rect, x, z);
    return this.locate(x, z, level)?.id === def.space;
  }

  // 매 프레임. 시작한 사건 id 또는 null
  update(x, z, level) {
    if (!this.enabled || this.runner.busy) return null;
    for (const def of this.defs) {
      if (this.armed(def) && this.at(def, x, z, level) && this.runner.start(def.event)) return def.event;
    }
    return null;
  }
}
