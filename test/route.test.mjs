// 루트 판정 단위 테스트: 플래그 5개의 모든 조합(32가지) → R1/R2/R3 (STORY.md 6장 의사코드)
import test from 'node:test';
import assert from 'node:assert/strict';
import { determineRoute, endingForRoute, Flags, FLAG_NAMES } from '../src/story/flags.js';
import { loadStory } from './helpers.mjs';

const combos = [];
for (let m = 0; m < 1 << FLAG_NAMES.length; m++) {
  combos.push(Object.fromEntries(FLAG_NAMES.map((n, i) => [n, !!(m & (1 << i))])));
}

test('32가지 플래그 조합 전부 의사코드대로 판정 (hasRoofKey 포함)', () => {
  assert.equal(combos.length, 32);
  for (const f of combos) {
    const expected = f.earlyBook ? 'R1' : f.dutyCompanion ? 'R2' : 'R3';
    assert.equal(determineRoute(f), expected, JSON.stringify(f));
  }
});

test('earlyBook 이 dutyCompanion 보다 우선한다', () => {
  assert.equal(determineRoute({ earlyBook: true, dutyCompanion: true }), 'R1');
});

test('열쇠 플래그는 루트에 영향을 주지 않는다', () => {
  assert.equal(determineRoute({ hasConnectorKey: true, hasExitKey: true }), 'R3');
  assert.equal(determineRoute({ hasConnectorKey: true, hasExitKey: true, dutyCompanion: true }), 'R2');
  assert.equal(determineRoute({ hasRoofKey: true }), 'R3');
});

test('기본값(처음 플레이)은 R3 → 엔딩 C', () => {
  const { story } = loadStory();
  const flags = new Flags(story.flags);
  assert.equal(flags.route, 'R3');
  assert.equal(endingForRoute('R3', story.endings), 'C');
  assert.equal(endingForRoute('R2', story.endings), 'B');
  assert.equal(endingForRoute('R1', story.endings), 'A');
});

test('Flags: 모르는 플래그 이름은 거부, 변경 알림은 값이 바뀔 때만', () => {
  const flags = new Flags();
  const seen = [];
  flags.onChange = (n, v) => seen.push(`${n}=${v}`);
  assert.throws(() => flags.set('earlybook', true));
  flags.set('earlyBook', true);
  flags.set('earlyBook', true);
  assert.deepEqual(seen, ['earlyBook=true']);
  flags.reset();
  assert.equal(flags.get('earlyBook'), false);
});
