// smoke 의 E13~E15 항목 (단계 16): E12 뒤 45초 → E13(교무실 열쇠 걸이 P4) → E14(복도에서 시선 돌리기·점프스케어 #3·추격 C4) → E15(현관에서 쓰러짐 = 엔딩 C).
// smoke.mjs 가 E10~E12 점검 바로 뒤에 부른다 (같은 페이지·도우미). headless 는 느려 시간 걸리는 구간(45초 대기·달리기·막 변화)은 직접 건너뛴다.
const RACK = [19.4, 1.6, -45]; // 교무실 열쇠 걸이 앞 (정답 47 열쇠 z −45)
const CORRIDOR = [16.5, 1.6, -31.2]; // C4 경로 시작 (E14 트리거 자리)
const DOOR = [16.7, 1.6, -2.6]; // 현관 유리문 앞 (추격 도착 자리, E15 트리거)

export async function e13e15Smoke({ S, check, poll }) {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => window.__DEBUG.story.advance());
      await wait(120);
    }
  };
  // E13: 당직실에서 기다린 시간(45초)을 건너뛴다
  check('E12 뒤 목표 = 당직을 기다린다', await S(() => window.__DEBUG.story.objective().includes('기다린다')));
  await S(() => window.__DEBUG.scenes.triggers.waited.set('E13', 46));
  check('45초 뒤 E13 시작 (당직이 돌아오지 않는다)', await poll(() => window.__DEBUG.story.event?.id === 'E13'));
  await advanceTo('reach');
  check('열쇠 걸이 앞에 닿을 때까지 기다림, 목표 = 열쇠함에서 열쇠 찾기', await S(() => window.__DEBUG.story.action?.id === 'staffRack' && window.__DEBUG.story.objective().includes('열쇠')));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 90, 0, 1), RACK);
  await advanceTo('puzzle'); // 접근 자막·{dohyeon} 대사
  check('P4 시작 (열쇠 걸이 살펴보기 5개)', await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'P4' && window.__DEBUG.scenes.p4.placed));
  check('교무실 열쇠 걸이·번호표 5개가 그려진다', await S(() => window.__DEBUG.scenes.p4View.mesh.parent?.children.filter((c) => c.name.startsWith('keyTag:')).length === 5));
  check('귀신 실루엣이 교무실 안쪽에 나타난다', await poll(() => window.__DEBUG.scenes.p4.ghost && window.__DEBUG.scenes.p4View.mesh.visible));
  await S(() => window.__DEBUG.phone.setLight(false)); // smoke 는 ?light=1 로 시작한다
  check('라이트가 꺼져 있으면 번호표를 못 읽는다', await poll(() => document.getElementById('interact').textContent.includes('읽을 수 없다')), await S(() => document.getElementById('interact').textContent));
  await S(() => window.__DEBUG.phone.setLight(true));
  check('라이트를 켜면 47번 열쇠를 꽂아 볼 수 있다', await poll(() => document.getElementById('interact').textContent.includes('47번')), await S(() => document.getElementById('interact').textContent));
  await S(() => window.__DEBUG.puzzle.submit('74')); // 틀린 열쇠 한 번 → 귀신이 다가옴
  check('틀린 열쇠 → 틀림 1, 귀신이 다음 자리로', await poll(() => window.__DEBUG.puzzle.puzzle?.wrong === 1 && window.__DEBUG.scenes.p4.target()[0] < 25));
  await S(() => document.getElementById('interact').click());
  check('E → 47번 열쇠로 P4 풀림', await poll(() => window.__DEBUG.puzzle.last?.id === 'P4' && window.__DEBUG.puzzle.last.outcome === 'solved'));
  for (let i = 0; i < 40 && !(await S(() => window.__DEBUG.story.registry.done.has('E13'))); i++) {
    await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(250);
  }
  check('E13 끝 → 출구 열쇠 획득, 목표 = 현관으로', await S(() => window.__DEBUG.story.flags.values.hasExitKey && window.__DEBUG.story.objective().includes('현관')));
  // E14: 복도 남쪽
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 180, 0, 1), CORRIDOR);
  check('복도에서 E14 시작, 조작 정지(추격 시작 자리를 지킨다)', await poll(() => window.__DEBUG.story.event?.id === 'E14' && window.__DEBUG.player.frozen));
  check('등 뒤를 돌아봄 (북쪽)', await poll(() => window.__DEBUG.story.action?.do === 'look' && window.__DEBUG.story.action.id === 'north'));
  check('점프스케어 #3 (3.2 m 앞 실루엣)', await poll(() => window.__DEBUG.story.action?.do === 'scare' && window.__DEBUG.scenes.steps.scare && window.__DEBUG.scenes.stepsView.scareMesh.visible));
  // 느린 headless 프레임에서 점프스케어(2초)·돌아보기 시간을 건너뛴다 (E10 smoke 와 같은 방식).
  for (let i = 0; i < 40; i++) {
    const done = await S(() => { const D = window.__DEBUG; if (D.scenes.steps.scare) D.scenes.steps.scare.t = 99; if (D.scenes.look?.cur) D.scenes.look.cur.t = 99; if (D.scenes.look) D.scenes.look.t = 99; if (!D.story.action) D.story.advance(); return D.chase.chase?.def.id === 'C4'; });
    if (done) break;
    await wait(500);
  }
  check('추격 C4 시작: 경로 위, 시작 gap 3 m, 스태미나 가득, 조작 가능', await poll(() => { const D = window.__DEBUG; const c = D.chase.chase; return c?.def.id === 'C4' && D.scenes.e2.path && c.startGap === 3 && D.player.stamina.value >= D.player.stamina.cfg.MAX - 5 && !D.player.frozen; }), await S(() => window.__DEBUG.chase.hudLine()));
  check('출구 결과 = 쓰러짐(collapse)', await S(() => window.__DEBUG.chase.current.atExit === 'collapse'));
  check('귀신 실루엣이 복도 3 m 뒤에 그려진다', await poll(() => { const g = window.__DEBUG.scenes.e2.ghost; return g?.mode === 'chase' && g.level === 1 && window.__DEBUG.scenes.view.ghost.visible; }));
  // 달려서 현관 유리문 앞에 도착했다고 본다 (귀신과 거리를 벌려 둔다)
  await S((p) => { const D = window.__DEBUG; D.player.setView([p[0], p[1], p[2]], 90, 0, 0); D.chase.chase.gap = 20; D.chase.reach(); }, DOOR);
  check('도착 → 출구 여는 1초 조작 불가 → exit(쓰러짐)', await poll(() => window.__DEBUG.chase.last?.id === 'C4' && window.__DEBUG.chase.last.outcome === 'exit' && window.__DEBUG.chase.last.finale === 'collapse'), await S(() => window.__DEBUG.chase.hudLine()));
  // E15
  check('E14 끝 → 현관 유리문 앞에서 E15 시작', await poll(() => window.__DEBUG.story.registry.done.has('E14') && window.__DEBUG.story.event?.id === 'E15'));
  check('E15 동안 조작 정지·화면 가장자리 어두움', await poll(() => window.__DEBUG.player.frozen && +document.getElementById('threat').style.opacity >= 0.69));
  await advanceTo('collapse');
  check('쓰러짐 시작: 문 쪽으로 돌아섬', await poll(() => window.__DEBUG.story.action?.do === 'collapse' && window.__DEBUG.scenes.collapse.phase === 'turn'));
  await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
  check('주저앉으며 붉은 막이 번진다 (피·시체 없음)', await poll(() => { const c = window.__DEBUG.scenes.collapse; return c.phase === 'sag' && +document.getElementById('blood').style.opacity > 0 && window.__DEBUG.player.eyeDrop > 0; }));
  await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
  check('어두워짐 → 완전한 암전', await poll(() => { const c = window.__DEBUG.scenes.collapse; return c.phase === 'dark' && +document.getElementById('blood').style.opacity > 0.8; }));
  await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
  check('암전 유지 (검은 막 1)', await poll(() => window.__DEBUG.scenes.collapse.phase === 'hold' && +document.getElementById('veil').style.opacity === 1));
  await S(() => { window.__DEBUG.scenes.collapse.t = 99; });
  check('엔딩 C 카드, endingsSeen 에 C 기록', await poll(() => window.__DEBUG.story.mode === 'ending' && JSON.parse(localStorage.getItem('schoolgame.endingsSeen') ?? '[]').includes('C')), await S(() => document.querySelector('.story-dlg')?.textContent ?? ''));
  await S(() => window.__DEBUG.story.advance());
  check('카드를 닫으면 막·눈높이가 돌아온다', await poll(() => { const D = window.__DEBUG; if (D.scenes.collapse.phase === 'recover') D.scenes.collapse.t = 99; return !D.scenes.collapse.active && +document.getElementById('veil').style.opacity === 0 && D.player.eyeDrop === 0 && !D.player.frozen; }), await S(() => { const D = window.__DEBUG; const c = D.scenes.collapse; return JSON.stringify({ act: c.active, phase: c.phase, veil: document.getElementById('veil').style.opacity, eye: D.player.eyeDrop, fr: D.player.frozen, mode: D.story.mode }); }));
}
