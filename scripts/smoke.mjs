// 상호작용 스모크 테스트: 클릭 → 키 입력(이동·토글·이벤트) → 핸드폰(E 화면·R 라이트·보조배터리) → 스토리 엔진(디버그 키로 사건 진행) → 콘솔 에러 수집
// ?light=1 : 핸드폰 라이트를 켠 채 시작 (손전등이 없어진 뒤 화면이 어두워도 같은 조건으로 점검)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4180;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && res()); setTimeout(res, 8000); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?light=1`);
await page.waitForFunction(() => document.getElementById('loading').textContent === '', null, { timeout: 120000 });
await page.click('#overlay');
const press = async (k, ms = 300) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
await press('Digit1', 200);
await page.waitForTimeout(3000);
const p0 = await page.evaluate(() => window.__DEBUG.pos());
await press('KeyW', 4000);
const p1 = await page.evaluate(() => window.__DEBUG.pos());
console.log('W 4초 이동:', p0, '→', p1);
await press('KeyD', 1500);
for (const k of ['KeyR', 'KeyR', 'KeyB', 'KeyG', 'KeyV', 'BracketRight', 'BracketLeft', 'KeyL', 'KeyL', 'KeyH', 'KeyM', 'KeyM', 'KeyY', 'KeyY', 'KeyY', 'Digit1', 'Digit2', 'Digit3', 'Backquote', 'KeyP']) await press(k, 150);
await page.keyboard.down('ShiftLeft');
await press('KeyW', 3000);
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(6000);
// 결정적 이동 테스트: 프레임과 무관하게 player.update 를 직접 돌린다
const sim = await page.evaluate(() => {
  const P = window.__DEBUG.player;
  const run = (pos, yaw, keys, sec) => {
    P.setView(pos, yaw, 0);
    P.vel.set(0, 0);
    P.stamina.reset();
    P.keys.clear();
    keys.forEach((k) => P.keys.add(k));
    for (let i = 0; i < sec * 60; i++) P.update(1 / 60);
    P.keys.clear();
    return [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2), +P.floorY.toFixed(2)];
  };
  return {
    northToColumn: run([0, 1.6, 12], 0, ['KeyW'], 20),
    westIntoBed: run([-11, 1.6, -5], 90, ['KeyW'], 5),
    diagonalSlideWall: run([-3, 1.6, -10], 30, ['KeyW'], 8),
    climbSteps: run([10, 1.6, -1], -90, ['KeyW'], 4),
    runSouthToStreetLimit: run([0, 1.6, 12], 180, ['KeyW', 'ShiftLeft'], 6),
  };
});
console.log('이동 시뮬레이션', sim);

const fails = [];
const check = (name, pass, info = '') => { if (!pass) fails.push(name); console.log(`${pass ? '✅' : '❌'} ${name} ${info}`); };
const S = (fn, arg) => page.evaluate(fn, arg);
const lastBefore = await S(() => window.__DEBUG.director.last);
const ph = () => S(() => { const p = window.__DEBUG.phone; return { open: p.screenOpen, light: p.lightOn, bat: p.battery, lv: p.level, begun: p.begun, picked: [...p.picked] }; });
const poll = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false); // 프레임 반영을 기다린다 (SwiftShader 는 느림)
// 스태미나 (단계 0b-2): 마당 한가운데서 player.update 를 직접 돌려 속도·탈진·핸드폰 감속·막대를 확인한다
const stam = await page.evaluate(() => {
  const P = window.__DEBUG.player;
  const ph = window.__DEBUG.phone;
  const go = (keys, sec) => {
    P.keys.clear();
    keys.forEach((k) => P.keys.add(k));
    for (let i = 0; i < sec * 60; i++) P.update(1 / 60);
    return { v: +P.speed.toFixed(2), run: P.running, st: +P.stamina.value.toFixed(1), ex: P.stamina.exhausted };
  };
  const out = {};
  P.setView([0, 1.6, 12], 90, 0); // 서쪽(마당 가로)으로 — 담장·건물까지 여유
  P.vel.set(0, 0);
  P.stamina.reset();
  out.walk = go(['KeyW'], 1.5);
  out.run3 = go(['KeyW', 'ShiftLeft'], 3);
  P.setView([12, 1.6, 12], 90, 0);
  out.runOut = go(['KeyW', 'ShiftLeft'], 6); // 누적 9초 → 탈진
  out.tiredWalk = go(['KeyW', 'ShiftLeft'], 1.5); // 탈진 중 Shift → 1.3
  out.rest = go([], 4); // 멈춤 4초 → 대기 1 + 12×3 = 36 → 해제
  P.setView([0, 1.6, 12], 90, 0);
  P.vel.set(0, 0);
  P.stamina.reset();
  ph.s.battery = 80;
  ph.openScreen();
  out.phoneRun = go(['KeyW', 'ShiftLeft'], 2); // 화면 열림: 달리기 불가, 1.6 × 0.7
  ph.closeScreen();
  out.afterPhone = go(['KeyW', 'ShiftLeft'], 1.5);
  P.keys.clear();
  return out;
});
console.log('스태미나', stam);
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
// 단계 7 외부 확장: 실제 충돌(소품 포함)로 마당 → 옆길 → 운동장, 운동장 경계, 필로티 유리문
const ext = await page.evaluate(() => {
  const P = window.__DEBUG.player;
  const run = (pos, yaw, sec) => {
    P.setView(pos, yaw, 0);
    P.vel.set(0, 0);
    P.stamina.reset();
    P.keys.clear();
    P.keys.add('KeyW');
    for (let i = 0; i < sec * 60; i++) P.update(1 / 60);
    P.keys.clear();
    return [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2), P.collision.surfaceAt(P.pos.x, P.pos.z)];
  };
  return {
    toField: run([0, 1.6, 11], -90, 26),
    fieldWest: run([60, 1.6, -52.5], 90, 20),
    fieldNorth: run([82, 1.6, -60], 0, 25),
    fieldEast: run([90, 1.6, -30], -90, 10),
    piloti: run([0.8, 1.6, -12], 0, 8),
    pathNorth: run([31, 1.6, 12], 0, 5),
  };
});
console.log('외부 확장 이동', ext);
check('마당에서 동쪽으로 걸어 옆길을 지나 운동장 도달', ext.toField[0] > 36, JSON.stringify(ext.toField));
check('운동장 바닥 발소리 = 마사토(dirt)', ext.fieldNorth[2] === 'dirt', JSON.stringify(ext.fieldNorth));
check('운동장 서쪽 울타리에서 멈춤 (건물 쪽으로 못 감)', near(ext.fieldWest[0], 33.4, 0.1), JSON.stringify(ext.fieldWest));
check('운동장 북쪽 그물에서 멈춤', near(ext.fieldNorth[1], -95.7, 0.1), JSON.stringify(ext.fieldNorth));
check('운동장 동쪽 그물에서 멈춤', near(ext.fieldEast[0], 101.7, 0.1), JSON.stringify(ext.fieldEast));
check('필로티는 유리문에서 멈춤 (얕은 입구)', near(ext.piloti[1], -19.7, 0.1), JSON.stringify(ext.piloti));
check('옆길 북쪽(동쪽 날개 옆 틈)은 막힘', near(ext.pathNorth[1], 8.4, 0.1), JSON.stringify(ext.pathNorth));
check('걷기 1.6 m/s 그대로', near(stam.walk.v, 1.6) && !stam.walk.run && stam.walk.st === 100, JSON.stringify(stam.walk));
check('달리기 3.6 m/s, 3초에 −37.5', near(stam.run3.v, 3.6) && stam.run3.run && near(stam.run3.st, 62.5, 0.3), JSON.stringify(stam.run3));
check('8초 넘게 달리면 탈진 → 달리기 해제', stam.runOut.ex && !stam.runOut.run && stam.runOut.st === 0, JSON.stringify(stam.runOut));
check('탈진 중 Shift 를 눌러도 1.3 m/s', stam.tiredWalk.ex && !stam.tiredWalk.run && near(stam.tiredWalk.v, 1.3), JSON.stringify(stam.tiredWalk));
check('멈춰 쉬면 회복 → 30 넘어 탈진 해제', !stam.rest.ex && stam.rest.st >= 30, JSON.stringify(stam.rest));
check('핸드폰 화면 열림: 달리기 불가, 이동 ×0.7 (1.12 m/s), 스태미나 소모 없음', !stam.phoneRun.run && near(stam.phoneRun.v, 1.12) && stam.phoneRun.st === 100, JSON.stringify(stam.phoneRun));
check('화면을 닫으면 다시 달리기', stam.afterPhone.run && near(stam.afterPhone.v, 3.6, 0.15), JSON.stringify(stam.afterPhone));
// 막대: 소모 중 표시·30% 이하 붉게, 가득 차면 숨김
await S(() => { const s = window.__DEBUG.player.stamina; s.value = 20; s.sinceRun = 0; });
check('스태미나 막대: 회복 중 표시 + 30% 이하 붉게', await poll(() => { const b = document.getElementById('stamina'); return b.classList.contains('show') && b.classList.contains('low'); }));
await S(() => window.__DEBUG.player.stamina.reset());
check('스태미나 막대: 가득 차면 숨김', await poll(() => !document.getElementById('stamina').classList.contains('show')));

// 스토리 엔진: N(다음 사건)으로 E1~ 을 차례로 불러 E(넘기기)로 진행하고, J(4층 책 줍기)로 R1 에 들어가 플래그·시점 변화를 확인한다
check('?light=1 → 라이트 켜진 채 시작', (await ph()).light);
const ph0 = await ph();
await press('KeyE', 120);
check('E 키는 더 이상 이상 현상을 발동하지 않음', (await S(() => window.__DEBUG.director.last)) === lastBefore);
const ph1 = await ph();
check('E(대화·대상 없음) → 핸드폰 화면 열림, −2%', ph1.open && Math.abs(ph0.bat - ph1.bat - 2) < 0.2, JSON.stringify([ph0.bat, ph1.bat]));
check('핸드폰 화면 표시', await poll(() => document.getElementById('phone').style.display !== 'none'));
await press('KeyR', 120);
check('화면이 열린 채 R → 라이트 끔', (await ph()).open && !(await ph()).light);
await press('KeyR', 120);
check('R → 라이트 다시 켬', (await ph()).light);
await press('KeyE', 120);
check('E 한 번 더 → 화면 닫힘', !(await ph()).open && (await poll(() => document.getElementById('phone').style.display === 'none')));
const finishEvent = async () => {
  for (let i = 0; i < 12 && (await S(() => window.__DEBUG.story.mode)) === 'line'; i++) await press('KeyE', 120);
};
const played = [];
const flagsAfter = {};
const S_ = () => S(() => ({ id: window.__DEBUG.story.event?.id, mode: window.__DEBUG.story.mode, pov: window.__DEBUG.story.pov,
  vis: [...document.querySelectorAll('#story > div')].filter((d) => d.style.display !== 'none').map((d) => d.className) }));
await press('KeyJ', 120);
check('J(책 줍기)는 E5 전에는 무시', !(await S(() => window.__DEBUG.story.flags.values.earlyBook)) && (await S(() => window.__DEBUG.story.mode)) === 'idle');
for (let i = 0; i < 15; i++) {
  await press('KeyN', 120);
  const st = await S_();
  played.push(st.id);
  if (i === 0) {
    check('N → E1 자막 표시', st.id === 'E1' && st.vis.length === 1, JSON.stringify(st));
    const b = await ph();
    check('E1 시작 때 배터리 확정 (표시 86~92%, 라이트가 켜져 있어 소수점만 줄어듦)', b.begun && b.lv >= 86 && b.lv <= 92 && b.bat > b.lv - 1, JSON.stringify(b));
    await finishEvent();
    check('대화 넘기기 E 는 핸드폰을 열지 않음', !(await ph()).open);
    // 보조배터리: U(디버그)로 앞에 놓고 E 로 줍는다 → 상호작용이 핸드폰보다 먼저
    await S(() => { window.__DEBUG.phone.s.battery = 50; });
    await press('KeyU', 120);
    check('U → 보조배터리 안내 표시', await poll(() => document.getElementById('interact').style.display !== 'none' && document.getElementById('interact').textContent.includes('보조배터리')));
    await press('KeyE', 120);
    const pb = await ph();
    check('근처 대상이 있으면 E = 줍기 (화면 안 열림), +15%', pb.picked.includes('PB1') && !pb.open && Math.abs(pb.bat - 65) < 0.5, JSON.stringify(pb));
    check('주운 뒤 안내 사라짐', await poll(() => document.getElementById('interact').style.display === 'none'));
  }
  if (i === 1) {
    await press('KeyN', 120);
    check('사건 도중 N 은 무시 (진행 중)', (await S(() => window.__DEBUG.story.event?.id)) === 'E2');
    check('E2 대화창 + 화자 이름', st.vis.includes('story-dlg') && (await page.textContent('.story-name')).length > 0);
  }
  if (st.id === 'R1-e') {
    check('R1-e 태민 시점 전환', st.pov === 'mingeon', JSON.stringify(st));
    const mp = await S(() => ({ pov: window.__DEBUG.phone.pov, bat: window.__DEBUG.phone.battery }));
    check('R1-e 태민 핸드폰 55% 에서 시작', mp.pov === 'mingeon' && mp.bat > 53 && mp.bat <= 55, JSON.stringify(mp));
    await press('KeyE', 120); // 타자 효과 끝내기
    await press('KeyE', 120); // 둘째 줄 = 태민 대사
    const nm = await S(() => ({ line: window.__DEBUG.story.lineIdx, who: window.__DEBUG.story.event.lines[window.__DEBUG.story.lineIdx].who, shown: getComputedStyle(document.querySelector('.story-name')).display !== 'none' }));
    check('태민 시점: 태민 대사는 이름 없이', nm.who === 'mingeon' && !nm.shown, JSON.stringify(nm));
  }
  await finishEvent();
  if (st.id === 'E5') {
    check('E5 선택지 없음', (await S(() => window.__DEBUG.story.mode)) === 'idle' && !(await page.isVisible('.story-choice')));
    await press('KeyJ', 120); // 신관 4층 책 줍기 (상호작용 사건, 맵 배치 전 디버그 키)
    await finishEvent();
    check('J → 책 줍기 → earlyBook = true, 루트 R1', await S(() => window.__DEBUG.story.flags.values.earlyBook && window.__DEBUG.story.route === 'R1'));
  }
  flagsAfter[st.id] = await S(() => ({ ...window.__DEBUG.story.flags.values }));
}
const r1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `R1-${x}`);
check('E1~E7 → R1-a~R1-h 순서 (E8·E9 생략)', played.join() === ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', ...r1].join(), played.join());
check('E4 후 hasConnectorKey = true', flagsAfter.E4?.hasConnectorKey === true);
check('R1-e 후 hasExitKey = true', flagsAfter['R1-e']?.hasExitKey === true && flagsAfter['R1-d']?.hasExitKey === false);
await press('KeyN', 120);
check('R1 엔딩 A 표시', (await S(() => window.__DEBUG.story.mode)) === 'ending' && (await page.textContent('.story-name')).includes('R1 → 엔딩 A'));
check('엔딩 기록 localStorage(endingsSeen)', await S(() => JSON.parse(localStorage.getItem('schoolgame.endingsSeen') ?? '[]').includes('A')));
check('시점이 주인공으로 복귀', (await S(() => window.__DEBUG.story.pov)) === 'player');
check('같은 사건 연속 발동 금지', await S(() => { const r = window.__DEBUG.story; r.close(); const ok = r.start('E3'); while (r.mode === 'line') r.advance(); return ok && !r.start('E3') && r.lastReason.includes('연속'); }));
await press('KeyK', 120);
check('K → 스토리 초기화', await S(() => !window.__DEBUG.story.flags.values.earlyBook && window.__DEBUG.story.registry.last === null));
check('K → 핸드폰도 새 판 (주운 보조배터리 비움)', (await ph()).picked.length === 0 && !(await ph()).begun);
// E12: W/S 선택지 이동, 선택 중 이동 정지, 시간 초과 기본값
await S(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); });
check('E12 선택지 + 제한 시간 막대', (await S(() => window.__DEBUG.story.mode)) === 'choice' && (await page.isVisible('.story-timer')));
check('선택지 동안 이동 정지', await poll(() => window.__DEBUG.player.frozen));
const q = await S(() => document.getElementById('hud').textContent.match(/품질 (\w+)/)?.[1]);
await press('Digit2', 120); // 숫자키 2 = 둘째 항목(남는다). 선택지가 떠 있으면 품질 단축키로 넘어가지 않는다
check('숫자키 선택 → 남는다', await poll(() => window.__DEBUG.story.mode === 'idle' && !window.__DEBUG.story.flags.values.dutyCompanion));
check('선택 중 숫자키가 품질을 바꾸지 않음', (await S(() => document.getElementById('hud').textContent.match(/품질 (\w+)/)?.[1])) === q, q);
await S(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); });
await press('KeyS', 120);
await press('KeyE', 120);
check('S 로 항목 이동(기본값 남는다 → 따라간다, 순환) → E 결정', await poll(() => window.__DEBUG.story.mode === 'idle' && window.__DEBUG.story.flags.values.dutyCompanion && !window.__DEBUG.player.frozen));
await S(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); r.update(10.5); });
check('무응답 10초 → 기본값 남는다', await S(() => window.__DEBUG.story.mode === 'idle' && !window.__DEBUG.story.flags.values.dutyCompanion));
await S(() => window.__DEBUG.story.reset());
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
check('C → 추격 C1 시작 + HUD 추격 줄', await poll(() => window.__DEBUG.chase.chase?.def.id === 'C1' && document.getElementById('hud').textContent.includes('추격 C1')));
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
const info = await page.evaluate(() => ({ hud: document.getElementById('hud').textContent, pos: window.__DEBUG?.pos?.() }));
console.log(info);
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
if (fails.length) console.log(`스토리 검사 실패 ${fails.length}건: ${fails.join(', ')}`);
process.exit(errors.length || fails.length ? 1 : 0);
