// 상호작용 스모크 테스트: 시작 흐름(이름 입력·자유 탐색·현관 홀 E1) → 키 입력(이동·토글·이벤트) → 본관 실내(자동문·계단·교실 문) → 신관(연결문·통로·계단·살펴보기) → 핸드폰(E 화면·R 라이트·보조배터리) → 스토리 엔진(디버그 키로 사건 진행) → 맵(위치 이름·보조배터리 자리, smokeMap.mjs) → 콘솔 에러 수집
// ?light=1 : 핸드폰 라이트를 켠 채 시작 (손전등이 없어진 뒤 화면이 어두워도 같은 조건으로 점검)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mapSmoke } from './smokeMap.mjs';
import { e7e9Smoke } from './smokeE7.mjs';
import { e10e12Smoke } from './smokeE10.mjs';
import { e13e15Smoke } from './smokeE13.mjs';
import { e17Smoke } from './smokeE17.mjs';
import { r1Smoke } from './smokeR1.mjs';
import { r1ehSmoke, toMingeonLine } from './smokeR1eh.mjs';
import { e1e2Smoke, e3e6Smoke } from './smokeE1E6.mjs';
import { brightStartSmoke, brightKeySmoke, aloneSmoke, endingRestartSmoke, enginesSmoke } from './smokeFinish.mjs';
import { roofSmoke } from './smokeRoof.mjs';

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
const press = async (k, ms = 300) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const fails = [];
const check = (name, pass, info = '') => { if (!pass) fails.push(name); console.log(`${pass ? '✅' : '❌'} ${name} ${info}`); };
const S = (fn, arg) => page.evaluate(fn, arg);
const poll = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false); // 프레임 반영을 기다린다 (SwiftShader 는 느림)
// 시작 흐름 (단계 0c): 경고 → 이름 입력(필수) → 시작 → 학교 앞 자유 탐색 → 현관 홀에서 E1 한 번
check('시작 화면: 경고 문구 + 이름 칸', (await page.isVisible('#overlay .warn')) && (await page.isVisible('#name-input')));
await brightStartSmoke({ page, check, poll }); // 실내 밝기 보정 (단계 20)
await page.click('#overlay', { position: { x: 8, y: 8 } });
check('이름 없이 누르면 시작하지 않음 (안내)', !(await S(() => window.__DEBUG.startFlow.started)) && (await page.textContent('#name-box .name-msg')).length > 0);
await page.fill('#name-input', '가나다라마바사아자');
await page.click('#overlay', { position: { x: 8, y: 8 } });
check('9자 이름은 거절', !(await S(() => window.__DEBUG.startFlow.started)));
await page.fill('#name-input', '<i>a</i>');
await page.keyboard.press('KeyE'); // 입력 중 E 는 게임 키로 번지지 않음
check('이름 입력 중 E 는 핸드폰을 열지 않음', !(await S(() => window.__DEBUG.phone.screenOpen)));
await page.fill('#name-input', '<i>a</i>');
await page.click('#overlay', { position: { x: 8, y: 8 } });
check('이름 입력 → 시작 (오버레이 숨김)', await poll(() => window.__DEBUG.startFlow.started && document.getElementById('overlay').classList.contains('hidden')));
check('HTML 문자 이름은 글자 그대로 (태그로 해석 안 됨, localStorage 에 저장)', await S(() => window.__DEBUG.story.text('{player}') === '<i>a</i>' && !document.querySelector('#story i, #overlay i') && localStorage.getItem('schoolgame.playerName') === '<i>a</i>'));
check('이름 칸은 첫 시작 뒤 숨김', !(await page.isVisible('#name-input')));
await brightKeySmoke({ press, check, poll });
check('자유 탐색 안내 문구 (6초 뒤 사라짐, headless 는 느려 문구만 확인)', await S(() => document.getElementById('notice').textContent.includes('운동장')));
await press('Digit1', 200);
await e1e2Smoke({ page, S, press, check, poll }); // 학교 앞 → 현관 홀 E1 → 3층 동쪽 복도 E2 (단계 0c·12, 3층 목격으로 변경)
await aloneSmoke({ S, check, poll }); // 혼자일 때 연출 (단계 20, STORY 13-3)
await press('KeyR', 120);
await e3e6Smoke({ S, press, check, poll }); // E3~E6 (단계 13)
await e7e9Smoke({ S, check, poll, press });
await e10e12Smoke({ S, check, poll, press });
await e13e15Smoke({ S, check, poll });
await e17Smoke({ S, check, poll });
await r1Smoke({ S, check, poll });
await r1ehSmoke({ S, check, poll });
await endingRestartSmoke({ S, press, check, poll }); // 엔딩 카드 처음부터 다시 (단계 20)
// 이후 점검은 디버그 키로 사건을 직접 부르므로 자동 진입을 끄고 스토리를 비운다 (실내 점검 중 현관 홀·복도에서 E1·E2 가 끼어들지 않게)
await S(() => { window.__DEBUG.prelude.enabled = false; window.__DEBUG.scenes.auto = false; window.__DEBUG.story.reset(); window.__DEBUG.player.setView([0, 1.6, 12], 0, 0); });
// 디버그 잠금: 잠긴 동안 디버그 키는 동작하지 않고, ` 키는 비밀번호 창을 연다
await press('KeyB', 100);
check('잠금: B(블룸) 무시', await S(() => window.__DEBUG.world.ctx && !window.__DEBUG.player.ghost && !window.__DEBUG.gate.unlocked));
await press('KeyT', 100);
await press('KeyF', 100);
check('잠금: T·F 무시', await S(() => !window.__DEBUG.player.ghost && !window.__DEBUG.player.stamina.infinite));
await press('Backquote', 100);
check('잠금: ` 키 → 비밀번호 창', await poll(() => getComputedStyle(document.getElementById('gate')).display !== 'none'));
await page.fill('#gate input', '0000');
await page.keyboard.press('Enter');
check('잘못된 비밀번호 → 잠긴 채 안내', await poll(() => document.querySelector('#gate .gate-msg').textContent.includes('틀렸다')) && !(await S(() => window.__DEBUG.gate.unlocked)));
await page.fill('#gate input', '3141');
await page.keyboard.press('Enter');
check('3141 → 잠금 해제 + 창 닫힘', await poll(() => window.__DEBUG.gate.unlocked && getComputedStyle(document.getElementById('gate')).display === 'none'));
await press('KeyT', 100);
await press('KeyF', 100);
check('T → 유령 모드, F → 무한 스태미나', await S(() => window.__DEBUG.player.ghost && window.__DEBUG.player.stamina.infinite));
await press('KeyT', 100);
await press('KeyF', 100);
check('T·F 다시 → 꺼짐', await S(() => !window.__DEBUG.player.ghost && !window.__DEBUG.player.stamina.infinite));
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
// 유령 모드: 같은 걸음이 기둥에서 막히지 않고 더 빠르게 지나간다
const ghostSim = await page.evaluate(() => {
  const P = window.__DEBUG.player;
  P.ghost = true;
  P.setView([0, 1.6, 12], 0, 0);
  P.vel.set(0, 0);
  P.keys.clear();
  P.keys.add('KeyW');
  for (let i = 0; i < 20 * 60; i++) P.update(1 / 60);
  P.keys.clear();
  P.ghost = false;
  return [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)];
});
console.log('유령 이동', ghostSim);
check('유령 모드: 기둥을 통과해 더 멀리 간다', ghostSim[1] < sim.northToColumn[1] - 3, `${ghostSim} vs ${sim.northToColumn}`);

const lastBefore = await S(() => window.__DEBUG.director.last);
const ph = () => S(() => { const p = window.__DEBUG.phone; return { open: p.screenOpen, light: p.lightOn, bat: p.battery, lv: p.level, begun: p.begun, picked: [...p.picked] }; });
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
// 단계 8 본관 실내: 현관 자동문으로 들어가 계단으로 2층, 교실 문 E 열기·들어가기, 잠긴 문, 실내 분위기·HUD
const walkIn = (pos, yaw, sec, lv = 0) => S(([pos, yaw, sec, lv]) => {
  const P = window.__DEBUG.player;
  const I = window.__DEBUG.interior;
  if (pos) { P.setView(pos, yaw, 0, lv); P.vel.set(0, 0); } else P.setView([P.pos.x, 1.6, P.pos.z], yaw, 0, P.level);
  P.stamina.reset();
  P.keys.clear();
  if (sec) P.keys.add('KeyW');
  for (let i = 0; i < sec * 60; i++) { P.update(1 / 60); I.update(1 / 60, P, P.camera); }
  P.keys.clear();
  P.vel.set(0, 0);
  return { x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), lv: P.level, y: +P.floorY.toFixed(2), surf: P.collision.surfaceAt(P.pos.x, P.pos.z, P.level), inside: I.atmo.inside, k: +I.atmo.k.toFixed(2), door: I.entrance.f };
}, [pos, yaw, sec, lv]);
const ent = await walkIn([12.6, 1.6, -1], -90, 2.4);
check('현관 자동문이 열리고 현관 홀(돌 바닥)로 들어감, 실내 노출 전환 시작', ent.x > 15.5 && ent.surf === 'stone' && ent.inside && ent.door > 0.9 && ent.k > 0 && ent.k < 0.5, JSON.stringify(ent));
const fade = await walkIn(null, -90, 3.5);
check('3초 뒤 실내 노출 전환 끝 (k = 1), 멀어지면 자동문 닫힘', fade.k === 1 && fade.door === 0, JSON.stringify(fade));
await walkIn([18.7, 1.6, -18.9], -90, 3.2);
await walkIn(null, 0, 0.9);
const up = await walkIn(null, 90, 3.6);
check('S1 계단으로 2층 (level 1, 바닥 높이 4.05)', up.lv === 1 && near(up.y, 4.05), JSON.stringify(up));
check('HUD 에 층·실내 표시', await poll(() => /층 1 /.test(document.getElementById('hud').textContent) && document.getElementById('hud').textContent.includes('실내: 2층')));
await walkIn([-16.8, 1.6, -52], 0, 0, 1);
check('잠긴 교실 문 안내 (2층 1-3)', await poll(() => document.getElementById('interact').textContent.includes('1-3 문 열기')));
await press('KeyE', 120);
check('잠긴 문: E → 잠김 안내, 문은 그대로', await poll(() => document.getElementById('toast').textContent.includes('잠겨 있다')) && !(await S(() => window.__DEBUG.interior.doors.openIds.length)));
await walkIn([-8.3, 1.6, -52], 0, 0, 0);
check('1층 1-1 교실 문 안내', await poll(() => document.getElementById('interact').textContent.includes('1-1 문 열기')));
const blocked = await walkIn(null, 0, 2);
await press('KeyE', 120);
check('E → 문 열림 + 안내가 닫기로 바뀜', await poll(() => window.__DEBUG.interior.doors.openIds.includes('1F-1-1') && document.getElementById('interact').textContent.includes('1-1 문 닫기')));
const inRoom = await walkIn(null, 0, 2.5);
check('닫힌 문은 막고, 연 문으로 교실에 들어감 (마루 바닥)', blocked.z > -53 && inRoom.z < -53.6 && inRoom.surf === 'wood', JSON.stringify([blocked, inRoom]));
// 단계 9 신관: 본관 3층 연결통로 입구 → 연결문(열쇠 없으면 잠김, hasConnectorKey 면 열림) → 통로 → 신관 3층 → 계단으로 4층
await walkIn([18.5, 1.6, -60.9], 0, 0, 2);
check('연결문 안내 (본관 3층 연결통로 입구)', await poll(() => document.getElementById('interact').textContent.includes('연결문 열기')));
await press('KeyE', 120);
check('열쇠 없으면 연결문 잠김 안내, 문은 닫힌 채', await poll(() => document.getElementById('toast').textContent.includes('연결문이 잠겨')) && (await S(() => window.__DEBUG.interior.connector.state.f)) === 0);
const stuck = await walkIn(null, 0, 2);
check('닫힌 연결문 앞에서 멈춤 (본관 셸 안쪽)', stuck.z > -61.7 && stuck.lv === 2, JSON.stringify(stuck));
await S(() => window.__DEBUG.story.flags.set('hasConnectorKey', true));
await press('KeyE', 120);
check('hasConnectorKey → E → 연결문 열림 + 안내가 닫기로', await poll(() => window.__DEBUG.interior.connector.state.target === 1 && document.getElementById('interact').textContent.includes('연결문 닫기')));
const atAnnexDoor = await walkIn(null, 0, 16);
check('연 연결문 뒤 통로 끝에서 신관 쪽 문에 막혀 멈춤 (닫힘)', atAnnexDoor.z > -83.1 && atAnnexDoor.lv === 2 && (await S(() => window.__DEBUG.interior.connectorA.state.f)) === 0, JSON.stringify(atAnnexDoor));
check('신관 쪽 문 안내 (열쇠 없이)', await poll(() => document.getElementById('interact').textContent.includes('연결통로 문') || document.getElementById('interact').textContent.includes('문 열기')));
await press('KeyE', 120);
check('E → 신관 쪽 문 열림 (hasConnectorKey 와 무관, 잠김 없음)', await poll(() => window.__DEBUG.interior.connectorA.state.target === 1 && !window.__DEBUG.interior.connectorA.state.locked));
const cross = await walkIn(null, 0, 4);
check('연 문으로 통로를 지나 신관 3층 홀까지 (바닥 7.65, 층 그대로)', cross.z < -84 && cross.lv === 2 && near(cross.y, 7.65) && cross.inside, JSON.stringify(cross));
check('HUD 에 신관 3층 표시', await poll(() => document.getElementById('hud').textContent.includes('실내: 신관 3층')));
await walkIn([17.75, 1.6, -91.05], -90, 3.2, 2);
await walkIn(null, 0, 0.9);
const up4 = await walkIn(null, 90, 3.6);
check('신관 동쪽 계단으로 4층 (level 3, 바닥 11.25)', up4.lv === 3 && near(up4.y, 11.25), JSON.stringify(up4));
await walkIn([1.5, 1.6, -89.6], 90, 0, 3);
check('4층 책상 위 책 살펴보기 안내', await poll(() => document.getElementById('interact').textContent.includes('책상 위 책')));
await press('KeyE', 120);
check('E5 전이면 임시 문구만 (earlyBook 그대로)', await poll(() => document.getElementById('toast').textContent.includes('누군가의 책')) && !(await S(() => window.__DEBUG.story.flags.values.earlyBook)));
await walkIn([4.4, 1.6, -91], 0, 0, 4);
check('5층 내 책 교실(2-13) 문 안내', await poll(() => document.getElementById('interact').textContent.includes('2-13 문 열기')));
await press('KeyE', 120);
check('열쇠 교실은 잠김 (hasClassKey 없음)', await poll(() => document.getElementById('toast').textContent.includes('2-13 — 잠겨 있다')) && !(await S(() => window.__DEBUG.interior.doorsA.openIds.includes('A5F-2-2'))));
await walkIn([8, 1.6, -91.5], 0, 0.1, 1);
const yl = await S(() => ({ inside: window.__DEBUG.interior.atmo.inside, inRoom: window.__DEBUG.interior.atmo.yajaInRoom, open: window.__DEBUG.interior.doorsA.openIds }));
check('신관 2층: 야자 교실 빛이 교실 안으로, 뒷문은 열려 있음', yl.inside && yl.inRoom && yl.open.includes('A2F-3-2'), JSON.stringify(yl));
await S(() => window.__DEBUG.story.flags.set('hasConnectorKey', false));
await walkIn([0, 1.6, 12], 0, 0.5);
check('밖으로 나오면 실내 분위기 해제 시작', !(await S(() => window.__DEBUG.interior.atmo.inside)));
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
  for (let i = 0; i < 40; i++) { // R1-d 는 대화가 길다 (단계 18)
    const mode = await S(() => window.__DEBUG.story.mode);
    if (mode === 'action') await S(() => window.__DEBUG.story.resume()); // 추격·숨기(행동 줄)는 위 E2 점검에서 봤으므로 건너뜀
    else if (mode === 'line') await press('KeyE', 120);
    else break;
  }
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
    await toMingeonLine({ S, press }); // 첫 줄 = 시점 전환(행동 줄, 단계 19) → 태민 대사 줄까지 넘긴다
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
await enginesSmoke({ S, press, check, poll }); // 퍼즐 실행기·추격 엔진 (단계 0b-3·0b-4)
await mapSmoke({ S, check, poll, press }); // 단계 10: 위치 이름·보조배터리
await roofSmoke({ S, press, check, poll }); // 단계 21: 옥상 수영장·엔딩 D·크레딧
const info = await page.evaluate(() => ({ hud: document.getElementById('hud').textContent, pos: window.__DEBUG?.pos?.() }));
console.log(info);
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
if (fails.length) console.log(`스토리 검사 실패 ${fails.length}건: ${fails.join(', ')}`);
process.exit(errors.length || fails.length ? 1 : 0);
