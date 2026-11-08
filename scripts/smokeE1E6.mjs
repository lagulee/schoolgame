// smoke 의 사건 앞부분 (smoke.mjs 에서 나눔, 단계 20): 학교 앞 → 현관 홀 E1 → 3층 동쪽 복도 E2 (단계 0c·12, 2026-11-08 3층 목격으로 변경), 3층 연결문 E3 → 2층 열쇠함 E4 → E5 → 신관 5층 E6 (단계 13)
export async function e1e2Smoke({ page, S, press, check, poll }) {
  const pre0 = await S(() => ({ bat: window.__DEBUG.phone.battery, begun: window.__DEBUG.phone.begun, obj: window.__DEBUG.story.objective(), where: window.__DEBUG.where(), hist: window.__DEBUG.story.registry.history.length }));
  await page.waitForTimeout(1500);
  const pre1 = await S(() => window.__DEBUG.phone.battery);
  check('탐색 구간: 사건 없음, 라이트를 켜도 배터리 그대로, 목표 = 현관으로, 위치 = 앞마당', pre0.hist === 0 && !pre0.begun && pre1 === pre0.bat && pre0.obj.includes('현관') && pre0.where === '앞마당', JSON.stringify({ ...pre0, pre1 }));
  // headless 는 프레임이 느려 실제로 걸어 들어가면 오래 걸린다 → 현관 앞에 세워 두고(사건 없음) 문턱 안쪽(현관 홀)으로 옮긴다
  await S(() => window.__DEBUG.player.setView([13, 1.6, -1], -90, 0));
  await page.waitForTimeout(1500);
  const porch = await S(() => ({ where: window.__DEBUG.where(), hist: window.__DEBUG.story.registry.history.length }));
  check('현관 앞(바깥)에서는 E1 없음', porch.where === '현관 앞' && porch.hist === 0, JSON.stringify(porch));
  await S(() => window.__DEBUG.player.setView([16.2, 1.6, -1], -90, 0));
  const e1 = await poll(() => window.__DEBUG.story.event?.id === 'E1');
  const e1s = await S(() => ({ where: window.__DEBUG.where(), begun: window.__DEBUG.phone.begun, lv: window.__DEBUG.phone.level }));
  check('현관 홀에 들어서면 E1 시작 + 배터리 확정 (86~92)', e1 && e1s.begun && e1s.lv >= 86 && e1s.lv <= 92, JSON.stringify(e1s));
  for (let i = 0; i < 12 && (await S(() => window.__DEBUG.story.mode)) === 'line'; i++) await press('KeyE', 120);
  await S(() => window.__DEBUG.player.setView([13, 1.6, -1], -90, 0));
  await page.waitForTimeout(800);
  await S(() => window.__DEBUG.player.setView([16.2, 1.6, -1], -90, 0));
  await page.waitForTimeout(1500);
  check('다시 들어와도 E1 은 한 번만', await S(() => window.__DEBUG.story.registry.history.join() === 'E1' && window.__DEBUG.story.mode === 'idle'));
  // E2 (2026-11-08): 구관 3층 동쪽 복도에서 연결통로 입구 쪽으로 가다 보면 E2 → 복도 모퉁이의 귀신 목격(추격·퍼즐 없음) → 퇴장·흔적.
  // headless 는 프레임이 느려 걷지 않고 자리를 옮긴다 (1층 동쪽 복도에서는 더 이상 E2 가 아니다)
  await S(() => window.__DEBUG.player.setView([16.5, 1.6, -25], 180, 0));
  await page.waitForTimeout(1000);
  check('1층 동쪽 복도에서는 E2 없음', (await S(() => window.__DEBUG.story.event?.id ?? null)) === null);
  await S(() => window.__DEBUG.player.setView([16.5, 1.6, -44], 0, 0, 2));
  check('E1 뒤 3층 동쪽 복도 → E2 시작', await poll(() => window.__DEBUG.story.event?.id === 'E2'));
  check('E2: 모퉁이에 귀신 목격(추격·퍼즐 없음)', await poll(() => { const D = window.__DEBUG; return !D.chase.active && !D.puzzle.active && D.scenes.steps.sightings.some((g) => g.def.event === 'E2' && g.alpha > 0); }));
  for (let i = 0; i < 30 && (await S(() => window.__DEBUG.story.registry.active)) === 'E2'; i++) await press('KeyE', 200);
  await poll(() => window.__DEBUG.scenes.traces.visible('gyuhaPhone'));
  const e2end = await S(() => ({ done: window.__DEBUG.story.registry.done.has('E2'), obj: window.__DEBUG.story.objective(), trace: window.__DEBUG.scenes.traces.visible('gyuhaPhone') }));
  check('E2 끝 → 목표 문구 5층, 현관 출구 앞 떨어진 핸드폰', e2end.done && e2end.obj.includes('5층') && e2end.trace, JSON.stringify(e2end));
}

export async function e3e6Smoke({ S, press, check, poll }) {
  // E3~E6 (단계 13): 3층 연결문 앞 E3(가짜 {gyuha} 등장) → 2층 복도 E4(원경 귀신·열쇠함 E → 연결문 열쇠) → 열쇠 들고 다시 온 3층 연결문 앞 E5 → 신관 5층 E6(1회차: 2-13 잠김, 아래층 소리)
  // 사건이 끝날 때까지 대사·자막은 E 로 넘기고, 행동 줄(소리 등)은 프레임이 넘길 때까지 기다린다.
  // (예전에는 행동 줄을 만나면 멈춰서, E6 처럼 행동 줄 뒤에 자막이 하나 더 있으면 그 자막이 넘어가지 않아 가끔 실패했다)
  const busyDone = async (id) => {
    for (let i = 0; i < 80; i++) {
      const m = await S((e) => (window.__DEBUG.story.registry.active === e ? window.__DEBUG.story.mode : null), id);
      if (m === null) break;
      if (m === 'action') await new Promise((res) => setTimeout(res, 150));
      else await press('KeyE', 150);
    }
    return poll((e) => window.__DEBUG.story.registry.done.has(e), id);
  };
  await S(() => window.__DEBUG.player.setView([18, 1.6, -57], 0, 0, 2));
  check('E2 뒤 3층 연결문 앞 → E3 (잠김 확인, 가짜 {gyuha} 등장은 e3e6 단위 테스트)', await poll(() => window.__DEBUG.story.registry.history.includes('E3')) && (await busyDone('E3')));
  await S(() => window.__DEBUG.player.setView([16.5, 1.6, -30], 0, 0, 1));
  check('2층 동쪽 복도 → E4, 복도 모퉁이에 원경 귀신', await poll(() => window.__DEBUG.story.event?.id === 'E4' && window.__DEBUG.scenes.stepsView.ghosts[0].m.visible));
  for (let i = 0; i < 40 && (await S(() => window.__DEBUG.story.action?.do)) !== 'take'; i++) await press('KeyE', 150); // 자막 넘기기
  await S(() => window.__DEBUG.player.setView([18.9, 1.6, -43], 90, 0, 1));
  check('교무실 열쇠함 살펴보기', await poll(() => document.getElementById('interact').textContent.includes('열쇠함')));
  await press('KeyE', 120);
  check('열쇠함 E → 연결문 열쇠(hasConnectorKey), E4 끝', await poll(() => window.__DEBUG.story.flags.values.hasConnectorKey) && (await busyDone('E4')));
  await S(() => window.__DEBUG.player.setView([18, 1.6, -57], 0, 0, 2));
  check('열쇠 들고 3층 연결문 앞 → E5 (문 열고 넘어감)', await poll(() => window.__DEBUG.story.event?.id === 'E5') && (await busyDone('E5')));
  await S(() => window.__DEBUG.player.setView([3, 1.6, -91.9], 0, 0, 4));
  check('신관 5층 복도 → E6', await poll(() => window.__DEBUG.story.registry.history.includes('E6')) && (await busyDone('E6')), await S(() => { const D = window.__DEBUG; const r = D.story; return JSON.stringify({ active: r.registry.active, mode: r.mode, hist: r.registry.history.join(), lv: D.player.level, pos: D.pos(), where: D.where(), phone: D.phone.screenOpen, frozen: D.player.frozen }); }));
  const e6 = await S(() => ({ obj: window.__DEBUG.story.objective(), book: window.__DEBUG.story.used.has('take:myBook'), key: window.__DEBUG.story.flags.values.hasClassKey }));
  check('E6 끝(1회차): 책은 못 챙김, 목표 = 신관 2층으로', !e6.book && !e6.key && e6.obj.includes('2층'), JSON.stringify(e6));
}
