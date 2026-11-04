// 깜빡임 검사 (단계 20, 광과민성 안전 "초당 3회 미만"): 프레임마다 기록한 화면 신호(0~1, 밝기·막의 짙기)에서
// minAmp 이상 오르거나 내린 한 번을 '변화'로 세고, 반대 방향 변화 두 번 = 깜빡임 한 번으로 본다 (WCAG 2.3.1 의 flash 정의와 같은 방식).
// 반환: 어느 1초 구간에서든 가장 많은 깜빡임 수, 전체 변화 수.
export function flashStats(series, dt, minAmp = 0.1) {
  const moves = []; // 방향이 바뀐 자리 (끝난 변화의 시각)
  let dir = 0;
  let pivot = series[0] ?? 0; // 지금 방향으로 움직이기 시작한 값
  let extreme = pivot;
  let extremeAt = 0;
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (dir >= 0 && v > extreme) {
      extreme = v;
      extremeAt = i;
    } else if (dir <= 0 && v < extreme) {
      extreme = v;
      extremeAt = i;
    }
    const back = dir >= 0 ? extreme - v : v - extreme; // 극값에서 되돌아온 양
    if (dir === 0 && Math.abs(v - pivot) >= minAmp) dir = Math.sign(v - pivot);
    else if (dir !== 0 && back >= minAmp) {
      if (Math.abs(extreme - pivot) >= minAmp) moves.push(extremeAt * dt);
      pivot = extreme;
      dir = -dir;
      extreme = v;
      extremeAt = i;
    }
  }
  if (dir !== 0 && Math.abs(extreme - pivot) >= minAmp) moves.push(extremeAt * dt);
  let worst = 0;
  for (let a = 0, b = 0; b < moves.length; b++) {
    while (moves[b] - moves[a] > 1) a++;
    worst = Math.max(worst, Math.floor((b - a + 1) / 2));
  }
  return { flashesPerSecond: worst, moves: moves.length };
}
