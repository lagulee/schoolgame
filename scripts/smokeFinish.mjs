// smoke 의 단계 20(마감) 점검과 엔진 점검 (smoke.mjs 에서 나눔): 실내 밝기 보정(시작 화면 버튼·키), 혼자일 때 연출, 엔딩 카드 다시 하기, 퍼즐 실행기·추격 엔진(단계 0b-3·0b-4)
export async function brightStartSmoke({ page, check, poll }) {
  // 실내 밝기 보정 (단계 20): 시작 화면 − + 는 게임을 시작하지 않고 단계를 바꾸며 브라우저에 저장된다
  const brightBtn = (i) => page.locator('#bright-box .bright-btn').nth(i).click();
  check('시작 화면: 경고 문구 정리(점프스케어·깜빡임 3회 미만) + 실내 밝기 0', (await page.textContent('#overlay .warn')).includes('점프스케어') && (await page.textContent('#bright-box .bright-value')) === '0');
  await brightBtn(1);
  await brightBtn(1);
  await brightBtn(1);
  check('실내 밝기 + 세 번 → +2 (끝), 저장, 시작 안 함', await poll(() => window.__DEBUG.brightness.level === 2 && localStorage.getItem('schoolgame.brightness') === '2' && !window.__DEBUG.startFlow.started && document.querySelector('#bright-box .bright-value').textContent === '+2' && Math.abs(window.__DEBUG.interior.atmo.bright.light - 1.96) < 1e-6));
  for (let i = 0; i < 4; i++) await brightBtn(0);
  check('실내 밝기 − 네 번 → −2', await poll(() => window.__DEBUG.brightness.level === -2 && document.querySelector('#bright-box .bright-value').textContent === '−2'));
  await brightBtn(1);
  await brightBtn(1);
  check('다시 0', await poll(() => window.__DEBUG.brightness.level === 0 && window.__DEBUG.interior.atmo.bright.light === 1));
}

export async function brightKeySmoke({ press, check, poll }) {
  await press('Equal', 100);
  check('= 키 → 실내 밝기 +1 (디버그 잠금 없이)', await poll(() => window.__DEBUG.brightness.level === 1 && document.getElementById('toast').textContent.includes('실내 밝기 +1')));
  await press('Minus', 100);
  check('- 키 → 다시 0', await poll(() => window.__DEBUG.brightness.level === 0));
}

export async function aloneSmoke({ S, check, poll }) {
  // 혼자일 때 연출 (단계 20, STORY 13-3): E2 뒤 구간. 기다리는 시간을 건너뛰어 속삭임 → 조명 떨림(표시등·눈 적응 빛이 한 번 어두워졌다 돌아옴)
  const aloneN = await S(() => window.__DEBUG.scenes.alone.log.length);
  await S(() => { window.__DEBUG.scenes.alone.wait = 0; });
  check('혼자일 때: 속삭임 (E2 뒤 구간)', await poll((n) => { const a = window.__DEBUG.scenes.alone; return a.log.length > n && a.log.some((e) => e.key === 'E2'); }, aloneN));
  await S(() => { const a = window.__DEBUG.scenes.alone; a.next = 'dim'; a.wait = 0; });
  check('혼자일 때: 조명 떨림 → 실내 표시등·눈 적응 빛이 어두워진다', await poll(() => window.__DEBUG.interior.atmo.tremble < 0.9));
  check('떨림이 끝나면 그대로', await poll(() => window.__DEBUG.interior.atmo.tremble === 1 && window.__DEBUG.scenes.alone.dimT < 0));
}

export async function endingRestartSmoke({ S, press, check, poll }) {
  // 엔딩 카드 (단계 20): "처음부터 다시" 버튼·Enter → onRestart(실제로는 새로고침), E → 닫기. 새로고침은 막고 부른 횟수만 센다
  await S(() => { window.__restart = 0; window.__DEBUG.story.ui.onRestart = () => window.__restart++; if (window.__DEBUG.story.mode !== 'ending') window.__DEBUG.story.showEnding('C'); });
  check('엔딩 카드: 처음부터 다시 버튼 + E 닫고 둘러보기 안내', await poll(() => getComputedStyle(document.querySelector('#story .story-restart')).display !== 'none' && document.querySelector('#story .story-hint').textContent.includes('닫고')));
  await S(() => document.querySelector('#story .story-restart').click()); // 포인터락 중이라 화면 클릭 대신 (키보드 click 과 같은 경로)
  await press('Enter', 100);
  check('버튼·Enter → 처음부터 다시 (2번), 카드는 그대로', await poll(() => window.__restart === 2 && window.__DEBUG.story.mode === 'ending'));
  await press('KeyE', 100);
  check('E → 카드 닫힘, 대화창에서는 버튼 숨김', await poll(() => window.__DEBUG.story.mode !== 'ending') && (await S(() => { window.__DEBUG.story.ui.showLine({ style: 'dialog', speaker: 'x', text: 'y' }); const v = getComputedStyle(document.querySelector('#story .story-restart')).display; window.__DEBUG.story.ui.hide(); return v === 'none'; })));
}

export async function enginesSmoke({ S, press, check, poll }) {
  // 퍼즐 실행기 (단계 0b-4): I 시작/중지, O 단서(중복 무시), Z 정답, X 오답 3번 → 시작 지점·플래그 복원 후 다시
  await press('KeyI', 120);
  check('I → 시험 퍼즐 시작 + HUD 퍼즐 줄', await poll(() => window.__DEBUG.puzzle.puzzle?.id === 'T0' && document.getElementById('hud').textContent.includes('퍼즐 T0')));
  await press('KeyO', 120);
  await press('KeyO', 120);
  check('O → 단서 얻기 (2/3)', await poll(() => window.__DEBUG.puzzle.puzzle?.got.length === 2));
  await S(() => window.__DEBUG.puzzle.gather('a'));
  check('같은 단서는 한 번만 센다', await S(() => window.__DEBUG.puzzle.puzzle.got.length === 2));
  await S(() => window.__DEBUG.story.flags.set('earlyBook', true));
  await press('KeyX', 120);
  await press('KeyX', 120);
  await press('KeyX', 120);
  check('X 3번 → 실패, 시작 지점 복원 (단서 0·틀림 0·플래그 원복·시도 2)', await poll(() => { const s = window.__DEBUG.puzzle; return s.puzzle?.got.length === 0 && s.puzzle.wrong === 0 && s.attemptOf('T0') === 1 && !window.__DEBUG.story.flags.values.earlyBook; }));
  await press('KeyZ', 120);
  check('Z → 정답 → 성공 후 종료', await poll(() => !window.__DEBUG.puzzle.active && window.__DEBUG.puzzle.last?.outcome === 'solved' && document.getElementById('hud').textContent.includes('퍼즐: 없음')));
  // 추격 엔진 (단계 0b-3): C(디버그) 시작/중지, HUD 줄, 잡히면 시작 지점·플래그로 되돌리고 다시, 출구 여는 1초 조작 불가
  await press('KeyC', 120);
  check('C → 추격 C2 시작 + HUD 추격 줄', await poll(() => window.__DEBUG.chase.chase?.def.id === 'C2' && document.getElementById('hud').textContent.includes('추격 C2')));
  const caught = await S(() => {
    const s = window.__DEBUG.chase;
    const P = window.__DEBUG.player;
    const start = [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)];
    window.__DEBUG.story.flags.set('earlyBook', true);
    P.setView([start[0] + 5, 1.6, start[1] + 5], 0, 0);
    P.speed = 0;
    s.update(8); // 가만히 서 있으면 (20 − 1.5) / 2.6 ≈ 7.1초에 잡힌다
    return { attempt: s.chase?.attempt, gap: s.chase?.startGap, book: window.__DEBUG.story.flags.values.earlyBook, back: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)], start };
  });
  check('잡힘 → 시작 지점·플래그 복원, 시도 2 (시작 거리 +2 m)', caught.attempt === 1 && caught.gap === 22 && !caught.book && caught.back.join() === caught.start.join(), JSON.stringify(caught));
  await press('KeyC', 120);
  check('C → 추격 중지', await poll(() => !window.__DEBUG.chase.active && document.getElementById('hud').textContent.includes('추격: 없음')));
  await S(() => { const s = window.__DEBUG.chase; s.start('C4', { atExit: 'collapse' }); Object.assign(s.chase, { phase: 'unlock', stall: 0, unlockLeft: 1, passed: true, arrivalGap: 5, gap: 5 }); });
  check('출구 여는 동안 조작 불가', await poll(() => window.__DEBUG.player.frozen && window.__DEBUG.chase.locked));
  await S(() => window.__DEBUG.chase.update(1.05)); // SwiftShader 는 프레임이 느려 1초를 직접 진행
  check('1초 뒤 통과 → collapse, 조작 복귀', await poll(() => !window.__DEBUG.chase.active && window.__DEBUG.chase.last?.finale === 'collapse' && !window.__DEBUG.player.frozen));
}
