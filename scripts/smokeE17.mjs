// smoke 의 R2 항목 (단계 17): E12 "따라간다" → 교무실 E13(당직과 함께 P4) → E14(복도·점프스케어 #3·추격 C4 atExit = playerCaught) → 입구 5 m 앞 트리거
// → 붙잡힘(귀신이 등 뒤로, 조작 정지, {dohyeon} 탈출) → 엔딩 B. smoke.mjs 가 E13~E15(R3) 점검 바로 뒤에 부른다.
const DOOR_IN = [24, 1.6, -40]; // 교무실 안 (문 쪽)
const RACK = [19.4, 1.6, -45]; // 열쇠 걸이 앞
const CORRIDOR = [16.5, 1.6, -31.2]; // C4 경로 시작 (E14 트리거 자리)
const NEAR_EXIT = [16.7, 1.6, -6.2]; // 입구 5 m 앞

export async function e17Smoke({ S, check, poll }) {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => window.__DEBUG.story.advance());
      await wait(120);
    }
  };
  // E12 까지 끝난 R2 판 (당직과 함께 가기로 했다)
  await S(() => {
    const D = window.__DEBUG;
    D.story.reset();
    for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12']) D.story.registry.done.add(id);
    D.story.registry.last = 'E12';
    D.story.flags.set('dutyCompanion', true);
    D.phone.setLight(true);
    D.player.setView([22, 1.6, -32], -90, 0, 3);
  });
  check('R2: 목표 = 당직을 따라 교무실로, 45초가 지나도 E13 은 시작되지 않는다', await S(() => { const D = window.__DEBUG; D.scenes.triggers.waited.set('E13', 99); return D.story.route === 'R2' && D.story.objective().includes('교무실'); }));
  await wait(400);
  check('교무실 밖에서는 E13 이 시작되지 않는다', await S(() => window.__DEBUG.story.event === null));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 90, 0, 1), DOOR_IN);
  check('교무실에 들어서면 E13(R2) 시작', await poll(() => window.__DEBUG.story.event?.id === 'E13' && window.__DEBUG.story.event.routes.includes('R2')));
  await advanceTo('reach');
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 90, 0, 1), RACK);
  await advanceTo('puzzle');
  check('P4 시작 (열쇠 걸이 살펴보기 5개)', await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'P4' && window.__DEBUG.scenes.p4.placed));
  check('R2 P4 문구가 R3 와 다르다', await S(() => !window.__DEBUG.scenes.p4.texts.wrong.includes('발소리가 한 걸음')));
  await S(() => window.__DEBUG.puzzle.submit('47'));
  for (let i = 0; i < 40 && !(await S(() => window.__DEBUG.story.registry.done.has('E13'))); i++) {
    await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(250);
  }
  check('E13 끝 → 출구 열쇠, 목표 = 현관으로', await S(() => window.__DEBUG.story.flags.values.hasExitKey && window.__DEBUG.story.objective().includes('현관')));
  // E14
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 180, 0, 1), CORRIDOR);
  check('복도에서 E14(R2) 시작, 조작 정지', await poll(() => window.__DEBUG.story.event?.id === 'E14' && window.__DEBUG.story.event.routes.includes('R2') && window.__DEBUG.player.frozen));
  check('점프스케어 #3', await poll(() => window.__DEBUG.story.action?.do === 'scare' && window.__DEBUG.scenes.steps.scare && window.__DEBUG.scenes.stepsView.scareMesh.visible));
  for (let i = 0; i < 40; i++) {
    const done = await S(() => { const D = window.__DEBUG; if (D.scenes.steps.scare) D.scenes.steps.scare.t = 99; if (D.scenes.look) D.scenes.look.t = 99; if (!D.story.action) D.story.advance(); return D.chase.chase?.def.id === 'C4'; });
    if (done) break;
    await wait(500);
  }
  check('추격 C4 시작: 출구 결과 = 붙잡힘(playerCaught), 트리거 35 m', await poll(() => { const D = window.__DEBUG; const c = D.chase.chase; return c?.def.id === 'C4' && D.chase.current.atExit === 'playerCaught' && c.triggerAt === 35 && !D.player.frozen; }), await S(() => window.__DEBUG.chase.hudLine()));
  check('추격 경로가 잡혔다', await poll(() => !!window.__DEBUG.scenes.e2.path));
  // 입구 5 m 앞에 닿았다고 본다 (귀신과 거리 12 m)
  await S((p) => {
    const D = window.__DEBUG;
    D.player.setView([p[0], p[1], p[2]], 180, 0, 0);
    const c = D.chase.chase;
    c.dist = 34.9;
    c.gap = 12;
    D.scenes.e2.path.progress.best = D.scenes.e2.path.base + 34.9;
    c.reach();
  }, NEAR_EXIT);
  check('트리거 지점 도달 → outcome trigger (playerCaught)', await poll(() => window.__DEBUG.chase.last?.id === 'C4' && window.__DEBUG.chase.last.outcome === 'trigger' && window.__DEBUG.chase.last.finale === 'playerCaught'), await S(() => window.__DEBUG.chase.hudLine()));
  check('붙잡힘 장면: 조작 정지, 귀신이 등 뒤로 다가온다', await poll(() => { const D = window.__DEBUG; return D.player.frozen && D.scenes.e2.held && D.scenes.view.ghost.visible; }));
  await advanceTo('collapse');
  check('귀신이 다 오기 전에는 돌아보지 않고 기다린다 (느린 headless 는 직접 도착시킨다)', await poll(() => window.__DEBUG.scenes.collapse.phase === 'wait' || window.__DEBUG.scenes.e2.ghostArrived));
  await S(() => { const h = window.__DEBUG.scenes.e2.held; if (h) h.at = h.player - 1.5; });
  check('귀신이 등 뒤에 다 오면 돌아봄 (북쪽)', await poll(() => { const c = window.__DEBUG.scenes.collapse; return c.phase === 'turn' && window.__DEBUG.scenes.e2.ghostArrived; }), await S(() => window.__DEBUG.scenes.collapse.phase));
  await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
  check('주저앉으며 붉은 막이 번진다 (피·시체 없음)', await poll(() => { const c = window.__DEBUG.scenes.collapse; return c.phase === 'sag' && +document.getElementById('blood').style.opacity > 0; }));
  for (let i = 0; i < 40 && (await S(() => window.__DEBUG.story.mode)) !== 'ending'; i++) {
    await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
    await wait(400);
  }
  check('엔딩 B 카드, endingsSeen 에 B 기록', await poll(() => window.__DEBUG.story.mode === 'ending' && JSON.parse(localStorage.getItem('schoolgame.endingsSeen') ?? '[]').includes('B')), await S(() => document.querySelector('.story-dlg')?.textContent ?? ''));
  await S(() => window.__DEBUG.story.advance());
  check('카드를 닫으면 막·귀신이 사라지고 조작이 돌아온다', await poll(() => { const D = window.__DEBUG; if (D.scenes.collapse.phase === 'recover') D.scenes.collapse.t = 99; return !D.scenes.collapse.active && !D.scenes.e2.held && +document.getElementById('veil').style.opacity === 0 && !D.player.frozen; }));
}
