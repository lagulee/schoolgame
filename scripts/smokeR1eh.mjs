// smoke 의 R1 뒷부분 항목 (단계 19): R1-d 뒤 5초 → R1-e {mingeon} 시점 전환(암전 속 교무실, 핸드폰 55%·보조배터리 없음) → P4(당직 말투)
// → R1-f 복도 점프스케어 #2 → R1-g 마지막 추격 C3 → R1-h 주인공 시점 복귀·흔적 → 탈출 = 엔딩 A.
// smoke.mjs 가 R1 앞부분(smokeR1.mjs) 바로 뒤에 부른다 (같은 판 이어서). headless 는 느려 시간 걸리는 구간(대기·연출·달리기)은 직접 건너뛴다.
const RACK = [19.4, 1.6, -45]; // 교무실 열쇠 걸이 앞
const CORRIDOR = [16.5, 1.6, -31.1]; // R1-f 자리 = C3 경로 시작
const DOOR = [16.7, 1.6, -2.6]; // 현관 유리문 앞 (추격 도착 자리)

// 디버그 N 으로 들어간 R1-e 에서 시점 전환(행동 줄)·당직 대사를 넘겨 {mingeon} 자신의 대사 줄까지 (smoke.mjs 의 "이름 없이" 점검)
export async function toMingeonLine({ S, press }) {
  for (let k = 0; k < 20; k++) {
    const c = await S(() => { const r = window.__DEBUG.story; const l = r.mode === 'line' ? r.event.lines[r.lineIdx] : null; return { mode: r.mode, me: l?.who === 'mingeon' && (l.style ?? 'dialog') === 'dialog' }; });
    if (c.me || (c.mode !== 'line' && c.mode !== 'action')) return;
    if (c.mode === 'action') await S(() => window.__DEBUG.story.resume());
    else await press('KeyE', 120);
  }
}

export async function r1ehSmoke({ S, check, poll }) {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // 대사·자막을 넘기고 행동 줄의 시간을 건너뛰며 kind 에 닿을 때까지
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => {
        const W = window.__DEBUG;
        const sc = W.scenes;
        if (sc.steps.scare) sc.steps.scare.t = 99;
        if (sc.look.line) sc.look.t = 99;
        if (sc.vanish.def) sc.vanish.t = 99;
        if (sc.pov.active) sc.pov.t = 99;
        if (W.story.mode === 'line') W.story.advance();
      });
      await wait(150);
    }
    return (await S(() => window.__DEBUG.story.action?.do)) === kind;
  };
  const before = await S(() => ({ bat: window.__DEBUG.phone.battery, banks: window.__DEBUG.banks.placed.size }));
  await S(() => window.__DEBUG.scenes.triggers.waited.set('R1-e', 4.9)); // R1-d 뒤 5초 대기를 줄인다
  check('R1-d 뒤 5초 → R1-e, 시점 = {mingeon}, 핸드폰 55%·라이트 켜짐, 보조배터리 빠짐', await poll(() => { const W = window.__DEBUG; return W.story.event?.id === 'R1-e' && W.story.pov === 'mingeon' && W.phone.pov === 'mingeon' && W.phone.level <= 55 && W.phone.level >= 54 && W.phone.lightOn && W.banks.placed.size === 0; }), JSON.stringify(before));
  check('시점 전환: 화면이 어두워지고 조작 정지', await poll(() => window.__DEBUG.scenes.pov.active && window.__DEBUG.player.frozen && +document.getElementById('veil').style.opacity > 0));
  check('암전 속에서 교무실로 옮겨진다', await poll(() => { const W = window.__DEBUG; return W.scenes.pov.phase !== 'out' && W.player.level === 1 && W.where().includes('교무실'); }), await S(() => window.__DEBUG.where()));
  check('{mingeon} 은 스태미나 가득', await S(() => window.__DEBUG.player.stamina.value >= window.__DEBUG.player.stamina.cfg.MAX - 1));
  // headless 는 한 프레임 dt 가 0.05초로 잘려 1초 남짓한 암전도 수십 초 걸린다 → 남은 단계를 매번 건너뛴다
  const skipPov = () => { const p = window.__DEBUG.scenes.pov; if (p.active) p.t = 99; };
  check('밝아지면 당직 대사 (화자 표시 = 당직)', await poll(`(${skipPov})(), window.__DEBUG.story.mode === 'line' && document.querySelector('.story-dlg')?.textContent.includes('당직')`), await S(() => document.querySelector('.story-dlg')?.textContent ?? ''));
  check('밝아진 뒤 검은 막이 걷힌다', await poll(() => +document.getElementById('veil').style.opacity === 0));
  await advanceTo('reach');
  check('열쇠 걸이로 걸어갈 수 있다 (조작 풀림)', await poll(() => !window.__DEBUG.player.frozen));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 90, 0, 1), RACK);
  check('P4 시작 ({mingeon}+당직)', (await advanceTo('puzzle')) && (await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'P4' && window.__DEBUG.scenes.p4.placed)));
  await S(() => window.__DEBUG.puzzle.submit('74'));
  // 화면 알림은 퍼즐 공통 문구("틀림 (1/3)")가 같은 순간 덮어쓴다(기존 동작, 단계 19 보고에 기록) → 문구 선택만 확인
  check('틀린 열쇠 → 틀림 1, 안내 문구 = 당직 말투', await poll(() => window.__DEBUG.puzzle.puzzle?.wrong === 1) && (await S(() => window.__DEBUG.scenes.p4.texts.wrong.includes('{duty'))), await S(() => window.__DEBUG.scenes.p4.texts.wrong));
  await S(() => window.__DEBUG.puzzle.submit('47'));
  for (let i = 0; i < 40 && !(await S(() => window.__DEBUG.story.registry.done.has('R1-e'))); i++) {
    await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(200);
  }
  check('47번 → R1-e 끝, 출구 열쇠, 목표 = 현관으로', await S(() => { const W = window.__DEBUG; return W.story.registry.done.has('R1-e') && W.story.flags.values.hasExitKey && W.story.objective().includes('현관'); }));
  // R1-f
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 180, 0, 1), CORRIDOR);
  check('복도 남쪽 → R1-f, 조작 정지', await poll(() => window.__DEBUG.story.event?.id === 'R1-f' && window.__DEBUG.player.frozen));
  check('검은 연기가 피어오른다', (await advanceTo('vanish')) && (await poll(() => window.__DEBUG.scenes.vanishView.puffs.some((p) => p.visible))));
  check('점프스케어 #2 (실루엣)', (await advanceTo('scare')) && (await poll(() => window.__DEBUG.scenes.steps.scare && window.__DEBUG.scenes.stepsView.scareMesh.visible)));
  check('R1-g 추격 C3 시작: 시작 gap 3 m, 출구 결과 = 탈출, 조작 가능', (await advanceTo('chase')) && (await poll(() => { const W = window.__DEBUG; const c = W.chase.chase; return c?.def.id === 'C3' && W.chase.current.atExit === 'escape' && W.scenes.e2.path && c.startGap === 3 && !W.player.frozen; })), await S(() => window.__DEBUG.chase.hudLine()));
  check('귀신 실루엣이 복도 뒤에 그려진다', await poll(() => { const g = window.__DEBUG.scenes.e2.ghost; return g?.mode === 'chase' && g.level === 1 && window.__DEBUG.scenes.view.ghost.visible; }));
  await S((p) => { const W = window.__DEBUG; W.player.setView([p[0], p[1], p[2]], 90, 0, 0); W.chase.chase.gap = 20; W.chase.reach(); W.chase.chase.unlockLeft = Math.min(W.chase.chase.unlockLeft, 0.05); }, DOOR);
  check('도착 → 문 여는 1초 → exit(탈출)', await poll(() => window.__DEBUG.chase.last?.id === 'C3' && window.__DEBUG.chase.last.outcome === 'exit' && window.__DEBUG.chase.last.finale === 'escape'), await S(() => window.__DEBUG.chase.hudLine()));
  for (let i = 0; i < 40 && !(await S(() => window.__DEBUG.story.registry.done.has('R1-g'))); i++) {
    await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(200);
  }
  // R1-h
  check('R1-g 끝 → R1-h, 주인공 시점·핸드폰 복귀(배터리 그대로), 보조배터리 다시 놓임', await poll(() => { const W = window.__DEBUG; return W.story.event?.id === 'R1-h' && W.story.pov === 'player' && W.phone.pov === 'player' && W.banks.placed.size > 0; }) && Math.abs((await S(() => window.__DEBUG.phone.battery)) - before.bat) < 0.01, JSON.stringify({ before, now: await S(() => window.__DEBUG.phone.battery) }));
  check('현관 홀 유리문 앞으로 (주인공 자리)', await poll(`(${skipPov})(), window.__DEBUG.scenes.pov.phase !== 'out' && window.__DEBUG.where().includes('현관')`), await S(() => window.__DEBUG.where()));
  check('문 앞의 깨진 핸드폰({gyuha} 흔적)을 내려다본다', (await advanceTo('look')) && (await poll(() => window.__DEBUG.player.camera.rotation.x < -0.3 || window.__DEBUG.story.action?.do !== 'look')) && (await S(() => window.__DEBUG.scenes.view.traceMeshes.get('gyuhaPhone')?.m.visible === true)));
  check('셋이 문을 지나 밖으로 (탈출 시작, 조작 정지)', (await advanceTo('escape')) && (await poll(() => window.__DEBUG.scenes.escape.active && window.__DEBUG.player.frozen)));
  await S(() => { window.__DEBUG.scenes.escape.t = 99; });
  check('걸어 나가며 어두워진다 → 학교 밖', await poll(() => { const W = window.__DEBUG; if (['turn', 'walk'].includes(W.scenes.escape.phase)) W.scenes.escape.t = 99; return W.scenes.escape.phase === 'dark' && W.player.pos.x < 15 && +document.getElementById('veil').style.opacity > 0.5; }), await S(() => JSON.stringify({ ph: window.__DEBUG.scenes.escape.phase, x: window.__DEBUG.player.pos.x, v: document.getElementById('veil').style.opacity })));
  await S(() => { window.__DEBUG.scenes.escape.t = 99; });
  await poll(() => window.__DEBUG.scenes.escape.phase === 'hold');
  await S(() => { window.__DEBUG.scenes.escape.t = 99; });
  check('엔딩 A 카드, endingsSeen 에 A', await poll(() => window.__DEBUG.story.mode === 'ending' && JSON.parse(localStorage.getItem('schoolgame.endingsSeen') ?? '[]').includes('A')), await S(() => document.querySelector('.story-dlg')?.textContent ?? ''));
  await S(() => window.__DEBUG.story.advance());
  check('카드를 닫으면 학교 밖에서 밝아지고 조작이 풀린다', await poll(() => { const W = window.__DEBUG; if (W.scenes.escape.phase === 'recover') W.scenes.escape.t = 99; return !W.scenes.escape.active && +document.getElementById('veil').style.opacity === 0 && !W.player.frozen && W.where() !== ''; }), await S(() => window.__DEBUG.where()));
  check('R1 판 기록: E7 → R1-a~R1-h', await S(() => window.__DEBUG.story.registry.history.join() === 'E7,R1-a,R1-b,R1-c,R1-d,R1-e,R1-f,R1-g,R1-h'), await S(() => window.__DEBUG.story.registry.history.join()));
}
