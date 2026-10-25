// 터치 조작: 왼쪽 아래 가상 조이스틱(이동, 끝까지 밀면 달리기), 화면 드래그(시점),
// 손전등 버튼 상시 노출, 나머지 기능은 접이식 메뉴. 키보드·마우스와 같은 actions 를 호출한다.

// 주 입력이 손가락(pointer: coarse)이면 터치 기기. ?touch=1 / ?touch=0 으로 강제할 수 있다 (테스트용).
export function isTouchDevice() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return matchMedia('(pointer: coarse)').matches;
}

const DEAD = 0.12;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// menuItems: [{ label, run }] — run 은 버튼을 누를 때 호출. 라벨은 문자열 또는 () => 문자열
export function setupTouch({ player, flashlight, menuItems }) {
  document.body.classList.add('touch');
  const root = el('div');
  root.id = 'touch';
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // 시점: 화면 전체 드래그 (이동 영역과 버튼이 위에 얹혀 먼저 입력을 받는다)
  const look = el('div', 'tz-look');
  let lookId = null;
  let lx = 0;
  let ly = 0;
  look.addEventListener('pointerdown', (e) => {
    if (lookId !== null) return;
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    player.look(e.clientX - lx, e.clientY - ly);
    lx = e.clientX;
    ly = e.clientY;
  });
  const endLook = (e) => {
    if (e.pointerId === lookId) lookId = null;
  };
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);

  // 이동: 고정 위치 조이스틱
  const zone = el('div', 'tz-move');
  const base = el('div', 'joy-base');
  const knob = el('div', 'joy-knob');
  base.append(knob);
  zone.append(base);
  let moveId = null;
  const setStick = (e) => {
    const r = base.getBoundingClientRect();
    const R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R;
    let dy = (e.clientY - (r.top + R)) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    knob.style.transform = `translate(${dx * R * 0.62}px, ${dy * R * 0.62}px)`;
    const mag = Math.min(1, m);
    player.analog = mag < DEAD ? null : { x: dx, y: -dy };
    base.classList.toggle('run', mag > 0.96);
  };
  const endStick = (e) => {
    if (e.pointerId !== moveId) return;
    moveId = null;
    player.analog = null;
    knob.style.transform = '';
    base.classList.remove('run');
  };
  zone.addEventListener('pointerdown', (e) => {
    if (moveId !== null) return;
    moveId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    setStick(e);
  });
  zone.addEventListener('pointermove', (e) => e.pointerId === moveId && setStick(e));
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  // 손전등 (상시)
  const flash = el('button', 'tbtn flash', '🔦');
  flash.setAttribute('aria-label', '손전등');
  const syncFlash = () => flash.classList.toggle('on', flashlight.on);
  flash.addEventListener('click', () => {
    menuItems.find((m) => m.id === 'flash').run();
    syncFlash();
  });
  syncFlash();

  // 접이식 메뉴
  const toggle = el('button', 'tbtn menu-toggle', '☰');
  toggle.setAttribute('aria-label', '메뉴');
  const panel = el('div', 'menu-panel');
  const entries = [];
  const refresh = () => entries.forEach(({ b, item }) => (b.textContent = typeof item.label === 'function' ? item.label() : item.label));
  for (const item of menuItems) {
    if (item.id === 'flash') continue;
    const b = el('button', 'mbtn');
    b.addEventListener('click', () => {
      item.run();
      refresh();
    });
    entries.push({ b, item });
    panel.append(b);
  }
  refresh();
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.classList.toggle('on', open);
    toggle.textContent = open ? '✕' : '☰';
    refresh();
  });

  root.append(look, zone, flash, toggle, panel);
  document.body.append(root);

  // 화면을 떠나거나 가려지면 입력이 남지 않게 정리
  const reset = () => {
    moveId = lookId = null;
    player.analog = null;
    knob.style.transform = '';
  };
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => document.hidden && reset());

  return { syncFlash };
}

// 첫 터치(시작): 전체화면 + 가로 고정을 시도한다. iPhone 등 미지원 환경은 조용히 무시.
export async function enterImmersive() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch { /* 미지원 */ }
  try {
    await screen.orientation.lock('landscape');
  } catch { /* 미지원 */ }
}
