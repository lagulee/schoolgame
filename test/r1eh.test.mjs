// 단계 19(6b): R1 뒷부분 — R1-d 뒤 5초 → R1-e {mingeon} 시점 전환(암전 속 교무실로, 핸드폰 55%·보조배터리 없음) → P4({mingeon}+당직)
// → R1-f 복도에서 {gyuha}의 목소리·검은 연기·점프스케어 #2·당직 사망 → R1-g 마지막 추격 C3 → R1-h 주인공 시점 복귀·흔적·탈출 = 엔딩 A.
// 화면 없이 StoryRunner + 실제 장면 모듈 (test/worldR1.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/chase/sim.js';
import { ChasePath } from '../src/scene/path.js';
import { yawTo } from '../src/scene/finale.js';
import { CHASE, PLAYER, SCENE, STAMINA, PHONE } from '../src/config.js';
import { story, chases, nav, C3, C4, DT, SCARE, r1, world, playToR1d, toP4, solveP4, toChase, runRoute } from './worldR1.mjs';

const POV_T = SCENE.pov.out + SCENE.pov.black + SCENE.pov.in;
const bankIds = (w) => [...w.items.keys()].filter((k) => /^PB\d$/.test(k));

// 값 목록의 방향 전환 횟수 (깜빡임 검사)
function turns(series) {
  let n = 0;
  let dir = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d);
    if (dir && s !== dir) n++;
    dir = s;
  }
  return n;
}

test('데이터: R1-e~R1-h 트리거(R1 만)·목표·길 안내·행동 줄이 가리키는 정의, J4 = R1-f #2, R1-h = 엔딩 A', () => {
  for (const id of ['R1-e', 'R1-f', 'R1-g', 'R1-h']) {
    const tr = story.triggers.filter((t) => t.event === id);
    assert.equal(tr.length, 1, id);
    assert.deepEqual(tr[0].routes, ['R1'], `${id} 는 R1 에서만`);
    const ev = r1(id);
    for (const k of [ev.objective, ev.objectiveDone].filter(Boolean)) {
      assert.ok(story.objectives[k], `${id} 목표 ${k}`);
      assert.ok(nav.goals[k], `${id} 길 안내 ${k}`);
    }
    const table = { reach: 'reaches', scare: 'scares', look: 'looks', sound: 'sounds', vanish: 'vanishes', switch: 'switches', escape: 'escapes' };
    for (const l of ev.lines.filter((x) => x.do && table[x.do])) assert.ok(story[table[l.do]]?.[l.id], `${id}: ${l.do} ${l.id}`);
  }
  assert.deepEqual(r1('R1-e').lines[0], { do: 'switch', id: 'toMingeon' }, '태민 시점은 첫 줄에서 전환');
  assert.deepEqual(r1('R1-h').lines[0], { do: 'switch', id: 'toPlayer' }, '주인공 시점 복귀도 첫 줄');
  assert.equal(story.switches.toMingeon.pov, 'mingeon');
  assert.equal(story.switches.toPlayer.pov, 'player');
  assert.equal(r1('R1-e').pov, 'mingeon');
  assert.equal(r1('R1-h').pov, 'player');
  assert.equal(r1('R1-e').set.hasExitKey, true);
  assert.equal(r1('R1-e').withDuty, true, 'R1-e 의 P4 는 당직 말투');
  assert.equal(story.scares.J4.n, 2);
  assert.equal(story.scares.J4.event, 'R1-f');
  assert.equal(r1('R1-f').jumpscare, 2);
  assert.ok(r1('R1-f').lines.some((l) => l.do === 'scare' && l.id === 'J4'));
  assert.equal(r1('R1-h').ending, 'A');
  assert.equal(story.endings.A.route, 'R1');
  assert.ok(story.endings.A.survivors.includes('mingeon') && story.endings.A.survivors.includes('dohyeon'));
  assert.deepEqual(r1('R1-g').finale, { companion: 'duty', fleeing: ['mingeon'], atExit: 'escape' });
  // 대사는 임시 표시
  for (const id of ['R1-e', 'R1-f', 'R1-g', 'R1-h']) for (const l of r1(id).lines.filter((x) => x.text)) assert.match(l.text, /^\[임시\]/, `${id}: ${l.text}`);
});

test('C3 경로·시뮬레이션 회귀: C4 와 같은 실제 경로 40 m(현관 유리문 앞), 걷기 위주 실패·평범 5.42 m·최적 10.92 m', () => {
  const path = new ChasePath(C3.path);
  const [ax, az, al] = path.at(C3.path.startAt + C3.pathLength);
  assert.ok(ax > 15 && ax < 18.2 && az > -3.4 && az < -2.0, `도착 자리 ${ax.toFixed(2)}, ${az.toFixed(2)}`);
  assert.equal(al, 0);
  assert.equal(path.at(C3.path.startAt)[2], 1, '2층 복도에서 시작');
  assert.equal(path.at(C3.path.startAt + 17)[2], 0.5, '계단참');
  const t = story.triggers.find((x) => x.event === 'R1-f');
  const zs = path.at(C3.path.startAt)[1];
  assert.ok(t.rect[1] <= zs + 1 && t.rect[3] >= zs - 1, `R1-f 자리 ${t.rect} / 경로 시작 z ${zs}`);
  assert.deepEqual([C3.ghostSpeed, C3.startGap, C3.companionKillDelay, C3.unlockTime], [3.4, 3, 4, 1.0], 'STORY 14-4 마지막 추격 수치');
  const cfg = { chase: CHASE, stamina: STAMINA, player: PLAYER };
  const walkish = simulate(C3, CHASE.SIM.profiles.walkish, cfg);
  const normal = simulate(C3, CHASE.SIM.profiles.normal, cfg);
  const optimal = simulate(C3, CHASE.SIM.profiles.optimal, cfg);
  assert.equal(walkish.outcome, 'caught');
  assert.equal(normal.outcome, 'exit');
  assert.equal(optimal.outcome, 'exit');
  assert.ok(Math.abs(normal.arrivalGap - 5.42) < 0.05, `평범 ${normal.arrivalGap}`);
  assert.ok(Math.abs(optimal.arrivalGap - 10.92) < 0.05, `최적 ${optimal.arrivalGap}`);
  const c4 = simulate(C4, CHASE.SIM.profiles.normal, cfg);
  assert.ok(Math.abs(c4.arrivalGap - normal.arrivalGap) < 1e-9, 'C3·C4 는 같은 수치');
});

test('자동 진행 R1 전체: E7 → R1-a~R1-d → R1-e(태민 시점) → R1-f → R1-g(C3) → R1-h → 엔딩 A, endingsSeen 에 A', () => {
  const w = world({ from: 'E6' });
  assert.equal(w.runner.route, 'R1');
  playToR1d(w);
  const myBattery = w.phone.battery;
  toP4(w);
  assert.equal(w.runner.pov, 'mingeon');
  w.phone.setLight(true);
  solveP4(w);
  assert.equal(w.runner.flags.get('hasExitKey'), true);
  toChase(w);
  runRoute(w);
  assert.equal(w.chase.last?.outcome, 'exit', `C3 도착 (${w.chase.last?.outcome})`);
  assert.equal(w.chase.last.finale, 'escape');
  w.finish('R1-g');
  assert.equal(w.runner.event?.id, 'R1-h', 'R1-g 가 끝나면 바로 R1-h');
  w.tick(story.switches.toPlayer.out + 0.05);
  assert.equal(w.runner.pov, 'player');
  assert.equal(w.phone.pov, 'player');
  assert.equal(w.phone.battery, myBattery, '주인공 핸드폰 배터리는 태민 구간 동안 그대로');
  for (let i = 0; i < 60 * 30 && w.runner.mode !== 'ending'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.equal(w.runner.mode, 'ending');
  assert.match(w.runner.ui.shown.speaker, /R1 → 엔딩 A/);
  assert.deepEqual(w.endings.list(), ['A'], 'endingsSeen 에 A');
  assert.deepEqual(w.runner.registry.history, ['E7', 'R1-a', 'R1-b', 'R1-c', 'R1-d', 'R1-e', 'R1-f', 'R1-g', 'R1-h']);
  for (const id of ['E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15']) assert.ok(!w.runner.registry.history.includes(id), `${id} 없음`);
  assert.ok(w.me.x < 15, `학교 밖으로 나왔다 (x ${w.me.x.toFixed(2)})`);
  const js = story.events.filter((e) => w.runner.registry.history.includes(e.id) && e.routes.includes('R1') && e.jumpscare).map((e) => e.jumpscare);
  assert.deepEqual(js, [1, 2], '이 판의 점프스케어 = E7 #1, R1-f #2');
});

test('R1-e: 5초 뒤 시작, 암전 속에서 교무실로 옮겨지고 태민 핸드폰(55%·라이트 켜짐)·스태미나 가득, 보조배터리는 사라진다', () => {
  const w = world();
  w.phone.s.battery = 71.5;
  w.stamina.value = 40;
  assert.ok(bankIds(w).length > 0, '주인공 시점엔 보조배터리가 놓여 있다');
  w.tick(4.8);
  assert.equal(w.runner.event, null, '5초 전에는 아직');
  assert.equal(w.runner.objectiveKey(), 'wait');
  w.tick(0.3);
  assert.equal(w.runner.event?.id, 'R1-e');
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.phone.pov, 'mingeon');
  assert.ok(Math.abs(w.phone.battery - PHONE.MINGEON_START) < 0.01, `태민 핸드폰 ${w.phone.battery}`);
  assert.equal(w.phone.lightOn, PHONE.MINGEON_LIGHT);
  assert.deepEqual(bankIds(w), [], '태민 시점에는 보조배터리가 없다');
  assert.deepEqual(w.runner.action, { do: 'switch', id: 'toMingeon' });
  assert.deepEqual([w.me.x, w.me.z, w.me.level], [22, -32, 3], '어두워지는 동안은 아직 당직실');
  w.tick(SCENE.pov.out + 0.05);
  assert.equal(w.pov.phase, 'black');
  const S = story.switches.toMingeon;
  assert.deepEqual([w.me.x, w.me.z, w.me.level], [S.pos[0], S.pos[1], S.level], '암전 속에서 교무실로');
  assert.equal(w.stamina.value, 100, '태민은 스태미나 가득');
  assert.deepEqual(w.pov.bodies.player.pose.pos, [22, PLAYER.eye, -32], '주인공 자리 저장 (플레이어 스냅샷)');
  assert.equal(w.pov.bodies.player.stamina.value, 40);
  w.tick(SCENE.pov.black + SCENE.pov.in + 0.1);
  assert.notEqual(w.runner.action?.do, 'switch', '밝아지면 다음 줄');
  assert.equal(w.pov.active, false);
  assert.equal(w.runner.objectiveKey(), 'findExitKey');
});

test('R1-e P4: 당직 말투 안내, 틀리면 귀신이 다가오고 3번이면 퍼즐 시작 자리로 (태민 시점 유지), 47번 → 열쇠·문자', () => {
  const w = world();
  toP4(w);
  w.phone.setLight(false);
  w.items.get('p4:key:47').onUse();
  assert.match(w.toasts.at(-1), /당직 아저씨/, '라이트가 꺼져 있으면 당직이 라이트를 켜라고 한다');
  w.phone.setLight(true);
  const start = [w.me.x, w.me.z];
  const snap = w.runner.snapshot();
  for (const n of ['74', '41']) w.items.get(`p4:key:${n}`).onUse();
  assert.equal(w.puzzle.puzzle.wrong, 2);
  assert.match(w.toasts.at(-1), /당직 아저씨/);
  w.me.x = 18.8;
  w.items.get('p4:key:38').onUse();
  assert.equal(w.puzzle.attemptOf('P4'), 1, '세 번 틀리면 잡힘');
  assert.deepEqual([w.me.x, w.me.z], start, '퍼즐 시작 자리로');
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.phone.pov, 'mingeon');
  assert.equal(w.pov.body, 'mingeon');
  assert.deepEqual(bankIds(w), [], '복원 뒤에도 보조배터리 없음');
  // 저장해 둔 체크포인트로도 같은 상태
  w.runner.reset();
  w.runner.restore(snap);
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.pov.body, 'mingeon');
  assert.ok(w.pov.bodies.player, '주인공 자리 스냅샷도 함께 복원');
  w.tick();
  solveP4(w);
  assert.ok(w.runner.flags.get('hasExitKey'));
  assert.equal(w.runner.objectiveKey(), 'keyToLobby');
  assert.ok(r1('R1-e').lines.some((l) => l.style === 'sms' && l.who === 'mingeon'), '주인공에게 현관으로 오라는 문자');
});

test('R1-f: 등 뒤 목소리 → 북쪽 돌아봄 → 검은 연기 → 점프스케어 #2 → 비명 → 남쪽으로 → R1-g 추격 C3(처리 4초, 스태미나 가득)', () => {
  const w = world();
  toP4(w);
  solveP4(w);
  w.stamina.value = 30;
  w.at(16.5, -31.1, 1);
  assert.equal(w.runner.event?.id, 'R1-f');
  w.me.yaw = Math.PI;
  const seen = [];
  let scareShown = false;
  for (let i = 0; i < 900 && w.runner.action?.do !== 'chase'; i++) {
    const a = w.runner.action;
    const k = a ? `${a.do}${a.id ? `:${a.id}` : ''}` : null;
    if (k && seen.at(-1) !== k) seen.push(k);
    if (w.steps.scare) scareShown = true;
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.deepEqual(seen.filter((a) => !a.startsWith('sound')), ['look:north', 'vanish:gyuhaR1f', 'scare:J4', 'look:south']);
  assert.ok(scareShown, '점프스케어가 나온다');
  assert.ok(w.sounds.some((s) => s.kind === 'sting'), '붙잡히는 소리');
  assert.ok(w.runner.registry.done.has('R1-f'));
  assert.equal(w.chase.current.id, 'C3');
  assert.equal(w.chase.current.atExit, 'escape');
  assert.equal(w.chase.chase.phase, 'kill', '{duty} 처리 4초 동안 귀신 정지');
  assert.equal(w.stamina.value, 100, '마지막 추격 = 스태미나 가득');
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.runner.objectiveKey(), 'runExit');
});

test('C3 잡힘 → 추격 시작 자리·태민 시점·태민 배터리로 되돌아가고 gap +2 m, 달리면 도착 → 문 여는 1초 → R1-h', () => {
  const w = world();
  toP4(w);
  solveP4(w);
  toChase(w);
  const start = [w.me.x, w.me.z, w.me.level];
  const battery = w.phone.battery;
  w.phone.s.battery -= 3; // 추격 중 배터리를 쓴 셈
  runRoute(w, PLAYER.walk);
  assert.equal(w.chase.attemptOf('C3', 'escape'), 1, '걷기만 하면 잡힌다');
  assert.equal(w.chase.chase.startGap, C3.startGap + CHASE.retryGapStep);
  assert.deepEqual([w.me.x, w.me.z, w.me.level], start, '추격 시작 자리로');
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.phone.pov, 'mingeon');
  assert.ok(Math.abs(w.phone.battery - battery) < 0.2, '태민 배터리도 추격 시작 때 값');
  assert.ok(w.pov.bodies.player, '주인공 스냅샷은 남아 있다');
  runRoute(w);
  assert.equal(w.chase.last?.outcome, 'exit');
  assert.ok(w.chase.last.arrivalGap >= 4.9, `도착 거리 ${w.chase.last.arrivalGap.toFixed(1)} m`);
  w.finish('R1-g');
  assert.equal(w.runner.event?.id, 'R1-h');
});

test('R1-h: 주인공 시점으로 돌아와 스태미나·배터리가 되살아나고, 핸드폰을 내려다본 뒤 문을 지나 밖으로 → 암전 → 엔딩 A, 카드를 닫으면 밝아진다', () => {
  const w = world();
  w.stamina.value = 55;
  const myBattery = w.phone.battery;
  toP4(w);
  solveP4(w);
  toChase(w);
  runRoute(w);
  w.finish('R1-g');
  assert.equal(w.runner.event?.id, 'R1-h');
  assert.deepEqual(bankIds(w).length > 0, true, '주인공 시점으로 돌아오면 보조배터리가 다시 놓인다');
  assert.equal(w.phone.battery, myBattery);
  w.tick(story.switches.toPlayer.out + 0.05);
  const P = story.switches.toPlayer;
  assert.deepEqual([w.me.x, w.me.z, w.me.level], [P.pos[0], P.pos[1], P.level], '현관 홀 유리문 앞');
  assert.equal(w.stamina.value, 55, '주인공 스태미나는 떠날 때 값');
  w.tick(P.black + P.in + 0.1);
  for (let i = 0; i < 300 && w.runner.action?.do !== 'look'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.deepEqual(w.runner.action, { do: 'look', id: 'gyuhaPhone' });
  w.tick(story.looks.gyuhaPhone.time + 0.05);
  const [px, pz] = story.looks.gyuhaPhone.at;
  assert.ok(Math.abs(Math.sin(w.me.yaw - yawTo(w.me.x, w.me.z, px, pz))) < 0.02, '바닥의 핸드폰 쪽');
  assert.ok(Math.abs(w.me.pitch - (story.looks.gyuhaPhone.pitch * Math.PI) / 180) < 1e-6, '내려다본다');
  assert.equal(story.traces.find((t) => t.id === 'gyuhaPhone').after, 'E2', '흔적(깨진 핸드폰)은 E2 뒤로 문 앞에 있다');
  for (let i = 0; i < 300 && w.runner.action?.do !== 'escape'; i++) w.tick();
  assert.deepEqual(w.runner.action, { do: 'escape', id: 'frontDoor' });
  const E = SCENE.escape;
  w.tick(E.turn + E.walk + 0.1);
  const F = story.escapes.frontDoor;
  assert.ok(Math.hypot(w.me.x - F.to[0], w.me.z - F.to[1]) < 1e-6, '문을 지나 밖으로');
  assert.equal(w.runner.mode, 'action');
  assert.equal(w.endings.list().length, 0);
  w.tick(E.dark + E.hold + 0.2);
  assert.equal(w.runner.mode, 'ending');
  assert.deepEqual(w.endings.list(), ['A']);
  assert.equal(w.log.veil.at(-1), 1, '카드가 떠 있는 동안 암전');
  w.runner.advance();
  w.tick(E.recover + 0.3);
  assert.equal(w.escape.active, false);
  assert.equal(w.log.veil.at(-1), 0, '밝아진다');
  assert.equal(w.log.frozen.at(-1), false, '조작이 풀린다');
});

test('검은 막은 깜빡이지 않는다: 시점 전환은 한 번 어두워졌다 밝아지고(방향 전환 1번), 탈출은 어두워지기만 한다', () => {
  const w = world();
  w.tick(5.1);
  const a = w.log.veil.length;
  w.tick(POV_T + 0.2);
  const sw = w.log.veil.slice(a);
  assert.equal(turns(sw), 1, `시점 전환 (방향 전환 ${turns(sw)}번)`);
  assert.ok(Math.max(...sw) === 1 && sw.at(-1) === 0);
  const step = Math.max(...sw.slice(1).map((v, i) => Math.abs(v - sw[i])));
  assert.ok(step * 30 < 1.5, `급변 없음 (${(step * 30).toFixed(2)}/s)`);
  assert.ok(SCENE.pov.out >= 1 && SCENE.pov.in >= 1, '충분히 천천히');
  // 탈출
  w.play();
  w.at(19.4, -45, 1);
  w.play();
  w.tick();
  solveP4(w);
  toChase(w);
  runRoute(w);
  w.finish('R1-g');
  for (let i = 0; i < 600 && w.runner.action?.do !== 'escape'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  const b = w.log.veil.length;
  w.tick(SCENE.escape.turn + SCENE.escape.walk + SCENE.escape.dark + SCENE.escape.hold + 0.2);
  const es = w.log.veil.slice(b);
  assert.equal(turns(es), 0, '탈출: 짙어지기만 한다');
  assert.equal(es.at(-1), 1);
});

test('조작 정지: 전환·첫 대사 동안 정지 → 열쇠 걸이로 걸어갈 땐 풀림, R1-f 내내 정지, 추격 중 풀림·도착 뒤 정지, R1-h 내내 정지', () => {
  const w = world();
  const frozenNow = () => w.log.frozen.at(-1);
  w.tick(5.1);
  assert.equal(frozenNow(), true, '전환 중');
  w.tick(POV_T + 0.2);
  assert.equal(w.runner.mode, 'line');
  assert.equal(frozenNow(), true, '당직 첫 대사 동안');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.tick();
  assert.equal(frozenNow(), false, '열쇠 걸이로 걸어갈 수 있다');
  w.at(19.4, -45, 1);
  w.play();
  w.tick();
  solveP4(w);
  w.at(16.5, -31.1, 1);
  assert.equal(w.runner.event?.id, 'R1-f');
  const from = w.log.frozen.length;
  for (let i = 0; i < 900 && w.runner.action?.do !== 'chase'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.ok(w.log.frozen.slice(from, -2).every(Boolean), 'R1-f 내내 정지 (R1-f 가 끝나 R1-g 가 걸리기 전 한 프레임 제외)');
  w.tick();
  assert.equal(frozenNow(), false, '추격 중에는 움직인다');
  runRoute(w);
  w.tick();
  assert.equal(frozenNow(), true, '도착 뒤(자막) 정지');
  w.finish('R1-g');
  const h = w.log.frozen.length;
  for (let i = 0; i < 60 * 30 && w.runner.mode !== 'ending'; i++) {
    if (w.runner.mode === 'line' && w.runner.ui.shown?.style === 'dialog') w.runner.advance();
    w.tick();
  }
  assert.ok(w.log.frozen.slice(h).every(Boolean), 'R1-h 내내 정지');
});

test('체크포인트·스토리 초기화: 태민 시점 사건 도중 저장 → 초기화 → 복원하면 시점·핸드폰·몸이 함께 돌아오고, 초기화하면 주인공으로', () => {
  const w = world();
  toP4(w);
  const snap = w.runner.snapshot();
  assert.equal(snap.parts.pov.body, 'mingeon');
  assert.equal(snap.parts.phone.pov, 'mingeon');
  assert.ok(snap.parts.pov.bodies.player);
  w.runner.reset();
  w.phone.reset();
  w.banks.placeAll();
  w.tick();
  assert.equal(w.runner.pov, 'player');
  assert.equal(w.pov.body, 'player', '초기화하면 몸도 주인공');
  assert.deepEqual(w.pov.bodies, {}, '저장한 자리도 비운다');
  assert.ok(bankIds(w).length > 0);
  w.runner.restore(snap);
  assert.equal(w.runner.pov, 'mingeon');
  assert.equal(w.phone.pov, 'mingeon');
  assert.equal(w.pov.body, 'mingeon');
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.deepEqual(bankIds(w), []);
  assert.equal(w.phone.battery <= PHONE.MINGEON_START, true);
});

test('다른 루트는 그대로: R3·R2 에는 R1-e~R1-h 가 걸리지 않고, R1 의 R1-f 자리는 R1-e 전에는 걸리지 않는다', () => {
  const w = world();
  w.at(16.5, -31.1, 1);
  w.tick(0.5);
  assert.equal(w.runner.event, null, 'R1-e 전에는 R1-f 자리에 가도 아무 일 없다');
  w.tick(5);
  assert.equal(w.runner.event?.id, 'R1-e', 'R1-d 뒤 5초 = R1-e (자리와 상관없이)');
  for (const route of ['R2', 'R3']) {
    const evs = story.events.filter((e) => e.routes.includes(route)).map((e) => e.id);
    for (const id of ['R1-e', 'R1-f', 'R1-g', 'R1-h']) assert.ok(!evs.includes(id), `${route} 에 ${id} 없음`);
  }
  assert.ok(chases.find((c) => c.id === 'C3').events.includes('R1-g'));
});
