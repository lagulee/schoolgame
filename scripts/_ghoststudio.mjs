import { chromium } from 'playwright';
const [OUT, ...views] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
p.on('pageerror', (e) => console.log('ERR', String(e)));
for (const v of views) {
  const [name, qs] = v.split('|');
  await p.goto(`http://localhost:5199/ghost-proto.html?${qs}`);
  await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
await b.close();
