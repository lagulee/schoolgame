// 상호작용 스모크 테스트: 클릭 → 키 입력(이동·토글·이벤트) → 콘솔 에러 수집
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
for (const k of ['KeyF', 'KeyF', 'KeyB', 'KeyG', 'KeyV', 'BracketRight', 'BracketLeft', 'KeyL', 'KeyL', 'KeyH', 'KeyM', 'KeyM', 'KeyE', 'KeyE', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Backquote', 'KeyP']) await press(k, 150);
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
const info = await page.evaluate(() => ({ hud: document.getElementById('hud').textContent, pos: window.__DEBUG?.pos?.() }));
console.log(info);
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
process.exit(errors.length ? 1 : 0);
