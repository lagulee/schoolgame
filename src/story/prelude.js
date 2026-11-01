// 시작 전 자유 탐색 (단계 0c, STORY 15-3, three 없음): 이름 입력 뒤 학교 앞에서 자유롭게 돌아다니다가
// 현관 홀(data/story.json prelude.trigger, map.json 의 space id)에 1층으로 들어서면 E1 을 한 번만 시작한다.
// E1 시작 때 배터리 확정(phone/setup.js)·hasRoofKey 판정(runner.start)은 기존 경로를 그대로 탄다.
// 한 번 시작한 뒤(또는 디버그 N·jump 로 이미 지나간 뒤)에는 다시 걸리지 않고, 스토리 초기화(K)로 사건 기록이 비면 다시 걸린다.
export class Prelude {
  // def = story.prelude, locate(x, z, level) → { id } | null (MapData.locate)
  constructor({ runner, def, locate }) {
    this.runner = runner;
    this.def = def;
    this.locate = locate;
    this.enabled = true; // 촬영 모드(?shot=1)에서는 끈다
  }

  // 아직 E1 이 시작되지 않았으면 true (탐색 구간)
  get armed() {
    const reg = this.runner.registry;
    return !reg.history.includes(this.def.event) && !reg.done.has(this.def.event);
  }

  // 매 프레임. E1 을 시작했으면 true
  update(x, z, level) {
    if (!this.enabled || !this.armed || this.runner.active) return false;
    if (Math.abs(level) > 1e-6) return false;
    if (this.locate(x, z, level)?.id !== this.def.trigger) return false;
    return this.runner.start(this.def.event);
  }
}
