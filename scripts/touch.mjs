// 터치 조작 테스트: 모바일 에뮬레이션(터치 이벤트)으로 조이스틱·시점 드래그·핸드폰 버튼·메뉴를 검증하고 화면을 저장한다.
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
  if (type === 'touchEnd') { if (!down.size) return; down.clear(); return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [] }); }
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
// 디버그 잠금: 잠긴 동안 유령 모드 무시 → '디버그 잠금 해제' 로 비밀번호 창 → 3141 → 유령·무한 스태미나
const mbtn = (text) => ({ tap: async () => { const c = await page.evaluate((t) => { const b = [...document.querySelectorAll('.mbtn')].find((x) => x.textContent.includes(t)); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, text); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(150); } });
await mbtn('유령 모드').tap();
check('터치: 잠금 중 유령 모드 무시', !(await dbg(() => window.__DEBUG.player.ghost)));
await mbtn('디버그 잠금 해제').tap();
check('터치: 잠금 해제 항목 → 비밀번호 창', await dbg(() => getComputedStyle(document.getElementById('gate')).display !== 'none'));
await page.fill('#gate input', '3141');
await page.locator('#gate button[type=submit]').tap();
check('터치: 3141 → 잠금 해제', await dbg(() => window.__DEBUG.gate.unlocked));
await mbtn('유령 모드').tap();
await mbtn('무한 스태미나').tap();
check('터치: 유령 모드·무한 스태미나 켜짐', await dbg(() => window.__DEBUG.player.ghost && window.__DEBUG.player.stamina.infinite));
await mbtn('유령 모드').tap();
await mbtn('무한 스태미나').tap();
await page.tap('.menu-toggle');
check('메뉴 닫힘', !(await dbg(() => document.querySelector('.menu-panel').classList.contains('open'))));

// 전체화면 버튼 (⤢/⤡): 항상 보이고, 지원 환경에서만 표시. headless 에서는 API 지원 여부만 확인한다
const fsInfo = await dbg(() => { const b = document.querySelector('.tbtn.fs'); return { has: !!b, shown: !!b && getComputedStyle(b).display !== 'none', sup: document.fullscreenEnabled, txt: b?.textContent }; });
check('전체화면 버튼 존재 (미지원이면 숨김)', fsInfo.has && fsInfo.shown === !!fsInfo.sup && ['⤢', '⤡'].includes(fsInfo.txt), JSON.stringify(fsInfo));
if (fsInfo.sup) {
  // headless 의 전체화면 전환은 불안정해(Document not active) 버튼 표시가 상태와 같은지만 본다 (실제 해제는 실기기 확인)
  const st = () => dbg(() => ({ fs: !!document.fullscreenElement, txt: document.querySelector('.tbtn.fs').textContent }));
  await page.tap('.tbtn.fs');
  await page.waitForTimeout(800);
  const s1 = await st();
  check('전체화면 버튼: 누르면 오류 없이 동작하고 표시(⤢/⤡)가 상태를 따름', s1.txt === (s1.fs ? '⤡' : '⤢'), JSON.stringify(s1));
}

// 핸드폰 버튼: 📱 화면 열기/닫기, 💡 라이트 (화면이 열려 있어도 동작)
const tphone = () => dbg(() => ({ open: window.__DEBUG.phone.screenOpen, light: window.__DEBUG.phone.lightOn, bat: window.__DEBUG.phone.battery,
  scr: document.querySelector('.tbtn.phone').classList.contains('on'), lamp: document.querySelector('.tbtn.light').classList.contains('on'),
  shown: document.getElementById('phone').style.display !== 'none' }));
check('손전등 🔦 버튼 없음', !(await page.$('.tbtn.flash')));
check('메뉴에 손전등 항목 없음', !labels.some((l) => l.includes('손전등')));
const tp0 = await tphone();
await page.tap('.tbtn.phone');
await page.waitForFunction(() => document.getElementById('phone').style.display !== 'none', null, { timeout: 30000 }).catch(() => {});
const tp1 = await tphone();
check('📱 → 화면 열림, −2%', tp1.open && tp1.scr && tp1.shown && Math.abs(tp0.bat - tp1.bat - 2) < 0.2, JSON.stringify([tp0, tp1]));
await page.tap('.tbtn.light');
const tp2 = await tphone();
check('화면이 열린 채 💡 → 라이트 토글', tp2.open && tp2.light !== tp1.light && tp2.lamp === tp2.light, JSON.stringify(tp2));
await page.screenshot({ path: 'screenshots/touch_phone.png' });
await page.tap('.tbtn.light');
await page.tap('.tbtn.phone');
const tp3 = await tphone();
check('📱 한 번 더 → 화면 닫힘', !tp3.open && !tp3.scr, JSON.stringify(tp3));

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
// 프레임이 느린 환경에서도 안정적이도록 고정 대기 대신 이동량을 폴링한다
await page.waitForFunction((z0) => window.__DEBUG.pos()[2] < z0 - 0.3, p0[2], { timeout: 40000 }).catch(() => {});
const st = await dbg(() => ({ run: window.__DEBUG.player.running, an: window.__DEBUG.player.analog, pos: window.__DEBUG.pos() }));
check('반쯤 밀면 걷기 (달리기 아님)', st.an && !st.run, JSON.stringify(st.an));
check('조이스틱 위로 → 북쪽(−z)으로 이동', st.pos[2] < p0[2] - 0.2, `(z ${p0[2]} → ${st.pos[2]})`);

// 끝까지 밀기 → 달리기
await touch('touchMove', 2, c.x, c.y - c.R * 1.4);
await page.waitForTimeout(2500);
const rs = await dbg(() => ({ run: window.__DEBUG.player.running, tr: window.__DEBUG.player.touchRun, an: window.__DEBUG.player.analog, sp: window.__DEBUG.player.speed }));
check('끝까지 밀면 달리기', rs.run, JSON.stringify(rs));
await page.screenshot({ path: 'screenshots/touch_running.png' });
check('달리는 동안 조이스틱 달리기 표시', await dbg(() => document.querySelector('.joy-base').classList.contains('run')));
// 탈진: 끝까지 밀고 있어도 달리지 못하고 조이스틱이 붉게, 스태미나 막대 표시
await dbg(() => { const s = window.__DEBUG.player.stamina; s.value = 0; s.exhausted = true; s.sinceRun = 0; });
await page.waitForFunction(() => document.querySelector('.joy-base').classList.contains('tired'), null, { timeout: 30000 }).catch(() => {});
const ts = await dbg(() => ({ run: window.__DEBUG.player.running, want: window.__DEBUG.player.wantRun, ex: window.__DEBUG.player.stamina.exhausted,
  tired: document.querySelector('.joy-base').classList.contains('tired'), runCls: document.querySelector('.joy-base').classList.contains('run'),
  bar: document.getElementById('stamina').classList.contains('show') && document.getElementById('stamina').classList.contains('low') }));
check('탈진 중 끝까지 밀어도 달리기 안 됨 + 조이스틱 붉게 + 막대 붉게', ts.want && !ts.run && ts.ex && ts.tired && !ts.runCls && ts.bar, JSON.stringify(ts));
await page.screenshot({ path: 'screenshots/touch_exhausted.png' });
await dbg(() => window.__DEBUG.player.stamina.reset());
await touch('touchEnd', 2);
await page.waitForTimeout(500);
check('손을 떼면 입력 해제', (await dbg(() => window.__DEBUG.player.analog)) === null);

// 이동 + 시점 동시 (멀티터치)
await touch('touchStart', 2, c.x, c.y);
await touch('touchMove', 2, c.x, c.y - c.R * 0.6);
const yaw2 = await dbg(() => window.__DEBUG.player.camera.rotation.y);
await touch('touchStart', 3, 600, 140);
await touch('touchMove', 3, 680, 140);
// SwiftShader 는 메인 스레드가 오래 막혀 이벤트 처리가 늦을 수 있어, 고정 대기 대신 조건을 폴링한다
await page.waitForFunction((y0) => Math.abs(window.__DEBUG.player.camera.rotation.y - y0) > 0.2, yaw2, { timeout: 30000 }).catch(() => {});
const both = await dbg(() => ({ an: window.__DEBUG.player.analog, yaw: window.__DEBUG.player.camera.rotation.y }));
check('멀티터치: 이동 중에도 시점 회전', both.an && Math.abs(both.yaw - yaw2) > 0.2, JSON.stringify({ ...both, yaw2 }));
await touch('touchEnd');

// 조이스틱을 누른 채 다른 손가락으로 📱·💡·메뉴 버튼 (pointerdown 처리라 click 이 안 만들어져도 눌림)
const btnPos = await page.$$eval('.tbtn.phone, .tbtn.light, .tbtn.menu-toggle', (bs) => Object.fromEntries(bs.map((b) => { const r = b.getBoundingClientRect(); return [b.className.split(' ')[1], { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; })));
await touch('touchStart', 2, c.x, c.y);
await touch('touchMove', 2, c.x, c.y - c.R * 0.6);
const holding = await dbg(() => !!window.__DEBUG.player.analog);
const lit0 = await dbg(() => window.__DEBUG.phone.lightOn);
await touch('touchStart', 5, btnPos.light.x, btnPos.light.y);
await touch('touchEnd', 5);
down.set(2, { x: c.x, y: c.y - c.R * 0.6, id: 2 });
await page.waitForTimeout(300);
check('조이스틱을 누른 채 💡 → 라이트 토글', holding && (await dbg(() => window.__DEBUG.phone.lightOn)) !== lit0);
await touch('touchStart', 2, c.x, c.y);
await touch('touchStart', 6, btnPos.phone.x, btnPos.phone.y);
await touch('touchEnd', 6);
await page.waitForTimeout(300);
check('조이스틱을 누른 채 📱 → 화면 열림', await dbg(() => window.__DEBUG.phone.screenOpen));
await dbg(() => { window.__DEBUG.phone.closeScreen(); window.__DEBUG.phone.setLight(false); });
await touch('touchEnd');

// 본관 실내 (단계 8): 1층 1-1 교실 문 앞 → 안내 버튼(✋) 탭 → 문 열림·안내가 닫기로 바뀜 → 다시 탭하면 닫힘
await dbg(() => window.__DEBUG.player.setView([-8.3, 1.6, -52], 0, 0, 0));
await page.waitForFunction(() => document.getElementById('interact').textContent.includes('1-1 문 열기'), null, { timeout: 30000 }).catch(() => {});
const dp = await dbg(() => document.getElementById('interact').textContent);
check('실내 문 안내가 터치 버튼(✋)으로', dp.startsWith('✋') && dp.includes('1-1 문 열기'), JSON.stringify(dp));
await page.tap('#interact');
await page.waitForFunction(() => document.getElementById('interact').textContent.includes('1-1 문 닫기'), null, { timeout: 30000 }).catch(() => {});
check('탭 → 1-1 문 열림 + 안내 닫기', await dbg(() => window.__DEBUG.interior.doors.openIds.includes('1F-1-1') && document.getElementById('interact').textContent.includes('닫기')));
await page.screenshot({ path: 'screenshots/touch_door.png' });
await page.tap('#interact');
await page.waitForFunction(() => !window.__DEBUG.interior.doors.openIds.includes('1F-1-1'), null, { timeout: 30000 }).catch(() => {});
check('한 번 더 탭 → 문 닫힘', !(await dbg(() => window.__DEBUG.interior.doors.openIds.includes('1F-1-1'))));
await dbg(() => window.__DEBUG.player.setView([0, 1.6, 12], 0, 0, 0));

// 스토리: 메뉴의 '다음 사건' → 대화창 탭으로 넘기기 → 선택지 버튼 탭으로 플래그 변경
await page.tap('.menu-toggle');
await page.locator('.mbtn', { hasText: '다음 사건' }).tap();
await page.tap('.menu-toggle');
check('메뉴 → 다음 사건(E1)', await dbg(() => window.__DEBUG.story.event?.id === 'E1'));
await dbg(() => { const r = window.__DEBUG.story; r.jump('E2'); });
const idx0 = await dbg(() => window.__DEBUG.story.lineIdx);
for (let i = 0; i < 4 && (await dbg(() => window.__DEBUG.story.lineIdx)) === idx0; i++) { await page.tap('.story-dlg'); await page.waitForTimeout(150); }
check('대화창 탭으로 다음 줄', (await dbg(() => window.__DEBUG.story.lineIdx)) > idx0);
await dbg(() => { const r = window.__DEBUG.story; r.jump('E12'); while (r.mode === 'line') r.advance(); });
check('선택지 버튼 2개 표시', (await page.$$('.story-opt')).length === 2);
await page.screenshot({ path: 'screenshots/touch_story_choice.png' });
await page.locator('.story-opt', { hasText: '따라간다' }).tap();
check('선택지 탭 → dutyCompanion = true, 루트 R2', await dbg(() => window.__DEBUG.story.flags.values.dutyCompanion && window.__DEBUG.story.route === 'R2'));
await dbg(() => window.__DEBUG.story.reset());

console.log(errors.length ? `콘솔 에러 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
server.kill();
process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
