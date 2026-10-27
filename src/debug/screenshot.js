// ?shot=1&pos=x,y,z&yaw=°&pitch=°[&lv=층][&light=0|1][&phone=1][&battery=%][&q=low|mid|high][&t=초][&story=E5&line=1][&flags=dutyCompanion][&story=ending&ending=A] 쿼리 모드와 P 키 스크린샷
export function parseShotParams() {
  const q = new URLSearchParams(location.search);
  if (!q.has('shot')) return null;
  const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
  const pos = q.has('pos') ? q.get('pos').split(',').map(Number) : null;
  return {
    pos,
    yaw: num('yaw', 0),
    pitch: num('pitch', 0),
    level: num('lv', 0), // 층 (0 = 1층·바깥, 1 = 2층 …, 0.5 단위 = 계단참). 실내 시점 (단계 8)
    light: q.get('light') === '1', // 핸드폰 라이트
    phone: q.get('phone') === '1', // 핸드폰 화면 열기
    battery: q.has('battery') ? parseFloat(q.get('battery')) : null, // 배터리 % 고정 (저전력 확인용)
    quality: q.get('q') || 'high',
    time: num('t', 12),
    inspect: q.get('inspect') === '1',
    frames: num('frames', 4),
    noShadow: q.get('noshadow') === '1',
    noPost: q.get('nopost') === '1',
    event: q.get('ev'), // lamp | led | figure : 이벤트 상태를 고정해 촬영
    story: q.get('story'), // E1~E15, R1-a~R1-h : 사건 대화창을 띄운 채 촬영. ending 이면 엔딩 상자
    storyLine: num('line', 0), // 그 사건의 몇 번째 줄 (줄 수 이상이면 선택지)
    storyFlags: Object.fromEntries((q.get('flags') ?? '').split(',').filter(Boolean).map((f) => [f, true])), // 예: flags=dutyCompanion → R2 변형 사건
    storyEnding: q.get('ending'), // story=ending 일 때 엔딩 키 (A/B/C)
  };
}

let pending = false;
export function requestScreenshot() {
  pending = true;
}

// 렌더 직후 같은 프레임 안에서 호출해야 drawing buffer 가 유효하다
export function captureIfRequested(canvas) {
  if (!pending) return;
  pending = false;
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `night-school-${stamp}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
