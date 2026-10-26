// 스태미나 막대 (DOM): 화면 하단 중앙의 얇은 막대. 소모·회복 중에만 보이고 가득 차면 잠시 뒤 숨긴다.
// 30% 이하(STAMINA.LOW)·탈진 중에는 붉게. 막대 색·크기는 index.html 의 #stamina 스타일.
export class StaminaBar {
  constructor(cfg) {
    this.cfg = cfg;
    this.root = document.createElement('div');
    this.root.id = 'stamina';
    this.fill = document.createElement('div');
    this.fill.className = 'st-fill';
    this.root.append(this.fill);
    document.body.append(this.root);
    this.hideLeft = 0;
    this.last = '';
  }

  // st: Stamina (value·ratio·low·exhausted·draining·recovering·full)
  update(dt, st) {
    const active = st.draining || st.recovering || !st.full;
    if (active) this.hideLeft = this.cfg.BAR_HIDE_DELAY;
    else this.hideLeft = Math.max(0, this.hideLeft - dt);
    const show = active || this.hideLeft > 0;
    const pct = Math.round(st.ratio * 1000) / 10;
    const key = `${show}|${pct}|${st.low}|${st.exhausted}`;
    if (key === this.last) return;
    this.last = key;
    this.root.classList.toggle('show', show);
    this.root.classList.toggle('low', st.low || st.exhausted);
    this.root.classList.toggle('out', st.exhausted);
    this.fill.style.width = `${pct}%`;
  }
}
