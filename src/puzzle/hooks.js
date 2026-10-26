// 귀신 연출 훅 (인터페이스만). 실제 연출(원경·소리·검은 연기)은 단계 12 이후에 register 로 채운다.
// 기본 구현은 빈 함수 + 디버그 로그. 이름만 예약된 연출 규칙(STORY 9장):
//   P1 onStart    — 문 앞을 지나가는 그림자·문틈 연기
//   P2 onClue     — 단서를 얻을 때마다 귀신이 나타났다 사라짐 (3번, 90초 이상 간격)
//   P3 onWrong    — 틀린 교실에서만 검은 연기
//   P4 onWrong    — 틀린 열쇠마다 소리, 형체가 한 걸음 가까워짐 / onFail — 잡힘
export const HOOK_NAMES = ['onStart', 'onClue', 'onComplete', 'onWrong', 'onSuccess', 'onFail'];

export class GhostHooks {
  // log: (line) => void  디버그 로그 (기본 구현이 호출 기록을 남긴다)
  constructor({ log = null } = {}) {
    this.log = log;
    this.impl = new Map(); // 훅 이름 → 연출 함수 목록
    this.history = []; // 최근 호출 기록 (디버그 HUD·테스트)
  }

  register(name, fn) {
    if (!HOOK_NAMES.includes(name)) throw new Error(`없는 훅 ${name}`);
    if (!this.impl.has(name)) this.impl.set(name, []);
    this.impl.get(name).push(fn);
  }

  // puzzle 의 ghostHooks 에 이름이 있는 훅만 부른다. 등록된 연출이 없으면 로그만 남긴다
  call(puzzleDef, name, info = {}) {
    if (!HOOK_NAMES.includes(name)) throw new Error(`없는 훅 ${name}`);
    if (!(puzzleDef.ghostHooks ?? []).includes(name)) return false;
    const line = `훅 ${name} (${puzzleDef.id}${info.clue ? ` ${info.clue}` : ''})`;
    this.history.push(line);
    if (this.history.length > 8) this.history.shift();
    this.log?.(line);
    for (const fn of this.impl.get(name) ?? []) fn({ puzzle: puzzleDef.id, ...info });
    return true;
  }
}
