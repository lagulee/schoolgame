// 시작 화면 흐름 (단계 0c, STORY 12장·15-3): 경고 문구 → 주인공 이름 입력(필수, 1~8자) → 시작 → 학교 앞 자유 탐색 안내.
// 이름은 textContent 로만 쓰고 localStorage 에만 저장한다 (playerName.js). 첫 시작 뒤에는 이름 칸을 숨겨 이번 판 이름을 고정하고,
// 시작 화면(ESC 로 다시 뜸)은 '계속' 용으로만 쓴다. 안내 문구(story.prelude.hint)는 첫 시작 때 START.hintShow 초 동안 보인다.
import { START } from '../config.js';
import { cleanName, loadName, saveName } from './playerName.js';

const storage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function setupStartFlow({ overlay, touch, hint, onName }) {
  const box = overlay.querySelector('#name-box');
  const input = box.querySelector('input');
  const msg = box.querySelector('.name-msg');
  const startEl = overlay.querySelector('.start');
  const notice = document.getElementById('notice');
  let started = false;
  let noticeTimer = 0;

  input.value = loadName(storage(), START.nameKey);
  input.maxLength = START.nameMax * 2; // 이모지(UTF-16 두 칸)도 8자까지 칠 수 있게. 실제 상한은 cleanName
  // 이름을 치는 동안 게임 키(WASD·E·디버그)로 번지지 않게, 입력 칸을 누를 때 시작되지 않게
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing) overlay.click();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('input', () => (msg.textContent = ''));

  const showHint = () => {
    if (!hint || !notice) return;
    notice.textContent = hint;
    notice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('show'), START.hintShow * 1000);
  };

  return {
    get started() {
      return started;
    },
    // 시작 화면을 눌렀을 때. 이름이 맞으면 true (부르는 쪽이 포인터락·오버레이 숨김), 아니면 이유를 보이고 false
    accept() {
      if (started) return true;
      const r = cleanName(input.value, START.nameMax);
      if (!r.ok) {
        msg.textContent = r.reason;
        input.focus();
        return false;
      }
      started = true;
      input.value = r.name;
      input.blur();
      saveName(storage(), START.nameKey, r.name);
      onName(r.name);
      box.hidden = true;
      startEl.textContent = touch ? '화면을 터치하여 계속' : '클릭하여 계속';
      showHint();
      return true;
    },
  };
}
