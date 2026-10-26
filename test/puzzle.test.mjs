// 퍼즐 실행기 (단계 0b-4): 단서 수집·번호 확인·틀린 시도 한도·실패 시 체크포인트 복원·훅 호출 순서·puzzles.json 스키마
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Puzzle } from '../src/puzzle/puzzle.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks, HOOK_NAMES } from '../src/puzzle/hooks.js';
import { Stamina } from '../src/player/stamina.js';
import { Phone } from '../src/phone/phone.js';
import { StoryRunner } from '../src/story/runner.js';
import { PUZZLE, STAMINA, PHONE } from '../src/config.js';
import { loadStory, fakeUI } from './helpers.mjs';

const raw = JSON.parse(readFileSync(new URL('../data/puzzles.json', import.meta.url), 'utf8'));
const t0 = raw.debugPuzzles.find((p) => p.id === PUZZLE.debugId);
const defs = [...raw.puzzles, ...raw.debugPuzzles];

function world(puzzles = defs) {
  const { story, characters } = loadStory();
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const phone = new Phone(PHONE, () => 0);
  const stamina = new Stamina(STAMINA);
  runner.checkpoints.register('phone', { save: () => phone.save(), load: (v) => phone.load(v) });
  runner.checkpoints.register('stamina', { save: () => stamina.save(), load: (v) => stamina.load(v) });
  const hooks = new GhostHooks();
  const session = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks });
  const calls = [];
  for (const n of HOOK_NAMES) {
    hooks.register(n, (i) => calls.push(`hook:${n}`));
    session[n] = (i) => calls.push(`cb:${n}`);
  }
  return { runner, phone, stamina, hooks, session, calls };
}

test('상수: 틀린 시도 한도 기본 3', () => {
  assert.equal(PUZZLE.wrongLimit, 3);
  assert.equal(new Puzzle({ id: 'X', clues: [], answer: 1 }, PUZZLE).wrongLimit, 3);
});

test('단서 수집: 중복은 한 번만 세고, 모두 모으면 완료', () => {
  const p = new Puzzle(t0, PUZZLE);
  assert.equal(p.complete, false);
  assert.equal(p.gather('a'), 'new');
  assert.equal(p.gather('a'), 'dup');
  assert.equal(p.got.length, 1);
  assert.equal(p.gather('zzz'), 'unknown');
  assert.equal(p.nextClue(), 'b');
  p.gather('b');
  assert.equal(p.complete, false);
  p.gather('c');
  assert.equal(p.complete, true);
  assert.equal(p.got.length, 3);
});

test('번호 확인: 정답 성공(숫자·문자열 모두), 오답은 틀린 시도 +1', () => {
  const a = new Puzzle(t0, PUZZLE);
  assert.deepEqual(a.check(1), { ok: false, wrong: 1, left: 2, status: 'active' });
  assert.equal(a.check('7').ok, true);
  assert.equal(a.status, 'solved');
  assert.equal(a.check(7).closed, true, '끝난 퍼즐은 더 받지 않는다');
  assert.equal(a.gather('a'), 'closed');
  const b = new Puzzle(t0, PUZZLE);
  assert.equal(b.check(' 7 ').ok, true);
});

test('틀린 시도가 wrongLimit 에 닿으면 실패, wrongLimit 은 퍼즐 값 우선', () => {
  const p = new Puzzle(t0, PUZZLE);
  p.check(1);
  p.check(2);
  assert.equal(p.status, 'active');
  assert.equal(p.check(3).status, 'failed');
  const two = new Puzzle({ ...t0, wrongLimit: 2 }, PUZZLE);
  two.check(1);
  assert.equal(two.check(1).status, 'failed');
});

test('정답이 없는(pending) 퍼즐은 번호 확인을 거부', () => {
  const p = new Puzzle(raw.puzzles[0], PUZZLE);
  assert.throws(() => p.check(1), /pending/);
});

test('세션: 정답이면 성공 콜백 후 끝', () => {
  const w = world();
  w.session.start('T0');
  assert.equal(w.session.active, true);
  const res = w.session.submit(7);
  assert.equal(res.ok, true);
  assert.equal(w.session.active, false);
  assert.deepEqual(w.session.last, { id: 'T0', outcome: 'solved' });
});

test('실패 → 퍼즐 시작 체크포인트로 복원 (플래그·배터리·스태미나·단서·틀린 횟수), 시도 횟수는 유지', () => {
  const w = world();
  w.runner.flags.set('hasExitKey', true);
  w.phone.s.battery = 50;
  w.stamina.update(2, 'run');
  const stam = w.stamina.value;
  w.session.start('T0');
  // 퍼즐 중에 바뀐 상태
  w.runner.flags.set('hasExitKey', false);
  w.runner.flags.set('earlyBook', true);
  w.phone.s.battery = 20;
  w.stamina.update(2, 'run');
  w.session.gather('a');
  w.session.gather('b');
  w.session.submit(1);
  w.session.submit(2);
  assert.equal(w.session.puzzle.wrong, 2);
  w.session.submit(3); // 세 번째 오답 → 실패 → 복원
  const p = w.session.puzzle;
  assert.ok(p && p.active, '같은 퍼즐이 다시 시작된다');
  assert.equal(p.got.length, 0);
  assert.equal(p.wrong, 0);
  assert.equal(w.session.attemptOf('T0'), 1);
  assert.equal(w.runner.flags.get('hasExitKey'), true);
  assert.equal(w.runner.flags.get('earlyBook'), false);
  assert.equal(w.phone.s.battery, 50);
  assert.equal(w.stamina.value, stam);
  assert.deepEqual(w.session.last, { id: 'T0', outcome: 'failed' });
  // 다시 틀려도 한도까지 다시 센다, 시도 횟수는 누적
  w.session.submit(1);
  w.session.submit(1);
  w.session.submit(1);
  assert.equal(w.session.attemptOf('T0'), 2);
  assert.equal(w.session.puzzle.wrong, 0);
  assert.equal(w.session.submit(7).ok, true);
});

test('start 는 시도 횟수를 0 으로 되돌린다', () => {
  const w = world();
  w.session.start('T0');
  for (let i = 0; i < 3; i++) w.session.submit(1);
  assert.equal(w.session.attemptOf('T0'), 1);
  w.session.start('T0');
  assert.equal(w.session.attemptOf('T0'), 0);
});

test('훅·콜백 호출 순서: 훅(연출) 다음 콜백(사건 진행)', () => {
  const w = world();
  w.session.start('T0');
  w.session.gather('a');
  w.session.gather('a'); // 중복도 알림은 가지만 완료는 아님
  w.session.gather('b');
  w.session.gather('c'); // 완료
  w.session.submit(1);
  w.session.submit(7);
  assert.deepEqual(w.calls, [
    'hook:onStart', 'cb:onStart',
    'hook:onClue', 'cb:onClue', 'hook:onClue', 'cb:onClue', 'hook:onClue', 'cb:onClue',
    'hook:onClue', 'cb:onClue', 'hook:onComplete', 'cb:onComplete',
    'hook:onWrong', 'cb:onWrong',
    'hook:onSuccess', 'cb:onSuccess',
  ]);
});

test('실패 때 순서: onWrong → onFail → (복원)', () => {
  const w = world();
  w.session.start('T0');
  w.calls.length = 0;
  for (let i = 0; i < 3; i++) w.session.submit(1);
  assert.deepEqual(w.calls.filter((c) => c.startsWith('cb:')), ['cb:onWrong', 'cb:onWrong', 'cb:onWrong', 'cb:onFail']);
  assert.equal(w.calls.at(-1), 'cb:onFail');
});

test('훅: 퍼즐의 ghostHooks 에 있는 이름만 불리고, 등록이 없으면 로그만', () => {
  const lines = [];
  const hooks = new GhostHooks({ log: (l) => lines.push(l) });
  const def = { id: 'Q', ghostHooks: ['onClue'] };
  assert.equal(hooks.call(def, 'onClue', { clue: 'a' }), true);
  assert.equal(hooks.call(def, 'onWrong'), false);
  assert.deepEqual(lines, ['훅 onClue (Q a)']);
  const got = [];
  hooks.register('onClue', (i) => got.push(i));
  hooks.call(def, 'onClue', { clue: 'b' });
  assert.deepEqual(got, [{ puzzle: 'Q', clue: 'b' }]);
  assert.throws(() => hooks.register('onNothing', () => {}), /없는 훅/);
  assert.throws(() => hooks.call(def, 'onNothing'), /없는 훅/);
});

test('세션: 없는 퍼즐은 오류, 진행 중이 아니면 입력 무시', () => {
  const w = world();
  assert.throws(() => w.session.start('P9'), /없는 퍼즐/);
  assert.equal(w.session.submit(1), null);
  assert.equal(w.session.gather('a'), null);
  assert.match(w.session.hudLine(), /퍼즐: 없음/);
});

test('puzzles.json 스키마: P1~P4 필수 필드, 훅 이름·단서 id 정합성', () => {
  assert.deepEqual(raw.puzzles.map((p) => p.id), ['P1', 'P2', 'P3', 'P4']);
  for (const p of [...raw.puzzles, ...raw.debugPuzzles]) {
    assert.ok(p.id && p.name && p.place, p.id);
    if (raw.puzzles.includes(p)) assert.ok(p.events.length, `${p.id} events`);
    assert.ok(Array.isArray(p.clues), `${p.id} clues`);
    assert.ok('answer' in p, `${p.id} answer`);
    assert.ok(Number.isInteger(p.wrongLimit) && p.wrongLimit >= 1, `${p.id} wrongLimit`);
    assert.ok(Array.isArray(p.ghostHooks), `${p.id} ghostHooks`);
    for (const h of p.ghostHooks) assert.ok(HOOK_NAMES.includes(h), `${p.id} 훅 ${h}`);
    const ids = p.clues.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${p.id} 단서 id 중복`);
    for (const c of p.clues) assert.ok(c.id && c.name && c.where, `${p.id} 단서 ${c.id}`);
    // 정답이 없으면 아직 내용을 채우지 않은 퍼즐(pending)이어야 한다
    if (p.answer == null) assert.equal(p.pending, true, `${p.id} 정답 없음은 pending`);
  }
  assert.equal(raw.puzzles.find((p) => p.id === 'P4').wrongLimit, 3, 'STORY 9장 P4: 3번 틀리면 잡힌다');
  assert.equal(t0.clues.length, 3);
  for (const k of ['start', 'clue', 'clueDup', 'complete', 'wrong', 'success', 'fail', 'stop', 'none']) assert.ok(raw.messages[k], k);
});
