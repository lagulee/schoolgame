// 시제품 렌더: vite dev 서버의 실제 게임에 귀신 모델을 넣고 장면별로 찍는다
import { chromium } from 'playwright';
const OUT = process.argv[2];
const PORT = 5199;
const shots = JSON.parse(process.argv[3]);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
for (const s of shots) {
  const q = new URLSearchParams({ shot: '1', pos: s.cam.join(','), yaw: s.yaw, pitch: s.pitch ?? 0, light: '1', q: 'high', lv: s.lv ?? 0 });
  await page.goto(`http://localhost:${PORT}/?${q}`);
  await page.waitForFunction(() => window.__READY === true, null, { timeout: 240000 });
  await page.evaluate(async (s) => {
    const { buildGhostModel } = await import('/src/scene/ghost/model.js');
    const D = window.__DEBUG;
    const g = buildGhostModel({ pose: s.pose || 'idle' });
    const c = D.camera;
    g.position.set(s.at[0], D.player.collision.floorHeight(s.at[0], s.at[2], s.lv ?? 0), s.at[2]);
    g.lookAt(c.position.x, g.position.y, c.position.z);
    D.scene.add(g);
    if (s.dim) D.scene.traverse((o) => { if (o.isSpotLight) { const i0 = o.intensity; o.__i = i0; Object.defineProperty(o, 'intensity', { get: () => i0 * s.dim, set: () => {} }); } });
    for (let i = 0; i < 3; i++) D.step(12, 0);
  }, s);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log(s.name);
}
console.log(errors.length ? errors.join('\n') : '에러 0');
await browser.close();
