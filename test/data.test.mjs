// 데이터 정합성: 사건 ID·순서, 플래그, 이름 자리표시자, objective·puzzle·chase·undecided 참조, 뼈대 파일과의 양방향 연결
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeholderIds } from '../src/story/text.js';
import { FLAG_NAMES } from '../src/story/flags.js';
import { POVS } from '../src/story/runner.js';
import { loadStory, loadSkeletons } from './helpers.mjs';

const { story, characters } = loadStory();
const { puzzles, chases, powerbanks } = loadSkeletons();
const ids = story.events.map((e) => e.id);
const uniq = [...new Set(ids)];
const ROUTES = ['R1', 'R2', 'R3'];
const R1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `R1-${x}`);

test('사건 ID: E1~E15 와 R1-a~R1-h 만, 진행 순서대로', () => {
  for (const id of uniq) assert.match(id, /^(E([1-9]|1[0-5])|R1-[a-h])$/, id);
  const es = uniq.filter((id) => id.startsWith('E'));
  assert.deepEqual(es, Array.from({ length: 15 }, (_, i) => `E${i + 1}`));
  assert.deepEqual(uniq.filter((id) => id.startsWith('R1-')), R1);
  // R1-a·b 는 E7 바로 뒤(E8 자리), R1-c~h 는 공통 구간 뒤
  assert.equal(uniq.indexOf('R1-a'), uniq.indexOf('E7') + 1);
  for (const ev of story.events.filter((e) => e.id.startsWith('R1-'))) assert.deepEqual(ev.routes, ['R1'], ev.id);
});

test('같은 ID 는 루트별 변형만 (E13·E14), 루트가 겹치지 않는다', () => {
  const dup = uniq.filter((id) => ids.filter((x) => x === id).length > 1);
  assert.deepEqual(dup.sort(), ['E13', 'E14']);
  for (const id of dup) {
    const routes = story.events.filter((e) => e.id === id).flatMap((e) => e.routes);
    assert.equal(new Set(routes).size, routes.length, `${id} 루트 겹침`);
    assert.deepEqual([...routes].sort(), ['R2', 'R3'], id);
  }
});

test('필드 형식: 루트·시점·플래그·화자·선택지', () => {
  for (const ev of [...story.events, ...story.interactions]) {
    const where = ev.id;
    for (const r of ev.routes ?? []) assert.ok(ROUTES.includes(r), `${where} 루트 ${r}`);
    if (ev.pov) assert.ok(POVS.includes(ev.pov), `${where} pov`);
    for (const k of Object.keys(ev.set ?? {})) assert.ok(FLAG_NAMES.includes(k), `${where} set ${k}`);
    if (ev.skipIf) assert.ok(FLAG_NAMES.includes(ev.skipIf));
    for (const l of ev.lines) {
      if (l.who) assert.ok(characters[l.who], `${where} 화자 ${l.who}`);
      if (ev.pov === 'mingeon') assert.notEqual(l.who, 'player', `${where}: 태민 시점에 주인공 대사`);
    }
    if (ev.choice) {
      assert.ok(ev.choice.options.some((o) => o.id === ev.choice.default), `${where} 기본값`);
      for (const o of ev.choice.options) for (const k of Object.keys(o.set ?? {})) assert.ok(FLAG_NAMES.includes(k));
    }
  }
  assert.deepEqual(Object.keys(story.flags).sort(), [...FLAG_NAMES].sort());
  for (const ev of story.events) assert.ok(ev.pov && ev.objective, `${ev.id} pov·objective 필수`);
});

test('v3 확정 사항: E1 문자·E5 선택지 없음, earlyBook 은 상호작용으로, hasExitKey 위치', () => {
  const ev = (id, route) => story.events.find((e) => e.id === id && (!route || e.routes.includes(route)));
  assert.ok(!ev('E1').lines.some((l) => l.style === 'sms'), 'E1 의 {dohyeon} 책 문자 삭제');
  assert.ok(!ev('E5').choice, 'E5 선택지 삭제');
  assert.equal(story.events.filter((e) => e.choice).map((e) => e.id).join(), 'E12');
  const book = story.interactions.find((i) => i.id === 'dohyeonBook');
  assert.deepEqual(book.set, { earlyBook: true });
  assert.ok(ids.includes(book.after) && ids.includes(book.before));
  assert.ok(ids.indexOf(book.after) < ids.indexOf(book.before));
  const keyEvents = story.events.filter((e) => e.set?.hasExitKey).map((e) => `${e.id}/${e.routes.join('')}`);
  assert.deepEqual(keyEvents.sort(), ['E14/R2', 'E14/R3', 'R1-e/R1']);
  assert.deepEqual(ev('E2').chase, 'C1');
  assert.deepEqual(ev('E2').puzzle, 'P1');
  assert.deepEqual(ev('E15').routes, ['R3'], 'R2 는 E14 뒤 엔딩 B');
});

test('점프스케어: 루트마다 3개 이내, 번호가 1부터 차례로', () => {
  for (const route of ROUTES) {
    const nums = story.events.filter((e) => e.routes.includes(route) && e.jumpscare).map((e) => e.jumpscare);
    assert.ok(nums.length <= 3, `${route} ${nums}`);
    assert.deepEqual(nums, nums.map((_, i) => i + 1), route);
  }
});

test('이름: 자리표시자만 쓰고, 모든 자리표시자는 characters.json 에 있다', () => {
  const texts = [];
  const pushEvent = (ev) => {
    texts.push(ev.title, ev.place, ...ev.lines.map((l) => l.text));
    if (ev.choice) texts.push(ev.choice.prompt, ...ev.choice.options.map((o) => o.label));
  };
  story.events.forEach(pushEvent);
  story.interactions.forEach(pushEvent);
  texts.push(...Object.values(story.objectives), ...Object.values(story.undecided), ...Object.values(story.endings).map((e) => e.summary));
  texts.push(...puzzles.map((p) => p.name), ...chases.map((c) => c.name));
  for (const t of texts) for (const id of placeholderIds(t)) assert.ok(characters[id], `자리표시자 {${id}} in "${t}"`);
  // 받침에 따라 바뀌는 조사는 {id:조사} 로 써야 가명을 바꿔도 맞는다
  for (const t of texts) assert.doesNotMatch(t, /\}(이|가|은|는|을|를|과|와|아|야|으로|로)(?![가-힣])/, `조사 직접 사용: "${t}"`);
  // 데이터 안에 표시 이름을 직접 쓰지 않는다 (가명 교체는 characters.json 한 곳에서)
  const raw = JSON.stringify({ story, puzzles, chases, powerbanks });
  for (const [id, ch] of Object.entries(characters)) if (id !== 'player' && !id.startsWith('_')) assert.ok(!raw.includes(ch.name), `데이터에 이름 "${ch.name}" 직접 사용`);
  for (const e of Object.values(story.endings)) for (const s of e.survivors) assert.ok(characters[s], `생존자 ${s}`);
});

test('참조: objective·puzzle·chase·undecided 는 존재하는 항목만', () => {
  const pz = new Set(puzzles.map((p) => p.id));
  const ch = new Set(chases.map((c) => c.id));
  for (const ev of story.events) {
    for (const k of ['objective', 'objectiveRepeat']) if (ev[k]) assert.ok(story.objectives[ev[k]], `${ev.id} ${k} ${ev[k]}`);
    if (ev.puzzle) assert.ok(pz.has(ev.puzzle), `${ev.id} puzzle ${ev.puzzle}`);
    if (ev.chase) assert.ok(ch.has(ev.chase), `${ev.id} chase ${ev.chase}`);
    for (const u of ev.undecided ?? []) assert.ok(story.undecided[u], `${ev.id} undecided ${u}`);
  }
  assert.ok(story.events.some((e) => e.objectiveRepeat), '2회차 목표 문구 자리');
  for (const [k, v] of Object.entries(story.undecided)) assert.match(v, /^\[미확정\]/, k);
});

test('뼈대: P1~P4·C1~C4·PB1~PB9, 사건과 양방향으로 연결', () => {
  assert.deepEqual(puzzles.map((p) => p.id), ['P1', 'P2', 'P3', 'P4']);
  assert.deepEqual(chases.map((c) => c.id), ['C1', 'C2', 'C3', 'C4']);
  assert.deepEqual(powerbanks.map((b) => b.id), Array.from({ length: 9 }, (_, i) => `PB${i + 1}`));
  for (const [list, field] of [[puzzles, 'puzzle'], [chases, 'chase']]) {
    for (const item of list) {
      assert.ok(item.name && item.place && item.events.length, item.id);
      for (const id of item.events) {
        const evs = story.events.filter((e) => e.id === id);
        assert.ok(evs.length, `${item.id} → 없는 사건 ${id}`);
        for (const e of evs) assert.equal(e[field], item.id, `${id} 의 ${field} 가 ${item.id} 가 아님`);
      }
    }
    // 사건 쪽에서 가리키는 항목은 그 항목의 events 에도 있어야 한다
    for (const e of story.events) if (e[field]) assert.ok(list.find((x) => x.id === e[field]).events.includes(e.id), `${e.id} ${field}`);
  }
  for (const b of powerbanks) {
    assert.ok(b.place && b.spot && b.from.length, b.id);
    for (const id of b.from) assert.ok(ids.includes(id), `${b.id} from ${id}`);
  }
});

test('엔딩 A·B·C: 루트 하나씩, [미확정] 표기 없음', () => {
  assert.deepEqual(Object.values(story.endings).map((e) => e.route).sort(), ROUTES);
  for (const e of Object.values(story.endings)) assert.doesNotMatch(e.summary, /미확정/);
  assert.deepEqual(story.endings.A.survivors.sort(), ['dohyeon', 'mingeon', 'player']);
  assert.deepEqual(story.endings.B.survivors, ['dohyeon']);
  assert.deepEqual(story.endings.C.survivors, []);
  assert.match(story.endings.A.summary, /\{gyuha\}의 흔적/);
});
