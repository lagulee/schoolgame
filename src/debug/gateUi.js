// 비밀번호 입력 창 (DOM). 열려 있는 동안 게임 키 입력은 main.js 가 무시한다 (open)
export class GateUi {
  constructor(gate, { onOpen, onClose, toast }) {
    this.gate = gate;
    this.onClose = onClose;
    this.toast = toast;
    this.open = false;
    const box = document.createElement('div');
    box.id = 'gate';
    box.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);font:14px system-ui,sans-serif;color:#dfe5ee;';
    box.innerHTML = '<form style="background:#141a22;border:1px solid #3a4658;border-radius:8px;padding:16px 18px;text-align:center"><div style="margin-bottom:8px">디버그 비밀번호</div><input type="password" inputmode="numeric" autocomplete="off" maxlength="12" style="font-size:18px;width:9em;text-align:center;padding:4px;background:#0b0f14;color:#dfe5ee;border:1px solid #3a4658;border-radius:4px"><div class="gate-msg" style="min-height:1.4em;margin-top:6px;color:#e08080;font-size:12px"></div><div style="margin-top:6px"><button type="submit">확인</button> <button type="button" class="gate-cancel">취소</button></div></form>';
    document.body.append(box);
    this.box = box;
    this.input = box.querySelector('input');
    this.msg = box.querySelector('.gate-msg');
    this.onOpen = onOpen;
    box.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.gate.submit(this.input.value)) {
        this.close();
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
    this.input.focus();
  }

  close() {
    this.open = false;
    this.box.style.display = 'none';
    this.input.blur();
    this.onClose?.();
  }
}
