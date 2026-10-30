// 비밀번호 입력 창 (DOM). 열려 있는 동안 게임 키 입력은 main.js 가 무시한다 (open)
// n 번 연속 탭(각 탭 사이가 ms 이내)하면 fn 을 부르는 함수를 만든다
export function tapCounter(n, ms, fn) {
  let count = 0;
  let last = -Infinity;
  return () => {
    const now = performance.now();
    count = now - last > ms ? 1 : count + 1;
    last = now;
    if (count >= n) {
      count = 0;
      fn();
    }
  };
}

export class GateUi {
  constructor(gate, { onOpen, onClose, onUnlock, toast }) {
    this.gate = gate;
    this.onClose = onClose;
    this.onUnlock = onUnlock;
    this.toast = toast;
    this.open = false;
    const box = document.createElement('div');
    box.id = 'gate';
    box.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;align-items:flex-start;justify-content:center;padding-top:6vh;background:rgba(0,0,0,0.6);-webkit-user-select:text;user-select:text;touch-action:manipulation;font:14px system-ui,sans-serif;color:#dfe5ee;';
    box.innerHTML = '<form style="background:#141a22;border:1px solid #3a4658;border-radius:8px;padding:16px 18px;text-align:center"><div style="margin-bottom:8px">디버그 비밀번호</div><input type="password" inputmode="numeric" autocomplete="off" maxlength="12" style="-webkit-user-select:text;user-select:text;font-size:18px;width:9em;text-align:center;padding:4px;background:#0b0f14;color:#dfe5ee;border:1px solid #3a4658;border-radius:4px"><div class="gate-pad" style="display:grid;grid-template-columns:repeat(3,44px);gap:6px;justify-content:center;margin-top:8px"></div><div class="gate-msg" style="min-height:1.4em;margin-top:6px;color:#e08080;font-size:12px"></div><div style="margin-top:6px"><button type="submit">확인</button> <button type="button" class="gate-cancel">취소</button></div></form>';
    document.body.append(box);
    this.box = box;
    this.input = box.querySelector('input');
    this.msg = box.querySelector('.gate-msg');
    this.onOpen = onOpen;
    // 화면 숫자 키패드: 터치 기기에서 소프트 키보드 없이도 입력 (readonly 입력이 아니라 직접 값 편집)
    const pad = box.querySelector('.gate-pad');
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵']) {
      const b = document.createElement('button');
      b.type = k === '↵' ? 'submit' : 'button';
      b.textContent = k;
      b.style.cssText = 'height:40px;font-size:16px';
      if (k !== '↵') b.addEventListener('click', () => { this.input.value = k === '⌫' ? this.input.value.slice(0, -1) : this.input.value + k; });
      pad.append(b);
    }
    box.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.gate.submit(this.input.value)) {
        this.close();
        this.onUnlock?.();
        this.toast('디버그 잠금 해제');
      } else {
        this.msg.textContent = '비밀번호가 틀렸다';
        this.input.select();
      }
    });
    box.querySelector('.gate-cancel').addEventListener('click', () => this.close());
    box.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.close();
      e.stopPropagation(); // 입력 중 숫자·글자가 게임 단축키로 가지 않게
    });
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.onOpen?.();
    this.input.value = '';
    this.msg.textContent = '';
    this.box.style.display = 'flex';
    if (matchMedia('(pointer: coarse)').matches) this.input.inputMode = 'none'; // 터치: 소프트 키보드 대신 화면 키패드
    else this.input.focus();
  }

  close() {
    this.open = false;
    this.box.style.display = 'none';
    this.input.blur();
    this.onClose?.();
  }
}
