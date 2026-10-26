// 체크포인트 저장·복원과 본 엔딩 기록(endingsSeen)
import test from 'node:test';
import assert from 'node:assert/strict';
import { StoryRunner } from '../src/story/runner.js';
import { Checkpoints } from '../src/story/checkpoint.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { loadStory, fakeUI, memoryStorage } from './helpers.mjs';

const { story, characters } = loadStory();
const makeRunner = () => new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
const finish = (r) => {
  while (r.mode === 'line') r.advance();
};

test('체크포인트: 플래그·사건 기록(done/last/history)·시점·상호작용을 되돌린다', () => {
  const r = makeRunner();
  for (let i = 0; i < 5; i++) { r.next(); finish(r); } // E1~E5
  r.interact('dohyeonBook');
  finish(r);
  const snap = r.snapshot();
  assert.equal(snap.parts.flags.earlyBook, true);
  assert.deepEqual(snap.parts.events.history, ['E1', 'E2', 'E3', 'E4', 'E5']);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(snap))), JSON.stringify(snap), 'JSON 으로 저장 가능');

  // 저장 뒤 진행: 태민 시점까지 가서 상태를 바꾼다
  for (let i = 0; i < 7; i++) { r.next(); finish(r); } // E6, E7, R1-a~R1-e
  assert.equal(r.registry.last, 'R1-e');
  assert.equal(r.pov, 'mingeon');
  assert.equal(r.flags.get('hasExitKey'), true);

  r.restore(snap);
  assert.equal(r.flags.get('earlyBook'), true);
  assert.equal(r.flags.get('hasExitKey'), false);
  assert.equal(r.registry.last, 'E5');
  assert.deepEqual([...r.registry.done], ['E1', 'E2', 'E3', 'E4', 'E5']);
  assert.deepEqual(r.registry.history, ['E1', 'E2', 'E3', 'E4', 'E5']);
  assert.equal(r.registry.active, null);
  assert.equal(r.pov, 'player');
  assert.equal(r.mode, 'idle');
  assert.ok(!r.interact('dohyeonBook'), '이미 쓴 상호작용은 복원 뒤에도 사용됨');
  r.next();
  assert.equal(r.event.id, 'E6', '복원 지점부터 이어진다');
});

test('체크포인트: 진행 중인 사건은 저장된 줄(선택지면 선택지)부터 다시', () => {
  const r = makeRunner();
  r.jump('E2', 2);
  const mid = r.snapshot();
  finish(r);
  r.restore(mid);
  assert.equal(r.registry.active, 'E2');
  assert.equal(r.lineIdx, 2);
  assert.equal(r.ui.shown.text, r.text(story.events[1].lines[2].text));

  r.jump('E12', 1); // 대사 1줄 뒤 = 선택지
  assert.equal(r.mode, 'choice');
  const atChoice = r.snapshot();
  r.choose(0); // 따라간다
  assert.equal(r.flags.get('dutyCompanion'), true);
  r.restore(atChoice);
  assert.equal(r.mode, 'choice');
  assert.equal(r.flags.get('dutyCompanion'), false, '고르기 전 상태');
  r.update(10.5); // 무응답 → 남는다
  assert.equal(r.flags.get('dutyCompanion'), false);
  assert.equal(r.registry.last, 'E12');
});

test('체크포인트: 태민 시점 사건 도중 저장 → 복원하면 태민 시점·R1 변형 그대로', () => {
  const r = makeRunner();
  r.jump('R1-f', 0, { earlyBook: true });
  const snap = r.snapshot();
  r.reset();
  assert.equal(r.pov, 'player');
  r.restore(snap);
  assert.equal(r.pov, 'mingeon');
  assert.equal(r.event.id, 'R1-f');
  assert.equal(r.route, 'R1');
});

test('체크포인트: 항목을 더할 수 있고, 저장에 없는 항목·모르는 항목은 무시', () => {
  const r = makeRunner();
  let battery = 88;
  r.checkpoints.register('phone', { save: () => ({ battery }), load: (v) => (battery = v.battery) });
  assert.throws(() => r.checkpoints.register('phone', { save() {}, load() {} }), /중복/);
  const snap = r.snapshot();
  assert.deepEqual(snap.parts.phone, { battery: 88 });
  battery = 10;
  r.restore(snap);
  assert.equal(battery, 88);
  // 예전 저장(phone 없음) + 모르는 항목
  const old = { v: snap.v, parts: { flags: { earlyBook: true }, extra: { x: 1 } } };
  battery = 42;
  r.restore(old);
  assert.equal(battery, 42);
  assert.equal(r.flags.get('earlyBook'), true);
  assert.throws(() => r.restore({ v: 999, parts: {} }), /형식/);
  // 저장 객체는 원본과 분리된 복사본
  const cp = new Checkpoints();
  const obj = { list: [1] };
  cp.register('o', { save: () => obj, load: () => {} });
  const s = cp.snapshot();
  obj.list.push(2);
  assert.deepEqual(s.parts.o.list, [1]);
});

test('endingsSeen: 엔딩을 보면 기록, 2회차 판정, 저장소 오류는 무시', () => {
  const storage = memoryStorage();
  const seen = new EndingsSeen('k', storage);
  assert.equal(seen.repeat, false);
  assert.ok(seen.mark('C'));
  seen.mark('C');
  seen.mark('A');
  assert.deepEqual(new EndingsSeen('k', storage).list(), ['C', 'A'], '다시 읽어도 유지, 중복 없음');
  assert.equal(new EndingsSeen('k', storage).repeat, true);
  storage.setItem('k', '{망가진');
  assert.deepEqual(seen.list(), []);
  seen.clear();

  const broken = new EndingsSeen('k', memoryStorage(true));
  assert.deepEqual(broken.list(), []);
  assert.equal(broken.mark('A'), false);
  assert.equal(broken.repeat, false);
  broken.clear();
  assert.deepEqual(new EndingsSeen('k', null).list(), [], '저장소 없음');
});

test('엔딩 표시 → onEnding 에 엔딩 키 전달 (setup 이 endingsSeen 에 기록)', () => {
  const r = makeRunner();
  const storage = memoryStorage();
  const seen = new EndingsSeen('k', storage);
  r.onEnding = (key) => seen.mark(key);
  r.jump('E15');
  finish(r);
  r.next();
  assert.equal(r.mode, 'ending');
  assert.deepEqual(seen.list(), ['C']);
  r.showEnding('A');
  assert.match(r.ui.shown.speaker, /R1 → 엔딩 A/);
  assert.deepEqual(seen.list(), ['C', 'A']);
});
