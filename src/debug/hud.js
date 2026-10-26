// ~ 키 디버그 HUD: FPS, 드로우콜, 삼각형 수, 위치, 품질·효과 상태, 최근 이벤트
export class Hud {
  constructor(renderer) {
    this.el = document.getElementById('hud');
    this.renderer = renderer;
    this.visible = false;
    this.frames = 0;
    this.last = performance.now();
    this.fps = 0;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
    return this.visible;
  }

  // 렌더 직후 호출 (renderer.info 는 매 프레임 초기화됨)
  update(data) {
    this.frames++;
    const now = performance.now();
    const el = (now - this.last) / 1000;
    if (el < 0.5) return;
    this.fps = this.frames / el;
    this.frames = 0;
    this.last = now;
    if (!this.visible) return;
    const r = this.renderer.info.render;
    const p = data.pos;
    this.el.textContent = [
      `FPS ${this.fps.toFixed(0)}   품질 ${data.quality}`,
      `드로우콜 ${r.calls}   삼각형 ${(r.triangles / 1000).toFixed(1)}k`,
      `위치 ${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}   바닥 ${data.surface}`,
      `안개 ${data.fog.toFixed(4)}   헤드밥 ${Math.round(data.bob * 100)}%`,
      `블룸 ${data.flags.bloom ? 'on' : 'off'}  그레인 ${data.flags.grain ? 'on' : 'off'}  비네팅 ${data.flags.vignette ? 'on' : 'off'}`,
      `점검 ${data.inspect ? 'on' : 'off'}   음소거 ${data.muted ? 'on' : 'off'}`,
      data.phone,
      data.stamina,
      data.chase,
      `이벤트: ${data.events.join(' / ') || '-'}`,
      ...(data.story ?? []),
    ].join('\n');
  }
}
