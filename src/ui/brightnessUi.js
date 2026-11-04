// 실내 밝기 보정 화면 (단계 20): 시작 화면 카드의 "실내 밝기 − 0 +" 한 줄. 버튼을 눌러도 게임이 시작되지 않게 클릭을 막는다.
// 키보드(- / =)·터치 메뉴 항목은 main.js 가 Brightness 에 바로 연결한다. 글자는 textContent 로만 넣는다.
export function mountBrightness(card, brightness) {
  const row = document.createElement('div');
  row.id = 'bright-box';
  const label = document.createElement('span');
  label.className = 'bright-label';
  label.textContent = '실내 밝기';
  const make = (text, d, aria) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bright-btn';
    b.textContent = text;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      brightness.step(d);
    });
    return b;
  };
  const value = document.createElement('span');
  value.className = 'bright-value';
  value.setAttribute('aria-live', 'polite');
  const note = document.createElement('span');
  note.className = 'bright-note';
  note.textContent = '너무 어두우면 올리세요';
  row.append(label, make('−', -1, '실내 밝기 낮추기'), value, make('+', 1, '실내 밝기 높이기'), note);
  row.addEventListener('click', (e) => e.stopPropagation());
  const anchor = card.querySelector('.start');
  card.insertBefore(row, anchor);
  const sync = () => (value.textContent = brightness.label);
  sync();
  return { sync, el: row };
}
