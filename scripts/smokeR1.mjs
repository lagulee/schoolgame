// smoke 의 R1 앞부분 항목 (단계 18): 책을 미리 챙긴 판(earlyBook) — E7 → R1-a 책 건네기 → R1-b P3(E8 대신) → 구관 4층 당직실 R1-c(당직 첫 만남·P2)
// → R1-d 잡담 → 돌아봄 → {gyuha}(가짜) 검은 연기 퇴장. smoke.mjs 가 R2(단계 17) 점검 바로 뒤에 부른다. headless 는 느려 걷지 않고 자리를 옮기고 퍼즐 답을 직접 넣는다.
const YAJA = [10.5, 1.6, -87]; // 신관 2층 야자 교실 3-7
const SWITCHBOARD = [-9, 1.6, -91.6]; // 신관 2층 배전반 앞
const ROOM_3_10 = [10.5, 1.6, -86.7]; // 신관 3층 3-10 (P3 정답)
const DUTY = [22, 1.6, -32]; // 구관 4층 당직실 안

export async function r1Smoke({ S, check, poll }) {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // 대사·자막을 넘겨 행동 줄 kind 에 닿거나, 사건 id 가 끝날 때까지
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
      await wait(120);
    }
  };
  const finish = async (id) => {
    for (let i = 0; i < 80 && !(await S((e) => window.__DEBUG.story.registry.done.has(e), id)); i++) {
      await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
      await wait(120);
    }
    return S((e) => window.__DEBUG.story.registry.done.has(e), id);
  };
  // E6 까지 끝난 R1 판 (4층 책을 미리 챙겼다)
  await S(() => {
    const D = window.__DEBUG;
    D.story.reset();
    for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) D.story.registry.done.add(id);
    D.story.registry.last = 'E6';
    D.story.flags.set('earlyBook', true);
    D.phone.setLight(true);
  });
  check('R1 판: 루트 판정 = R1', await S(() => window.__DEBUG.story.route === 'R1'));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 0, 0, 1), YAJA);
  check('R1: 야자 교실 → E7 (정전·분리는 R3 와 같다)', await poll(() => window.__DEBUG.story.event?.id === 'E7'));
  await advanceTo('reach');
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 180, 0, 1), SWITCHBOARD);
  await poll(() => window.__DEBUG.story.action?.do === 'scare');
  await S(() => { const sc = window.__DEBUG.scenes.steps.scare; if (sc) sc.t = 99; });
  check('E7 끝 → 같은 자리에서 R1-a(책 건네기), E8 은 없다', (await finish('E7')) && (await poll(() => window.__DEBUG.story.registry.history.includes('R1-a') && !window.__DEBUG.story.registry.history.includes('E8'))));
  check('R1-a 끝 → R1-b P3 교실 수색', (await finish('R1-a')) && (await poll(() => window.__DEBUG.story.event?.id === 'R1-b' && window.__DEBUG.puzzle.puzzle?.id === 'P3')));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 0, 0, 2), ROOM_3_10);
  check('3-10 에 들어서면 P3 풀림 → R1-b 끝, 목표 = 구관 4층 당직실', (await poll(() => window.__DEBUG.puzzle.last?.outcome === 'solved')) && (await finish('R1-b')) && (await S(() => window.__DEBUG.story.objective().includes('당직실'))), await S(() => window.__DEBUG.story.objective()));
  check('신관 3층 복도로 나와도 E9 가 걸리지 않는다', await S(() => { window.__DEBUG.player.setView([4.6, 1.6, -91.9], 0, 0, 2); return true; }) && (await wait(400), await S(() => !window.__DEBUG.story.busy)));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 0, 0, 3), DUTY);
  check('구관 4층 당직실 → R1-c (당직 첫 만남)', await poll(() => window.__DEBUG.story.event?.id === 'R1-c'));
  await advanceTo('puzzle');
  check('R1-c P2: 당직실 단서 살펴보기 3개', await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'P2' && window.__DEBUG.scenes.p2.placed.size === 3));
  await S(() => window.__DEBUG.puzzle.submit('47'));
  check('P2 풀림(47) → R1-c 끝 → 당직실에서 바로 R1-d', (await finish('R1-c')) && (await poll(() => window.__DEBUG.story.event?.id === 'R1-d')));
  await advanceTo('look');
  check('잡담 뒤 {gyuha} 자리로 돌아봄 (조작 정지)', await poll(() => window.__DEBUG.story.action?.do !== 'look' || window.__DEBUG.player.frozen));
  check('검은 연기가 피어오른다 (조작 정지)', await poll(() => { const D = window.__DEBUG; return D.story.action?.do === 'vanish' && D.scenes.vanishView.puffs.some((p) => p.visible) && D.player.frozen; }));
  await S(() => { window.__DEBUG.scenes.vanish.t = 99; }); // 느린 headless 에서 연기 3.4초는 건너뛴다
  check('연기가 흩어지면 R1-d 끝, 목표 = 기다린다, 다음 = R1-e', (await finish('R1-d')) && (await S(() => { const D = window.__DEBUG; return !D.scenes.vanishView.puffs.some((p) => p.visible) && D.story.objective().includes('기다린다') && D.story.registry.nextId(D.story.flags.values, D.story.route) === 'R1-e'; })));
  check('R1 판에는 E8~E12 가 없다', await S(() => !['E8', 'E9', 'E10', 'E11', 'E12'].some((id) => window.__DEBUG.story.registry.history.includes(id))));
}
