// 사건 연출 수치 (src/config.js 가 다시 내보낸다). 매직 넘버 규칙상 config 의 일부다.
// 사건 연출 (단계 12, E2: 추격 C1·숨기 P1). 귀신은 3D 모델 없이 실루엣·소리 (K6 가정, STORY 10-3). 깜빡임 없음
export const SCENE = {
  ghost: { h: 1.95, w: 0.8, opacity: 0.9, color: 0x2c3038 }, // 실루엣 판 크기(m)·불투명도·색(빛 없이 그리는 판이라 완전 검정이면 어둠에 묻혀 안 보인다)
  steps: { near: 0.3, far: 0.8, nearGap: 3, farGap: 20, prep: 0.95, pass: 0.75, gain: 0.55 }, // 발소리 간격(초): 가까울수록 빠름
  threat: { startGap: 9, rangeGap: 7, max: 0.55, pass: 0.3 }, // 화면 가장자리 어둡게: gap 이 startGap 아래로 줄면 rangeGap 동안 0 → max
  breath: { prep: 0.35, pass: 0.8 }, // 숨는 동안 숨소리 크기 (0~1)
  smoke: { size: 1.3, max: 0.55 }, // 그림자가 지나갈 때 문틈으로 번지는 검은 연기 (판 크기 m·최대 불투명도)
  trace: { size: [0.075, 0.009, 0.155], turn: 0.6 }, // 떨어진 핸드폰 크기(m)·돌림
  tutorialShow: 9, // E1 뒤 조작 안내 표시 시간 (초)
  hintShow: 4, // 숨기 안내 한 줄 표시 간격 (초)
  // 단계 13 (E3~E6)
  sighting: { view: 35, range: 45 }, // 원경 귀신이 '보인다'고 볼 시야 반각(도)·거리(m). 줍기 뒤 이 밖으로 고개를 돌리면 흐려진다
  keybox: { size: [0.08, 0.5, 0.4], y: 1.35, wall: 0.2 }, // 교무실 열쇠함 크기(두께·높이·폭 m)·바닥에서 가운데 높이·벽에서 띄움
  bangGain: 0.8, // 아래층 쿵 소리 크기
};
