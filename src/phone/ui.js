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

  // view: { open, level, lightOn, low, objective, place }
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
  }
}
