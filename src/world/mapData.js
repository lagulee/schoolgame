// 맵 데이터 로더 (단계 10 = 옛 1d, three 없음): data/map.json 으로 (x, z, 층) → 위치 이름, 잠긴 문 소리, 사건 장소 참조를 푼다.
// 핸드폰 위치 표시(phone/setup.js)와 문 잠김 소리(interior/doors.js·connectorView.js·index.js)가 쓴다. 판정 순서는 interior/site.js 의
// locate 와 같다: 연결통로 → 구관 → 신관, 실내가 아니면 1층(바깥)에서만 바깥 구역. JSON 은 부르는 쪽이 넘긴다 (Node 테스트는 fs 로 읽음).
const contains = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const ORDER = ['bridge', 'main', 'annex'];

export class MapData {
  constructor(map) {
    this.map = map;
    this.locks = new Map(map.locks.map((l) => [l.id, l]));
    this.byId = new Map([...map.spaces, ...map.rooms].map((s) => [s.id, s]));
  }

  // (x, z, 층) 이 들어 있는 곳: { building, id, kind, name, level } 또는 null. 계단참(x.5)은 계단에서만
  locate(x, z, level = 0) {
    const L = Math.floor(level + 1e-6);
    const whole = Math.abs(level - Math.round(level)) < 1e-6;
    for (const b of ORDER) {
      for (const s of this.map.spaces) {
        if (s.building !== b || !contains(s.rect, x, z)) continue;
        const [lo, hi] = s.levels;
        if (s.kind === 'stair' ? L >= lo && L <= hi : whole && L >= lo && L <= hi) return { building: b, id: s.id, kind: s.kind, name: s.name, level };
      }
      if (!whole) continue;
      const r = this.map.rooms.find((t) => t.building === b && t.level === L && contains(t.rect, x, z));
      if (r) return { building: b, id: r.id, kind: r.kind, name: r.name, level };
    }
    if (level !== 0) return null;
    const o = this.map.outdoor.find((t) => contains(t.rect, x, z));
    return o ? { building: null, id: o.id, kind: 'outdoor', name: o.name, level } : null;
  }

  // 핸드폰에 보일 위치 이름 (예: "구관 2층 · 교무실", "신관 2층 · 3-7 교실", "연결통로 (3층)", "운동장"). 모르는 곳이면 ''
  label(x, z, level = 0) {
    const at = this.locate(x, z, level);
    if (!at) return '';
    const M = this.map;
    if (!at.building) return fill(M.labels.outdoor, { name: at.name });
    const L = Math.floor(level + 1e-6);
    const floor = fill(M.floor, { n: L + 1 });
    const next = fill(M.floor, { n: L + 2 });
    const building = M.buildings[at.building].name;
    const name = M.roomNames[at.kind] ? fill(M.roomNames[at.kind], { name: at.name }) : at.name;
    if (at.building === 'bridge') return fill(M.labels.bridge, { name: building, floor });
    const landing = Math.abs(level - L - 0.5) < 1e-6;
    return fill(landing ? M.labels.landing : M.labels.inside, { building, floor, next, name });
  }

  // 잠긴 문 소리 (interactions 의 id, 예: 'door:2F-1-1'). 없으면 기본 'rattle'
  lockSound(id) {
    return this.locks.get(id)?.sound ?? 'rattle';
  }

  // 사건 장소 참조 'E@1' (공간 id @ 층) / '2F-staff' (방 id) → { item, level } 또는 null
  resolve(ref) {
    const [id, lv] = ref.split('@');
    const item = this.byId.get(id);
    if (!item) return null;
    const level = lv === undefined ? (item.level ?? item.levels[0]) : Number(lv);
    if (item.levels && (level < item.levels[0] || level > item.levels[1])) return null;
    if (item.level !== undefined && level !== item.level) return null;
    return { item, level };
  }

  // 사건 place 문구 → 참조 목록 (map.json eventPlaces). 없으면 null
  placeRefs(text) {
    return this.map.eventPlaces[text] ?? null;
  }
}
