// 단계 13(2b): E3 연결문 잠김 → E4 교무실 열쇠(원경 귀신) → E5 열쇠 들고 다시 온 3층 연결문 앞(연결통로 전, 가짜 {gyuha})·신관 계단(4층 책 = earlyBook) → E6 5층(2-13·아래층 소리).
// 5층 내 책(2-13)은 1회차엔 잠겨 못 챙기고, 2회차(엔딩을 본 판)는 E1 시작 때 2-13 열쇠를 받아 E6 에서 챙긴다 (사용자 결정 2026-11-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { StorySteps } from '../src/scene/steps.js';
import { MapData } from '../src/world/mapData.js';
import { bankOpen, seenBy } from '../src/phone/bank.js';
import { openWorld, distances, POINTS } from './mapWorld.mjs';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const { story, characters } = loadStory();
const { powerbanks } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
const DT = 1 / 30;

// 화면 없이 E2 뒤부터 돌리는 세계. repeat = 엔딩을 본 판(2회차)
function world({ repeat = false } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  runner.repeat = repeat;
  assert.ok(runner.start('E1'));
  while (runner.busy) runner.advance() || runner.update(1);
  runner.registry.done.add('E2');
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) };
  const sounds = [];
  const steps = new StorySteps({ runner, story, interactions, sound: (d) => sounds.push(d) });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate: (x, z, l) => map.locate(x, z, l) });
  const view = { looking: true };
  const tick = (sec = DT, at) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      if (at) triggers.update(...at);
      steps.update(DT, () => view.looking);
    }
  };
  // 대화(dialog) 줄은 E 로 넘기고, 자막은 시간으로 넘긴다. 행동 줄에 닿거나 사건이 끝나면 멈춘다
  const play = (limit = 30) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  const ghost = () => steps.sightings[0];
  return { runner, steps, triggers, items, sounds, view, tick, play, ghost };
}

const mid = (id) => {
  const r = map.resolve(id);
  const [a, b, c, d] = r.item.rect;
  return [(a + c) / 2, (b + d) / 2, r.level];
};

// E3 → E6 을 자리 진입으로 끝까지. book = 4층 {dohyeon} 책을 챙길지
function runE3toE6(w, { book }) {
  const { runner, steps, items, tick, play } = w;
  tick(DT, mid('3F-bridge@2'));
  assert.equal(runner.event?.id, 'E3', '3층 연결문 앞 → E3');
  play();
  assert.equal(runner.objectiveKey(), 'findConnectorKey');
  tick(DT, [16.5, -30, 1]); // 2층 동쪽 복도
  assert.equal(runner.event?.id, 'E4', '2층 복도 → E4');
  assert.equal(w.ghost().phase, 'on', '원경 귀신이 서 있다');
  play();
  assert.deepEqual(runner.action, { do: 'take', id: 'connectorKey' });
  assert.ok(items.has('take:connectorKey'), '열쇠함 살펴보기');
  assert.equal(runner.flags.get('hasConnectorKey'), false);
  items.get('take:connectorKey').onUse();
  assert.equal(runner.flags.get('hasConnectorKey'), true, '열쇠함 → hasConnectorKey');
  assert.ok(!items.has('take:connectorKey'));
  play();
  assert.ok(runner.registry.done.has('E4'));
  assert.equal(runner.objectiveKey(), 'openConnector');
  tick(DT, mid('bridge@2'));
  assert.equal(runner.event, null, '연결통로 안으로 바로 가면 E5 가 시작되지 않는다 (연결통로 전에 만난다)');
  tick(DT, mid('3F-bridge@2'));
  assert.equal(runner.event?.id, 'E5', '열쇠 들고 다시 온 3층 연결문 앞 → E5');
  play();
  assert.equal(runner.objectiveKey(), runner.repeat ? 'climbRepeat' : 'climb');
  if (book) assert.ok(runner.interact('dohyeonBook'), '4층 책상 위 책');
  play();
  tick(DT, mid('AC@4'));
  assert.equal(runner.event?.id, 'E6', '신관 5층 복도 → E6');
}

test('데이터: 자리 진입 E3~E6, 줍기·원경 귀신·소리, E4·E6 행동 줄', () => {
  const ev = Object.fromEntries(story.events.map((e) => [e.id, e]));
  for (const id of ['E3', 'E4', 'E5', 'E6']) assert.ok(story.triggers.some((t) => t.event === id), id);
  assert.ok(ev.E4.lines.some((l) => l.do === 'take' && l.id === 'connectorKey'));
  assert.ok(ev.E6.lines.some((l) => l.do === 'take' && l.id === 'myBook' && l.if === 'hasClassKey'));
  assert.ok(ev.E6.lines.some((l) => l.do === 'sound' && story.sounds[l.id]));
  // 가짜 {gyuha}는 연결통로에 들어가기 전(E5, 3층 연결문 앞)에 만난다. 5층(E6)에는 나오지 않는다 (사용자 정정 2026-11-02)
  assert.ok(ev.E3.lines.some((l) => l.who === 'gyuha' && /무서워서 다시 왔어/.test(l.text)), 'E3 가짜 {gyuha} 등장(연결통로 가기 전)');
  assert.ok(ev.E3.lines.some((l) => l.who === 'gyuha' && /같이/.test(l.text)), 'E3 열쇠 대사');
  assert.ok(!ev.E5.lines.some((l) => l.who === 'gyuha'), 'E5 에는 {gyuha} 대사 없음');
  assert.ok(!ev.E6.lines.some((l) => l.who === 'gyuha'), 'E6 에는 {gyuha} 대사 없음');
  assert.equal(story.triggers.find((t) => t.event === 'E5').space, '3F-bridge');
  for (const l of [...ev.E4.lines, ...ev.E6.lines].filter((x) => x.do === 'take')) assert.ok(story.pickups.some((p) => p.id === l.id), l.id);
  const s = story.sightings.find((x) => x.event === 'E4');
  assert.ok(s && !ev.E4.jumpscare, '원경 귀신, 점프스케어 아님');
  // 목표 문구는 4층 책을 1회차에 알려 주지 않는다
  for (const k of [ev.E5.objective, ev.E6.objective, ev.E6.objectiveDone, ev.E4.objectiveDone]) assert.doesNotMatch(story.objectives[k], /dohyeon|4층/, k);
});

test('1회차: E3~E6 자동 진행, 2-13 은 잠겨 책을 못 챙기고 earlyBook 없으면 R3', () => {
  const w = world();
  runE3toE6(w, { book: false });
  w.play();
  assert.ok(w.runner.registry.done.has('E6'));
  assert.equal(w.runner.flags.get('hasClassKey'), false);
  assert.ok(!w.runner.used.has('take:myBook'), '책은 못 챙김');
  assert.equal(w.sounds.length, 1, '아래층 소리 한 번');
  assert.equal(w.runner.objectiveKey(), 'goYaja');
  assert.equal(w.runner.route, 'R3');
  assert.equal(w.runner.registry.nextId(w.runner.flags.values, w.runner.route), 'E7');
});

test('1회차 earlyBook: E5 뒤 4층 책 → R1 이 E7 전에 정해진다', () => {
  const w = world();
  runE3toE6(w, { book: true });
  w.play();
  assert.equal(w.runner.flags.get('earlyBook'), true);
  assert.equal(w.runner.route, 'R1');
  // E7 이 시작되면 더 이상 책을 챙길 수 없다 (earlyBook 확정 시점)
  const v = world();
  for (const id of ['E3', 'E4', 'E5', 'E6']) v.runner.registry.done.add(id);
  assert.ok(v.runner.start('E7'));
  assert.equal(v.runner.canInteract('dohyeonBook').ok, false);
  const u = world();
  assert.equal(u.runner.canInteract('dohyeonBook').ok, false, 'E5 전에는 못 챙김');
});

test('2회차: E1 시작 때 2-13 열쇠를 받고, E6 에서 내 책을 챙길 때까지 기다린다', () => {
  const w = world({ repeat: true });
  assert.equal(w.runner.flags.get('hasClassKey'), true, '2회차 E1 → hasClassKey');
  assert.equal(world().runner.flags.get('hasClassKey'), false, '1회차는 없음');
  runE3toE6(w, { book: false });
  w.play();
  assert.deepEqual(w.runner.action, { if: 'hasClassKey', do: 'take', id: 'myBook' });
  assert.equal(w.steps.take('connectorKey'), false, '기다리는 줍기가 아니면 무시');
  assert.ok(w.steps.take('myBook'), '2-13 책상 위 내 책');
  w.play();
  assert.ok(w.runner.registry.done.has('E6'));
  assert.ok(w.runner.used.has('take:myBook'));
});

test('원경 귀신: 열쇠를 챙기기 전엔 그대로, 챙긴 뒤 시야에서 벗어나면 흐려져 사라진다', () => {
  const w = world();
  w.runner.registry.done.add('E3');
  assert.ok(w.runner.start('E4'));
  w.play();
  w.view.looking = false;
  w.tick(3);
  assert.equal(w.ghost().phase, 'on', '열쇠 전에는 고개를 돌려도 있다');
  w.items.get('take:connectorKey').onUse();
  w.view.looking = true;
  w.tick(2);
  assert.equal(w.ghost().phase, 'on', '보고 있으면 그대로');
  w.view.looking = false;
  w.tick(0.5);
  assert.equal(w.ghost().phase, 'fade');
  assert.ok(w.ghost().alpha > 0 && w.ghost().alpha < 1, '천천히 흐려진다 (번쩍임 없음)');
  w.tick(5);
  assert.equal(w.ghost().phase, 'gone');
  // 스토리 초기화 → 다시 없음, 이미 끝난 E4 를 복원한 판에서는 나타나지 않는다
  w.runner.reset();
  w.tick();
  assert.equal(w.ghost().phase, 'off');
  w.runner.registry.done.add('E4');
  w.tick();
  assert.equal(w.ghost().phase, 'gone');
});

test('체크포인트: 열쇠함 앞에서 저장 → 복원하면 살펴보기가 다시 생기고 열쇠는 없던 일', () => {
  const w = world();
  w.runner.registry.done.add('E3');
  w.runner.start('E4');
  w.play();
  const snap = w.runner.snapshot();
  w.items.get('take:connectorKey').onUse();
  w.tick();
  w.runner.restore(snap);
  w.tick();
  assert.equal(w.runner.flags.get('hasConnectorKey'), false);
  assert.equal(w.runner.action?.id, 'connectorKey');
  assert.ok(w.items.has('take:connectorKey'));
});

test('보조배터리 줍는 시점: PB3·PB4 = E4, PB5·PB6 = E5, PB7 = E6 (2-13 은 열쇠 방이라 2회차에만 닿음)', () => {
  const w = world();
  const seen = seenBy(w.runner.registry);
  const open = (id) => bankOpen(powerbanks.find((b) => b.id === id), seen);
  assert.ok(!open('PB3') && !open('PB4') && !open('PB5') && !open('PB7'));
  w.runner.registry.done.add('E3');
  w.runner.start('E4');
  assert.ok(open('PB3') && open('PB4') && !open('PB5'));
  w.play();
  w.items.get('take:connectorKey').onUse();
  w.play();
  w.runner.start('E5');
  assert.ok(open('PB5') && open('PB6') && !open('PB7'));
  w.play();
  w.runner.start('E6');
  assert.ok(open('PB7'));
  assert.equal(powerbanks.find((b) => b.id === 'PB7').level, 4);
  assert.ok(map.resolve('A5F-2').item.key === 'hasClassKey', 'PB7 교실 = 2-13 열쇠 방');
});

test('교무실 열쇠함: 걸어서 손 닿는 자리, 원경 귀신 자리는 2층 동쪽·북쪽 복도 모퉁이', () => {
  const key = story.pickups.find((p) => p.id === 'connectorKey');
  const d = distances(openWorld(), POINTS.staff);
  const n = d.near(key.pos[0], key.pos[1], key.level, 1.5);
  assert.ok(n, '열쇠함 1.5 m 안에 설 수 있다');
  assert.equal(map.locate(key.pos[0], key.pos[1], key.level)?.id, '2F-staff');
  const g = story.sightings[0];
  assert.ok(['E', 'N'].includes(map.locate(g.pos[0], g.pos[1], g.level)?.id), map.locate(g.pos[0], g.pos[1], g.level)?.id);
});
