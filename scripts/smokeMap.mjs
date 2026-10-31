// smoke 의 맵 항목 (단계 10): 걸어 다니면 핸드폰 위치 이름이 바뀌는지, 보조배터리가 제자리에 보이고 E 로 주워지는지, 서랍 속은 살펴보기.
// smoke.mjs 가 부른다 (같은 페이지·도우미). 이동은 player.update 를 직접 돌려 프레임과 무관하게.
export async function mapSmoke({ S, check, poll, press }) {
  const walk = await S(() => {
    const P = window.__DEBUG.player;
    P.setView([16.5, 1.6, -17], 180, 0, 0); // 구관 1층 동쪽 복도 → 남쪽(현관 홀)으로
    P.vel.set(0, 0);
    P.keys.clear();
    P.keys.add('KeyW');
    const seen = [];
    for (let i = 0; i < 180; i++) {
      P.update(1 / 60);
      const w = window.__DEBUG.where();
      if (seen[seen.length - 1] !== w) seen.push(w);
    }
    P.keys.clear();
    return seen;
  });
  check('걸으면 위치 이름이 바뀜: 동쪽 복도 → 현관 홀', walk.join() === '구관 1층 · 동쪽 복도,구관 1층 · 현관 홀', walk.join(' → '));
  await S(() => window.__DEBUG.phone.openScreen());
  check('핸드폰 화면 위치 = 지금 서 있는 곳', await poll(() => document.getElementById('phone').textContent.includes('구관 1층 · 현관 홀')));
  await S(() => window.__DEBUG.phone.closeScreen());
  const names = await S(() => {
    const P = window.__DEBUG.player;
    const at = (pos, lv) => { P.setView(pos, 0, 0, lv); return window.__DEBUG.phonePlace(); };
    return [at([22.25, 1.6, -47.75], 1), at([18.5, 1.6, -72], 2), at([11, 1.6, -92.9], 1), at([60, 1.6, -40], 0)];
  });
  check('위치 이름: 교무실·연결통로·신관 복도·운동장', names.join() === '구관 2층 · 교무실,연결통로 (3층),신관 2층 · 신관 복도,운동장', names.join(' / '));
  // 보조배터리: 보이는 것(바닥·사물함 위)만 물체가 있고, E1 이후 제자리에서 E 로 줍는다
  await S(() => { const r = window.__DEBUG.story; r.start('E1'); while (r.mode === 'line') r.advance(); window.__DEBUG.phone.s.battery = 40; window.__DEBUG.phone.setLight(false); });
  const vis = await S(() => [...window.__DEBUG.bankView.items].filter(([, v]) => v.m.visible).map(([id]) => id).join());
  check('보이는 보조배터리 물체 = PB1·PB2·PB4', vis === 'PB1,PB2,PB4', vis);
  await S(() => window.__DEBUG.player.setView([17.5, 1.6, -22.25], 90, -30, 0));
  const prompt = (t) => poll((t) => { const el = document.getElementById('interact'); return el.style.display !== 'none' && el.textContent.includes(t); }, t); // 다음 프레임의 안내 (이전 글자가 남아 있어도 숨김이면 아님)
  check('PB2 소화전 옆: 줍기 안내', await prompt('보조배터리'));
  await press('KeyE', 120);
  check('E → PB2 주움 (+15%), 물체 사라짐', await poll(() => window.__DEBUG.phone.picked.has('PB2') && !window.__DEBUG.bankView.items.get('PB2').m.visible && window.__DEBUG.phone.battery > 54));
  await S(() => window.__DEBUG.player.setView([22.25, 1.6, -47.75], 180, -20, 1));
  check('PB3 교무실: 서랍 살펴보기 안내 (물체 없음)', await prompt('서랍 살펴보기'));
  await press('KeyE', 120);
  check('E4 전에는 PB3 를 못 줍고 안내만', await poll(() => document.getElementById('toast').textContent.includes('E4')) && !(await S(() => window.__DEBUG.phone.picked.has('PB3'))));
  await S(() => window.__DEBUG.story.reset());
}
