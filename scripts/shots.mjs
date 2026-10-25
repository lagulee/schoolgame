// 7장 시각 검증: 빌드 결과를 preview 서버로 띄우고 headless Chromium 으로 6개 시점 촬영
// 사용: npm run build && npm run shots [-- --only=01 --q=high --suffix=_r1 --extra=inspect=1]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { SHOTS } from '../src/config.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || '1']));
const PORT = 4179;
const W = parseInt(args.w || '1280', 10);
const H = parseInt(args.h || '720', 10);
mkdirSync('screenshots', { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => {
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && res());
  setTimeout(res, 8000);
});

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

for (const s of SHOTS) {
  if (args.only && !s.name.startsWith(args.only)) continue;
  const q = new URLSearchParams({
    shot: '1', pos: s.pos.join(','), yaw: s.yaw, pitch: s.pitch, flash: s.flash ? '1' : '0', q: args.q || 'high',
  });
  if (args.extra) for (const kv of args.extra.split('&')) { const [k, v] = kv.split('='); q.set(k, v); }
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/?${q}`);
  await page.waitForFunction(() => window.__READY === true, null, { timeout: 240000 });
  const file = `screenshots/${s.name}${args.suffix || ''}.png`;
  await page.screenshot({ path: file });
  console.log(`${file}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
process.exit(0);
