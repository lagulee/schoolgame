// 스토리 플래그와 루트 판정. 플래그 이름과 판정 규칙은 docs/story/STORY.md 6장·9장 그대로.

export const FLAG_NAMES = ['hasConnectorKey', 'earlyBook', 'dutyCompanion', 'hasExitKey', 'hasRoofKey'];

// 엔딩 키. A·B·C 는 루트 엔딩, D 는 A·B·C 를 모두 본 뒤에만 가는 숨겨진 엔딩 (STORY 16장)
export const MAIN_ENDINGS = ['A', 'B', 'C'];
export const ENDING_KEYS = [...MAIN_ENDINGS, 'D'];

// 새 판 E1 에서 옥상 열쇠(hasRoofKey)를 주는가: 본 엔딩에 A·B·C 가 모두 있으면 (D 는 따지지 않음)
export function earnsRoofKey(seen) {
  return MAIN_ENDINGS.every((k) => seen.includes(k));
}

// STORY.md 6장 의사코드:
//   if earlyBook          -> R1  (E7 이전에 결정)
//   else if dutyCompanion -> R2  (E12에서 결정)
//   else                  -> R3  (기준 경로, 기본값)
export function determineRoute(flags) {
  if (flags.earlyBook) return 'R1';
  if (flags.dutyCompanion) return 'R2';
  return 'R3';
}

// endings: story.json 의 { A: { route: 'R1' }, ... } → 루트에 해당하는 엔딩 키
export function endingForRoute(route, endings) {
  return Object.keys(endings).find((k) => endings[k].route === route) ?? null;
}

export class Flags {
  constructor(defaults = {}) {
    this.defaults = {};
    for (const name of FLAG_NAMES) this.defaults[name] = !!defaults[name];
    this.values = { ...this.defaults };
    this.onChange = null; // (name, value) => void
  }

  get(name) {
    if (!FLAG_NAMES.includes(name)) throw new Error(`알 수 없는 플래그: ${name}`);
    return this.values[name];
  }

  set(name, value) {
    if (!FLAG_NAMES.includes(name)) throw new Error(`알 수 없는 플래그: ${name}`);
    const v = !!value;
    if (this.values[name] === v) return false;
    this.values[name] = v;
    this.onChange?.(name, v);
    return true;
  }

  // { flag: value, ... } 묶음 적용
  apply(changes = {}) {
    for (const [name, value] of Object.entries(changes)) this.set(name, value);
  }

  reset() {
    this.values = { ...this.defaults };
  }

  get route() {
    return determineRoute(this.values);
  }

  snapshot() {
    return { ...this.values };
  }

  // 체크포인트 복원. 알림(onChange)은 보내지 않는다. 저장에 없는 플래그는 기본값
  restore(values = {}) {
    this.values = { ...this.defaults };
    for (const name of FLAG_NAMES) if (name in values) this.values[name] = !!values[name];
  }
}
