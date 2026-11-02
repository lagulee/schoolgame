// 옥상 문 접근 조건 준비 (단계 15, STORY 16장·17장 #17 [가정]): 구관 4층에 올라온 뒤(R3·R2 는 E11, R1 은 R1-c 시작) 옥상으로 갈 수 있다.
// 앞선 사건(E2, E4 등)을 건너뛰어 스토리가 꼬이는 것을 막기 위함이다. 옥상 문·수영장·엔딩 D 는 단계 21 에서 이 조건을 쓴다.
export const ROOF_AFTER = ['E11', 'R1-c'];

// 구관 4층에 올라온 뒤인가 (사건을 시작했거나 jump 로 지나간 판)
export function roofReachable(registry) {
  return ROOF_AFTER.some((id) => registry.history.includes(id) || registry.done.has(id));
}

// 옥상 문을 열 수 있는가: 옥상 열쇠(엔딩 A·B·C 를 모두 본 뒤 시작한 판) + 4층에 올라온 뒤
export function canEnterRoof(runner) {
  return runner.flags.get('hasRoofKey') && roofReachable(runner.registry);
}
