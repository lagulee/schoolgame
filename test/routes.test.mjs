// 단계 20 (마감) 3루트 회귀: 학교 앞에서 시작해 R3 → 엔딩 C, R2 → 엔딩 B, R1 → 엔딩 A 까지 화면 없이 자동 진행한다.
// 각 판에서 사건 순서, 엔딩·endingsSeen, 점프스케어 수(한 판 3개 이내, STORY 12장), 화면 밝기 신호의 깜빡임(초당 3회 미만),
// 혼자일 때 연출(STORY 13-3)이 정해진 구간에서만 나오는지를 본다. 세 엔딩을 본 뒤의 판은 E1 에서 옥상 열쇠(hasRoofKey)를 받는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, story, DT } from './worldFull.mjs';
import { playRoute, ORDER } from './routeDrive.mjs';
import { flashStats } from './flicker.mjs';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { FINISH, SCENE } from '../src/config.js';
import { memoryStorage } from './helpers.mjs';

const ENDING = { R1: 'A', R2: 'B', R3: 'C' };
const SCARES = { R1: ['scare:J1', 'scare:J4'], R2: ['scare:J1', 'scare:J2', 'scare:J3'], R3: ['scare:J1', 'scare:J2', 'scare:J3'] };
const SIGNALS = ['veil', 'blood', 'scare', 'smoke', 'dim', 'lightDip'];
const shared = new EndingsSeen('routes', memoryStorage()); // 세 판이 같은 브라우저에서 이어서 하는 것처럼
const results = {};

function run(route) {
  const w = world({ endings: shared });
  playRoute(w, route);
  results[route] = w;
  return w;
}

test('깜빡임 검사 도구: 4 Hz 깜빡임은 초당 3회 이상으로 잡고, 2 Hz·한 번 어두워졌다 밝아지기는 3회 미만', () => {
  const sq = (hz, sec) => Array.from({ length: Math.round(sec / DT) }, (_, i) => (Math.floor(i * DT * hz * 2) % 2 ? 1 : 0));
  assert.ok(flashStats(sq(4, 3), DT).flashesPerSecond >= 3, '4 Hz');
  assert.ok(flashStats(sq(3, 3), DT).flashesPerSecond >= 3, '3 Hz 도 안 된다 (3회 "미만")');
  assert.ok(flashStats(sq(2, 3), DT).flashesPerSecond < 3, '2 Hz');
  const dip = Array.from({ length: 90 }, (_, i) => 1 - Math.sin((Math.PI * i) / 89));
  assert.ok(flashStats(dip, DT).flashesPerSecond <= 1, '3초에 걸쳐 한 번 어두워졌다 돌아옴');
  assert.equal(flashStats(dip, DT).moves, 2);
  assert.equal(flashStats(Array(60).fill(0.3), DT).moves, 0, '변화 없음');
  assert.equal(flashStats(Array.from({ length: 60 }, (_, i) => 0.5 + 0.03 * Math.sin(i)), DT).moves, 0, '작은 흔들림(10% 미만)은 세지 않는다');
});

for (const route of ['R3', 'R2', 'R1']) {
  test(`${route}: 학교 앞 → 엔딩 ${ENDING[route]} 자동 진행 (사건 순서·엔딩 기록)`, () => {
    const w = run(route);
    assert.equal(w.runner.route, route);
    assert.equal(w.runner.mode, 'ending');
    assert.match(w.runner.ui.shown.speaker, new RegExp(`${route} → 엔딩 ${ENDING[route]}`));
    assert.ok(shared.list().includes(ENDING[route]), `endingsSeen 에 ${ENDING[route]}`);
    assert.deepEqual(w.log.events, ORDER[route], '사건 순서');
    // 다른 루트 사건이 섞이지 않는다
    for (const ev of story.events.filter((e) => w.log.events.includes(e.id) && e.kind !== 'interaction')) assert.ok(!ev.routes || ev.routes.includes(route) || w.runner.registry.get(ev.id, route), ev.id);
  });

  test(`${route}: 점프스케어 ${SCARES[route].length}개 (한 판 3개 이내), 사건의 jumpscare 번호와 같다`, () => {
    const w = results[route] ?? run(route);
    const got = w.log.actions.filter((a) => a.startsWith('scare:'));
    assert.deepEqual(got, SCARES[route]);
    assert.ok(got.length <= 3);
    const nums = w.log.events.map((id) => w.runner.registry.get(id, route)).filter((e) => e?.jumpscare).map((e) => e.jumpscare);
    assert.deepEqual(nums, got.map((_, i) => i + 1), '번호는 1부터 차례로');
  });

  test(`${route}: 화면 밝기 신호(검은 막·붉은 막·점프스케어·연기·떨림·라이트 줄임)는 어느 1초에도 깜빡임 3회 미만`, () => {
    const w = results[route] ?? run(route);
    const frames = w.log.veil.length;
    assert.ok(frames * DT > 300, `판 길이 ${(frames * DT / 60).toFixed(1)}분`);
    for (const name of SIGNALS) {
      const s = flashStats(w.log[name], DT);
      assert.ok(s.flashesPerSecond < 3, `${name}: 1초에 ${s.flashesPerSecond}회 (변화 ${s.moves}번)`);
    }
    // 여러 신호가 같은 화면에 겹치므로 가장 어두운 쪽(막·실루엣의 최댓값)으로도 본다
    const combined = w.log.veil.map((v, i) => Math.max(v, w.log.blood[i], w.log.scare[i], w.log.smoke[i] * 0.6, 1 - w.log.dim[i], 1 - w.log.lightDip[i]));
    assert.ok(flashStats(combined, DT).flashesPerSecond < 3, '겹친 신호');
    assert.ok(Math.max(...w.log.veil) === 1, '암전은 있다 (엔딩)');
  });
}

test('혼자일 때 연출(13-3): 정해진 구간(E2 뒤 ~ E7, E9 뒤 ~ E10)에서만, 사건·추격·퍼즐이 없을 때, 속삭임·떨림 번갈아, 구간마다 3번 이내', () => {
  const w3 = results.R3 ?? run('R3');
  const w1 = results.R1 ?? run('R1');
  for (const w of [w3, w1]) {
    const log = w.alone.log;
    assert.ok(log.length >= 2, `연출 ${log.length}번`);
    for (const k of ['E2', 'E9']) assert.ok(log.filter((e) => e.key === k).length <= story.alone.max);
    assert.ok(log.every((e) => ['E2', 'E9'].includes(e.key)));
    assert.deepEqual(log.slice(0, 2).map((e) => e.kind), ['whisper', 'dim'], '번갈아');
    for (let i = 1; i < log.length; i++) if (log[i].key === log[i - 1].key) assert.ok(log[i].at - log[i - 1].at >= FINISH.alone.gap[0] - 1e-6, '쿨다운');
  }
  assert.ok(w3.alone.log.some((e) => e.key === 'E9'), 'R3: 구관으로 돌아가는 길에도');
  assert.ok(!w1.alone.log.some((e) => e.key === 'E9'), 'R1 에는 E9 가 없다');
  // 떨림은 한 번 어두워졌다 돌아올 뿐이고 너무 어둡지 않다
  assert.ok(Math.min(...w3.log.dim) >= FINISH.alone.dim.to - 1e-9);
  const D = FINISH.alone.dim;
  assert.ok(D.down + D.hold + D.up > 1 / 3, '한 번에 1/3초보다 길다');
});

test('세 엔딩(A·B·C)을 본 뒤의 판: E1 에서 옥상 열쇠(hasRoofKey)·2-13 열쇠(hasClassKey)를 받고, 2회차 목표 문구', () => {
  for (const r of ['R3', 'R2', 'R1']) results[r] ?? run(r);
  assert.deepEqual(shared.list().sort(), ['A', 'B', 'C']);
  assert.equal(shared.allMain, true);
  const w = world({ endings: shared });
  assert.equal(w.runner.repeat, true);
  w.at(17, -1, 0);
  assert.equal(w.runner.event?.id, 'E1');
  w.finish('E1');
  assert.equal(w.runner.flags.get('hasRoofKey'), true, '옥상 열쇠');
  assert.equal(w.runner.flags.get('hasClassKey'), true, '2-13 열쇠');
  const fresh = world();
  fresh.at(17, -1, 0);
  fresh.finish('E1');
  assert.equal(fresh.runner.flags.get('hasRoofKey'), false, '1회차는 없음');
});

test('조작 정지가 판 끝까지 풀리지 않는 일은 없다: 엔딩 직전까지 연속 정지 구간이 60초를 넘지 않는다 (P2 대기 제외)', () => {
  for (const r of ['R3', 'R2', 'R1']) {
    const w = results[r] ?? run(r);
    let run0 = 0;
    let worst = 0;
    for (const f of w.log.frozen) {
      run0 = f ? run0 + DT : 0;
      worst = Math.max(worst, run0);
    }
    assert.ok(worst < 60, `${r}: 가장 긴 조작 정지 ${worst.toFixed(1)}초`);
  }
  assert.ok(SCENE.pov.out + SCENE.pov.black + SCENE.pov.in < 10);
});
