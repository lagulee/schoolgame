// 사건 뒤에 남는 흔적 (단계 12, three·DOM 없음): story.json traces — 앞 사건(after)이 끝나면 그 자리에 생기고 살펴볼 수 있다(E).
// 예: E2 뒤 현관 출구 문 앞에 떨어진 {gyuha}의 깨진 핸드폰. 스토리 초기화로 사건 기록이 비면 다시 없어진다.
export class Traces {
  // defs = story.traces, text(s) = 자리표시자 치환 (runner.text)
  constructor({ runner, defs = [], interactions, toast }) {
    Object.assign(this, { runner, defs, interactions, toast });
    this.shown = new Set();
  }

  visible(id) {
    return this.shown.has(id);
  }

  update() {
    const done = this.runner.registry.done;
    for (const d of this.defs) {
      const on = done.has(d.after);
      if (on === this.shown.has(d.id)) continue;
      const key = `trace:${d.id}`;
      if (on) {
        this.shown.add(d.id);
        this.interactions.add({ id: key, pos: d.pos, level: d.level ?? 0, label: d.label, onUse: () => this.toast(this.runner.text(d.text)) });
      } else {
        this.shown.delete(d.id);
        this.interactions.remove(key);
      }
    }
  }
}
