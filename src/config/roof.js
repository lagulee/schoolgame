// 옥상 수영장·엔딩 D 수치 (단계 21, STORY 16장). src/config.js 가 다시 내보낸다. 매직 넘버 규칙상 config 의 일부다.
// 자리·크기·문구는 data/roof.json. 값은 전부 [가정, 사용자 확인 대기] (확인 질문 2개: 옥상 문·분위기, 간판 연출).
export const ROOF = {
  level: 5, // 옥상 층 (본관 5층 = 4 위). 이 층의 충돌·바닥은 옥상 데크뿐이다
  deckH: 0.9, // 데크 바닥 높이 (지붕 슬래브 위, m). 수영장은 데크 안에 묻힌다
  // 문 → 암전 → 옥상에서 밝아짐 (초). 검은 막은 오르고(out) 머물고(black) 내리는(in) 한 번뿐 (깜빡임 1회 = 초당 3회 미만)
  fade: { out: 1.2, black: 0.8, in: 1.8 },
  // 간판을 "읽었다"고 보는 조건: 반경(data 의 radius) 안에서 시선이 간판 쪽 angle 도 안으로 time 초 (누적)
  read: { time: 1.2, angle: 50 },
  cardDelay: 2.5, // 세 간판을 다 읽은 뒤 엔딩 D 카드까지 (초)
  neonOn: 2.2, // 네온 간판이 처음 서서히 켜지는 시간 (한 번 오르고 그대로, 깜빡임 0)
  fog: 0.55, // 옥상에 있는 동안 안개 밀도 배율 (맑은 밤하늘, 1.5초에 걸쳐)
  fogFade: 1.5,
  fence: { h: 1.1, t: 0.05, post: 2.0, glass: 0.9 }, // 데크 둘레 난간: 높이·두께·기둥 간격·유리판 높이
  penthouse: { h: 2.9 }, // 계단탑 높이 (데크 위)
  pool: {
    depth: 0.75, // 물 높이에서 바닥까지
    water: 0.12, // 데크 아래 물 높이
    coping: 0.45, // 둘레 돌 테 폭 (발소리 tile)
    // 수영장 조명 (청록, 점광원 하나 — 데크·선베드를 비춘다). 옥상에 있을 때만 켠다
    light: { color: 0x2fd8cc, intensity: 16, distance: 18, y: 2.4 }, // y = 데크 위 높이 (물에 비친 점이 번지지 않게 높이)
    glow: 0.55, // 물·바닥 타일 발광 세기
    wave: 0.06, // 물결 무늬 흐르는 속도 (m/s, 천천히 — 밝기 변화 없음)
  },
  // 간판 3종 (STORY 16장 확정: 입간판·네온·풀 바닥 타일). 글자 높이는 m
  sign: {
    stand: { w: 0.9, h: 1.25, legH: 0.12, label: 0.09, name: 0.12, tilt: 0.12 },
    neon: { w: 2.6, h: 1.05, y: 1.3, label: 0.18, name: 0.36, color: '#7ff7ec', label2: '#ff8fd0', light: { color: 0x9ff4ff, intensity: 2.4, distance: 9 } },
    tile: { name: 0.8, sub: 0.5, color: '#e6fdff', label: '#b6efff' }, // 흰 타일로 박은 글자 (바닥이 스스로 빛나 물 너머로 읽힌다)
    font: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "WenQuanYi Zen Hei", sans-serif',
  },
  lounger: { w: 0.7, l: 1.9, h: 0.38 }, // 선베드 (충돌 박스 겸)
  bollard: { r: 0.08, h: 0.55, glow: 1.4 }, // 데크 가장자리 작은 등 (발광만, 광원 없음)
  sound: { water: 0.16, ref: 3 }, // 물소리 음량·거리 (m)
};
