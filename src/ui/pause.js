// 일시정지 (ESC). 게임의 시간은 모두 메인 루프의 dt 로만 흐르므로, 일시정지 = 루프가 step 을 건너뛰고 소리 컨텍스트를 멈추는 것.
// PauseState 는 DOM 없이 상태만 다룬다(단위 테스트용). mountPause 는 화면(안내 창·터치 ⏸ 버튼)을 만든다. 글자는 textContent 로만 넣는다.
export class PauseState {
  // canPause: () => 시작한 뒤에만 true, onPause / onResume: 전환될 때 한 번씩
  constructor({ canPause = () => true, onPause = () => {}, onResume = () => {} } = {}) {
    this.paused = false;
    this.canPause = canPause;
    this.onPause = onPause;
    this.onResume = onResume;
  }

  set(v) {
    v = !!v;
    if (v === this.paused) return this.paused;
    if (v && !this.canPause()) return this.paused;
    this.paused = v;
    (v ? this.onPause : this.onResume)();
    return this.paused;
  }

  toggle() {
    return this.set(!this.paused);
  }
}

export function mountPause({ touch, onResume, onPauseTap }) {
  const box = document.createElement('div');
  box.id = 'pause';
  const card = document.createElement('div');
  card.className = 'pause-card';
  const h = document.createElement('h2');
  h.textContent = '일시정지';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pause-btn';
  btn.textContent = '계속하기';
  const hint = document.createElement('div');
  hint.className = 'pause-hint';
  hint.textContent = touch ? '버튼을 누르면 계속합니다' : 'ESC 또는 화면을 클릭하면 계속합니다';
  card.append(h, btn, hint);
  box.append(card);
  box.addEventListener('click', (e) => { e.stopPropagation(); onResume(); });
  document.body.append(box);

  let pauseBtn = null;
  if (touch) {
    pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.id = 'pause-btn-touch';
    pauseBtn.textContent = '⏸';
    pauseBtn.setAttribute('aria-label', '일시정지');
    pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); onPauseTap(); });
    document.body.append(pauseBtn);
  }
  return {
    show(v) {
      box.classList.toggle('show', v);
      document.body.classList.toggle('paused', v);
      if (v) btn.focus?.({ preventScroll: true });
    },
    hint(text) { hint.textContent = text; },
  };
}
