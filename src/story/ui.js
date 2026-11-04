// 자막·대화창·선택지 화면 (DOM). 진행 규칙은 runner.js 가 갖고, 여기서는 그리기와 입력 전달만 한다.
// 키보드: E/Enter/Space 넘기기·결정, ↑↓·W/S 이동, 숫자키 바로 선택. 터치·클릭: 대화창 탭으로 넘기기, 선택지 버튼 탭.
// 엔딩 카드(단계 20): E·탭 = 닫고 그 자리에서 둘러보기, Enter·"처음부터 다시" 버튼 = onRestart (story/setup.js 가 새로고침).
import { onTap } from '../ui/tap.js';

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.append(e);
  return e;
}

export class StoryUI {
  // opts: { typeSpeed (초당 글자), timerWarn (초), touch }
  constructor(opts) {
    this.opts = opts;
    this.instant = false; // 촬영 모드: 타자 효과 없이 바로 전체 표시
    this.onAdvance = null; // () => void
    this.onPick = null; // (index) => void
    this.onRestart = null; // () => void  엔딩 카드의 "처음부터 다시" (단계 20)
    this.full = '';
    this.shown = 0;
    this.typing = false;

    this.root = el('div', 'story', document.body);
    this.root.id = 'story';
    this.sub = el('div', 'story-sub', this.root);
    this.dlg = el('div', 'story-dlg', this.root);
    this.name = el('div', 'story-name', this.dlg);
    this.body = el('div', 'story-text', this.dlg);
    this.hint = el('div', 'story-hint', this.dlg);
    this.hintText = opts.touch ? '탭하여 계속 ▶' : 'E 계속 ▶';
    this.hint.textContent = this.hintText;
    this.restart = el('button', 'story-restart', this.dlg);
    this.restart.type = 'button';
    this.restart.textContent = opts.touch ? '처음부터 다시' : '처음부터 다시 (Enter)';
    onTap(this.restart, () => this.onRestart?.());
    this.choice = el('div', 'story-choice', this.root);
    this.prompt = el('div', 'story-prompt', this.choice);
    this.list = el('div', 'story-options', this.choice);
    this.timerBar = el('div', 'story-timer', this.choice);
    this.timerFill = el('div', 'story-timer-fill', this.timerBar);
    this.buttons = [];

    for (const target of [this.dlg, this.sub]) {
      onTap(target, () => this.onAdvance?.());
    }
    this.hide();
  }

  showLine({ style, speaker, text }) {
    this.hideAll();
    this.full = text;
    this.shown = this.instant ? text.length : 0;
    this.typing = !this.instant;
    if (style === 'dialog' || style === 'ending') {
      const ending = style === 'ending';
      this.dlg.classList.toggle('ending', ending);
      this.restart.style.display = ending ? '' : 'none';
      this.hint.textContent = ending ? (this.opts.touch ? '탭하여 닫고 둘러보기 ▶' : 'E 닫고 둘러보기 ▶') : this.hintText;
      this.name.textContent = speaker;
      this.name.style.display = speaker ? '' : 'none';
      this.target = this.body;
      this.dlg.style.display = '';
    } else {
      this.sub.classList.toggle('sms', style === 'sms');
      this.target = this.sub;
      this.subPrefix = style === 'sms' ? (speaker ? `📱 ${speaker}: ` : '📱 ') : ''; // 지금 시점 인물이 보낸 문자는 이름 없이 (단계 19)
      this.sub.style.display = '';
    }
    this.render();
  }

  render() {
    const t = this.full.slice(0, Math.floor(this.shown));
    if (this.target === this.sub) this.sub.textContent = this.subPrefix + t;
    else this.body.textContent = t;
    this.hint.style.visibility = this.typing ? 'hidden' : 'visible';
  }

  isTyping() {
    return this.typing;
  }

  finishTyping() {
    this.shown = this.full.length;
    this.typing = false;
    this.render();
  }

  showChoice({ prompt, options, timeout, selected }) {
    this.hideAll();
    this.prompt.textContent = prompt;
    this.list.replaceChildren();
    this.buttons = options.map((label, i) => {
      const b = el('button', 'story-opt', this.list);
      b.type = 'button';
      el('span', 'story-key', b).textContent = String(i + 1);
      el('span', 'story-label', b).textContent = label;
      onTap(b, () => this.onPick?.(i));
      return b;
    });
    this.timerBar.style.display = timeout ? '' : 'none';
    this.setTimer(1, timeout ?? Infinity);
    this.setSelected(selected);
    this.choice.style.display = '';
  }

  setSelected(i) {
    this.buttons.forEach((b, k) => b.classList.toggle('sel', k === i));
  }

  // frac: 남은 비율 0~1, left: 남은 초
  setTimer(frac, left) {
    this.timerFill.style.transform = `scaleX(${frac})`;
    this.timerBar.classList.toggle('warn', left <= this.opts.timerWarn);
  }

  hideAll() {
    this.sub.style.display = 'none';
    this.dlg.style.display = 'none';
    this.choice.style.display = 'none';
  }

  hide() {
    this.hideAll();
    this.typing = false;
    this.full = '';
  }

  update(dt) {
    if (!this.typing) return;
    this.shown = Math.min(this.full.length, this.shown + dt * this.opts.typeSpeed);
    if (this.shown >= this.full.length) this.typing = false;
    this.render();
  }
}

// 키 입력을 진행기 동작으로 바꾼다. 소비했으면 true (다른 단축키로 넘기지 않음)
export function storyKey(runner, code) {
  if (runner.choosing) {
    if (code === 'ArrowUp' || code === 'KeyW') runner.moveSelection(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') runner.moveSelection(1);
    else if (code === 'KeyE' || code === 'Enter' || code === 'Space') runner.choose();
    else if (/^Digit[1-9]$/.test(code)) runner.choose(Number(code.slice(5)) - 1);
    else return false;
    return true;
  }
  // 엔딩 카드: Enter = 처음부터 다시 (E·Space 는 아래에서 닫기)
  if (runner.mode === 'ending' && code === 'Enter') {
    runner.ui.onRestart?.();
    return true;
  }
  // 행동 줄(추격·숨기) 동안 E 는 문·물건 상호작용으로 넘긴다 (단계 12)
  if (runner.active && runner.mode !== 'action' && (code === 'KeyE' || code === 'Enter' || code === 'Space')) {
    runner.advance();
    return true;
  }
  return false;
}
