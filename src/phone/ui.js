// 핸드폰 화면 (DOM): 배터리·라이트 상태 줄, 해야 할 것(사건 objective), 위치(사건 place).
// 배터리 경고는 화면을 닫아 두어도 위쪽 알림으로 잠깐 보인다. 문구는 data/phone.json.

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent?.append(e);
  return e;
}

export const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export class PhoneUI {
  // texts: data/phone.json, opts: { touch, warnShow (초) }
  constructor(texts, opts) {
    this.t = texts.ui;
    this.opts = opts;
    this.root = el('div', '', document.body);
    this.root.id = 'phone';
    this.root.style.display = 'none';
    const bar = el('div', 'ph-bar', this.root);
    el('span', 'ph-title', bar, this.t.title);
    this.lightEl = el('span', 'ph-light', bar);
    this.batEl = el('span', 'ph-bat', bar);
    const row = (label) => {
      const r = el('div', 'ph-row', this.root);
      el('div', 'ph-label', r, label);
      return el('div', 'ph-value', r);
    };
    this.objEl = row(this.t.objective);
    this.placeEl = row(this.t.place);
    // 가는 길 (길 안내): 화살표(내가 보는 쪽 기준 방향) + 이름·거리 + 계단 안내. 안내가 없는 목표에서는 줄째 숨긴다
    this.routeRow = el('div', 'ph-row ph-route', this.root);
    el('div', 'ph-label', this.routeRow, this.t.route);
    const body = el('div', 'ph-route-body', this.routeRow);
    this.arrowEl = el('div', 'ph-arrow', body, '↑');
    const txt = el('div', 'ph-route-text', body);
    this.routeEl = el('div', 'ph-value', txt);
    this.stepEl = el('div', 'ph-step', txt);
    el('div', 'ph-hint', this.root, opts.touch ? this.t.closeHintTouch : this.t.closeHintKey);
    this.warnEl = el('div', '', document.body);
    this.warnEl.id = 'phone-warn';
    this.warnLeft = 0;
    this.last = '';
  }

  warn(text) {
    this.warnEl.textContent = text;
    this.warnEl.classList.add('show');
    this.warnLeft = this.opts.warnShow;
  }

  // view: { open, level, lightOn, low, objective, place, guide } — guide: null 또는 { state, text, step, angle (도, 0 = 앞, 시계 방향), rough }
  update(dt, view) {
    if (this.warnLeft > 0) {
      this.warnLeft -= dt;
      if (this.warnLeft <= 0) this.warnEl.classList.remove('show');
    }
    const key = JSON.stringify(view);
    if (key === this.last) return;
    this.last = key;
    this.root.style.display = view.open ? '' : 'none';
    if (!view.open) return;
    this.batEl.textContent = `${this.t.battery} ${view.level}%`;
    this.batEl.classList.toggle('low', view.low);
    this.lightEl.textContent = `${this.t.light} ${view.lightOn ? this.t.on : this.t.off}`;
    this.lightEl.classList.toggle('on', view.lightOn);
    this.objEl.textContent = view.objective || this.t.none;
    this.placeEl.textContent = view.place || this.t.none;
    const g = view.guide;
    this.routeRow.style.display = g ? '' : 'none';
    if (g) {
      this.routeEl.textContent = g.text;
      this.stepEl.textContent = [g.rough ? this.t.rough : '', g.step].filter(Boolean).join(' · ');
      this.arrowEl.style.visibility = g.state === 'path' ? 'visible' : 'hidden';
      this.arrowEl.style.transform = `rotate(${g.angle ?? 0}deg)`;
    }
  }
}
