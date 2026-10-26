// 사건 데이터에서 추격 조합(chase · finale.atExit)을 뽑는다. JSON import 없음 → Node 테스트에서 그대로 쓴다.
// 디버그 순환 목록: 사건의 chase·finale.atExit 조합 (C1, C2, C4/R3 collapse, C4/R2 playerCaught, C3/R1 escape …)
export function chaseVariants(events) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    if (!e.chase) continue;
    const atExit = e.finale?.atExit ?? null;
    const k = `${e.chase}:${atExit}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: e.chase, atExit, label: `${e.chase} (${e.id}${e.routes ? ` ${e.routes.join('·')}` : ''})` });
  }
  return out;
}
