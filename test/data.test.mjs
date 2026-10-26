// 데이터 정합성: 사건 ID·순서, 플래그, 이름 자리표시자, objective·puzzle·chase·undecided 참조, 뼈대 파일과의 양방향 연결
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeholderIds } from '../src/story/text.js';
import { FLAG_NAMES, ENDING_KEYS, earnsRoofKey } from '../src/story/flags.js';
import { fillText, withPlayerName } from '../src/story/text.js';
import { mergeCharacters, mergeCredits, applyLocal, localKey } from '../src/story/names.js';
import { chaseErrors, loadChases, exitMinGap } from '../src/story/chases.js';
import { StoryRunner } from '../src/story/runner.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { PLAYER, CHASE } from '../src/config.js';
import { readFileSync } from 'node:fs';
import { POVS } from '../src/story/runner.js';
import { loadStory, loadSkeletons, memoryStorage, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { puzzles, chases, powerbanks, credits } = loadSkeletons();
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
  texts.push(...Object.values(story.objectives), ...Object.values(story.undecided), ...Object.values(story.resolved), ...Object.values(story.endings).map((e) => e.summary));
  texts.push(...puzzles.map((p) => p.name), ...chases.map((c) => c.name), ...credits.entries.flatMap((e) => e.names));
  for (const t of texts) for (const id of placeholderIds(t)) assert.ok(characters[id], `자리표시자 {${id}} in "${t}"`);
  // 받침에 따라 바뀌는 조사는 {id:조사} 로 써야 가명을 바꿔도 맞는다
  for (const t of texts) assert.doesNotMatch(t, /\}(이|가|은|는|을|를|과|와|아|야|으로|로)(?![가-힣])/, `조사 직접 사용: "${t}"`);
  // 데이터 안에 표시 이름을 직접 쓰지 않는다 (가명 교체는 characters.json 한 곳에서)
  const raw = JSON.stringify({ story, puzzles, chases, powerbanks, credits });
  for (const [id, ch] of Object.entries(characters)) if (id !== 'player' && !id.startsWith('_')) assert.ok(!raw.includes(ch.name), `데이터에 이름 "${ch.name}" 직접 사용`);
  for (const e of Object.values(story.endings)) for (const s of e.survivors ?? []) assert.ok(characters[s], `생존자 ${s}`);
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
  const main = Object.values(story.endings).filter((e) => !e.hidden);
  assert.deepEqual(main.map((e) => e.route).sort(), ROUTES);
  for (const e of Object.values(story.endings)) assert.doesNotMatch(e.summary, /미확정/);
  assert.deepEqual(story.endings.A.survivors.sort(), ['dohyeon', 'mingeon', 'player']);
  assert.deepEqual(story.endings.B.survivors, ['dohyeon']);
  assert.deepEqual(story.endings.C.survivors, []);
  assert.match(story.endings.A.summary, /\{gyuha\}의 흔적/);
});

// ---- v6 보정 (단계 0②) ----

const speeds = { walk: PLAYER.walk, run: PLAYER.run };
const variant = (id, route) => story.events.find((e) => e.id === id && e.routes.includes(route));

test('v6 hasRoofKey: 5번째 플래그, A·B·C 를 모두 본 새 판의 E1 에서만 켜진다 (D 는 무관)', () => {
  assert.equal(FLAG_NAMES.length, 5);
  assert.equal(FLAG_NAMES[4], 'hasRoofKey');
  assert.equal(story.flags.hasRoofKey, false);
  assert.ok(earnsRoofKey(['C', 'A', 'B']));
  assert.ok(!earnsRoofKey(['A', 'B', 'D']));
  assert.deepEqual(story.events.filter((e) => e.grantRoofKey).map((e) => e.id), ['E1']);
  const play = (allEndings) => {
    const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
    r.allEndings = allEndings;
    assert.equal(r.flags.get('hasRoofKey'), false);
    r.start('E1');
    return r;
  };
  assert.equal(play(true).flags.get('hasRoofKey'), true);
  assert.equal(play(false).flags.get('hasRoofKey'), false);
  // 루트 판정에는 영향 없음
  assert.equal(play(true).route, 'R3');
});

test('v6 엔딩 D: 숨김 엔딩으로 따로 저장, A·B·C 완주 판정에 영향 없음', () => {
  assert.deepEqual(ENDING_KEYS, ['A', 'B', 'C', 'D']);
  assert.deepEqual(Object.keys(story.endings).sort(), ENDING_KEYS);
  assert.equal(story.endings.D.hidden, true);
  assert.equal(story.endings.D.route, null);
  const seen = new EndingsSeen('k', memoryStorage());
  assert.ok(seen.mark('D'));
  assert.ok(!seen.mark('X'), '모르는 엔딩 키는 기록하지 않음');
  assert.deepEqual(seen.list(), ['D']);
  assert.equal(seen.allMain, false, 'D 만으로는 완주 아님');
  for (const k of ['A', 'B']) seen.mark(k);
  assert.equal(seen.allMain, false);
  seen.mark('C');
  assert.equal(seen.allMain, true);
  assert.deepEqual(seen.list(), ['D', 'A', 'B', 'C']);
  // 엔딩 D 표시 → onEnding 에 'D'
  const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  let got = null;
  r.onEnding = (key) => (got = key);
  r.showEnding('D');
  assert.equal(got, 'D');
});

test('v6 {player}: 입력한 이름으로 바뀌고, 비어 있으면 "나"', () => {
  assert.equal(fillText('{player}', characters), '나');
  assert.equal(fillText('{player:이} 왔다', withPlayerName(characters, '하늘')), '하늘이 왔다');
  assert.equal(fillText('{player:이} 왔다', withPlayerName(characters, '  ')), '나가 왔다');
  assert.equal(characters.player.name, '나', '원본은 그대로');
  const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  r.setPlayerName('<b>민</b>');
  assert.equal(r.text('{player}'), '<b>민</b>', '치환은 문자 그대로 (화면 출력은 textContent, 단계 0c)');
  assert.equal(r.text('{gyuha}'), characters.gyuha.name, '다른 이름은 그대로');
  r.setPlayerName('');
  assert.equal(r.text('{player}'), '나');
});

test('v6 로컬 덮어쓰기: 파일이 없으면 가명, 있으면 같은 id 의 이름만 바뀐다', () => {
  const base = { characters, credits };
  // 없음
  const none = applyLocal(base, {});
  assert.deepEqual(none.characters, characters);
  assert.deepEqual(none.credits, credits);
  // 있음 (테스트용 값, 실명 아님)
  const local = {
    characters: { gyuha: { name: '가람' }, nobody: { name: '무시' }, player: { name: '무시' }, dohyeon: { name: '' } },
    credits: { entries: [{ id: 'developer', names: ['클로드', '가람'] }, { id: 'nope', names: ['무시'] }] },
  };
  const got = applyLocal(base, local);
  assert.equal(got.characters.gyuha.name, '가람');
  assert.equal(got.characters.gyuha.role, characters.gyuha.role);
  assert.equal(got.characters.dohyeon.name, characters.dohyeon.name, '빈 값은 무시');
  assert.equal(got.characters.player.name, '나', '주인공은 입력값으로만');
  assert.ok(!got.characters.nobody, '모르는 id 는 더하지 않음');
  assert.deepEqual(got.credits.entries.find((e) => e.id === 'developer').names, ['클로드', '가람']);
  assert.equal(got.credits.entries.length, credits.entries.length);
  assert.equal(characters.gyuha.name !== '가람' && credits.entries[0].names[1], '{gyuha}', '원본 불변');
  assert.equal(mergeCharacters(characters, null).gyuha.name, characters.gyuha.name);
  assert.deepEqual(mergeCredits(credits, { entries: 'x' }), credits);
  assert.equal(localKey('../../data/characters.local.json'), 'characters');
  // 저장소에 올라가지 않게
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^data\/\*\.local\.json$/m);
});

test('v6 크레딧: 개발자·아이디어·회사, 인물은 자리표시자', () => {
  const by = Object.fromEntries(credits.entries.map((e) => [e.id, e.names]));
  assert.deepEqual(Object.keys(by), ['developer', 'idea', 'company']);
  assert.deepEqual(by.developer, ['클로드', '{gyuha}']);
  assert.deepEqual(by.idea, ['{mingeon}']);
  assert.ok(by.company.includes('jinsolentertainment'));
});

test('v6 마지막 추격 구조(14-4): 일행이 먼저 죽고, 사망자 메타가 루트별 생존과 맞다', () => {
  const r3 = variant('E14', 'R3');
  const r2 = variant('E14', 'R2');
  assert.deepEqual(r3.deaths, ['dohyeon']);
  assert.deepEqual(r3.finale, { companion: 'dohyeon', fleeing: ['player'], atExit: 'collapse' });
  assert.deepEqual(variant('E15', 'R3').deaths, ['player']);
  assert.deepEqual(r2.deaths, ['duty', 'player'], 'R2: 당직 → 주인공 순차 사망');
  assert.deepEqual(r2.finale, { companion: 'duty', fleeing: ['player', 'dohyeon'], atExit: 'playerCaught' });
  assert.deepEqual(variant('R1-f', 'R1').deaths, ['duty']);
  assert.deepEqual(variant('R1-g', 'R1').finale, { companion: 'duty', fleeing: ['mingeon'], atExit: 'escape' });
  // 마지막 추격 사건은 C3·C4 를 쓰고, 먼저 죽는 일행은 그 루트에서 앞서(또는 그 사건에서) 죽는다
  for (const route of ROUTES) {
    const evs = story.events.filter((e) => e.routes.includes(route));
    const fin = evs.filter((e) => e.finale);
    assert.equal(fin.length, 1, route);
    const f = fin[0].finale;
    assert.ok(['C3', 'C4'].includes(fin[0].chase), `${route} chase`);
    const before = evs.slice(0, evs.indexOf(fin[0]) + 1).flatMap((e) => e.deaths ?? []);
    assert.ok(before.includes(f.companion), `${route}: ${f.companion} 가 먼저 죽음`);
    assert.ok(!f.fleeing.includes(f.companion));
    // 엔딩 생존자 = 등장인물 - 이 루트의 사망자 - 화면 밖 사망({gyuha}, 태민은 R2·R3 E7~E8)
    const dead = new Set([...evs.flatMap((e) => e.deaths ?? []), 'gyuha', ...(route === 'R1' ? [] : ['mingeon'])]);
    const ending = Object.values(story.endings).find((e) => e.route === route);
    const alive = ['player', 'gyuha', 'mingeon', 'dohyeon', 'duty'].filter((id) => !dead.has(id));
    assert.deepEqual(alive.sort(), [...ending.survivors].sort(), route);
  }
  // 해소된 미확정 a·b·e: 사건이 더는 가리키지 않고 [미확정] 문구도 없다
  assert.deepEqual(Object.keys(story.resolved).sort(), ['a', 'b', 'e']);
  assert.deepEqual(story.undecided, {});
  for (const ev of story.events) {
    assert.ok(!ev.undecided?.length, `${ev.id} undecided`);
    for (const l of ev.lines) assert.doesNotMatch(l.text, /미확정/, ev.id);
  }
  // R1-c 도입부에서 당직 첫 만남 (자기소개가 당직의 첫 대사)
  const c = variant('R1-c', 'R1');
  assert.equal(c.lines.find((l) => l.who).who, 'duty');
});

test('v6 chases: 필드·값, 귀신 속도는 걷기 < 속도 < 달리기', () => {
  const by = Object.fromEntries(chases.map((c) => [c.id, c]));
  assert.deepEqual(loadChases({ chases }, speeds).map((c) => c.id), ['C1', 'C2', 'C3', 'C4']);
  assert.equal(by.C1.ghostSpeed, 2.6);
  assert.equal(by.C2.ghostSpeed, 3.0);
  for (const id of ['C3', 'C4']) {
    const c = by[id];
    assert.deepEqual([c.ghostSpeed, c.startGap, c.pathLength, c.companionKillDelay, c.unlockTime], [3.4, 3, 40, 4, 1.0], id);
    assert.ok(c.final);
    assert.ok(Math.abs(exitMinGap(c, CHASE.catchDistance) - 4.9) < 1e-9, '출구 통과 조건 4.9 m');
    assert.ok(Math.abs(c.startGap + c.ghostSpeed * c.companionKillDelay - 16.6) < 1e-9, '처리 직후 거리 16.6 m');
  }
  for (const c of chases) {
    assert.ok(c.ghostSpeed > PLAYER.walk && c.ghostSpeed < PLAYER.run, c.id);
    for (const f of c.undecided ?? []) assert.ok(c[f] === null || (Array.isArray(c[f]) && c[f].length === 0), `${c.id} ${f}`);
  }
  // 범위 검사: 경계값·밖은 막는다
  const bad = (patch) => chaseErrors({ ...by.C3, ...patch }, speeds);
  assert.deepEqual(bad({}), []);
  for (const v of [1.6, 3.6, 1.0, 4.0]) assert.ok(bad({ ghostSpeed: v }).length, `ghostSpeed ${v}`);
  assert.ok(bad({ pathLength: null }).length, 'undecided 에 없으면 null 불가');
  assert.deepEqual(bad({ pathLength: null, undecided: ['pathLength'] }), []);
  assert.ok(bad({ ghostSpeed: null, undecided: ['ghostSpeed'] }).length, '속도는 미정 불가');
  assert.ok(bad({ delays: [{ at: 50, seconds: 2 }] }).length, '경로 밖 지연');
  assert.ok(bad({ delays: [{ at: 5, seconds: 0 }] }).length);
  assert.deepEqual(bad({ delays: [{ at: 5, seconds: 2 }] }), []);
  assert.throws(() => loadChases({ chases: [{ ...by.C1, ghostSpeed: 3.6 }] }, speeds), /범위 밖/);
  // 단계 0b-3: R2 트리거 지점(마지막 추격만, 경로 안), 가정값 표시(assumed)
  assert.equal(by.C4.triggerBeforeExit, 5);
  assert.ok(bad({ triggerBeforeExit: 40 }).length, '트리거가 경로 밖');
  assert.ok(chaseErrors({ ...by.C1, triggerBeforeExit: 5 }, speeds).length, '일반 추격에는 트리거 없음');
  assert.ok(bad({ assumed: ['nope'] }).length);
  assert.deepEqual(by.C1.assumed, ['pathLength', 'delays']);
});
