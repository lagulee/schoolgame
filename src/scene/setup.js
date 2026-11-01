// 사건 연출 조립 (단계 12): 자리 진입 사건(triggers) + E2(추격 C1·숨기 P1) + 흔적(traces) + 화면(e2View) + E1 조작 안내.
// main.js 는 update(dt) 를 추격 update 보다 먼저 부르고, breath 를 숨소리에 더한다.
import { PLAYER, SCENE } from '../config.js';
import { EventTriggers } from '../story/triggers.js';
import { E2Scene } from './e2.js';
import { E2View } from './e2View.js';
import { Traces } from './traces.js';
import { showNotice } from '../ui/notice.js';

export function setupScenes({ scene, story, chase, puzzle, player, phone, world, mapData, collision, audio, toast, touch }) {
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
    get breath() {
      return view.breath;
    },
    // 촬영 모드·자동 점검에서 자리 진입 사건을 끈다
    set auto(on) {
      triggers.enabled = on;
    },
    update(dt) {
      triggers.update(player.pos.x, player.pos.z, player.level);
      e2.update(dt);
      traces.update();
      view.update(dt);
    },
  };
}
