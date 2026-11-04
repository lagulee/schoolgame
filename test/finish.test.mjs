// 단계 20 (마감): 실내 밝기 보정(저장·범위·배율), 조명 구역(STORY 15장 표), 혼자일 때 연출(STORY 13-3)의 규칙, 시작 화면 경고·엔딩 카드 다시 하기.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Brightness } from '../src/ui/brightness.js';
import { AloneAmbience } from '../src/scene/alone.js';
import { Atmosphere } from '../src/world/interior/atmosphere.js';
import { StoryRunner } from '../src/story/runner.js';
import { storyKey } from '../src/story/ui.js';
import { FINISH, INTERIOR } from '../src/config.js';
import { loadStory, fakeUI, memoryStorage } from './helpers.mjs';

const { story, characters } = loadStory();
const B = FINISH.bright;
const DT = 1 / 30;

test('밝기 보정: 5단계(−2~+2), 기본 0 = 지금 밝기(배율 1·노출 0), 범위 밖은 끝으로, 한 칸마다 배율이 커진다', () => {
  assert.deepEqual([B.min, B.def, B.max], [-2, 0, 2]);
  const b = new Brightness(B, memoryStorage());
  assert.equal(b.level, 0);
  assert.equal(b.light, 1);
  assert.equal(b.exposure, 0);
  assert.equal(b.label, '0');
  assert.equal(b.set(9), 2);
  assert.equal(b.label, '+2');
  assert.equal(b.set(-9), -2);
  assert.equal(b.label, '−2');
  let prev = 0;
  for (let v = B.min; v <= B.max; v++) {
    b.set(v);
    assert.ok(b.light > prev, `${v} 단계 배율 ${b.light}`);
    prev = b.light;
  }
  b.set(B.min);
  assert.ok(b.light > 0.4 && INTERIOR.inside.exposure + b.exposure > 0.4, '가장 어두워도 완전한 암흑은 아니다 (STORY 15-2)');
  b.set(B.max);
  assert.ok(b.light < 2.5, '가장 밝아도 2.5배 미만');
});

test('밝기 보정: 브라우저에 저장되고 다음 판에 그대로, 저장이 막혀 있거나 이상한 값이면 기본값, 바뀔 때만 알림', () => {
  const store = memoryStorage();
  const a = new Brightness(B, store);
  const seen = [];
  a.onChange = (v) => seen.push(v);
  a.step(1);
  a.step(1);
  a.step(1); // 끝 (+2) 에서 더 올리면 그대로
  assert.deepEqual(seen, [1, 2]);
  assert.equal(new Brightness(B, store).level, 2, '다시 열어도 +2');
  store.setItem(B.key, 'abc');
  assert.equal(new Brightness(B, store).level, B.def, '이상한 값');
  store.setItem(B.key, '7');
  assert.equal(new Brightness(B, store).level, B.max, '범위 밖 값은 끝으로');
  const broken = new Brightness(B, memoryStorage(true));
  assert.equal(broken.level, B.def, '저장소 막힘 = 기본값');
  assert.equal(broken.set(-1), -1, '막혀 있어도 이번 판에는 바뀐다');
  assert.equal(new Brightness(B, null).level, B.def);
  // 터치 메뉴 한 칸: 0 → +1 → +2 → −2 → −1 → 0
  const c = new Brightness(B, null);
  assert.deepEqual([1, 2, 3, 4, 5].map(() => c.cycle()), [1, 2, -2, -1, 0]);
});

test('조명 구역(STORY 15장 표): 구관 1층(현관·복도) = 기준, 구관 2층 위·신관·연결통로 = 더 어둡게, 바깥은 그대로', () => {
  const Z = FINISH.zones;
  const at = (inside, where, level) => Atmosphere.prototype.zoneTarget.call({ inside, where }, { level });
  assert.equal(at(false, null, 0), 1);
  assert.equal(at(true, 'main', 0), Z.lobby);
  assert.equal(at(true, 'main', 1), Z.upper);
  assert.equal(at(true, 'main', 3), Z.upper, '당직실(4층)');
  assert.equal(at(true, 'main', 0.5), Z.upper, '1층 위 계단참부터');
  assert.equal(at(true, 'annex', 1), Z.annex);
  assert.equal(at(true, 'bridge', 2), Z.bridge);
  for (const k of ['upper', 'annex', 'bridge']) assert.ok(Z[k] < Z.lobby && Z[k] >= 0.6, `${k} ${Z[k]}: 매우 어둡되 밝기 보정 −2 와 겹쳐도 윤곽은 남게`);
  assert.ok(Z.fade >= 1, '구역이 바뀔 때 천천히 (깜빡임 없음)');
});

// 혼자일 때 연출을 시험하는 작은 세계: 진행기 + 사건 기록만
function lonely({ rand = () => 0.5 } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  let inside = true;
  const a = new AloneAmbience({ runner, def: story.alone, cfg: FINISH.alone, inside: () => inside, rand });
  const run = (sec) => {
    const out = [];
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      const f = a.update(DT);
      if (f) out.push(f.kind);
    }
    return out;
  };
  return { runner, a, run, setInside: (v) => (inside = v) };
}

test('혼자일 때 연출: 데이터 구간은 실제 사건을 가리키고 after 가 until 보다 먼저, 구간 밖(E2 전·E7 뒤)에는 나오지 않는다', () => {
  const ids = new Set(story.events.map((e) => e.id));
  for (const w of story.alone.windows) {
    assert.ok(ids.has(w.after) && ids.has(w.until), JSON.stringify(w));
    const order = story.events.map((e) => e.id);
    assert.ok(order.indexOf(w.after) < order.indexOf(w.until));
  }
  const w = lonely();
  assert.deepEqual(w.run(400), [], 'E2 전 (진짜 {gyuha}와 함께)');
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']) w.runner.registry.done.add(id);
  assert.deepEqual(w.run(400), [], 'E7 뒤 ({dohyeon}와 함께)');
});

test('혼자일 때 연출: 첫 연출은 구간에 들어선 뒤 20~35초, 그다음은 60~120초 간격, 속삭임·떨림 번갈아, 구간마다 3번까지', () => {
  const w = lonely({ rand: () => 0 });
  for (const id of ['E1', 'E2']) w.runner.registry.done.add(id);
  assert.deepEqual(w.run(FINISH.alone.first[0] - 0.5), []);
  assert.deepEqual(w.run(1), ['whisper']);
  assert.deepEqual(w.run(FINISH.alone.gap[0] - 1), []);
  assert.deepEqual(w.run(2), ['dim']);
  assert.deepEqual(w.run(FINISH.alone.gap[0]), ['whisper']);
  assert.deepEqual(w.run(600), [], `구간마다 ${story.alone.max}번까지`);
  // 다음 구간(E9 뒤)에서는 다시 처음부터
  for (const id of ['E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9']) w.runner.registry.done.add(id);
  assert.deepEqual(w.run(FINISH.alone.first[0] + 0.5), ['dim'], '번갈아 이어서');
  w.runner.registry.history.push('E10');
  assert.deepEqual(w.run(600), [], 'E10 이 시작되면 끝');
});

test('혼자일 때 연출: 사건 대사·추격·퍼즐 중이거나 건물 밖이면 기다렸다가 나온다 (시간은 멈춤)', () => {
  const w = lonely({ rand: () => 0 });
  for (const id of ['E1', 'E2']) w.runner.registry.done.add(id);
  w.setInside(false);
  assert.deepEqual(w.run(200), [], '건물 밖');
  w.setInside(true);
  assert.ok(w.runner.start('E3'));
  assert.deepEqual(w.run(10), [], '사건 대사 중');
  while (w.runner.busy) w.runner.advance() || w.runner.update(1);
  assert.deepEqual(w.run(FINISH.alone.first[0] + 0.5), ['whisper']);
});

test('조명 떨림: 한 번 천천히 어두워졌다(to 배율까지) 돌아올 뿐 — 방향이 바뀌는 건 한 번, 1/3초보다 길다', () => {
  const w = lonely({ rand: () => 0 });
  for (const id of ['E1', 'E2']) w.runner.registry.done.add(id);
  w.run(FINISH.alone.first[0] + 1 + FINISH.alone.gap[0]); // 속삭임 → 떨림 시작
  assert.ok(w.a.dim < 1);
  const v = [];
  for (let i = 0; i < 120; i++) {
    w.a.update(DT);
    v.push(w.a.dim);
  }
  let turns = 0;
  let dir = 0;
  for (let i = 1; i < v.length; i++) {
    const s = Math.sign(v[i] - v[i - 1]);
    if (!s) continue;
    if (dir && s !== dir) turns++;
    dir = s;
  }
  assert.ok(turns <= 1, `방향 전환 ${turns}`);
  assert.ok(Math.min(...v) >= FINISH.alone.dim.to - 1e-9);
  assert.equal(v.at(-1), 1, '다시 그대로');
  const D = FINISH.alone.dim;
  assert.ok(D.down >= 0.5 && D.up >= 0.5);
});

test('엔딩 카드: Enter = 처음부터 다시(onRestart), E = 닫기. 엔딩이 아닐 때 Enter 는 대화 넘기기 그대로', () => {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  let restarts = 0;
  runner.ui.onRestart = () => restarts++;
  runner.showEnding('C');
  assert.equal(runner.mode, 'ending');
  assert.equal(storyKey(runner, 'Enter'), true);
  assert.equal(restarts, 1);
  assert.equal(runner.mode, 'ending', 'Enter 는 카드를 닫지 않는다');
  assert.equal(storyKey(runner, 'KeyE'), true);
  assert.equal(runner.mode, 'idle', 'E 는 닫기');
  assert.ok(runner.start('E1'));
  assert.equal(storyKey(runner, 'Enter'), true);
  assert.equal(restarts, 1, '대화 중 Enter 는 넘기기');
});

test('시작 화면: 경고 문구(공포·점프스케어·어두운 장면·깜빡임 초당 3회 미만·헤드폰), 밝기 키 안내, 디버그 키는 잠김 표시', () => {
  const html = readFileSync('index.html', 'utf8');
  const warn = html.match(/<div class="warn">([\s\S]*?)<\/div>/)[1];
  for (const w of ['공포', '점프스케어', '어두운 장면', '깜빡임', '3회 미만', '헤드폰']) assert.ok(warn.includes(w), w);
  assert.match(html, /실내 밝기/);
  assert.match(html, /처음부터 다시/);
  assert.match(html, /class="dbg"/);
});
