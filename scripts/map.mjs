// data/map.json 의 만들어지는 부분(spaces·rooms·locks)을 실내 평면에서 다시 계산해 쓴다 (단계 10).
// 실내 배치(data/mainInterior.json·annexInterior.json)를 바꾼 뒤 `npm run map` → `npm test` (map.test 가 어긋남을 잡는다).
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSite } from '../src/world/interior/site.js';
import { mapRecords, formatMap } from '../src/world/mapGen.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const map = read('map.json');
const site = buildSite(read('mainInterior.json'), read('annexInterior.json'));
Object.assign(map, mapRecords(site, map.lockSounds));
writeFileSync(new URL('../data/map.json', import.meta.url), formatMap(map));
console.log(`map.json: 공간 ${map.spaces.length}, 방 ${map.rooms.length} (들어갈 수 있는 방 ${map.rooms.filter((r) => r.enterable).length}), 잠긴 문 ${map.locks.length}`);
