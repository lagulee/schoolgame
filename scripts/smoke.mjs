// 상호작용 스모크 테스트: 클릭 → 키 입력(이동·토글·이벤트) → 스토리 엔진(디버그 키로 사건 진행) → 콘솔 에러 수집
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
await page.goto(`http://localhost:${PORT}/`);
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
for (const k of ['KeyF', 'KeyF', 'KeyB', 'KeyG', 'KeyV', 'BracketRight', 'BracketLeft', 'KeyL', 'KeyL', 'KeyH', 'KeyM', 'KeyM', 'KeyY', 'KeyY', 'KeyY', 'Digit1', 'Digit2', 'Digit3', 'Backquote', 'KeyP']) await press(k, 150);
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

// 스토리 엔진: N(다음 사건)으로 E1~ 을 차례로 불러 E(넘기기)·숫자키(선택)로 진행하고 플래그 변화를 확인한다
const fails = [];
const check = (name, pass, info = '') => { if (!pass) fails.push(name); console.log(`${pass ? '✅' : '❌'} ${name} ${info}`); };
const S = (fn, arg) => page.evaluate(fn, arg);
const lastBefore = await S(() => window.__DEBUG.director.last);
await press('KeyE', 120);
check('E 키는 더 이상 이상 현상을 발동하지 않음', (await S(() => window.__DEBUG.director.last)) === lastBefore);
const finishEvent = async () => {
  for (let i = 0; i < 12 && (await S(() => window.__DEBUG.story.mode)) === 'line'; i++) await press('KeyE', 120);
};
const played = [];
const flagsAfter = {};
for (let i = 0; i < 8; i++) {
  await press('KeyN', 120);
  const st = await S(() => ({ id: window.__DEBUG.story.event?.id, mode: window.__DEBUG.story.mode,
    vis: [...document.querySelectorAll('#story > div')].filter((d) => d.style.display !== 'none').map((d) => d.className) }));
  played.push(st.id);
  if (i === 0) check('N → E1 자막·문자 표시', st.id === 'E1' && st.vis.length === 1, JSON.stringify(st));
  if (i === 1) {
    await press('KeyN', 120);
    check('사건 도중 N 은 무시 (진행 중)', (await S(() => window.__DEBUG.story.event?.id)) === 'E2');
    check('E2 대화창 + 화자 이름', st.vis.includes('story-dlg') && (await page.textContent('.story-name')).length > 0);
  }
  await finishEvent();
  if (st.id === 'E5') {
    check('E5 선택지 표시', (await S(() => window.__DEBUG.story.mode)) === 'choice' && (await page.$$('.story-opt')).length === 2);
    const q = await S(() => document.getElementById('hud').textContent.match(/품질 (\w+)/)?.[1]);
    await press('Digit1', 120); // 숫자키 1 = 첫 항목(책을 챙긴다). 선택지가 떠 있으면 품질 단축키로 넘어가지 않는다
    check('숫자키 선택 → earlyBook = true, 루트 R1', await S(() => window.__DEBUG.story.flags.values.earlyBook && window.__DEBUG.story.route === 'R1'));
    check('선택 중 숫자키가 품질을 바꾸지 않음', (await S(() => document.getElementById('hud').textContent.match(/품질 (\w+)/)?.[1])) === q, q);
  }
  flagsAfter[st.id] = await S(() => ({ ...window.__DEBUG.story.flags.values }));
}
check('E1~E8 순서대로 발동, earlyBook 이면 E9 생략 후 엔딩', played.join() === 'E1,E2,E3,E4,E5,E6,E7,E8', played.join());
check('E4 후 hasConnectorKey = true', flagsAfter.E4?.hasConnectorKey === true);
await press('KeyN', 120);
check('R1 엔딩 표시', (await S(() => window.__DEBUG.story.mode)) === 'ending' && (await page.textContent('.story-name')).includes('R1'));
check('같은 사건 연속 발동 금지', await S(() => { const r = window.__DEBUG.story; r.close(); const ok = r.start('E3'); while (r.mode === 'line') r.advance(); return ok && !r.start('E3') && r.lastReason.includes('연속'); }));
await press('KeyK', 120);
check('K → 스토리 초기화', await S(() => !window.__DEBUG.story.flags.values.earlyBook && window.__DEBUG.story.registry.last === null));
// E12: W/S 선택지 이동, 선택 중 이동 정지, 시간 초과 기본값
await S(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); });
check('E12 선택지 + 제한 시간 막대', (await S(() => window.__DEBUG.story.mode)) === 'choice' && (await page.isVisible('.story-timer')));
const poll = (fn) => page.waitForFunction(fn, null, { timeout: 30000 }).then(() => true, () => false); // 프레임 반영을 기다린다 (SwiftShader 는 느림)
check('선택지 동안 이동 정지', await poll(() => window.__DEBUG.player.frozen));
await press('KeyS', 120);
await press('KeyE', 120);
check('S 로 항목 이동(기본값 남는다 → 따라간다, 순환) → E 결정', await poll(() => window.__DEBUG.story.mode === 'idle' && window.__DEBUG.story.flags.values.dutyCompanion && !window.__DEBUG.player.frozen));
await S(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); r.update(10.5); });
check('무응답 10초 → 기본값 남는다', await S(() => window.__DEBUG.story.mode === 'idle' && !window.__DEBUG.story.flags.values.dutyCompanion));
await S(() => window.__DEBUG.story.reset());
const info = await page.evaluate(() => ({ hud: document.getElementById('hud').textContent, pos: window.__DEBUG?.pos?.() }));
console.log(info);
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
if (fails.length) console.log(`스토리 검사 실패 ${fails.length}건: ${fails.join(', ')}`);
process.exit(errors.length || fails.length ? 1 : 0);
