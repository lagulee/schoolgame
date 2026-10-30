// 디버그 기능 잠금 (순수 로직, DOM 없음). 비밀번호는 클라이언트 코드에 그대로 있으므로 보안이 아니라 장난 방지용 문턱이다.
// 잠금 상태는 페이지를 새로 열면 다시 잠긴다 (저장하지 않음).
import { DEBUG } from '../config.js';

export class DebugGate {
  constructor(password = DEBUG.password) {
    this.password = password;
    this.unlocked = false;
    this.fails = 0;
  }

  // 비밀번호 확인. 맞으면 잠금 해제하고 true
  submit(input) {
    if (String(input).trim() === this.password) {
      this.unlocked = true;
      this.fails = 0;
      return true;
    }
    this.fails++;
    return false;
  }

  lock() {
    this.unlocked = false;
  }

  // 잠겨 있으면 fn 을 실행하지 않고 false (잠금 해제 요청은 호출한 쪽이 한다)
  guard(fn) {
    if (!this.unlocked) return false;
    fn();
    return true;
  }
}
