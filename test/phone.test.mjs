// 핸드폰 배터리 규칙 (STORY 8장): 시작값·확인 비용·라이트 소모·보조배터리·0%·경고·체크포인트·태민 시점·깜빡임 안전
import test from 'node:test';
import assert from 'node:assert/strict';
import { Phone, flickerStep } from '../src/phone/phone.js';
import { PowerBanks, seenBy } from '../src/phone/bank.js';
import { PHONE } from '../src/config.js';
import { StoryRunner } from '../src/story/runner.js';
import { loadStory, loadSkeletons, fakeUI } from './helpers.mjs';

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('시작 배터리: 86~92 정수, 양 끝값 포함, E1(begin) 때 다시 정함', () => {
  assert.equal(new Phone(PHONE, () => 0).battery, 86);
  assert.equal(new Phone(PHONE, () => 0.999999).battery, 92);
  const seen = new Set();
  const p = new Phone(PHONE);
  for (let i = 0; i < 2000; i++) {
    p.begin();
    assert.ok(Number.isInteger(p.battery) && p.battery >= 86 && p.battery <= 92, `${p.battery}`);
    seen.add(p.battery);
  }
  assert.equal(seen.size, 7, '86~92 가 모두 나옴');
  const q = new Phone(PHONE, seq(0, 0.99));
  assert.equal(q.battery, 86);
  q.begin();
  assert.equal(q.battery, 92);
  assert.ok(q.begun);
});

test('화면 확인: 열 때마다 −2%, 열려 있는 동안은 추가 소모 없음, 닫았다 다시 열면 −2%', () => {
  const p = new Phone(PHONE, () => 0.5); // 89
  assert.equal(p.battery, 89);
  assert.equal(p.toggleScreen(), true);
  assert.equal(p.battery, 87);
  p.openScreen(); // 이미 열림
  p.update(60); // 라이트 꺼짐 → 소모 없음
  assert.equal(p.battery, 87);
  assert.equal(p.toggleScreen(), false);
  assert.equal(p.battery, 87, '닫을 때는 소모 없음');
  p.toggleScreen();
  assert.equal(p.battery, 85);
});

test('라이트: 켜진 동안 20초당 −1% (분당 3%), 꺼지면 멈춤, 화면이 열려 있어도 켜고 끌 수 있음', () => {
  const p = new Phone(PHONE, () => 0.5); // 89
  p.openScreen(); // 87
  assert.equal(p.toggleLight(), true);
  for (let i = 0; i < 20 * 60; i++) p.update(1 / 60);
  near(p.battery, 86, 1e-6);
  assert.equal(p.level, 86);
  p.update(60);
  near(p.battery, 83, 1e-6);
  assert.equal(p.screenOpen, true);
  assert.equal(p.toggleLight(), false);
  p.update(100);
  near(p.battery, 83, 1e-6);
  near(PHONE.LIGHT_COST_PER_SEC * 60, 3);
  // 표시값은 올림: 86.5 → 87
  p.s.battery = 86.5;
  assert.equal(p.level, 87);
});

test('보조배터리: +15%, 상한 100 (넘는 양은 버림), 같은 것 두 번 못 주움', () => {
  const p = new Phone(PHONE, () => 0.5); // 89
  assert.deepEqual(p.pickBank('PB1'), { ok: true, reason: '' });
  assert.equal(p.battery, 100);
  assert.equal(p.pickBank('PB1').reason, 'picked');
  p.s.battery = 40;
  p.pickBank('PB2');
  assert.equal(p.battery, 55);
  assert.deepEqual([...p.picked], ['PB1', 'PB2']);
});

test('0%: 라이트·화면이 꺼지고 다시 켤 수 없음, 충전하면 다시 쓸 수 있음', () => {
  const p = new Phone(PHONE, () => 0.5);
  let dead = 0;
  p.onDead = () => dead++;
  p.setLight(true);
  p.openScreen();
  p.s.battery = 0.5;
  p.update(20);
  assert.equal(p.battery, 0);
  assert.equal(p.dead, true);
  assert.equal(p.lightOn, false);
  assert.equal(p.screenOpen, false);
  assert.equal(dead, 1);
  assert.equal(p.setLight(true), false);
  assert.equal(p.openScreen(), false);
  assert.equal(p.toggleScreen(), false);
  p.update(100);
  assert.equal(p.battery, 0);
  assert.equal(dead, 1, '0% 알림은 한 번');
  // 화면 열기 비용으로 0% 가 되면 열리지 않음
  const q = new Phone(PHONE, () => 0.5);
  q.s.battery = 1;
  assert.equal(q.openScreen(), false);
  assert.equal(q.screenOpen, false);
  assert.equal(q.dead, true);
  // 충전
  p.pickBank('PB3');
  assert.equal(p.battery, 15);
  assert.equal(p.dead, false);
  assert.equal(p.setLight(true), true);
});

test('경고: 20%·10% 에 처음 닿을 때 한 번씩 (충전 뒤 다시 내려가도 반복하지 않음)', () => {
  const p = new Phone(PHONE, () => 0.5);
  const warns = [];
  p.onWarn = (lv) => warns.push(lv);
  p.s.battery = 21;
  p.setLight(true);
  for (let i = 0; i < 40 * 10; i++) p.update(0.1); // 40초 → 19%
  assert.deepEqual(warns, [20]);
  p.charge(5);
  p.update(200); // 24 → 14
  assert.deepEqual(warns, [20]);
  near(p.battery, 14, 1e-6);
  p.s.battery = 14; // 부동소수 오차 제거
  p.openScreen(); // 12
  p.closeScreen();
  p.openScreen(); // 10
  assert.deepEqual(warns, [20, 10]);
  assert.equal(p.low, true);
  p.update(60);
  assert.deepEqual(warns, [20, 10]);
});

test('태민 시점: 55% 따로 시작, 같은 소모 규칙, 보조배터리 없음, 주인공 핸드폰은 그대로', () => {
  const p = new Phone(PHONE, () => 0.5); // 89
  p.openScreen(); // 87
  p.usePov('mingeon');
  assert.equal(p.battery, PHONE.MINGEON_START);
  assert.equal(p.battery, 55);
  assert.equal(p.screenOpen, false);
  p.openScreen();
  assert.equal(p.battery, 53);
  p.setLight(true);
  p.update(20);
  near(p.battery, 52);
  assert.equal(p.pickBank('PB9').reason, 'pov');
  assert.equal(p.picked.size, 0);
  p.usePov('player');
  assert.equal(p.battery, 87);
  p.usePov('mingeon');
  near(p.battery, 52, 1e-9);
});

test('체크포인트 왕복: 배터리·라이트·주운 보조배터리·시점별 핸드폰 (러너 체크포인트에 등록)', () => {
  const { story, characters } = loadStory();
  const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const p = new Phone(PHONE, () => 0.5);
  r.onPov = (pov) => p.usePov(pov);
  r.checkpoints.register('phone', { save: () => p.save(), load: (v) => p.load(v) });
  p.pickBank('PB1');
  p.s.battery = 63.25;
  p.setLight(true);
  const snap = JSON.parse(JSON.stringify(r.snapshot()));
  assert.equal(snap.parts.phone.states.player.battery, 63.25);

  p.pickBank('PB2');
  p.setLight(false);
  r.setPov('mingeon');
  p.openScreen();
  r.restore(snap);
  assert.equal(r.pov, 'player');
  assert.equal(p.pov, 'player');
  assert.equal(p.battery, 63.25);
  assert.equal(p.lightOn, true);
  assert.deepEqual([...p.picked], ['PB1']);
  assert.equal(p.states.mingeon, undefined, '저장 시점에 없던 태민 핸드폰은 사라짐');
});

test('E1 시작 때 배터리 확정 (스토리 러너 연결), 그 전 값은 임시', () => {
  const { story, characters } = loadStory();
  const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const p = new Phone(PHONE, seq(0, 0.99));
  r.onEvent = (id, phase) => id === PHONE.BEGIN_EVENT && phase === 'start' && p.begin();
  assert.equal(p.battery, 86);
  assert.equal(p.begun, false);
  p.setLight(true);
  r.next();
  assert.equal(r.event.id, 'E1');
  assert.equal(p.battery, 92);
  assert.equal(p.begun, true);
  assert.equal(p.lightOn, true, '켜 둔 라이트는 그대로');
});

test('보조배터리 줍기: from 사건 이후에만, 주우면 상호작용 대상에서 빠짐', () => {
  const { story, characters } = loadStory();
  const { powerbanks } = loadSkeletons();
  const r = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 1, subtitlePerChar: 0 } });
  const items = new Map();
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id) };
  const p = new Phone(PHONE, () => 0.5);
  const msgs = { bankLabel: 'x', bankTooEarly: '{id} {event}', bankPicked: '{n} {level}', bankPov: 'pov', bankNone: 'none', bankPlaced: '{id}' };
  const toasts = [];
  const banks = new PowerBanks({ phone: p, defs: powerbanks, interactions, seen: seenBy(r.registry), msgs, toast: (m) => toasts.push(m), gain: PHONE.BANK_GAIN });
  assert.equal(banks.debugPlaceNext(0, 0), 'PB1');
  assert.equal(items.get('PB1').label, 'x');
  assert.equal(items.get('PB1').onUse().reason, 'early', 'E1 전에는 못 주움');
  r.next(); // E1
  p.s.battery = 50;
  assert.equal(items.get('PB1').onUse().ok, true);
  assert.equal(p.battery, 65);
  assert.ok(!items.has('PB1'));
  assert.equal(banks.debugPlaceNext(0, 0), 'PB2');
  assert.equal(banks.debugPlaceNext(1, 0), 'PB3');
  assert.equal(banks.pick('PB3').reason, 'early', 'PB3 은 E4 이후');
  // 복원으로 주운 상태가 되면 월드에서 뺌
  p.picked.add('PB2');
  banks.sync();
  assert.ok(!items.has('PB2'));
  assert.ok(items.has('PB3'));
});

test('저전력 흐려짐: 상태가 바뀌는 횟수는 어느 1초 안에서도 3회 미만 (광과민성 안전)', () => {
  const cfg = PHONE.LIGHT.flicker;
  assert.ok(cfg.length >= 0.36 && cfg.every[0] >= 0.36);
  let st = { dim: false, left: 0.01 };
  const changes = [];
  const rng = seq(0, 0.3, 0.9, 0.1);
  const dt = 1 / 120;
  for (let i = 0; i < 120 * 120; i++) {
    const next = flickerStep(st, dt, rng, cfg);
    if (next.dim !== st.dim) changes.push(i * dt);
    st = next;
  }
  assert.ok(changes.length > 10, '흐려짐이 실제로 일어남');
  for (let i = 0; i + 2 < changes.length; i++) assert.ok(changes[i + 2] - changes[i] > 1 - 1e-9, `3회가 1초 안: ${changes[i]}`);
});
