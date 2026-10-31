// 맵 데이터 만들기 (단계 10 = 옛 1d, three 없음). 실내 평면(interior/site.js 의 buildSite 결과)에서
// data/map.json 의 만들어지는 부분(spaces·rooms·locks)을 계산한다. 손으로 쓰는 부분(buildings·outdoor·lockSounds·eventPlaces 등)은 그대로 둔다.
// scripts/map.mjs 가 이 결과로 map.json 을 다시 쓰고, test/map.test.mjs 가 파일과 이 결과가 같은지(평면과 어긋나지 않는지) 검사한다.
import { pilotiBackZ } from './layout.js';
import { SCHOOL } from '../config.js';

const r2 = (v) => Math.round(v * 100) / 100;
const rect = (r) => r.map(r2);
const pos = (p) => p.map(r2);
const BUILDING = { '': 'main', A: 'annex' };

// 공간(복도·홀·계단·연결통로): 층 범위로 묶는다. 방: 층마다 하나
export function mapRecords(site, lockSounds = {}) {
  const spaces = [];
  const rooms = [];
  const locks = [];
  const sound = (kind) => lockSounds[kind] ?? null;
  for (const P of site.plans) {
    const building = BUILDING[P.g];
    const halls = new Map();
    for (const s of P.spaces) {
      if (!s.hall) {
        rooms.push({ id: s.id, building, level: s.L, kind: s.kind, name: s.name, rect: rect(s.rect), enterable: !!s.enter, key: s.key ?? null });
        continue;
      }
      const h = halls.get(s.id);
      if (h) h.levels[1] = Math.max(h.levels[1], s.L);
      else halls.set(s.id, { id: s.id, building, kind: s.kind, name: s.name, rect: rect(s.rect), levels: [s.L, s.L] });
    }
    spaces.push(...halls.values());
    for (const st of P.stairs) spaces.push({ id: st.id, building, kind: 'stair', name: st.name, rect: rect(st.rect), levels: [0, P.top] });
    for (const d of P.doors) {
      if (!d.locked && !d.key) continue;
      locks.push({ id: `door:${d.id}`, kind: d.kind, building, level: d.L, name: d.name, pos: pos(d.pos), key: d.key, sound: sound(d.kind) });
    }
    for (const st of P.stairs) {
      const b = st.blocks.find((k) => k.kind === 'shutter');
      if (b) locks.push({ id: `shutter:${st.id}`, kind: 'shutter', building, level: b.L, name: `${st.name} 방화셔터`, pos: pos([(b.rect[0] + b.rect[2]) / 2, (b.rect[1] + b.rect[3]) / 2]), key: null, sound: sound('shutter') });
    }
  }
  const B = site.bridge;
  spaces.push({ id: B.id, building: 'bridge', kind: 'passage', name: B.name, rect: rect(B.rect), levels: [B.L, B.L] });
  const D = B.door;
  locks.push({ id: `door:${D.id}`, kind: 'connector', building: 'bridge', level: B.L, name: D.name, pos: pos(D.pos), key: D.key, sound: sound('connector') });
  // 필로티 끝 유리벽 (interior/index.js 의 door:pilotiGlass, 안팎 어디서나 잠김)
  locks.push({ id: 'door:pilotiGlass', kind: 'glass', building: 'main', level: 0, name: '필로티 유리문', pos: pos([0, pilotiBackZ() - SCHOOL.shellWall / 2]), key: null, sound: sound('glass') });
  return { spaces, rooms, locks };
}

// map.json 쓰기 모양: 맨 위 키마다 한 줄씩, 배열·사전은 항목마다 한 줄 (사람이 읽고 고치기 쉽게)
export function formatMap(map) {
  // 한 줄 JSON: 문자열 밖의 , : { } 에만 띄어쓰기 (숫자 배열 [1,2] 은 붙여 씀)
  const one = (v) => {
    const src = JSON.stringify(v);
    let out = '';
    let str = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (str) {
        out += c;
        if (c === '\\') out += src[++i];
        else if (c === '"') str = false;
      } else if (c === '"') {
        str = true;
        out += c;
      } else if (c === ',') out += /[\d]/.test(src[i - 1]) && /[-\d]/.test(src[i + 1]) ? ',' : ', ';
      else if (c === ':') out += ': ';
      else if (c === '{') out += src[i + 1] === '}' ? '{' : '{ ';
      else if (c === '}') out += src[i - 1] === '{' ? '}' : ' }';
      else out += c;
    }
    return out;
  };
  const lines = Object.entries(map).map(([k, v]) => {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return `  "${k}": [\n${v.map((x) => `    ${one(x)}`).join(',\n')}\n  ]`;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 2) {
      return `  "${k}": {\n${Object.entries(v).map(([a, b]) => `    ${JSON.stringify(a)}: ${one(b)}`).join(',\n')}\n  }`;
    }
    return `  "${k}": ${one(v)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}
