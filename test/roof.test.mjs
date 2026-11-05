// 단계 21 옥상 수영장·엔딩 D·크레딧 (STORY 16장): 데이터 자리, 옥상 문 조건(옥상 열쇠 + 구관 4층 이후 + 사건 중 아님),
// 문 → 암전 → 옥상(엔딩 D 기록, 사건 정지) → 간판 3개 읽기 → 엔딩 D 카드, D 는 A·B·C 완주 판정 불변, 크레딧 가명/로컬 덮어쓰기.
// 실제 판: 세 엔딩을 본 뒤 학교 앞에서 시작한 R3 판에서 E11 전에는 'early', E11 뒤에는 열린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RoofScene, rectDistance } from '../src/scene/roof.js';
import { canEnterRoof } from '../src/story/roof.js';
import { StoryRunner } from '../src/story/runner.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { mergeCredits, applyLocal } from '../src/story/names.js';
import { fillText } from '../src/story/text.js';
import { creditLines } from '../src/world/roof/signs.js';
import { ring, addRoofCollision, deckY } from '../src/world/roof/build.js';
import { buildSite } from '../src/world/interior/site.js';
import { Collision } from '../src/player/collision.js';
import { MapData } from '../src/world/mapData.js';
import { ROOF, PLAYER } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI, memoryStorage } from './helpers.mjs';
import { flashStats } from './flicker.mjs';
import { world } from './worldFull.mjs';
import { playE1E2, playE3E6, playE7, playE8E9, playE10E12 } from './routeDrive.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const def = read('roof.json');
const { story, characters } = loadStory();
const { credits } = loadSkeletons();
const DT = 1 / 30;
const inRect = ([x0, z0, x1, z1], x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const DEG = Math.PI / 180;

// 화면 없는 옥상 장면: 러너 + 자리(me) + 상호작용 목록
function rig({ seen = ['A', 'B', 'C'], key = true, after = 'E11' } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  const endings = new EndingsSeen('roof', memoryStorage());
  for (const k of seen) endings.mark(k);
  if (key) runner.flags.set('hasRoofKey', true);
  if (after) runner.registry.done.add(after);
  const me = { x: -18.75, z: -49.1, level: 4, yaw: 0, pitch: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? me.yaw, pitch: p.pitch ?? 0 }),
  };
  const items = new Map();
  const toasts = [];
  let blocked = false;
  let locks = 0;
  const roof = new RoofScene({
    runner, def, cfg: ROOF, pose, where: () => ({ x: me.x, z: me.z, level: me.level }), endings,
    interactions: { add: (it) => items.set(it.id, it) }, toast: (m) => toasts.push(m), blocked: () => blocked, lockSound: () => locks++,
  });
  roof.attach();
  const tick = (sec) => {
    const veil = [];
    for (let t = 0; t < sec - 1e-9; t += DT) {
      roof.update(DT);
      runner.update(DT);
      veil.push(roof.veil);
    }
    return veil;
  };
  // 간판 앞에 서서 간판 쪽을 본다
  const face = (x, z, tx, tz) => Object.assign(me, { x, z, yaw: Math.atan2(-(tx - x), -(tz - z)) });
  return { runner, endings, roof, me, items, toasts, tick, face, setBlocked: (v) => (blocked = v), locks: () => locks };
}

test('roof.json: 옥상 문은 구관 5층 북서쪽 계단(S2) 계단 앞 층계참 벽, 도착·간판·수영장은 데크 안, 크레딧 항목이 있다', () => {
  const site = buildSite(read('mainInterior.json'), read('annexInterior.json'));
  const st = site.main.stairs.find((s) => s.id === def.door.stair);
  assert.equal(def.door.level, st.top, '맨 위층(5층)');
  const [x0, z0, x1] = st.near;
  assert.ok(def.door.pos[0] > x0 && def.door.pos[0] < x1 && Math.abs(def.door.pos[1] - z0) < 1e-6, '층계참 북쪽 벽면');
  assert.ok(inRect(st.near, ...def.door.use), 'E 자리는 층계참 위');
  assert.deepEqual(def.penthouse.rect, st.rect, '계단탑 = S2 계단실 위');
  assert.ok(inRect(def.deck, ...def.arrive.pos) && rectDistance(def.pool, ...def.arrive.pos) > 2);
  const ids = new Set(credits.entries.map((e) => e.id));
  assert.deepEqual(def.signs.map((s) => s.kind).sort(), ['neon', 'stand', 'tile'], 'STORY 16장: 입간판·네온·풀 바닥 타일');
  for (const s of def.signs) {
    assert.ok(ids.has(s.credit), s.id);
    assert.ok(inRect(def.deck, ...s.pos), `${s.id} 데크 안`);
  }
  assert.deepEqual([...new Set(def.signs.map((s) => s.credit))].sort(), [...ids].sort(), '크레딧 항목을 모두 보여 준다');
  assert.equal(def.draft, true, '문구 임시 표시');
  assert.ok('roofPool' in story.objectives && read('nav.json').goals.roofPool.length === 0, '핸드폰 목표 (안내 없음)');
});

test('충돌: 옥상 층에는 데크 바닥(지붕 + deckH)만, 수영장·둘레는 막힘, 발소리 wood/tile, 다른 층에 영향 없음', () => {
  const col = new Collision();
  addRoofCollision(col, def);
  const L = ROOF.level;
  const [ax, az] = def.arrive.pos;
  assert.equal(col.floorHeight(ax, az, L), deckY());
  assert.equal(col.hit(ax, az, PLAYER.radius, L), false, '도착 자리는 비어 있다');
  const [px0, pz0, px1, pz1] = def.pool;
  assert.equal(col.hit((px0 + px1) / 2, (pz0 + pz1) / 2, PLAYER.radius, L), true, '물에는 못 들어간다');
  assert.equal(col.hit(def.deck[2] + 0.1, -50, PLAYER.radius, L), true, '난간 밖으로 못 나간다');
  assert.equal(col.surfaceAt(ax, az, L), 'wood');
  assert.equal(col.surfaceAt(px0 - 0.2, pz0 + 1, L), 'tile');
  assert.equal(col.hit(ax, az, PLAYER.radius, 4), false, '5층에는 없음');
  assert.equal(ring([0, 0, 10, 10], [2, 2, 8, 8]).reduce((a, [x0, z0, x1, z1]) => a + (x1 - x0) * (z1 - z0), 0), 100 - 36, '데크 = 수영장 자리를 뺀 넓이');
  const map = new MapData(read('map.json'));
  assert.equal(map.label(ax, az, L), '구관 옥상 수영장', '핸드폰 위치');
});

test('옥상 문 조건: 옥상 열쇠 없음 → 잠김(소리), 열쇠만 있고 구관 4층 전 → early, 대화·추격·퍼즐·태민 시점 → busy, 모두 맞으면 열린다', () => {
  const a = rig({ key: false });
  a.items.get('roof:roofDoor').onUse();
  assert.deepEqual(a.roof.log, ['locked']);
  assert.equal(a.locks(), 1);
  assert.equal(a.toasts[0], def.messages.locked);
  assert.equal(a.roof.keyNote(), '', '열쇠가 없으면 핸드폰 안내 없음');
  const b = rig({ after: null });
  assert.equal(b.roof.keyNote(), def.messages.keyNote, '열쇠가 있으면 핸드폰 목표 아래 한 줄');
  b.items.get('roof:roofDoor').onUse();
  assert.deepEqual(b.roof.log, ['early']);
  b.runner.registry.done.add('E7');
  assert.equal(b.roof.check().reason, 'early', 'E7 은 아직');
  b.runner.registry.history.push('R1-c');
  assert.equal(b.roof.check().ok, true, 'R1 은 R1-c 부터');
  const c = rig();
  c.setBlocked(true);
  assert.equal(c.roof.check().reason, 'busy', '추격·퍼즐 중');
  c.setBlocked(false);
  c.runner.setPov('mingeon');
  assert.equal(c.roof.check().reason, 'busy', '태민 시점');
  c.runner.setPov('player');
  c.runner.mode = 'line';
  assert.equal(c.roof.check().reason, 'busy', '대화 중');
  c.runner.mode = 'idle';
  assert.equal(c.roof.check().ok, true);
  assert.equal(canEnterRoof(c.runner), true);
});

test('문 → 암전 → 옥상: 조작 정지, 검은 막 한 번(깜빡임 3회 미만), 암전 속에서 옥상으로 옮기며 엔딩 D 기록, 사건 정지, 핸드폰 목표 roofPool', () => {
  const r = rig();
  assert.equal(r.roof.paused, false);
  assert.equal(r.items.get('roof:roofDoor').onUse(), true);
  assert.equal(r.roof.frozen, true);
  assert.equal(r.roof.paused, true, '문을 여는 순간부터 사건 진행 정지');
  const F = ROOF.fade;
  const v1 = r.tick(F.out - DT * 2);
  assert.equal(r.me.level, 4, '아직 5층');
  assert.ok(!r.endings.has('D'));
  const v2 = r.tick(DT * 3);
  assert.equal(r.me.level, ROOF.level, '옥상');
  assert.deepEqual([r.me.x, r.me.z], def.arrive.pos);
  assert.ok(Math.abs(r.me.yaw - def.arrive.yaw * DEG) < 1e-9);
  assert.ok(r.endings.has('D'), 'endingsSeen 에 D');
  assert.equal(r.endings.allMain, true);
  assert.equal(r.runner.objectiveKey(), 'roofPool');
  const v3 = r.tick(F.black + F.in + 0.2);
  assert.equal(r.roof.phase, 'free');
  assert.equal(r.roof.frozen, false);
  assert.equal(r.roof.paused, true, '옥상에 있는 동안 계속 정지');
  const veil = [0, ...v1, ...v2, ...v3];
  assert.equal(Math.max(...veil), 1);
  assert.equal(veil.at(-1), 0);
  assert.ok(flashStats(veil, DT).moves <= 2, '오르고 내림 한 번');
  assert.ok(flashStats(veil, DT).flashesPerSecond < 3);
  assert.equal(r.runner.mode, 'idle', '도착만으로는 카드가 뜨지 않는다');
});

test('간판 3개(입간판·네온·바닥 타일)를 가까이서 보면 엔딩 D 카드, 등 돌리거나 멀면 안 읽힘, 계단탑 문은 카드를 다시 띄운다', () => {
  const r = rig();
  r.roof.open();
  r.tick(ROOF.fade.out + ROOF.fade.black + ROOF.fade.in + 0.1);
  const [sx, sz] = def.signs.find((s) => s.kind === 'stand').pos;
  r.face(sx - 2, sz, sx - 6, sz); // 간판 앞, 등 돌림
  r.tick(2);
  assert.equal(r.roof.done.size, 0, '등 돌리면 안 읽힘');
  r.face(sx + 1.5, sz, sx, sz); // 간판 뒤쪽에서
  r.tick(2);
  assert.equal(r.roof.done.size, 0, '뒷면');
  r.face(sx - 2, sz, sx, sz);
  r.tick(ROOF.read.time + 0.1);
  assert.deepEqual([...r.roof.done], ['stand']);
  const [nx, nz] = def.signs.find((s) => s.kind === 'neon').pos;
  r.face(nx, -49, nx, nz); // 수영장 건너편에서 네온 (11.5 m)
  r.tick(ROOF.read.time + 0.1);
  const [px0, , px1, pz1] = def.pool;
  r.face((px0 + px1) / 2, pz1 + 1, (px0 + px1) / 2, -54.3); // 수영장 가에서 바닥을
  r.tick(ROOF.read.time + 0.1);
  assert.deepEqual([...r.roof.done].sort(), ['neon', 'stand', 'tile']);
  assert.equal(r.runner.mode, 'idle', '바로 뜨지 않고 cardDelay 뒤');
  r.tick(ROOF.cardDelay + 0.1);
  assert.equal(r.runner.mode, 'ending');
  assert.equal(r.runner.ui.shown.speaker, '엔딩 D', '숨겨진 엔딩은 루트 없이 제목만');
  assert.ok(r.runner.ui.shown.text.includes('옥상'));
  r.runner.advance(); // E = 닫고 둘러보기
  assert.equal(r.runner.mode, 'idle');
  r.tick(3);
  assert.equal(r.roof.log.filter((x) => x === 'card').length, 1, '카드는 한 번');
  r.face(...def.penthouse.use, def.penthouse.door[0] - 1, def.penthouse.door[1]);
  assert.equal(r.items.get('roof:back').onUse(), true);
  assert.equal(r.runner.mode, 'ending', '계단탑 문 = 엔딩 D 카드 (처음부터 다시)');
  assert.equal(r.me.level, ROOF.level, '내려가지 않는다');
  r.runner.advance();
  r.me.level = 0; // 디버그로 옥상을 떠나면 보너스 장면 끝
  r.tick(DT);
  assert.equal(r.roof.paused, false);
  assert.notEqual(r.runner.objectiveKey(), 'roofPool');
  assert.ok(r.endings.has('D'), 'D 기록은 남는다');
});

test('엔딩 D 는 A·B·C 완주 판정(allMain·hasRoofKey)에 영향이 없다', () => {
  const e = new EndingsSeen('d', memoryStorage());
  e.mark('D');
  assert.equal(e.allMain, false);
  e.mark('A');
  e.mark('B');
  assert.equal(e.allMain, false, 'A·B·D 로는 안 된다');
  e.mark('C');
  assert.equal(e.allMain, true);
  assert.deepEqual(e.list(), ['D', 'A', 'B', 'C']);
  const only = new EndingsSeen('x', memoryStorage());
  for (const k of ['A', 'B', 'C']) only.mark(k);
  assert.equal(only.allMain, e.allMain, 'D 가 있든 없든 같다');
});

test('크레딧: 저장소판은 가명({id} → characters.json), 로컬 덮어쓰기(credits.local.json·characters.local.json)가 있을 때만 바뀐다', () => {
  const text = (s) => fillText(s, characters);
  const plain = credits.entries.flatMap((e) => creditLines(e, 'stand', text).map((l) => l.text));
  assert.ok(plain.includes(characters.gyuha.name) && plain.includes(characters.mingeon.name), '가명');
  assert.ok(plain.every((t) => !t.includes('{')), '자리표시자가 남지 않는다');
  assert.ok(plain.includes('jinsolentertainment') && plain.includes('진솔엔터테이먼트'), '회사 이름(STORY 16장 철자)');
  const none = applyLocal({ characters, credits }, {});
  assert.deepEqual(none.credits, credits, '로컬 파일이 없으면 그대로');
  const local = applyLocal({ characters, credits }, { characters: { gyuha: { name: '시험이름' } }, credits: { entries: [{ id: 'idea', names: ['다른이름'] }] } });
  const lines = local.credits.entries.flatMap((e) => creditLines(e, 'neon', (s) => fillText(s, local.characters)).map((l) => l.text));
  assert.ok(lines.includes('시험이름') && lines.includes('다른이름') && !lines.includes(characters.mingeon.name));
  assert.deepEqual(mergeCredits(credits, { entries: [{ id: 'developer', names: [''] }] }), credits, '빈 이름은 무시');
});

test('실제 판(세 엔딩을 본 뒤 R3): E1 에서 옥상 열쇠, E9 까지는 옥상 문 early, E11(구관 4층 당직실) 뒤에는 열린다', () => {
  const seen = new EndingsSeen('full', memoryStorage());
  for (const k of ['A', 'B', 'C']) seen.mark(k);
  const w = world({ endings: seen });
  const roofOf = () => new RoofScene({ runner: w.runner, def, cfg: ROOF, pose: { get: () => ({ pos: [0, 0, 0], level: 4, yaw: 0, pitch: 0 }), set() {} }, where: () => ({ x: 0, z: 0, level: 4 }), interactions: { add() {} }, toast() {}, endings: seen });
  playE1E2(w);
  assert.equal(w.runner.flags.get('hasRoofKey'), true, 'E1 옥상 열쇠');
  playE3E6(w);
  playE7(w);
  playE8E9(w);
  assert.equal(roofOf().check().reason, 'early', 'E9 까지');
  playE10E12(w, { follow: false });
  assert.ok(w.runner.registry.history.includes('E11'));
  assert.equal(roofOf().check().ok, true, 'E11 뒤');
  const fresh = world();
  playE1E2(fresh);
  assert.equal(fresh.runner.flags.get('hasRoofKey'), false, '1회차는 열쇠 없음');
});
