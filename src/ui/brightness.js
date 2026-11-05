// 실내 밝기 보정 (단계 20, STORY 15-2 접근성 옵션): 단계(정수 min ~ max, 기본 def)를 브라우저에 저장하고 바뀌면 알린다.
// DOM 없음 (저장소는 바깥에서 넘긴다. 사생활 모드·저장 막힘이면 기본값으로 동작). 화면 연결은 brightnessUi.js.
export class Brightness {
  // cfg = FINISH.bright, storage = localStorage 같은 것 (없거나 막혀 있으면 저장하지 않는다)
  constructor(cfg, storage = null) {
    this.cfg = cfg;
    this.storage = storage;
    this.onChange = null; // (level) => void
    this.level = this.clamp(this.read());
  }

  clamp(v) {
    const { min, max, def } = this.cfg;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  }

  read() {
    try {
      const v = this.storage?.getItem(this.cfg.key);
      return v === null || v === undefined || v === '' ? this.cfg.def : Number(v);
    } catch {
      return this.cfg.def;
    }
  }

  set(v) {
    const n = this.clamp(v);
    if (n === this.level) return n;
    this.level = n;
    try {
      this.storage?.setItem(this.cfg.key, String(n));
    } catch {
      // 저장이 막혀 있어도 이번 판에는 그대로 쓴다
    }
    this.onChange?.(n);
    return n;
  }

  step(d) {
    return this.set(this.level + d);
  }

  // 한 바퀴 돌리기 (터치 메뉴 한 칸): 끝에서 처음으로
  cycle() {
    const { min, max } = this.cfg;
    return this.set(this.level >= max ? min : this.level + 1);
  }

  // 화면 글자: "+1", "0", "−2"
  get label() {
    return this.level > 0 ? `+${this.level}` : this.level < 0 ? `−${-this.level}` : '0';
  }

  // 실내 하늘빛·눈 적응 빛 배율, 노출 더하기
  get light() {
    return this.cfg.step ** this.level;
  }

  get exposure() {
    return this.cfg.exposure * this.level;
  }
}
