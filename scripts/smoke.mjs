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
await press('KeyW', 4000);
await press('KeyD', 1500);
for (const k of ['KeyF', 'KeyF', 'KeyB', 'KeyG', 'KeyV', 'BracketRight', 'BracketLeft', 'KeyL', 'KeyL', 'KeyH', 'KeyM', 'KeyM', 'KeyE', 'KeyE', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Backquote', 'KeyP']) await press(k, 150);
await page.keyboard.down('ShiftLeft');
await press('KeyW', 3000);
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({ hud: document.getElementById('hud').textContent, pos: window.__DEBUG?.pos?.() }));
console.log(info);
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
process.exit(errors.length ? 1 : 0);
