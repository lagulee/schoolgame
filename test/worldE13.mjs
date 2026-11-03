// 단계 16·17 테스트 공용 세계 (화면 없이 StoryRunner + 실제 E2Scene·StorySteps·Look·Collapse·P4Keys). E12 까지 끝난 판을 만든다.
import assert from 'node:assert/strict';
import { StoryRunner } from '../src/story/runner.js';
import { EventTriggers } from '../src/story/triggers.js';
import { ChaseSession } from '../src/chase/session.js';
import { PuzzleSession } from '../src/puzzle/session.js';
import { GhostHooks } from '../src/puzzle/hooks.js';
import { E2Scene } from '../src/scene/e2.js';
import { StorySteps } from '../src/scene/steps.js';
import { Look, Collapse } from '../src/scene/finale.js';
import { P4Keys } from '../src/scene/p4.js';
import { EndingsSeen } from '../src/story/endingsSeen.js';
import { MapData } from '../src/world/mapData.js';
import { readFileSync } from 'node:fs';
import { CHASE, PUZZLE, PLAYER, SCENE } from '../src/config.js';
import { loadStory, loadSkeletons, fakeUI, memoryStorage } from './helpers.mjs';

export const { story, characters } = loadStory();
export const { chases, puzzles } = loadSkeletons();
const map = new MapData(JSON.parse(readFileSync('data/map.json', 'utf8')));
export const C4 = chases.find((c) => c.id === 'C4');
export const P2 = puzzles.find((p) => p.id === 'P2');
export const P4 = puzzles.find((p) => p.id === 'P4');
export const DT = 1 / 30;
export const SCARE = SCENE.scare.rise + SCENE.scare.hold + SCENE.scare.fade;
export const ev = (id, route) => story.events.find((e) => e.id === id && e.routes.includes(route));

// E12 까지 끝난 판 (R3). 플레이어는 구관 4층 당직실 안
export function world({ route = 'R3' } = {}) {
  const runner = new StoryRunner({ story, characters, ui: fakeUI(), timing: { subtitleBase: 0.5, subtitlePerChar: 0 } });
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12']) runner.registry.done.add(id);
  runner.registry.last = 'E12';
  if (route === 'R2') runner.flags.set('dutyCompanion', true);
  const me = { x: 22, z: -32, level: 3, yaw: -Math.PI / 2, pitch: 0 };
  const pose = {
    get: () => ({ pos: [me.x, PLAYER.eye, me.z], level: me.level, yaw: me.yaw, pitch: me.pitch }),
    set: (p) => Object.assign(me, { x: p.pos[0], z: p.pos[2], level: p.level ?? me.level, yaw: p.yaw ?? 0, pitch: p.pitch ?? 0 }),
  };
  const where = () => ({ x: me.x, z: me.z, level: me.level });
  const locate = (x, z, l) => map.locate(x, z, l);
  let speed = 0;
  const stamina = { resets: 0, reset() { this.resets++; } };
  const chase = new ChaseSession({ runner, chases, cfg: CHASE, getSpeed: () => speed, pose, stamina });
  const puzzle = new PuzzleSession({ runner, puzzles, cfg: PUZZLE, hooks: new GhostHooks() });
  const doors = { roomClosed: () => false, setForced: () => {} };
  const e2 = new E2Scene({ runner, chase, puzzle, pose, where, doors, locate, light: () => true, maxSpeed: PLAYER.run * 1.4 });
  const items = new Map();
  let refreshes = 0;
  const interactions = { add: (it) => items.set(it.id, it), remove: (id) => items.delete(id), refresh: () => refreshes++ };
  const toasts = [];
  const sounds = [];
  const steps = new StorySteps({ runner, story, interactions, where, scareTime: SCARE, sound: (d) => sounds.push(d) });
  const look = new Look({ runner, story, pose });
  const collapse = new Collapse({ runner, story, pose, cfg: SCENE.collapse, ready: () => e2.ghostArrived });
  let lightOn = false;
  const p4 = new P4Keys({ runner, puzzle, pose, interactions, light: () => lightOn, toast: (m) => toasts.push(m), text: (t) => runner.text(t), cfg: SCENE.p4 });
  const triggers = new EventTriggers({ runner, defs: story.triggers, locate });
  const endings = new EndingsSeen('test', memoryStorage());
  runner.onEnding = (key) => endings.mark(key);
  const veil = [];
  const blood = [];
  const tick = (sec = DT) => {
    for (let t = 0; t < sec - 1e-9; t += DT) {
      runner.update(DT);
      triggers.update(me.x, me.z, me.level, DT);
      e2.update(DT);
      chase.update(DT);
      steps.update(DT);
      look.update(DT);
      collapse.update(DT);
      p4.update(DT);
      veil.push(collapse.veil);
      blood.push(collapse.blood);
    }
  };
  const walk = (x, z, v, tries = () => 0) => {
    const t0 = tries();
    for (let i = 0; i < 4000 && Math.hypot(x - me.x, z - me.z) > 1e-6; i++) {
      const d = Math.hypot(x - me.x, z - me.z);
      const s = Math.min(d, v * DT);
      me.x += ((x - me.x) / d) * s;
      me.z += ((z - me.z) / d) * s;
      speed = s / DT;
      tick();
      if (tries() !== t0 || chase.locked) break; // 잡혀서 시작 자리로 돌아왔다 / 출구를 여는 동안은 조작 불가
    }
    speed = 0;
  };
  const play = (limit = 30) => {
    for (let i = 0; i < limit * 30 && runner.busy && runner.mode !== 'action'; i++) {
      if (runner.mode === 'line' && runner.ui.shown?.style === 'dialog') runner.advance();
      tick();
    }
  };
  return { runner, me, chase, puzzle, steps, look, collapse, p4, items, toasts, sounds, stamina, endings, veil, blood, tick, walk, play, triggers, e2, setLight: (v) => (lightOn = v), refreshes: () => refreshes };
}

// 당직실에서 기다리다 E13 → 교무실 열쇠 걸이 앞에서 P4 시작
export function toP4(w) {
  w.tick(44);
  assert.equal(w.runner.event, null, '45초 전에는 E13 이 시작되지 않는다');
  w.tick(1.5);
  assert.equal(w.runner.event?.id, 'E13', 'E12 뒤 45초가 지나면 자리와 상관없이 E13');
  w.play();
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' }, '교무실 열쇠 걸이 앞에 닿을 때까지 기다린다');
  w.tick(5);
  assert.deepEqual(w.runner.action, { do: 'reach', id: 'staffRack' });
  w.me.x = 19.4;
  w.me.z = -45;
  w.me.level = 1;
  w.tick();
  w.play();
  assert.deepEqual(w.runner.action, { do: 'puzzle' });
  assert.equal(w.puzzle.puzzle?.id, 'P4', 'P4 시작');
  w.tick();
}
