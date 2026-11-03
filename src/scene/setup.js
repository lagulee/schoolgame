// 사건 연출 조립 (단계 12·13): 자리 진입 사건(triggers) + E2(추격 C1·숨기 P1) + 흔적(traces) + 화면(e2View) + E1 조작 안내
// + 사건 안 작은 행동(steps: 줍기·소리·원경 귀신, 단계 13 E3~E6 / 자리 도착·정전·점프스케어, 단계 14 E7)
// + P3 교실 수색(p3·p3View, 단계 14 E8) + 기절·각성(faint·faintView)과 P2 당직실 단서(p2·p2View, 단계 15 E10~E12)
// + P4 교무실 열쇠(p4·p4View)와 마지막 장면(finale·finaleView: 시선 돌리기·쓰러짐·엔딩 C, 단계 16 E13~E15).
// main.js 는 update(dt) 를 추격 update 보다 먼저 부르고, breath 를 숨소리에 더한다.
import { PLAYER, SCENE } from '../config.js';
import { EventTriggers } from '../story/triggers.js';
import { E2Scene } from './e2.js';
import { E2View } from './e2View.js';
import { Traces } from './traces.js';
import { StorySteps } from './steps.js';
import { StepsView } from './stepsView.js';
import { P3Search } from './p3.js';
import { P3View } from './p3View.js';
import { Faint } from './faint.js';
import { FaintView } from './faintView.js';
import { P2Duty } from './p2.js';
import { P2View } from './p2View.js';
import { P4Keys } from './p4.js';
import { P4View } from './p4View.js';
import { Look, Collapse } from './finale.js';
import { FinaleView } from './finaleView.js';
import { showNotice } from '../ui/notice.js';

export function setupScenes({ scene, camera, story, chase, puzzle, player, phone, world, mapData, collision, audio, toast, touch }) {
  const runner = story.runner;
  const data = runner.story;
  const locate = (x, z, l) => mapData.locate(x, z, l);
  const doors = world.interior.doors;
  const triggers = new EventTriggers({ runner, defs: data.triggers, locate });
  const e2 = new E2Scene({
    runner,
    chase: chase.session,
    puzzle: puzzle.session,
    pose: {
      get: () => ({ pos: [player.pos.x, PLAYER.eye, player.pos.z], level: player.level, yaw: player.camera.rotation.y, pitch: player.camera.rotation.x }),
      set: (p) => {
        player.setView(p.pos, (p.yaw * 180) / Math.PI, (p.pitch * 180) / Math.PI, p.level ?? 0);
        player.vel.set(0, 0);
      },
    },
    where: () => ({ x: player.pos.x, z: player.pos.z, level: player.level }),
    doors,
    locate,
    light: () => phone.phone.lightOn,
    maxSpeed: PLAYER.run * 1.4,
    toast,
  });
  const traces = new Traces({ runner, defs: data.traces, interactions: story.interactions, toast });
  const view = new E2View({
    scene, e2, collision, audio, doors, traces, traceDefs: data.traces ?? [],
    threatEl: document.getElementById('threat'), hintEl: document.getElementById('hide-hint'),
  });
  const where = () => ({ x: player.pos.x, z: player.pos.z, level: player.level });
  const S = SCENE.scare;
  const steps = new StorySteps({ runner, story: data, interactions: story.interactions, toast, where, scareTime: S.rise + S.hold + S.fade });
  const threatEl = document.getElementById('threat');
  const stepsView = new StepsView({ scene, steps, collision, audio, camera, player, story: data, threatEl, light: phone.light });
  const p3 = new P3Search({ runner, puzzle: puzzle.session, pose: e2.pose, where, locate, interactions: story.interactions, toast, text: (t) => runner.text(t), cfg: SCENE.p3 });
  const p3View = new P3View({ scene, p3, collision, audio, camera, player, map: mapData, threatEl });
  const faint = new Faint({ runner, story: data, pose: e2.pose, cfg: SCENE.faint });
  const faintView = new FaintView({ faint, player, camera, audio, veilEl: document.getElementById('veil') });
  const p2 = new P2Duty({ runner, puzzle: puzzle.session, interactions: story.interactions, toast, text: (t) => runner.text(t), cfg: SCENE.duty });
  const p2View = new P2View({ scene, p2, collision, audio, camera, player });
  const p4 = new P4Keys({ runner, puzzle: puzzle.session, pose: e2.pose, interactions: story.interactions, light: () => phone.phone.lightOn, toast, text: (t) => runner.text(t), cfg: SCENE.p4 });
  const p4View = new P4View({ scene, p4, collision, audio, camera });
  const look = new Look({ runner, story: data, pose: e2.pose });
  const collapse = new Collapse({ runner, story: data, pose: e2.pose, cfg: SCENE.collapse, ready: () => e2.ghostArrived });
  const finaleView = new FinaleView({
    runner, look, collapse, player, camera, audio,
    bloodEl: document.getElementById('blood'), veilEl: document.getElementById('veil'), threatEl,
  });
  // E1 이 끝나면 조작 안내 (사건 데이터 tutorial)
  const prevEvent = runner.onEvent;
  runner.onEvent = (id, phase) => {
    prevEvent?.(id, phase);
    const tut = phase === 'end' ? runner.registry.get(id, runner.route)?.tutorial : null;
    if (tut) showNotice(touch ? tut.touch : tut.keys, SCENE.tutorialShow);
  };

  return {
    triggers,
    e2,
    traces,
    view,
    steps,
    stepsView,
    p3,
    p3View,
    faint,
    faintView,
    p2,
    p2View,
    p4,
    p4View,
    look,
    collapse,
    finaleView,
    get breath() {
      return Math.max(view.breath, faint.breath, collapse.breath);
    },
    // 촬영 모드·자동 점검에서 자리 진입 사건을 끈다
    set auto(on) {
      triggers.enabled = on;
    },
    update(dt) {
      triggers.update(player.pos.x, player.pos.z, player.level, dt);
      e2.update(dt);
      traces.update();
      view.update(dt);
      steps.update(dt, (def) => stepsView.inView(def));
      stepsView.update();
      if (p3.update(dt)) p3View.knock();
      p3View.update();
      faint.update(dt);
      faintView.update();
      p2View.update(dt);
      p4View.update(dt);
      look.update(dt);
      collapse.update(dt);
      finaleView.update();
      world.interior.atmo.powerOut = steps.powerOut;
    },
  };
}
