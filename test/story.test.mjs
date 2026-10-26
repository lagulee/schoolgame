// 스토리 데이터·자리표시자·사건 등록기·진행기 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillText, withParticle, placeholderIds } from '../src/story/text.js';
import { EventRegistry } from '../src/story/registry.js';
import { StoryRunner } from '../src/story/runner.js';
import { FLAG_NAMES } from '../src/story/flags.js';
import { loadStory, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const timing = { subtitleBase: 1, subtitlePerChar: 0 };
const makeRunner = () => new StoryRunner({ story, characters, ui: fakeUI(), timing });

// 진행 중인 사건을 끝까지 넘긴다. 선택지는 pick(eventId) 가 고른 항목 id (null 이면 무응답: 제한 시간이 있으면 시간 초과, 없으면 기본값)
function playEvent(r, pick = () => null) {
  for (let guard = 0; r.mode === 'line' || r.mode === 'choice'; guard++) {
    assert.ok(guard < 50, '사건이 끝나지 않음');
    if (r.mode === 'line') r.advance();
    else {
      const def = r.choice.def;
      const id = pick(r.event.id);
      if (id === null && def.timeout) r.update(def.timeout); // 무응답 → 기본값
      else r.choose(def.options.findIndex((o) => o.id === (id ?? def.default)));
    }
  }
}
function playAll(pick) {
  const r = makeRunner();
  const seen = [];
  for (let i = 0; i < 20 && r.mode !== 'ending'; i++) {
    r.next();
    if (r.event) seen.push(r.event.id);
    playEvent(r, pick);
  }
  return { r, seen };
}

test('데이터: 사건 E1~E15 가 순서대로 하나씩', () => {
  assert.deepEqual(story.events.map((e) => e.id), Array.from({ length: 15 }, (_, i) => `E${i + 1}`));
});

test('데이터: 플래그·자리표시자·선택지 형식', () => {
  assert.deepEqual(Object.keys(story.flags).sort(), [...FLAG_NAMES].sort());
  const texts = [];
  for (const ev of story.events) {
    texts.push(ev.title, ...ev.lines.map((l) => l.text));
    for (const l of ev.lines) if (l.who) assert.ok(characters[l.who], `${ev.id} 화자 ${l.who}`);
    for (const k of Object.keys(ev.set ?? {})) assert.ok(FLAG_NAMES.includes(k), `${ev.id} set ${k}`);
    if (ev.skipIf) assert.ok(FLAG_NAMES.includes(ev.skipIf));
    if (ev.choice) {
      const ids = ev.choice.options.map((o) => o.id);
      assert.ok(ids.includes(ev.choice.default), `${ev.id} 기본값`);
      texts.push(ev.choice.prompt, ...ev.choice.options.map((o) => o.label));
      for (const o of ev.choice.options) for (const k of Object.keys(o.set ?? {})) assert.ok(FLAG_NAMES.includes(k));
    }
  }
  for (const e of Object.values(story.endings)) texts.push(e.summary);
  for (const t of texts) for (const id of placeholderIds(t)) assert.ok(characters[id], `자리표시자 {${id}}`);
  // 데이터 안에 표시 이름을 직접 쓰지 않는다 (가명 교체는 characters.json 한 곳에서)
  const raw = JSON.stringify(story);
  for (const [id, ch] of Object.entries(characters)) if (id !== 'player' && !id.startsWith('_')) assert.ok(!raw.includes(ch.name), `story.json 에 이름 "${ch.name}" 직접 사용`);
});

test('자리표시자 치환과 받침에 맞는 조사', () => {
  const chars = { a: { name: '서진' }, b: { name: '지후' }, c: { name: '하늘' } };
  assert.equal(fillText('{a:이} 왔다. {b:이} 왔다.', chars), '서진이 왔다. 지후가 왔다.');
  assert.equal(fillText('{a:은}/{b:은} {a:을}/{b:를} {a:와}/{b:과}', chars), '서진은/지후는 서진을/지후를 서진과/지후와');
  assert.equal(withParticle('하늘', '으로'), '하늘로');
  assert.equal(withParticle('서진', '로'), '서진으로');
  assert.equal(fillText('{b}의 책', chars), '지후의 책');
  assert.equal(fillText('{nobody} 그대로', chars), '{nobody} 그대로');
});

test('등록기: 같은 사건 연속 발동 금지, 진행 중에는 새 사건 금지', () => {
  const reg = new EventRegistry(story.events);
  assert.ok(reg.begin('E3'));
  assert.equal(reg.begin('E4'), null, '진행 중');
  reg.end();
  assert.equal(reg.begin('E3'), null, '연속 발동');
  assert.equal(reg.check('E3').reason, 'E3 연속 발동 금지');
  assert.ok(reg.begin('E4'));
  reg.end();
  assert.ok(reg.begin('E3'), '사이에 다른 사건이 있으면 다시 가능');
  assert.throws(() => new EventRegistry([{ id: 'X' }, { id: 'X' }]));
});

test('진행기: 대사 → 선택지 → 플래그 변경 (E5 에서 책을 챙기면 earlyBook)', () => {
  const r = makeRunner();
  assert.ok(r.jump('E5'));
  assert.equal(r.ui.shown.kind, 'line');
  r.advance();
  assert.equal(r.mode, 'choice');
  assert.match(r.ui.shown.prompt, /지후의 책상/);
  assert.equal(r.ui.shown.timeout, null);
  r.choose(0);
  assert.equal(r.flags.get('earlyBook'), true);
  assert.equal(r.route, 'R1');
  assert.equal(r.mode, 'idle');
});

test('진행기: E12 무응답 10초 → 기본값 "남는다" (dutyCompanion 그대로)', () => {
  const r = makeRunner();
  r.jump('E12');
  r.advance();
  assert.equal(r.mode, 'choice');
  r.update(9.9);
  assert.equal(r.mode, 'choice');
  r.update(0.2);
  assert.equal(r.mode, 'idle');
  assert.equal(r.flags.get('dutyCompanion'), false);
});

test('진행기: 자막은 시간이 지나면 저절로 넘어간다', () => {
  const r = makeRunner();
  r.jump('E3');
  assert.equal(r.ui.shown.style, 'subtitle');
  r.update(1.1);
  assert.equal(r.mode, 'idle');
});

test('전체 진행: 기본 선택 → R3 · 엔딩 C, 열쇠 플래그 획득', () => {
  const { r, seen } = playAll(() => null);
  assert.deepEqual(seen, story.events.map((e) => e.id));
  assert.equal(r.route, 'R3');
  assert.equal(r.ui.shown.style, 'ending');
  assert.match(r.ui.shown.speaker, /R3 → 엔딩 C/);
  assert.equal(r.flags.get('hasConnectorKey'), true);
  assert.equal(r.flags.get('hasExitKey'), true);
});

test('전체 진행: E12 따라간다 → R2 · 엔딩 B', () => {
  const { r } = playAll((id) => (id === 'E12' ? 'follow' : null));
  assert.equal(r.route, 'R2');
  assert.match(r.ui.shown.speaker, /엔딩 B/);
});

test('전체 진행: E5 책 선점 → E9 생략, R1 · 엔딩 A', () => {
  const { r, seen } = playAll((id) => (id === 'E5' ? 'take' : null));
  assert.ok(!seen.includes('E9'));
  assert.equal(r.route, 'R1');
  assert.match(r.ui.shown.speaker, /엔딩 A/);
});
