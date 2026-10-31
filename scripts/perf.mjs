// 성능 점검 (단계 10): 품질 Low/Mid/High 마다 가정 기기 해상도·픽셀비(config PERF.devices)로 띄우고, 주요 시점(PERF.views = SHOTS 이름)에서
// 실제 렌더 루프의 프레임 간격(requestAnimationFrame)과 드로우콜·삼각형을 잰다.
// 사용: npm run build && npm run perf  → 마크다운 표. headless Chromium 은 GPU 없이 SwiftShader(CPU)로 그리므로 프레임 시간은
// 실제 기기보다 수십 배 느리다 → 절댓값이 아니라 품질·시점 사이의 비율과 드로우콜·삼각형(기기와 무관)을 본다.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { SHOTS, PERF, QUALITY } from '../src/config.js';

const PORT = 4181;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && res()); setTimeout(res, 8000); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const rows = [];
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

for (const [q, dev] of Object.entries(PERF.devices)) {
  const page = await browser.newPage({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?light=1`);
  await page.waitForFunction(() => document.getElementById('loading').textContent === '', null, { timeout: 180000 });
  await page.click('#overlay');
  await page.evaluate((name) => window.__DEBUG.applyQuality(name), q);
  for (const name of PERF.views) {
    const s = SHOTS.find((t) => t.name === name);
    const r = await page.evaluate(async ({ s, warmup, frames }) => {
      const D = window.__DEBUG;
      D.player.setView(s.pos, s.yaw, s.pitch, s.lv ?? 0);
      if (s.open?.includes('connector')) D.interior.connector.set(true);
      const ts = [];
      const info = [];
      await new Promise((res) => {
        const f = (t) => {
          ts.push(t);
          info.push([D.renderer.info.render.calls, D.renderer.info.render.triangles]);
          if (ts.length < warmup + frames + 1) requestAnimationFrame(f);
          else res();
        };
        requestAnimationFrame(f);
      });
      const dt = ts.slice(warmup + 1).map((t, i) => t - ts[warmup + i]);
      const [calls, tris] = info[info.length - 1];
      const px = D.renderer.domElement.width * D.renderer.domElement.height;
      return { dt, calls, tris, px };
    }, { s, warmup: PERF.warmup, frames: PERF.frames });
    rows.push({ q, name, ms: med(r.dt), calls: r.calls, tris: r.tris, px: r.px });
    console.error(`${q} ${name} ${med(r.dt).toFixed(0)} ms  calls ${r.calls}`);
  }
  await page.close();
}

console.log(`| 품질 | 가정 기기 (CSS px × 픽셀비 → 그리는 px) | 시점 | 프레임 중앙값 (ms, SwiftShader) | 드로우콜 | 삼각형 (k) |`);
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  const d = PERF.devices[r.q];
  const pr = Math.min(d.dpr, QUALITY[r.q].pixelRatio);
  console.log(`| ${r.q} | ${d.w}×${d.h} × ${pr} → ${(r.px / 1e6).toFixed(2)} Mpx | ${r.name} | ${r.ms.toFixed(0)} | ${r.calls} | ${(r.tris / 1000).toFixed(0)} |`);
}
for (const q of Object.keys(PERF.devices)) {
  const a = rows.filter((r) => r.q === q);
  console.log(`\n${q}: 프레임 중앙값 평균 ${(a.reduce((s, r) => s + r.ms, 0) / a.length).toFixed(0)} ms, 최대 ${Math.max(...a.map((r) => r.ms)).toFixed(0)} ms, 드로우콜 최대 ${Math.max(...a.map((r) => r.calls))}`);
}
console.log(errors.length ? `\n페이지 에러 ${errors.length}건:\n${errors.join('\n')}` : '\n페이지 에러 0');
await browser.close();
server.kill();
process.exit(0);
