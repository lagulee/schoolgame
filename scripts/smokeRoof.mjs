// smoke 의 단계 21 점검 (옥상 수영장·엔딩 D·크레딧): 5층 옥상 문 잠김 → 옥상 열쇠 + 구관 4층 이후 → 암전 → 옥상(엔딩 D 기록·사건 정지·위치 이름)
// → 데크 위 걷기(난간·수영장 충돌) → 간판 3개 읽기 → 엔딩 D 카드 → E 닫기 → 계단탑 문 = 카드 다시. 끝나면 학교 앞으로 돌려 놓는다.
export async function roofSmoke({ S, press, check, poll }) {
  await S(() => {
    const D = window.__DEBUG;
    D.story.reset();
    D.player.setView([-18.75, 1.6, -49.0], 0, 0, 4); // 구관 5층 북서쪽 계단 맨 위, 옥상 문 앞
  });
  check('5층 옥상 문 안내 (E 옥상 문 열기)', await poll(() => document.getElementById('interact').textContent.includes('옥상 문')));
  await press('KeyE', 100);
  check('옥상 열쇠 없음 → 잠김', await poll(() => window.__DEBUG.scenes.roof.log.at(-1) === 'locked' && document.getElementById('toast').textContent.includes('잠겨')));
  await S(() => window.__DEBUG.story.flags.set('hasRoofKey', true));
  await press('KeyE', 100);
  check('옥상 열쇠만 있고 구관 4층 전 → 아직 (early)', await poll(() => window.__DEBUG.scenes.roof.log.at(-1) === 'early'));
  check('핸드폰 목표 아래 옥상 열쇠 안내', await S(() => { const D = window.__DEBUG; D.phone.openScreen(); return D.scenes.roof.keyNote().includes('옥상 열쇠'); }));
  await poll(() => document.querySelector('#phone .ph-note')?.textContent.includes('옥상 열쇠'));
  await S(() => { window.__DEBUG.phone.closeScreen(); window.__DEBUG.story.registry.done.add('E11'); });
  await press('KeyE', 100);
  check('E11 뒤 → 문이 열리고 조작 정지 + 검은 막', await poll(() => window.__DEBUG.scenes.roof.frozen && window.__DEBUG.player.frozen && +document.getElementById('veil').style.opacity > 0.2));
  // headless 는 프레임이 느려 암전(3.8초)을 건너뛴다: 단계마다 남은 시간을 없앤다 (단계 순서·자리 옮기기는 그대로)
  check('암전 뒤 옥상(층 5)·엔딩 D 기록·사건 정지', await poll(() => { const D = window.__DEBUG; const r = D.scenes.roof; if (r.phase !== 'free' && r.phase !== 'idle') r.t = 99; return D.player.level === 5 && r.phase === 'free' && r.endings.has('D') && r.paused; }));
  check('옥상 묶음 보임·검은 막 걷힘·위치 이름·목표', await poll(() => { const D = window.__DEBUG; return D.scenes.roofBuild.group.visible && +(document.getElementById('veil').style.opacity || 0) < 0.05 && D.where() === '구관 옥상 수영장' && D.story.objectiveKey() === 'roofPool'; }));
  await S(() => window.__DEBUG.player.setView([10.5, 1.6, -44], -90, 0, 5)); // 동쪽 난간 앞에서 동쪽으로
  await press('KeyW', 1200);
  check('데크 난간 밖으로 못 나간다', await S(() => { const p = window.__DEBUG.player.pos; return window.__DEBUG.player.level === 5 && p.x < 12 && Math.abs(window.__DEBUG.player.floorY - 18.9) < 0.05; }));
  await S(() => window.__DEBUG.player.setView([-2, 1.6, -50.6], 0, 0, 5));
  await press('KeyW', 1200);
  check('수영장 물에 못 들어간다', await S(() => window.__DEBUG.player.pos.z > -51.8 + 0.2));
  // 간판 3개: 입간판 앞 → 네온 건너편 → 수영장 가 (시선은 간판 쪽)
  const spots = [[[-16.2, 1.6, -47.6], -90], [[-2, 1.6, -49], 0], [[-2, 1.6, -50.6], 0]];
  for (const [i, [pos, yaw]] of spots.entries()) {
    await S(([p, y]) => window.__DEBUG.player.setView(p, y, -10, 5), [pos, yaw]);
    await poll((n) => window.__DEBUG.scenes.roof.done.size >= n, i + 1);
  }
  check('간판 3개 읽음 (입간판·네온·바닥 타일)', await poll(() => window.__DEBUG.scenes.roof.done.size === 3));
  check('엔딩 D 카드 (제목만, 처음부터 다시)', await poll(() => { const r = window.__DEBUG.scenes.roof; if (r.cardT > 0) r.cardT = 0; return true; }) && await poll(() => window.__DEBUG.story.mode === 'ending' && document.querySelector('#story').textContent.includes('엔딩 D') && getComputedStyle(document.querySelector('#story .story-restart')).display !== 'none'));
  await press('KeyE', 100);
  check('E → 카드 닫고 옥상 둘러보기', await poll(() => window.__DEBUG.story.mode !== 'ending' && window.__DEBUG.player.level === 5));
  await S(() => window.__DEBUG.player.setView([-17.2, 1.6, -48.25], 90, 0, 5));
  check('계단탑 문 안내', await poll(() => document.getElementById('interact').textContent.includes('계단 문')));
  await press('KeyE', 100);
  check('계단탑 문 → 엔딩 D 카드 다시 (내려가지 않음)', await poll(() => window.__DEBUG.story.mode === 'ending' && window.__DEBUG.player.level === 5));
  await press('KeyE', 100);
  await S(() => { const D = window.__DEBUG; D.scenes.roof.stop(); D.story.reset(); D.player.setView([0, 1.6, 12], 0, 0, 0); });
  check('학교 앞으로 돌아오면 옥상 숨김·안개 원래대로', await poll(() => !window.__DEBUG.scenes.roofBuild.group.visible && window.__DEBUG.scenes.roofView.fogK === 1));
}
