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
// 전체 진행. after(r, id): 사건이 끝날 때마다 호출 (상호작용 사건을 끼워 넣을 때)
function playAll(pick, after = () => {}) {
  const r = makeRunner();
  const seen = [];
  const povs = {};
  for (let i = 0; i < 30 && r.mode !== 'ending'; i++) {
    r.next();
    const ev = r.event;
    if (ev) {
      seen.push(ev.id);
      povs[ev.id] = r.pov;
    }
    playEvent(r, pick);
    if (ev) after(r, ev.id);
  }
  return { r, seen, povs };
}
const E = (...n) => n.map((i) => `E${i}`);
const COMMON = E(1, 2, 3, 4, 5, 6, 7);
const takeBookAfterE5 = (r, id) => id === 'E5' && playInteraction(r, 'dohyeonBook');
function playInteraction(r, id) {
  assert.ok(r.interact(id), r.lastReason);
  playEvent(r);
}

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

test('E5 는 선택지 없이 끝나고, earlyBook 은 4층 책 상호작용으로만 켜진다', () => {
  const r = makeRunner();
  assert.ok(r.jump('E5'));
  assert.equal(r.ui.shown.kind, 'line');
  assert.doesNotMatch(r.ui.shown.text, /책상|책을/);
  playEvent(r);
  assert.equal(r.mode, 'idle');
  assert.equal(r.flags.get('earlyBook'), false, '사건만으로는 켜지지 않음');
  assert.equal(r.route, 'R3');
  assert.ok(r.interact('dohyeonBook'), r.lastReason);
  assert.equal(r.ui.shown.style, 'subtitle');
  assert.match(r.ui.shown.text, /지후의 이름이 적힌 책/);
  playEvent(r);
  assert.equal(r.flags.get('earlyBook'), true);
  assert.equal(r.route, 'R1');
  assert.equal(r.registry.last, 'E5', '상호작용은 사건 순서·연속 발동 기록에 끼지 않는다');
  assert.ok(!r.interact('dohyeonBook') && /이미/.test(r.lastReason), '한 번만');
});

test('4층 책 상호작용은 E5 이후·E7 시작 전에만', () => {
  const r = makeRunner();
  assert.ok(!r.interact('dohyeonBook') && /E5 이후/.test(r.lastReason), 'E5 전');
  r.jump('E7');
  assert.ok(!r.interact('dohyeonBook') && /진행 중/.test(r.lastReason), '사건 진행 중');
  playEvent(r);
  assert.ok(!r.interact('dohyeonBook') && /E7 시작 전/.test(r.lastReason), 'E7 이후');
  r.jump('E6');
  playEvent(r);
  assert.ok(r.interact('dohyeonBook'), 'E6 뒤, E7 전이면 가능');
  assert.ok(!r.interact('nothing') && /없는 상호작용/.test(r.lastReason));
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
  assert.deepEqual(seen, [...COMMON, ...E(8, 9, 10, 11, 12, 13, 14, 15)]);
  assert.equal(r.route, 'R3');
  assert.equal(r.ui.shown.style, 'ending');
  assert.match(r.ui.shown.speaker, /R3 → 엔딩 C/);
  assert.equal(r.flags.get('hasConnectorKey'), true);
  assert.equal(r.flags.get('hasExitKey'), true);
});

test('전체 진행: E12 따라간다 → R2 · E14 에서 끝, 엔딩 B', () => {
  const { r, seen } = playAll((id) => (id === 'E12' ? 'follow' : null));
  assert.deepEqual(seen, [...COMMON, ...E(8, 9, 10, 11, 12, 13, 14)]);
  assert.equal(r.route, 'R2');
  assert.equal(r.flags.get('hasExitKey'), true, 'R2 도 E14 에서 출구 열쇠');
  assert.match(r.ui.shown.speaker, /엔딩 B/);
});

test('전체 진행: 4층 책(earlyBook) → E8·E9 생략, R1-a~R1-h 순서, 엔딩 A', () => {
  const keyAt = {};
  const { r, seen, povs } = playAll(() => null, (rr, id) => {
    takeBookAfterE5(rr, id);
    keyAt[id] = rr.flags.get('hasExitKey');
  });
  const r1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `R1-${x}`);
  assert.deepEqual(seen, [...COMMON, ...r1]);
  assert.ok(!seen.includes('E9') && !seen.includes('E8'));
  assert.equal(r.route, 'R1');
  assert.match(r.ui.shown.speaker, /R1 → 엔딩 A/);
  assert.equal(keyAt['R1-d'], false);
  assert.equal(keyAt['R1-e'], true, 'R1-e(태민+당직)에서 출구 열쇠');
  assert.deepEqual(r1.map((id) => povs[id]), ['player', 'player', 'player', 'player', 'mingeon', 'mingeon', 'mingeon', 'player']);
  assert.equal(r.pov, 'player');
});

test('E9: earlyBook 이 켜지면 생략, 아니면 나온다', () => {
  const r = makeRunner();
  r.jump('E8');
  playEvent(r);
  assert.equal(r.registry.nextId(r.flags.values, r.route), 'E9');
  r.flags.set('earlyBook', true);
  assert.notEqual(r.registry.nextId(r.flags.values, r.route), 'E9');
  assert.ok(!r.registry.isAvailable('E9', r.flags.values, r.route));
});

test('E13·E14 는 루트별 변형: R3 은 당직 없이, R2 는 당직과 함께', () => {
  const r = makeRunner();
  r.jump('E13');
  assert.deepEqual(r.event.routes, ['R3']);
  assert.match(r.ui.shown.text, /돌아오지 않는다/);
  r.jump('E13', 0, { dutyCompanion: true });
  assert.deepEqual(r.event.routes, ['R2']);
  assert.ok(r.event.lines.some((l) => l.who === 'duty'), 'R2 의 E13 에는 당직 대사');
  assert.ok(!r.registry.get('E13', 'R3').lines.some((l) => l.who === 'duty'), 'R3 의 E13 에는 당직 대사 없음');
  assert.equal(r.registry.get('E13', 'R2').puzzle, 'P4');
  assert.equal(r.registry.get('E13', 'R3').puzzle, 'P4');
  assert.notEqual(r.registry.get('E14', 'R2'), r.registry.get('E14', 'R3'));
  assert.equal(r.registry.get('E13', 'R1'), null);
  assert.throws(() => new EventRegistry([{ id: 'X', routes: ['R2'] }, { id: 'X', routes: ['R2', 'R3'] }]), /루트가 겹침/);
});

test('시점: 태민 시점에서는 태민 대사가 이름 없이(1인칭), 다른 인물은 이름 표시', () => {
  const r = makeRunner();
  const povs = [];
  r.onPov = (p) => povs.push(p);
  r.jump('R1-e');
  assert.equal(r.pov, 'mingeon');
  const lines = r.event.lines;
  const idx = (who) => lines.findIndex((l) => l.who === who);
  assert.equal(r.speakerName('mingeon'), '');
  assert.equal(r.speakerName('duty'), '당직 아저씨');
  assert.equal(r.speakerName('player'), '나', '태민 시점에서 주인공은 1인칭이 아니다 (데이터 검사로 그런 대사를 막는다)');
  assert.ok(idx('mingeon') >= 0 && idx('duty') >= 0);
  r.jump('R1-h');
  assert.equal(r.pov, 'player');
  assert.equal(r.speakerName('mingeon'), '태민');
  assert.equal(r.speakerName('player'), '');
  assert.deepEqual(povs, ['mingeon', 'player']);
});

test('목표 문구: 사건의 objective, 엔딩을 본 판이면 objectiveRepeat', () => {
  const r = makeRunner();
  assert.equal(r.objective(), '');
  r.jump('E5');
  assert.equal(r.objective(), '연결문을 열고 신관 5층으로 올라간다');
  r.repeat = true;
  assert.match(r.objective(), /지후의 책을 챙긴다/);
  playEvent(r);
  assert.match(r.objective(), /지후의 책/, '사건이 끝나도 직전 사건 기준');
  r.repeat = false;
  r.jump('E8');
  assert.equal(r.objective(), '흩어진 서진과 태민을 찾는다');
});
