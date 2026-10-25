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
  moon: { intensity: 0.42, shadowRange: 30, shadowRes: 1024, offset: [22, 42, 30] },
  hemi: 0.2,
  lamp: { intensity: 26, distance: 18, decay: 2 },
  entrance: { intensity: 5, distance: 9 },
  green: { intensity: 22, distance: 22 },
  led: { intensity: 4.5, distance: 9 },
  flashlight: { intensity: 38, angle: Math.PI / 7, penumbra: 0.5, decay: 2, distance: 25, shadowRes: 1024,
    offset: [0.22, -0.24, -0.15], lag: 9 },
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
  { name: '06_flashlight_wall', pos: [-12.5, 1.6, -3], yaw: 90, pitch: 8, flash: 1 },
];
