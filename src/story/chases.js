// 추격 데이터(data/chases.json) 검사. 귀신 속도는 걷기 < ghostSpeed < 달리기 범위만 허용한다 (STORY 14-1).
// 실행기(gap 모델 진행)는 src/chase/chase.js. 여기서는 값의 형식과 범위만 본다.

const NUMBER_FIELDS = ['ghostSpeed', 'startGap', 'pathLength', 'companionKillDelay', 'unlockTime'];
export const CHASE_FIELDS = [...NUMBER_FIELDS, 'delays'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// 오류 문구 목록 (비면 정상). speeds: { walk, run } (src/config.js PLAYER)
// 값이 아직 정해지지 않은 필드는 chase.undecided 에 이름을 적고 null 로 둘 수 있다.
export function chaseErrors(chase, { walk, run }) {
  const err = [];
  const open = new Set(chase.undecided ?? []);
  for (const f of open) if (!CHASE_FIELDS.includes(f)) err.push(`${chase.id}: undecided 에 모르는 필드 ${f}`);
  for (const f of chase.assumed ?? []) if (!CHASE_FIELDS.includes(f) || open.has(f)) err.push(`${chase.id}: assumed 필드 ${f}`);
  for (const f of NUMBER_FIELDS) {
    const v = chase[f];
    if (v === null && open.has(f) && f !== 'ghostSpeed') continue;
    if (!isNum(v)) err.push(`${chase.id}: ${f} 숫자 아님`);
    else if (v < 0) err.push(`${chase.id}: ${f} 음수`);
  }
  if (isNum(chase.ghostSpeed) && !(chase.ghostSpeed > walk && chase.ghostSpeed < run)) {
    err.push(`${chase.id}: ghostSpeed ${chase.ghostSpeed} 가 걷기 ${walk} < 속도 < 달리기 ${run} 범위 밖`);
  }
  if (!Array.isArray(chase.delays)) err.push(`${chase.id}: delays 배열 아님`);
  else {
    for (const d of chase.delays) {
      if (!isNum(d?.at) || !isNum(d?.seconds) || d.at < 0 || d.seconds <= 0) err.push(`${chase.id}: delays 항목 ${JSON.stringify(d)}`);
      else if (isNum(chase.pathLength) && d.at > chase.pathLength) err.push(`${chase.id}: delays.at ${d.at} 가 경로 밖`);
    }
  }
  if (chase.triggerBeforeExit !== undefined) {
    const t = chase.triggerBeforeExit;
    if (!chase.final) err.push(`${chase.id}: triggerBeforeExit 는 마지막 추격만`);
    if (!isNum(t) || t <= 0 || (isNum(chase.pathLength) && t >= chase.pathLength)) err.push(`${chase.id}: triggerBeforeExit ${t}`);
  }
  return err;
}

// 잘못된 값이 있으면 던진다 (시작할 때 바로 드러나게)
export function loadChases(data, speeds) {
  const errors = data.chases.flatMap((c) => chaseErrors(c, speeds));
  if (errors.length) throw new Error(`chases.json 오류\n${errors.join('\n')}`);
  return data.chases;
}

// 출구 통과 조건 (STORY 14-4): 도착 시 gap ≥ ghostSpeed × unlockTime + 잡힘 거리
export function exitMinGap(chase, catchDistance) {
  return chase.ghostSpeed * chase.unlockTime + catchDistance;
}
