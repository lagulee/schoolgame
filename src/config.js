// 모든 매직 넘버는 이곳에 모은다. 좌표: +x 오른쪽, +y 위, -z 북쪽(건물 방향).

export const SCHOOL_NAME = 'OO중학교';

export const PALETTE = {
  brick: 0xc8a27c,
  mortar: 0x8d8478,
  redBand: 0xc26a55,
  bluePanel: 0x5e7fa6,
  yellow: 0xe8c93b,
  orange: 0xd8602f,
  frame: 0xe9ecef,
  canopy: 0x8b6b7a,
  granite: 0x8e8e8c,
  silver: 0xb9bec4,
  iron: 0x15171a,
  teal: 0x2f8f8a,
  lampWarm: 0xffd9a0,
  litWindow: 0xcfe8ff,
  parkGreen: 0x9be05a,
  led: 0xff2a14,
  moon: 0x6c7fa8,
  hemiSky: 0x1a2238,
  hemiGround: 0x0b0a0c,
  fog: 0x0b1018,
  entranceLight: 0xbfdcff,
  exitSign: 0x2fe07a,
};

// 창문 밝기: 달빛에 하얗게 뜨던 창틀·창살을 낮은 회색조로, 불 켜진 창은 하얗게 날아가지 않게
export const WINDOW_LOOK = {
  frameColor: 0x8d9195, // 외벽 창틀 (기존 0xe9ecef)
  mullion: '#8e949a', // 유리 안쪽 창살
  litEmissive: 0.55, // 불 켜진 창 발광 세기 (기존 1.5)
  litTop: '#c9dff0',
  litBottom: '#7f9fbd',
  glassEnv: 0.8, // 유리 환경 반사 (기존 1.6)
  sill: 0x8f8b84,
};

export const DIM = {
  floorH: 3.6,
  floors: 5,
  parapet: 0.6,
  frontZ: -14, // 중앙 블록 남쪽 면
  backZ: -28, // 중앙 블록 북쪽 면 (공원 쪽)
  outerX: 29, // 건물 바깥 x 경계 (날개 폭 14m)
  innerX: 15, // 마당 쪽 날개 면
  wingSouthZ: 8,
  fenceZ: 15,
  gateHalf: 3,
  streetMaxZ: 19,
  park: { minX: -20, maxX: 20, minZ: -46 },
  piloti: { halfW: 5, h: 4.5, colR: 0.42, colZ: -15.2 },
  canopy: { z0: -4, z1: 2, x0: 11, colH: 4.4, colD: 0.7, thick: 0.45 },
  steps: { x0: 12.0, tread: 0.4, rise: 0.15, count: 3, z0: -3, z1: 1 },
  wave: { x0: 12, x1: 15, z0: -12.9, z1: -4.4, h: 3.1, amp: 0.35, waves: 2.5 },
  bay: 3.2, // 창 모듈 폭
  window: { w: 1.1, h: 1.45, sill: 0.95, inset: 0.06 },
  band: { h: 0.32, out: 0.1 },
};

export const PLAYER = {
  start: [0, 1.6, 12],
  eye: 1.6,
  radius: 0.3,
  walk: 1.6,
  run: 3.6,
  accel: 8, // lerp 계수 (1/s)
  fov: 70,
  touchLook: 0.0045, // 터치 드래그 감도 (rad/px)
  runFovAdd: 6,
  bob: {
    walk: { amp: 0.025, freq: 1.8 },
    run: { amp: 0.045, freq: 2.6 },
    breath: 0.004,
    breathFreq: 0.25,
    levels: [1, 0.4, 0], // H 키 순환
  },
};

export const LIGHTS = {
  exposure: 0.9,
  moon: { intensity: 0.95, shadowRange: 30, shadowRes: 1024, offset: [22, 42, 30] },
  hemi: 0.26,
  lamp: { intensity: 26, distance: 18, decay: 2 },
  entrance: { intensity: 5, distance: 9 },
  green: { intensity: 90, distance: 34 },
  led: { intensity: 8, distance: 11 },
  envIntensity: 0.2,
  inspectBoost: 6, // 점검 모드 hemi 배율
};

export const FOG = { density: 0.02, min: 0.015, max: 0.04, step: 0.0025 };

export const POST = {
  bloom: { strength: 0.6, radius: 0.5, threshold: 0.85 },
  vignette: 0.35,
  grain: 0.04,
  aberration: 0.0015,
};

export const QUALITY = {
  low: { pixelRatio: 1.0, shadows: false, post: false, bloom: false, grade: false, fx: 0 },
  mid: { pixelRatio: 1.25, shadows: true, post: true, bloom: true, grade: false, fx: 1 },
  high: { pixelRatio: 1.5, shadows: true, post: true, bloom: true, grade: true, fx: 2 },
};

export const EVENTS = {
  lampCooldown: 90,
  ledCooldown: 120,
  figureCooldown: 180,
  autoInterval: [35, 60], // 자동 이벤트 시도 간격(초)
  flickerMinState: 0.36, // 깜빡임 상태 최소 유지 시간 → 초당 3회 미만 보장
  lampOff: 5,
  ledGlitch: 1.5,
  figureSeen: 3,
  silenceEvery: [80, 140],
  silenceLength: 12,
  doorEvery: [55, 110],
  metalEvery: [18, 40],
};

export const AUDIO = {
  master: 0.8,
  wind: 0.22,
  hum: 0.018,
  city: 0.05,
  stepWalk: 0.28,
  stepRun: 0.46,
};

// 불 켜진 창 (facade id, 층 index 0~4, 창 index). 3층 창(index 2)은 실루엣 이벤트 위치.
export const LIT_WINDOWS = [
  { facade: 'front', floor: 2, index: 4 },
  { facade: 'front', floor: 4, index: 14 },
  { facade: 'west', floor: 1, index: 6 },
  { facade: 'east', floor: 3, index: 3 },
];
export const FIGURE_WINDOW = 0; // LIT_WINDOWS 중 실루엣이 설 창

// 시각 검증용 시점 (7장)
export const SHOTS = [
  { name: '01_front_overview', pos: [0, 1.6, 12], yaw: 0, pitch: 4 },
  { name: '02_entrance_canopy', pos: [3.5, 1.6, 2.5], yaw: -62, pitch: 6 },
  { name: '03_wave_corridor', pos: [4.5, 1.6, -1], yaw: -50, pitch: 5 },
  { name: '04_piloti_green', pos: [0.5, 1.6, -6], yaw: 0, pitch: 3 },
  { name: '05_look_up', pos: [-3, 1.6, -7], yaw: 12, pitch: 42 },
  { name: '08_park_trees', pos: [1, 1.6, -29.5], yaw: -22, pitch: 12 },
  { name: '07_fence_gate', pos: [2, 1.6, 9], yaw: 160, pitch: 2 },
  { name: '06_phone_light_wall', pos: [-12.5, 1.6, -3], yaw: 90, pitch: 8, light: 1 },
  { name: '09_phone_screen', pos: [3.5, 1.6, 2.5], yaw: -62, pitch: 6, light: 1, phone: 1, story: 'E3' },
];

// 핸드폰 (STORY 8장). 배터리 단위는 %. 단계 0b-1(단계 3)에서 손전등을 대체했다
export const PHONE = {
  PHONE_START_MIN: 86, // 판 시작 배터리 (정수 랜덤, BEGIN_EVENT 시작 때 확정)
  PHONE_START_MAX: 92,
  BEGIN_EVENT: 'E1',
  CHECK_COST: 2, // 화면을 열 때마다 (열려 있는 동안은 추가 소모 없음)
  LIGHT_COST_PER_SEC: 1 / 20, // 라이트 20초당 −1%
  BANK_GAIN: 15, // 보조배터리 1개
  BATTERY_MAX: 100,
  MINGEON_START: 55, // 태민 시점(pov mingeon)의 핸드폰
  WARN_LEVELS: [20, 10], // 이 값에 처음 닿을 때 한 번씩 알림
  LOW_LEVEL: 10, // 이하이면 라이트가 더 어둡고 가끔 흐려짐
  WARN_SHOW: 3, // 경고 알림 표시 시간 (초)
  DEBUG_BANK_AHEAD: 1.0, // U 키(디버그) 보조배터리를 놓는 거리 (플레이어 앞, m)
  // 라이트: 이전 손전등(π/7, 거리 25, 세기 26)보다 약하게
  LIGHT: {
    intensity: 15.6, // 이전 손전등의 60%
    angle: Math.PI / 6,
    penumbra: 0.7,
    decay: 2,
    distance: 11,
    shadowRes: 1024,
    offset: [0.18, -0.22, -0.2], // 카메라 기준 (손에 든 위치)
    lag: 9,
    lowDim: 0.6, // 배터리 LOW_LEVEL 이하 밝기 배율
    flicker: { every: [2.5, 6], length: 0.4, dip: 0.5 }, // 저전력 흐려짐: 간격(초)·길이(초, 0.36 이상 → 초당 3회 미만)·밝기 배율
  },
};

// 스토리 엔진 (src/story/). 대사·분기는 data/*.json, 여기에는 시간·크기만 둔다.
// 추격 gap 모델 (STORY 14-3·14-4, 단계 0b-3 src/chase/). 추격별 값(귀신 속도·경로·지연)은 data/chases.json
export const CHASE = {
  catchDistance: 1.5, // gap 이 이 이하면 잡힘 (m)
  ghostSpeedDefault: 3.2, // chases.json 에 값이 없을 때의 귀신 속도 (m/s)
  startGapDefault: 20, // 일반 추격 시작 gap (m)
  retryGapStep: 2, // 잡혀서 다시 할 때마다 시작 gap 에 더하는 값 (m)
  retryGapMax: 8, // 그 합의 상한 (m)
  // 자동 시뮬레이션 (src/chase/sim.js, test/chase.test.mjs). 플레이 유형은 STORY 14-4 검증 계산의 정의
  SIM: {
    dt: 1 / 60,
    maxTime: 120, // 이 시간 안에 끝나지 않으면 timeout (s)
    profiles: {
      walkOnly: { kind: 'walk' }, // 걷기만
      walkish: { kind: 'burst', runFor: 3 }, // 걷기 위주: 3초 달린 뒤 걷기
      normal: { kind: 'pace', runFor: 6, pace: 2.0, band: 1.5 }, // 평범: 6초 달린 뒤 평균 2.0 m/s (뒤처지면 달림, ±band m)
      optimal: { kind: 'sprint', runFor: 7.5 }, // 최적: 7.5초 달린 뒤 걷다가 남은 스태미나로 끝까지 질주 (평균 약 2.25 m/s)
    },
  },
};

// 퍼즐 실행기 (단계 0b-4 src/puzzle/). 퍼즐별 값(단서·정답·연출 훅)은 data/puzzles.json
export const PUZZLE = {
  wrongLimit: 3, // puzzles.json 에 wrongLimit 이 없을 때의 틀린 시도 한도 (STORY 9장 P4: 3번 틀리면 잡힌다)
  debugId: 'T0', // 디버그 키(I·O·Z·X)로 도는 시험 퍼즐 (data/puzzles.json debugPuzzles)
  debugWrongInput: 0, // 디버그 오답 입력값 (시험 퍼즐 정답과 다르게)
};

export const STORY = {
  typeSpeed: 38, // 대화창 타자 효과 (초당 글자 수)
  subtitleBase: 1.8, // 자막·문자 자동 넘김 시간 = base + 글자 수 × perChar (초)
  subtitlePerChar: 0.07,
  timerWarn: 3, // 선택지 남은 시간이 이 이하(초)면 타이머 막대를 붉게
  interactRadius: 1.6, // E 상호작용 기본 반경 (m)
  hudLog: 4, // HUD 에 보이는 최근 스토리 기록 수
  endingsKey: 'schoolgame.endingsSeen', // 본 엔딩 기록 localStorage 키 (2회차 안내 조건)
  debugBook: 'dohyeonBook', // J 키(디버그)로 실행하는 상호작용 사건 — 맵 배치 전 earlyBook 확인용
};

// 스태미나 (STORY 14-2, 단계 0b-2). 값은 STORY 의 [제안] 그대로
export const STAMINA = {
  MAX: 100,
  RUN_COST: 12.5, // 달리는 동안 초당 소모 (가득 → 0 약 8초)
  RECOVER_DELAY: 1, // 달리기를 멈추고 이 시간(초)이 지나야 회복 시작
  RECOVER_WALK: 6, // 걷는 중 초당 회복
  RECOVER_STILL: 12, // 멈춰 있을 때
  RECOVER_HIDDEN: 15, // 숨는 중
  EXHAUST_CLEAR: 30, // 0 이 되면 탈진, 이 값 이상 회복해야 해제 (짧게 달렸다 멈추는 꼼수 방지)
  EXHAUSTED_SPEED: 1.3, // 탈진 중 이동 속도 (m/s, 걷기 1.6 의 약 80%)
  PHONE_MOVE_SCALE: 0.7, // 핸드폰 화면이 열려 있는 동안 이동 배율 (달리기 불가)
  STILL_SPEED: 0.3, // 실제 속도가 이 아래면 '멈춤' 회복으로 본다 (m/s)
  LOW: 0.3, // 막대가 붉어지는 비율 (30% 이하)
  BAR_HIDE_DELAY: 0.8, // 가득 찬 뒤 막대를 숨기기까지 (초)
  TIRED_EASE: 1.5, // 탈진 효과(숨소리·흔들림) 켜짐/꺼짐 속도 (1/s)
  SHAKE: { amp: 0.012, freq: [1.3, 2.1] }, // 탈진 화면 흔들림: 진폭(m)·느린 사인 두 개(Hz) — 밝기 변화 없는 위치 흔들림
  BREATH: { volume: 0.22, rate: 1.1 }, // 헐떡이는 숨소리: 음량·초당 호흡 수
};
