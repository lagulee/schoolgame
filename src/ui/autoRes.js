// 자동 해상도 (렉 수정, v1.28.8, three·DOM 없음): 실제 프레임 간격을 재서 목표 FPS 에 못 미치면 그리는 해상도를 한 칸씩 낮춘다.
// 픽셀 수가 줄면 픽셀 셰이더(광원·안개·후처리) 비용이 같은 비율로 줄어든다. 화질(그림자·후처리)은 그대로 둔다.
// - 창(window 초)마다 평균 FPS 를 보고 target 미만이면 한 칸 내린다. 다시 올리지는 않는다 (올렸다 내렸다 하면 화면이 출렁인다).
//   품질을 직접 바꾸면(reset) 처음 배율로 돌아가 다시 잰다.
// - 탭 전환·일시정지·로딩처럼 한 프레임이 maxGap 초를 넘으면 그 프레임은 세지 않는다 (headless 테스트는 늘 이쪽이라 배율이 바뀌지 않는다).
export class AutoRes {
  constructor(cfg, onChange = () => {}) {
    this.cfg = cfg;
    this.onChange = onChange;
    this.reset();
  }

  get scale() {
    return this.cfg.steps[this.i];
  }

  reset() {
    this.i = 0;
    this.time = 0;
    this.frames = 0;
    this.hold = this.cfg.settle;
  }

  // gap: 지난 프레임부터의 실제 시간(초). 배율이 바뀌면 true
  frame(gap) {
    if (!(gap > 0) || gap > this.cfg.maxGap) return false;
    if (this.hold > 0) { this.hold -= gap; return false; }
    this.time += gap;
    this.frames++;
    if (this.time < this.cfg.window) return false;
    const fps = this.frames / this.time;
    this.time = 0;
    this.frames = 0;
    if (fps >= this.cfg.target || this.i >= this.cfg.steps.length - 1) return false;
    this.i++;
    this.hold = this.cfg.settle; // 해상도를 바꾼 직후의 끊김은 세지 않는다
    this.onChange(this.scale, fps);
    return true;
  }
}
