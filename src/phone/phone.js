// 핸드폰 상태와 배터리 규칙 (STORY 8장). DOM·three 없이 순수 로직만 둔다 (test/phone.test.mjs).
// 시점(pov)마다 핸드폰이 따로 있다: 주인공(player)은 시작 86~92%, 태민(mingeon)은 55%. 소모 규칙은 같다.
// 보조배터리는 주인공 핸드폰만 충전한다 (태민 시점에는 보조배터리가 없다).

const copy = (v) => JSON.parse(JSON.stringify(v));

export class Phone {
  // cfg: src/config.js 의 PHONE, rng: () => [0, 1) (테스트에서 고정)
  constructor(cfg, rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.onWarn = null; // (level) => void   20%·10% 에 처음 닿을 때 한 번씩
    this.onDead = null; // () => void        0% 가 되는 순간
    this.reset();
  }

  // 새 판 (스토리 초기화). 배터리는 임시값이고 BEGIN_EVENT(E1) 시작 때 begin() 으로 확정한다
  reset() {
    this.pov = 'player';
    this.states = { player: this.fresh(this.roll()) };
    this.picked = new Set(); // 주운 보조배터리 id
    this.begun = false;
  }

  roll() {
    const { PHONE_START_MIN: lo, PHONE_START_MAX: hi } = this.cfg;
    return lo + Math.min(hi - lo, Math.floor(this.rng() * (hi - lo + 1)));
  }

  fresh(battery) {
    return { battery, lightOn: false, screenOpen: false, warned: [] };
  }

  // E1 시작: 시작 배터리 확정 (86~92 정수 랜덤). 라이트를 켜 둔 채 들어왔으면 그대로 둔다
  begin() {
    const lightOn = this.states.player.lightOn;
    this.pov = 'player';
    this.states = { player: this.fresh(this.roll()) };
    this.states.player.lightOn = lightOn;
    this.picked.clear();
    this.begun = true;
  }

  // 시점 전환: 태민 핸드폰은 처음 쓸 때 55% 로 만든다
  usePov(pov) {
    if (!this.states[pov]) this.states[pov] = this.fresh(pov === 'mingeon' ? this.cfg.MINGEON_START : this.roll());
    this.pov = pov;
  }

  get s() {
    return this.states[this.pov];
  }

  get battery() {
    return this.s.battery;
  }

  // 화면에 보이는 정수 % (소수점은 올림: 89.5 → 90)
  get level() {
    return Math.ceil(this.s.battery - 1e-9);
  }

  get lightOn() {
    return this.s.lightOn;
  }

  get screenOpen() {
    return this.s.screenOpen;
  }

  // 0% 면 꺼짐: 라이트·목표·위치 모두 쓸 수 없다
  get dead() {
    return this.s.battery <= 0;
  }

  get low() {
    return !this.dead && this.level <= this.cfg.LOW_LEVEL;
  }

  spend(amount) {
    const s = this.s;
    if (s.battery <= 0 || amount <= 0) return;
    const before = s.battery;
    s.battery = Math.max(0, before - amount);
    for (const lv of this.cfg.WARN_LEVELS) {
      if (before > lv && s.battery <= lv && !s.warned.includes(lv)) {
        s.warned.push(lv);
        if (s.battery > 0) this.onWarn?.(lv);
      }
    }
    if (s.battery <= 0) {
      s.lightOn = false;
      s.screenOpen = false;
      this.onDead?.();
    }
  }

  // 화면 열기: 열 때마다 CHECK_COST. 이미 열려 있으면 그대로. 꺼져 있으면 false
  openScreen() {
    if (this.dead) return false;
    if (this.s.screenOpen) return true;
    this.s.screenOpen = true;
    this.spend(this.cfg.CHECK_COST);
    return !this.dead;
  }

  closeScreen() {
    this.s.screenOpen = false;
  }

  // 반환: 바뀐 뒤 열림 여부 (꺼져 있어 못 열면 false)
  toggleScreen() {
    if (this.s.screenOpen) {
      this.closeScreen();
      return false;
    }
    return this.openScreen();
  }

  setLight(on) {
    if (on && this.dead) return false;
    this.s.lightOn = on;
    return on;
  }

  toggleLight() {
    return this.setLight(!this.s.lightOn);
  }

  // 라이트가 켜져 있으면 20초당 1%
  update(dt) {
    if (this.s.lightOn) this.spend(this.cfg.LIGHT_COST_PER_SEC * dt);
  }

  // 충전 +BANK_GAIN, 상한 BATTERY_MAX (넘는 양은 버려짐)
  charge(amount = this.cfg.BANK_GAIN) {
    const s = this.s;
    s.battery = Math.min(this.cfg.BATTERY_MAX, s.battery + amount);
  }

  // 보조배터리 줍기: { ok, reason } — reason: pov(태민 시점) | picked(이미 주움)
  pickBank(id) {
    if (this.pov !== 'player') return { ok: false, reason: 'pov' };
    if (this.picked.has(id)) return { ok: false, reason: 'picked' };
    this.picked.add(id);
    this.charge();
    return { ok: true, reason: '' };
  }

  // 체크포인트 (runner.checkpoints.register('phone', …))
  save() {
    return { pov: this.pov, begun: this.begun, picked: [...this.picked], states: copy(this.states) };
  }

  load(v) {
    this.states = copy(v.states);
    this.pov = this.states[v.pov] ? v.pov : 'player';
    this.picked = new Set(v.picked ?? []);
    this.begun = !!v.begun;
  }
}

// 저전력 흐려짐 타이머. 상태(밝음/흐림)마다 최소 cfg.length(≥0.36초) 유지 → 초당 3회 미만 (광과민성 안전)
// st: { dim, left } 를 받아 dt 만큼 진행한 새 상태를 돌려준다
export function flickerStep(st, dt, rng, cfg) {
  let { dim, left } = st;
  left -= dt;
  while (left <= 0) {
    dim = !dim;
    left += dim ? cfg.length : cfg.every[0] + rng() * (cfg.every[1] - cfg.every[0]);
  }
  return { dim, left };
}
