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
  backZ: -28, // 중앙 블록 북쪽 면 (단계 7부터 본관 중정 쪽, SCHOOL.main)
  outerX: 29, // 건물 바깥 x 경계 (날개 폭 14m)
  innerX: 15, // 마당 쪽 날개 면
  wingSouthZ: 8,
  fenceZ: 15,
  gateHalf: 3,
  streetMaxZ: 19,
  piloti: { halfW: 5, h: 4.5, colR: 0.42, colZ: -15.2, depth: 6 }, // depth: 정면에서 유리문까지 (K3, 2026-10-26 사용자 선택: 얕은 입구)
  canopy: { z0: -4, z1: 2, x0: 11, colH: 4.4, colD: 0.7, thick: 0.45 },
  steps: { x0: 12.0, tread: 0.4, rise: 0.15, count: 3, z0: -3, z1: 1 },
  entranceDoor: { inset: 0.3, frame: 0.12, h: 2.4, top: 3.02 }, // 현관 유리문: 계단 끝에서 들어온 폭·은색 틀 두께·문 높이·틀 꼭대기 (문 아래 = 계단 위)
  wave: { x0: 12, x1: 15, z0: -12.9, z1: -4.4, h: 3.1, amp: 0.35, waves: 2.5 },
  bay: 3.2, // 창 모듈 폭
  window: { w: 1.1, h: 1.45, sill: 0.95, inset: 0.06 },
  band: { h: 0.32, out: 0.1 },
};

// 디버그 모드: 비밀번호는 클라이언트 코드에 있어 보안이 아닌 문턱이다 (src/debug/gate.js)
export const DEBUG = {
  password: '3141',
  ghostSpeedScale: 2.5, // 유령 모드 이동 속도 배율 (걷기·달리기 모두)
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
  green: { intensity: 90, distance: 34 }, // 초록 가로등 (단계 7에서 공원과 함께 없어져 지금은 쓰지 않음)
  pilotiGreen: { intensity: 14, distance: 14, y: 2.4, behind: -1.2 }, // 필로티 유리문 앞 초록 번짐 (behind < 0 이면 유리 앞쪽)
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

// 학교 외부 확장 (단계 7 = 옛 1a, STORY 4-0·4-1). 치수 단위 m. 본관 앞부분(ㄷ자, DIM)은 그대로 두고
// 그 뒤에 중정형 뒷부분, 다시 그 뒤에 신관, 오른쪽(+x)에 운동장을 둔다. 세부 치수는 STORY 17장 #23 [가정]
export const SCHOOL = {
  shellWall: 0.35, // 속이 빈 셸 벽 두께 (실내는 단계 8~)
  main: {
    outerX: 27, // 뒷부분 바깥 면 (앞부분 x ±29 보다 2 m 안쪽 → 앞쪽 좌우가 살짝 튀어나온 모양)
    backZ: -62, // 뒷면
    ring: 12, // 중정을 두른 동의 깊이 → 중정 x ±15, z −50~−28 (천장 막힘)
  },
  annex: {
    wallColor: 0xb4b2ab, // 본관(벽돌)과 구분되는 밝은 패널 벽, 달빛에 하얗게 뜨지 않게 낮춤
    x0: -18, x1: 24, z0: -94, z1: -83, // 신관 편복도형: 남쪽 면 = 교실 창, 북쪽 면 = 복도 창
    classes: [[-12, -3], [-3, 6], [6, 15]], // 층당 반 3개 (x 범위), 양끝 x −18~−12·18~24 는 계단
    yaja: { floor: 1, cls: 2 }, // 2층(index 1) 동쪽 끝 반 = 야자 교실 (운동장에서 보임)
  },
  bridge: { x0: 17, x1: 20, floor: 2, h: 3.3, pillarZ: -72.5, pillarR: 0.32, wall: 0.25, sill: 1.0, head: 2.6, bars: [1.2, 1.5], slab: 0.45 }, // 3층(index 2) 본관 뒷면 ↔ 신관 남쪽 면. 바닥 = 실내 3층 바닥(단계 9), h = 바닥~지붕 아래(= 본관 3층 천장), wall = 낮은 벽 두께, sill·head = 띠창 아래·위, bars = 창살 시작·간격, slab = 바닥 슬래브 두께(바깥)
  path: { x0: 15, x1: 33, z0: 8, z1: 15 }, // 마당 → 운동장 옆길 (동쪽 날개 남쪽)
  field: {
    x0: 33, x1: 102, z0: -96, z1: 15, // 이동 가능 범위 (서쪽 x0 에 낮은 울타리, 남쪽은 앞 담장 연장)
    track: { cx: 68, cz: -41, straight: 50, r: 15, w: 5, lanes: 4, line: 0.1 }, // 200 m 트랙 (긴 축 = z)
    goalZ: 33, // 트랙 중심에서 골대까지 (z)
    goal: { w: 5, h: 2.1, d: 1.6 },
    stands: [[-80, -55], [-30, -6]], // 서쪽 스탠드 z 범위 (x0 + 1 부터 깊이 standD)
    standD: 5.2, standSteps: 4, standRise: 0.38,
    podium: { z0: -46, z1: -36, d: 6, h: 1.2, roofH: 4.2 }, // 구령대
    netH: 6, // 동쪽·북쪽 공 막이 그물 높이
    lamps: [[25, 11.6, -Math.PI / 2], [34.2, -33, Math.PI], [34.2, -84, Math.PI]], // 옆길 1 + 스탠드 옆 2 (x, z, 팔 방향). 운동장 가운데는 가로등 없이 어둡게 (STORY 15-3)
  },
  farZ: -230, // 먼 아파트 실루엣 (신관 뒤, 운동장에서 보여 단계 7에서 멀리 옮김)
  farWestX: -150, // 먼 아파트 실루엣 (본관 서쪽, 건물 사이로 보이는 지평선을 가림)
};

// 본관 실내 (단계 8 = 옛 1b, data/mainInterior.json). 층 level 0 = 1층·바깥, 0.5 단위 = 계단참.
// 바닥 높이 = base + level × DIM.floorH, 천장 = 다음 층 바닥 − slab (5층은 지붕 슬래브 아래)
export const INTERIOR = {
  base: 0.45, // 1층 바닥 (현관 계단 3단 위)
  slab: 0.3, // 층 슬래브 두께
  wall: 0.15, // 칸막이 벽 (방은 칸 안쪽, 복도는 빈 공간 쪽으로)
  lining: 0.05, // 외벽 안쪽 마감
  door: { w: 1.0, h: 2.1, leaf: 0.05, time: 0.45, reach: 1.3 }, // 교실 미닫이 문: 폭·높이·두께·여닫는 시간(초)·상호작용 반경(m)
  exitDoor: { w: 1.4, h: 2.2 }, // 잠긴 철문 장식 (plan exit, 단계 8 연결통로 문 → 단계 9 부터 연결문은 ANNEX.connector)
  rail: { h: 1.1, t: 0.08, post: 1.8 }, // 중정 난간: 높이·두께·기둥 간격
  column: 0.45, // 중정 기둥 (정사각형 한 변)
  columnEvery: [7.5, 11], // 중정 기둥 간격 (남북 변, 동서 변)
  stair: { near: 1.5, far: 1.45, divider: 0.1, steps: 12 }, // 계단 앞 층계참 폭, 중간 계단참 폭, 두 줄 칸막이, 한 줄 계단 수 (단 높이 = 층 높이 / 2 / 계단 수)
  wainscot: 1.0, // 벽 아래 걸레받이 띠 높이
  courtyardFloor: 0.3, // 중정 바닥 높이 (1층 복도보다 낮은 화단)
  entrance: { reach: 2.6, time: 0.9, leafT: 0.04 }, // 현관 자동문: 감지 거리(m, 문 가운데 기준)·열림 시간(초)·문짝 두께
  inside: { exposure: 0.55, fade: 3, hemi: 0.3, hemiSky: 0x3a4660, hemiGround: 0x171512, moon: 0.04, lamps: 0.12, red: 0.5 }, // 실내 노출·전환 시간(STORY 15-2)·하늘빛(밝은 색으로 바꿔 윤곽만 보이게)·바깥 광원 배율
  nearSight: { color: 0x8a96ad, intensity: 3.5, distance: 7 }, // 어둠에 익은 눈: 카메라 둘레의 약한 빛 (그림자 없음, 실내에서만). 라이트 없이도 바로 앞 윤곽이 보이게 (STORY 15-2)
  signLight: { pool: 4, exit: { color: 0x3cff8c, intensity: 1.4, distance: 5 }, hydrant: { color: 0xff2a1a, intensity: 0.7, distance: 3 } }, // 유도등·소화전 표시등: 가까운 것부터 pool 개만 점광원
  windowGlow: { depth: 1.6, opacity: 0.07 }, // 창가 바닥의 희미한 달빛 (가산 혼합)
  props: { // 복도 벽 소품 (data/mainInterior.json props): 폭·높이·깊이·바닥에서 높이 (m)
    hydrant: { w: 0.75, h: 1.0, d: 0.2, y: 0.5 }, // 소화전함 + 위쪽 붉은 표시등
    locker: { h: 1.75, d: 0.42, cell: 0.4 },
    board: { h: 1.0, d: 0.03, y: 1.0 },
    extinguisher: { r: 0.085, h: 0.5, out: 0.15 },
    sign: { w: 0.44, h: 0.17, d: 0.06, y: 2.4 }, // 비상구 유도등 (문·계단 입구 위)
  },
  furniture: { // 가구 (interior/furniture.js): 다리 굵기, 의자, 교실 배치(행·간격·앞 여유·옆 여백), 교무실 책상 섬, 현관 신발장, 천장 형광등 기구
    leg: 0.035,
    chair: { seat: 0.44, back: 0.84 },
    lockerD: 0.42,
    classroom: { board: 4.2, boardH: 1.2, rows: 5, pitch: 0.92, front: 2.3, margin: 0.85, desk: { w: 0.62, d: 0.45, h: 0.72 }, lockerH: 1.15 },
    staff: { islands: [1.4, 4.2], runs: [[2.6, 6.2], [7.4, 11.0]] },
    lobby: { shoes: [18.5, 24.5], shoesH: 1.8, shoesD: 0.4, board: [25, 27.5] },
    fixture: { l: 1.25, w: 0.18, h: 0.07, every: 3.2, room: 2.8 },
  },
  showOutside: 32, // 바깥에서 현관까지 이 거리 안이면 1층 실내를 그린다
  doorSight: { level: 0, z: -30 }, // 1층 동쪽 복도 이 z 보다 남쪽·현관 홀에서는 바깥을 그린다 (현관 유리문으로 보임)
};

// 신관 실내·연결통로 (단계 9 = 옛 1c, data/annexInterior.json). 층 높이·벽·교실 문·소품은 INTERIOR 와 같다
export const ANNEX = {
  connector: { w: 1.4, h: 2.2, leaf: 0.05, time: 1.1, reach: 1.4, frame: 0.06 }, // 연결문(여닫이 철문 한 짝, 안쪽(신관 쪽)으로 90° 열림): 폭·높이·두께·여는 시간(초)·상호작용 반경·문틀
  shutter: { h: 2.4, slat: 0.1, box: 0.3 }, // 신관 2층 → 1층 계단을 막은 방화셔터 (STORY 4-1 "계단 아래가 막혀 있음"): 높이·살 간격·위 셔터 상자
  switchboard: { w: 0.6, h: 1.1, d: 0.22, y: 0.9 }, // 배전반 (복도 벽 철함): 폭·높이·깊이·바닥에서 높이
  yaja: { intensity: 7, distance: 10, y: 2.4, levels: [0.5, 1.5] }, // 야자 교실 형광등 빛: 플레이어가 신관 2층(이 층 범위)에 있으면 바깥 YAJA_LIGHT 를 교실 천장 아래로 옮긴다 (광원 수 그대로, 깜빡임 없음)
  book: { w: 0.19, d: 0.26, h: 0.035 }, // 책상 위 책 (가로·세로·두께)
  bag: { w: 0.32, d: 0.16, h: 0.4 }, // 의자에 걸친 가방 (야자 교실)
};

// 신관 2층 야자 교실 창 불빛 (STORY 15장 "유일하게 밝은 곳"). 깜빡이지 않는다
export const YAJA_LIGHT = { color: 0xe6f2ff, emissive: 1.25, leak: 0.3, intensity: 14, distance: 13, out: 1.6 };

// 시각 검증용 시점 (7장)
export const SHOTS = [
  { name: '01_front_overview', pos: [0, 1.6, 12], yaw: 0, pitch: 4 },
  { name: '02_entrance_canopy', pos: [3.5, 1.6, 2.5], yaw: -62, pitch: 6 },
  { name: '03_wave_corridor', pos: [4.5, 1.6, -1], yaw: -50, pitch: 5 },
  { name: '04_piloti_green', pos: [0.5, 1.6, -6], yaw: 0, pitch: 3 },
  { name: '05_look_up', pos: [-3, 1.6, -7], yaw: 12, pitch: 42 },
  { name: '08_field_track', pos: [70, 1.6, 9], yaw: 20, pitch: 6 }, // 단계 7: 공원(필로티 너머)이 없어져 운동장 시점으로 바꿈
  { name: '07_fence_gate', pos: [2, 1.6, 9], yaw: 160, pitch: 2 },
  { name: '06_phone_light_wall', pos: [-12.5, 1.6, -3], yaw: 90, pitch: 8, light: 1 },
  { name: '10_side_path', pos: [6, 1.6, 10.6], yaw: -82, pitch: 4 },
  { name: '11_field_buildings', pos: [62, 1.6, -18], yaw: 58, pitch: 9 },
  { name: '12_annex_yaja', pos: [46, 1.6, -52], yaw: 50, pitch: 8 },
  { name: '13_bridge', pos: [44, 1.6, -71], yaw: 92, pitch: 12 },
  { name: '09_phone_screen', pos: [3.5, 1.6, 2.5], yaw: -62, pitch: 6, light: 1, phone: 1, story: 'E3' },
  // 단계 8: 본관 실내 (lv = 층, 0 = 1층). 실내는 어두워 핸드폰 라이트를 켠다
  { name: '14_entrance_open', pos: [12.6, 1.6, -1], yaw: -90, pitch: 2 },
  { name: '15_lobby_to_door', pos: [24, 1.6, -1], yaw: 90, pitch: 0, light: 1 },
  { name: '16_lobby_lockers', pos: [22, 1.6, 4], yaw: 18, pitch: 2, light: 1 },
  { name: '17_corridor_east', pos: [16.5, 1.6, -20], yaw: 0, pitch: 0, light: 1 },
  { name: '18_atrium_2f', pos: [3.6, 1.6, -52.2], yaw: 160, pitch: -14, lv: 1, light: 1 },
  { name: '19_classroom', pos: [-8.9, 1.6, -54.3], yaw: -68, pitch: -10, light: 1 },
  { name: '20_stairs', pos: [18.7, 1.6, -19], yaw: -90, pitch: 18, light: 1 },
  { name: '21_staff_room', pos: [19.2, 1.6, -37], yaw: -10, pitch: -4, lv: 1, light: 1 },
  { name: '22_duty_room', pos: [19.4, 1.6, -34.4], yaw: -125, pitch: -6, lv: 3, light: 1 },
  // 단계 9: 3층 연결통로·신관 실내 (open: connector = 연결문을 연 채)
  { name: '23_bridge_door', pos: [18.9, 1.6, -55.5], yaw: 0, pitch: 4, lv: 2, light: 1 },
  { name: '24_bridge_inside', pos: [18.5, 1.6, -60.5], yaw: 0, pitch: 0, lv: 2, light: 1, open: 'connector' },
  { name: '25_annex_hall_3f', pos: [21.5, 1.6, -88.6], yaw: 150, pitch: 0, lv: 2, light: 1, open: 'connector' },
  { name: '26_annex_corridor', pos: [16.4, 1.6, -92.6], yaw: 90, pitch: 0, lv: 2, light: 1 },
  { name: '27_annex_yaja', pos: [11, 1.6, -92.9], yaw: -125, pitch: 0, lv: 1 },
  { name: '28_annex_yaja_room', pos: [14.2, 1.6, -89.4], yaw: 110, pitch: -12, lv: 1 },
  { name: '29_annex_stairs', pos: [16.1, 1.6, -91.9], yaw: -90, pitch: -6, lv: 1, light: 1 },
  { name: '30_annex_desk_4f', pos: [3.6, 1.6, -89.5], yaw: 112, pitch: -22, lv: 3, light: 1 },
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
