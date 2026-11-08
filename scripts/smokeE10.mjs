// smoke 의 E10~E12 항목 (단계 15): 구관 현관 홀 E10(추격 C2 → 점프스케어 #2 → 기절 → 구관 4층에서 깨어남) → E11 P2 당직실 단서 3개(귀신) → E12 선택지.
// smoke.mjs 가 E7~E9 점검 바로 뒤에 부른다 (같은 페이지·도우미). headless 는 느려 시간 걸리는 구간(추격 달리기·점프스케어·기절·귀신 간격)은 직접 건너뛴다.
const WAKE = [16.5, -31.5, 3]; // data/story.json faints.wake4F
const LOG = [23.3, 1.6, -34.3]; // P2 당직 일지 살펴보기 자리

export async function e10e12Smoke({ S, check, poll, press }) {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => window.__DEBUG.story.advance());
      await wait(120);
    }
  };
  // 구관 현관 홀 → E10 → 추격 C2
  await S(() => window.__DEBUG.player.setView([16.5, 1.6, -1], 0, 0, 0));
  check('구관 현관 홀 → E10', await poll(() => window.__DEBUG.story.event?.id === 'E10'));
  await advanceTo('chase');
  check('추격 C2 시작 (경로 위, 시작 gap 20 m)', await poll(() => window.__DEBUG.chase.chase?.def.id === 'C2' && window.__DEBUG.scenes.e2.path), await S(() => window.__DEBUG.chase.hudLine()));
  check('귀신 자리가 건물 밖이면 실루엣을 그리지 않는다 (발소리만)', await S(() => { const g = window.__DEBUG.scenes.e2.ghost; return g?.mode === 'chase' && g.hidden === true; }));
  await S(() => window.__DEBUG.chase.reach()); // 달려서 끝까지 갔다고 본다
  await advanceTo('scare'); // 자막 한 줄
  check('도착 → 점프스케어 #2', await poll(() => window.__DEBUG.story.action?.do === 'scare' && window.__DEBUG.scenes.steps.scare && window.__DEBUG.scenes.stepsView.scareMesh.visible));
  await S(() => { const sc = window.__DEBUG.scenes.steps.scare; if (sc) sc.t = 99; });
  check('점프스케어 끝 → 기절 (막이 어두워지기 시작)', await poll(() => window.__DEBUG.story.action?.do === 'faint' && window.__DEBUG.scenes.faint.phase === 'out'));
  await S(() => { window.__DEBUG.scenes.faint.t = 99; });
  check('완전히 어두움 → 구관 4층 복도로 옮겨짐, 눈이 낮음', await poll((w) => { const D = window.__DEBUG; return D.scenes.faint.phase === 'black' && D.player.level === 3 && Math.abs(D.player.pos.x - w[0]) < 0.1 && Math.abs(D.player.pos.z - w[1]) < 0.1 && D.player.eyeDrop > 0.5 && +document.getElementById('veil').style.opacity === 1; }, WAKE));
  await S(() => { window.__DEBUG.scenes.faint.t = 99; });
  check('밝아지며 천장을 올려다봄', await poll(() => window.__DEBUG.scenes.faint.phase === 'in' && window.__DEBUG.player.camera.rotation.x > 0.5));
  await S(() => { window.__DEBUG.scenes.faint.t = 99; });
  check('깨어남 → E10 끝, 눈높이·막 원래대로, E11 시작', await poll(() => { const D = window.__DEBUG; return D.story.registry.done.has('E10') && D.player.eyeDrop === 0 && +document.getElementById('veil').style.opacity === 0 && D.story.event?.id === 'E11'; }));
  // E11 P2
  await advanceTo('puzzle');
  check('P2 시작, 목표 = 당직실 단서', await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'P2' && window.__DEBUG.story.objective().includes('열쇠 번호')));
  await S((p) => window.__DEBUG.player.setView([p[0], p[1], p[2]], 0, -30, 3), LOG);
  check('당직 일지 살펴보기', await poll(() => document.getElementById('interact').textContent.includes('당직 일지')));
  await press('KeyF', 120);
  check('E → 단서(일지), 귀신 실루엣 등장', await poll(() => window.__DEBUG.puzzle.puzzle?.got.includes('log') && window.__DEBUG.scenes.p2.ghost && window.__DEBUG.scenes.p2View.mesh.visible));
  await S(() => { const D = window.__DEBUG; D.scenes.p2.use('calendar'); D.scenes.p2.use('blackboard'); });
  for (let i = 0; i < 60 && (await S(() => window.__DEBUG.puzzle.active)); i++) {
    await S(() => { const p = window.__DEBUG.scenes.p2; p.lastShow = -1e9; if (p.ghost) Object.assign(p.ghost, { t: 99, phase: 'fade', alpha: Math.min(p.ghost.alpha, 0.02) }); }); // 간격 90초·머무는 시간은 건너뛴다
    await wait(400);
  }
  check('귀신 3번 뒤 P2 풀림 (정답 47)', await poll(() => window.__DEBUG.puzzle.last?.id === 'P2' && window.__DEBUG.puzzle.last.outcome === 'solved'), await S(() => `shown ${window.__DEBUG.scenes.p2.shown}`));
  // E11 마지막 대사를 넘긴다 (E12 대사·선택지는 넘기지 않는다: 선택지에서 advance 는 선택이다)
  for (let i = 0; i < 60 && !(await S(() => window.__DEBUG.story.registry.done.has('E11'))); i++) {
    await S(() => window.__DEBUG.story.registry.active === 'E11' && window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(120);
  }
  check('E11 끝 → 당직실 안이라 바로 E12 시작', await poll(() => window.__DEBUG.story.event?.id === 'E12'));
  for (let i = 0; i < 40 && (await S(() => window.__DEBUG.story.mode)) !== 'choice'; i++) {
    await S(() => window.__DEBUG.story.mode === 'line' && window.__DEBUG.story.advance());
    await wait(100);
  }
  check('E12 선택지 (제한 10초, 기본 = 남는다)', await S(() => { const c = window.__DEBUG.story.choice; return window.__DEBUG.story.mode === 'choice' && c.def.timeout === 10 && c.def.default === 'stay'; }));
  await S(() => { window.__DEBUG.story.choice.left = 0.01; }); // 10초 무응답
  check('무응답 → 남는다: dutyCompanion 꺼짐, 목표 = 기다린다', await poll(() => { const r = window.__DEBUG.story; return r.registry.done.has('E12') && !r.flags.values.dutyCompanion && r.objective().includes('기다린다'); }));
}
