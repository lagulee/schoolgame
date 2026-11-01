// 단계 0c: 시작 흐름 — 주인공 이름 검증·저장, 시작 전 탐색 구간에서 현관 홀 진입 시 E1 한 번만.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanName, loadName, saveName } from '../src/ui/playerName.js';
import { Prelude } from '../src/story/prelude.js';
import { StoryRunner } from '../src/story/runner.js';
import { MapData } from '../src/world/mapData.js';
import { loadStory, fakeUI, memoryStorage } from './helpers.mjs';

const { story, characters } = loadStory();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const MAX = 8;

test('이름: 필수 1~8자, 앞뒤 공백·숨은 문자 제거, 글자 수는 코드 포인트 기준', () => {
  assert.deepEqual(cleanName('  하늘  ', MAX), { ok: true, name: '하늘', reason: '' });
  assert.equal(cleanName('', MAX).ok, false);
  assert.equal(cleanName('   \t ', MAX).ok, false);
  assert.equal(cleanName('\u200b\u202e', MAX).ok, false, '보이지 않는 문자만 있으면 빈 이름');
  assert.equal(cleanName('가나다라마바사아', MAX).ok, true, '8자');
  assert.equal(cleanName('가나다라마바사아자', MAX).ok, false, '9자');
  assert.equal(cleanName('😀😀😀😀😀😀😀😀', MAX).ok, true, '이모지 8개 = 8자');
  assert.equal(cleanName('a  b', MAX).name, 'a b', '연속 공백은 하나로');
  assert.equal(cleanName(null, MAX).ok, false);
});

test('이름: HTML 문자는 그대로 글자로 남고, 대사 치환에서도 해석되지 않는다', () => {
  const r = cleanName('<i>a</i>', MAX);
  assert.equal(r.ok, true);
  assert.equal(r.name, '<i>a</i>');
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  runner.setPlayerName(r.name);
  assert.equal(runner.text('{player}'), '<i>a</i>');
  runner.setPlayerName('{gyuha}');
  assert.equal(runner.text('{player:이} 왔다'), '{gyuha}가 왔다', '이름 안의 자리표시자는 다시 치환하지 않는다');
});

test('이름: localStorage 저장·불러오기, 저장소가 막혀도 오류 없이 진행', () => {
  const s = memoryStorage();
  assert.equal(loadName(s, 'k'), '');
  saveName(s, 'k', '하늘');
  assert.equal(loadName(s, 'k'), '하늘');
  const broken = memoryStorage(true);
  assert.doesNotThrow(() => saveName(broken, 'k', '하늘'));
  assert.equal(loadName(broken, 'k'), '');
  assert.equal(loadName(undefined, 'k'), '');
});

const setup = () => {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const prelude = new Prelude({ runner, def: story.prelude, locate: (x, z, l) => map.locate(x, z, l) });
  return { runner, prelude };
};
const lobby = map.byId.get(story.prelude.trigger);
const inLobby = [(lobby.rect[0] + lobby.rect[2]) / 2, (lobby.rect[1] + lobby.rect[3]) / 2];

test('시작 전 탐색: 데이터 — prelude 는 E1·현관 홀(1층)·목표 문구를 가리킨다', () => {
  assert.equal(story.prelude.event, 'E1');
  assert.ok(lobby, `map.json 에 ${story.prelude.trigger} 공간`);
  assert.equal(lobby.building, 'main');
  assert.equal(lobby.levels[0], 0);
  assert.ok(story.objectives[story.prelude.objective]);
  assert.ok(story.prelude.hint);
});

test('시작 전 탐색: 바깥에서는 아무 사건도 없고, 목표는 현관으로 가라는 문구', () => {
  const { runner, prelude } = setup();
  for (const [x, z] of [[0, 12], [13, -1], [60, -40], [20, 12]]) assert.equal(prelude.update(x, z, 0), false, `(${x}, ${z})`);
  assert.equal(runner.registry.history.length, 0);
  assert.equal(runner.objective(), story.objectives[story.prelude.objective]);
});

test('시작 전 탐색: 현관 홀에 들어서면 E1 이 시작되고, 다시 들어와도 한 번만', () => {
  const { runner, prelude } = setup();
  assert.equal(prelude.update(...inLobby, 0), true);
  assert.equal(runner.event.id, 'E1');
  assert.equal(prelude.armed, false);
  while (runner.active) runner.advance();
  for (let i = 0; i < 5; i++) assert.equal(prelude.update(...inLobby, 0), false);
  assert.deepEqual(runner.registry.history, ['E1']);
});

test('시작 전 탐색: 대화 중·다른 층·꺼짐에서는 걸리지 않고, 스토리 초기화 뒤 다시 걸린다', () => {
  const { runner, prelude } = setup();
  assert.equal(prelude.update(...inLobby, 1), false, '2층 같은 자리');
  prelude.enabled = false;
  assert.equal(prelude.update(...inLobby, 0), false, '촬영 모드');
  prelude.enabled = true;
  runner.jump('E3'); // 디버그로 이미 지나감
  while (runner.active) runner.advance();
  assert.equal(prelude.armed, false);
  assert.equal(prelude.update(...inLobby, 0), false);
  runner.reset();
  assert.equal(prelude.armed, true);
  assert.equal(prelude.update(...inLobby, 0), true);
});

test('시작 전 탐색: A·B·C 를 모두 본 판이면 현관 진입(E1)에서 hasRoofKey', () => {
  const { runner, prelude } = setup();
  runner.allEndings = true;
  prelude.update(...inLobby, 0);
  assert.equal(runner.flags.values.hasRoofKey, true);
});
