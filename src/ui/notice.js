// 화면 위쪽 안내 한 줄 (#notice, 단계 0c·12): 시작 안내·조작 안내. 정해진 시간 뒤 서서히 사라진다 (깜빡임 없음).
let timer = 0;

export function showNotice(text, seconds) {
  const el = document.getElementById('notice');
  if (!el || !text) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
}
