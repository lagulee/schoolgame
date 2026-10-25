// ?shot=1&pos=x,y,z&yaw=°&pitch=°[&flash=0|1][&q=low|mid|high][&t=초] 쿼리 모드와 P 키 스크린샷
export function parseShotParams() {
  const q = new URLSearchParams(location.search);
  if (!q.has('shot')) return null;
  const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
  const pos = q.has('pos') ? q.get('pos').split(',').map(Number) : null;
  return {
    pos,
    yaw: num('yaw', 0),
    pitch: num('pitch', 0),
    flash: q.get('flash') === '1',
    quality: q.get('q') || 'high',
    time: num('t', 12),
    inspect: q.get('inspect') === '1',
    frames: num('frames', 4),
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
