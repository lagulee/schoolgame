// smoke 의 E7~E9 항목 (단계 14): 야자 교실 E7(정전 → 배전반 → 점프스케어 #1) → E8 P3(가방 → 틀린 교실 연기·끌려 나옴 → 3-10) → E9 4층 책.
// smoke.mjs 가 E6 점검 바로 뒤에 부른다 (같은 페이지·도우미). headless 는 느려 걷지 않고 자리를 옮긴다.
import { POINTS } from '../test/mapWorld.mjs';

const DESK4 = POINTS.desk4; // 신관 4층 2-10 {dohyeon} 책상 앞 [x, z, 층]

export async function e7e9Smoke({ S, check, poll, press }) {
  // headless 는 프레임이 느려 자막을 기다리면 오래 걸린다 → 대사·자막을 직접 넘기고 사건이 끝나기를 기다린다
  const busyDone = async (id) => {
    for (let i = 0; i < 100; i++) {
      const done = await S((e) => { const r = window.__DEBUG.story; if (r.registry.done.has(e)) return true; if (r.registry.active === e && r.mode === 'line') { r.advance(); r.advance(); } return false; }, id);
      if (done) break;
      await new Promise((res) => setTimeout(res, 150)); // 행동 줄(점프스케어 등)은 프레임이 넘긴다
    }
    return poll((e) => window.__DEBUG.story.registry.done.has(e), id);
  };
  // 행동 줄 kind 에 닿을 때까지 대사를 넘긴다 (사이의 행동 줄은 프레임이 넘겨 주도록 잠깐씩 기다림)
  const advanceTo = async (kind) => {
    for (let i = 0; i < 80 && (await S(() => window.__DEBUG.story.action?.do)) !== kind; i++) {
      await S(() => window.__DEBUG.story.advance());
      await new Promise((res) => setTimeout(res, 120));
    }
  };
  // E7~E9 (단계 14): 야자 교실 E7(정전 → 배전반 → 점프스케어 #1) → E8 P3(가방 → 틀린 교실 연기·끌려 나옴 → 3-10) → E9 4층 책
  await S(() => window.__DEBUG.player.setView([10.5, 1.6, -87], 0, 0, 1));
  check('신관 2층 야자 교실 → E7', await poll(() => window.__DEBUG.story.event?.id === 'E7'));
  await advanceTo('reach');
  check('정전: 형광등 꺼짐(야자 빛 0), 신관 노출 낮아짐 (깜빡임 없음)', await poll(() => { const D = window.__DEBUG; return D.scenes.steps.powerOut && D.world.ctx.lights.yaja.intensity === 0 && D.renderer.toneMappingExposure < 0.5; }), await S(() => window.__DEBUG.renderer.toneMappingExposure.toFixed(2)));
  await S(() => window.__DEBUG.player.setView([-9, 1.6, -91.6], 180, 0, 1));
  check('배전반 앞 → 점프스케어 #1 실루엣', await poll(() => window.__DEBUG.story.action?.do === 'scare' && window.__DEBUG.scenes.stepsView.scareMesh.visible));
  await S(() => { const sc = window.__DEBUG.scenes.steps.scare; if (sc) sc.t = 99; }); // 점프스케어 2초는 건너뛴다
  check('점프스케어 끝 → E7 끝 → 신관 2층 복도에서 E8', (await busyDone('E7')) && (await poll(() => window.__DEBUG.story.event?.id === 'E8')));
  await advanceTo('puzzle');
  await S(() => window.__DEBUG.player.setView([-9.4, 1.6, -89.6], 180, 0, 1));
  check('3-5 교실 가방 살펴보기', await poll(() => document.getElementById('interact').textContent.includes('가방')));
  await press('KeyF', 120);
  check('가방 E → 단서(소지품), 젖은 발자국 보임', await poll(() => window.__DEBUG.puzzle.puzzle?.got.includes('belongings') && window.__DEBUG.scenes.p3View.prints.visible));
  await S(() => window.__DEBUG.player.setView([1.5, 1.6, -87], 0, 0, 1));
  check('틀린 교실(3-6) → 검은 연기', await poll(() => window.__DEBUG.scenes.p3.pull && window.__DEBUG.scenes.p3View.smoke.visible));
  // 끌려 나오기(1.6초)는 headless 프레임이 느리면 30초 안에 안 끝날 수 있다: 남은 시간만 없앤다 (끌어내기·틀림 처리는 그대로)
  check('끌려 나옴 → 복도, 틀림 1', await poll(() => { const D = window.__DEBUG; const pl = D.scenes.p3.pull; if (pl) pl.t = 99; return D.puzzle.puzzle?.wrong === 1 && D.where().includes('복도'); }), await S(() => window.__DEBUG.where()));
  await S(() => window.__DEBUG.player.setView([10.5, 1.6, -87], 0, 0, 2));
  check('3층 3-10 → P3 성공', await poll(() => window.__DEBUG.puzzle.last?.outcome === 'solved'));
  check('E8 끝 ({gyuha}·{mingeon} 만남), 목표 = 4층 책', (await busyDone('E8')) && (await S(() => window.__DEBUG.story.objective().includes('4층'))));
  await S(() => window.__DEBUG.player.setView([10, 1.6, -91.9], 0, 0, 2));
  check('3층 복도 → E9', await poll(() => window.__DEBUG.story.event?.id === 'E9'));
  await advanceTo('take');
  await S((p) => window.__DEBUG.player.setView([p[0], 1.6, p[1]], 180, -30, p[2]), DESK4);
  check('4층 2-10 책상 위 책 살펴보기', await poll(() => document.getElementById('interact').textContent.includes('책')));
  await press('KeyF', 120);
  check('E9 책 → 끝, 목표 = 구관으로', (await busyDone('E9')) && (await S(() => window.__DEBUG.story.objective().includes('구관'))));
}
