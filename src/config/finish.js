// 마감 수치 (단계 20, STORY 15장·13-3). src/config.js 가 다시 내보낸다. 매직 넘버 규칙상 config 의 일부다.
// 값은 전부 [가정, 사용자 확인 대기]. 실제 모니터·폰 밝기는 headless 에서 확인할 수 없다.
export const FINISH = {
  // 실내 밝기 보정 (STORY 15-2 "밝기 보정 옵션(실내 기본광 ±)", 접근성). 단계 min ~ max, 기본 def (= 단계 19 까지의 밝기).
  // 한 칸마다 실내 하늘빛·눈 적응 빛(nearSight) × step, 실내 노출 + exposure. 브라우저(localStorage key)에 저장한다
  bright: { min: -2, max: 2, def: 0, key: 'schoolgame.brightness', step: 1.4, exposure: 0.04 },
  // 조명 구역 (STORY 15장 표): 실내 하늘빛·눈 적응 빛 배율. 구관 1층(현관·복도) = 어두움(기준 1), 구관 2층 위(교무실·상층)·신관 복도·계단·연결통로 = 매우 어두움.
  // 신관 2층 야자 교실은 형광등(ANNEX.yaja)이 따로 밝힌다. 구역이 바뀌면 fade 초에 걸쳐 옮겨 간다 (깜빡임 없음)
  zones: { lobby: 1, upper: 0.8, annex: 0.82, bridge: 0.82, fade: 1.5 },
  // 혼자일 때 환경 연출 (STORY 13-3, 구간은 data/story.json 의 alone): 구간에 들어선 뒤 첫 연출까지(초, 범위 안 랜덤)·다음 연출까지 간격(초, 범위 안 랜덤).
  // whisper = 귀 가까운 속삭임 (뒤쪽 dist m, 소리 크기 gain, 길이 len 초), dim = 근처 표시등·눈 적응 빛이 한 번 천천히 to 배율까지 어두워졌다(down 초) 머물고(hold) 돌아온다(up). 초당 3회 미만(한 번 ≈ 0.45 Hz)
  alone: {
    first: [20, 35],
    gap: [60, 120],
    whisper: { gain: 0.3, dist: 0.7, len: [1.2, 1.9] },
    dim: { to: 0.3, down: 0.6, hold: 0.5, up: 1.1 },
  },
};
