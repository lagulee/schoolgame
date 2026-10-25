// 터치 조작 테스트: 모바일 에뮬레이션(터치 이벤트)으로 조이스틱·시점 드래그·버튼·메뉴를 검증하고 화면을 저장한다.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4182;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && res()); setTimeout(res, 8000); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const ok = [];
const check = (name, pass, info = '') => { ok.push(pass); console.log(`${pass ? '✅' : '❌'} ${name} ${info}`); };

// CDP 는 touchStart/Move 마다 '현재 눌린 모든 점'을 받고, touchEnd 는 전부 뗀다
const down = new Map();
const touch = (type, id, x, y) => {
  if (type === 'touchEnd') { down.clear(); return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [] }); }
  down.set(id, { x, y, id });
  return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...down.values()] });
};
const dbg = (fn) => page.evaluate(fn);

// 자동 감지 (쿼리 없이 isMobile 에뮬레이션만으로 터치 모드가 켜지는지)
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => document.getElementById('loading').textContent === '', null, { timeout: 120000 });
check('터치 기기 자동 감지', await dbg(() => document.body.classList.contains('touch')));
check('시작 문구 터치용', (await page.textContent('#overlay .start')).includes('터치'));
await page.touchscreen.tap(400, 180);
await page.waitForTimeout(500);
check('탭으로 시작 (오버레이 숨김)', await dbg(() => document.getElementById('overlay').classList.contains('hidden')));

// 메뉴: 열기 → 품질 Low 로 낮춰 SwiftShader 에서도 빠르게
await page.tap('.menu-toggle');
check('메뉴 열림', await dbg(() => document.querySelector('.menu-panel').classList.contains('open')));
const labels = await page.$$eval('.mbtn', (b) => b.map((x) => x.textContent));
console.log('메뉴 항목:', labels.join(' | '));
for (let i = 0; i < 3; i++) {
  const txt = await page.$eval('.mbtn:nth-child(3)', (b) => b.textContent);
  if (txt.includes('Low')) break;
  await page.tap('.mbtn:nth-child(3)');
}
check('품질 버튼 순환 → Low', (await page.$eval('.mbtn:nth-child(3)', (b) => b.textContent)).includes('Low'));
await page.screenshot({ path: 'screenshots/touch_menu.png' });
await page.tap('.menu-toggle');
check('메뉴 닫힘', !(await dbg(() => document.querySelector('.menu-panel').classList.contains('open'))));

// 손전등 버튼
const flashOn0 = await dbg(() => document.querySelector('.tbtn.flash').classList.contains('on'));
await page.tap('.tbtn.flash');
const flashOn1 = await dbg(() => document.querySelector('.tbtn.flash').classList.contains('on'));
check('손전등 버튼 토글', flashOn0 !== flashOn1, `(${flashOn0} → ${flashOn1})`);

// 시점 드래그: 오른쪽 영역에서 오른쪽으로 120px → yaw 감소(우회전)
const yaw0 = await dbg(() => window.__DEBUG.player.camera.rotation.y);
await touch('touchStart', 1, 500, 150);
for (let i = 1; i <= 6; i++) { await touch('touchMove', 1, 500 + i * 20, 150 + i * 5); await page.waitForTimeout(60); }
await touch('touchEnd', 1);
const yaw1 = await dbg(() => window.__DEBUG.player.camera.rotation.y);
check('드래그로 시점 회전', Math.abs(yaw1 - yaw0) > 0.3, `(Δyaw ${(yaw1 - yaw0).toFixed(2)} rad, 기대 ≈ -0.54)`);
const pitch1 = await dbg(() => window.__DEBUG.player.camera.rotation.x);
check('세로 드래그가 피치에 반영', Math.abs(pitch1) > 0.05, `(pitch ${pitch1.toFixed(2)})`);

// 조이스틱: 중심 위로 50px (≈0.7) → 걷기, 앞으로 이동
const c = await page.$eval('.joy-base', (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; });
console.log('조이스틱 중심/반지름', c);
await dbg(() => window.__DEBUG.player.setView([0, 1.6, 12], 0, 0));
const p0 = await dbg(() => window.__DEBUG.pos());
await touch('touchStart', 2, c.x, c.y);
await touch('touchMove', 2, c.x, c.y - c.R * 0.7);
await page.waitForTimeout(5000);
const st = await dbg(() => ({ run: window.__DEBUG.player.running, an: window.__DEBUG.player.analog, pos: window.__DEBUG.pos() }));
check('반쯤 밀면 걷기 (달리기 아님)', st.an && !st.run, JSON.stringify(st.an));
check('조이스틱 위로 → 북쪽(−z)으로 이동', st.pos[2] < p0[2] - 0.2, `(z ${p0[2]} → ${st.pos[2]})`);

// 끝까지 밀기 → 달리기
await touch('touchMove', 2, c.x, c.y - c.R * 1.4);
await page.waitForTimeout(2500);
const rs = await dbg(() => ({ run: window.__DEBUG.player.running, tr: window.__DEBUG.player.touchRun, an: window.__DEBUG.player.analog, sp: window.__DEBUG.player.speed }));
check('끝까지 밀면 달리기', rs.run, JSON.stringify(rs));
await page.screenshot({ path: 'screenshots/touch_running.png' });
await touch('touchEnd', 2);
await page.waitForTimeout(500);
check('손을 떼면 입력 해제', (await dbg(() => window.__DEBUG.player.analog)) === null);

// 이동 + 시점 동시 (멀티터치)
await touch('touchStart', 2, c.x, c.y);
await touch('touchMove', 2, c.x, c.y - c.R * 0.6);
const yaw2 = await dbg(() => window.__DEBUG.player.camera.rotation.y);
await touch('touchStart', 3, 600, 140);
await touch('touchMove', 3, 680, 140);
await page.waitForTimeout(1200); // SwiftShader 는 프레임이 느려 여유를 둔다
const both = await dbg(() => ({ an: window.__DEBUG.player.analog, yaw: window.__DEBUG.player.camera.rotation.y }));
check('멀티터치: 이동 중에도 시점 회전', both.an && Math.abs(both.yaw - yaw2) > 0.2, JSON.stringify({ ...both, yaw2 }));
await touch('touchEnd');

console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
