// 추격 엔진 조립 (단계 0b-3): 세션 + 디버그 시작 키 + HUD 줄. 귀신 모델·연출·정식 추격 UI 는 아직 없다 (단계 2a·4b·6b 이후).
// 사건과의 연결(사건의 chase 를 언제 시작할지)은 맵이 생긴 뒤 각 사건 단계에서 start(id, { atExit }) 로 붙인다.
import chaseData from '../../data/chases.json';
import { CHASE, PLAYER } from '../config.js';
import { ChaseSession } from './session.js';
import { retryBonus } from './chase.js';
import { chaseVariants } from './variants.js';

const FINALE_NAME = { escape: '탈출', playerCaught: '입구 직전 붙잡힘', collapse: '문 앞에서 쓰러짐' };

export function setupChase({ story, player, toast }) {
  const runner = story.runner;
  const session = new ChaseSession({
    runner,
    chases: chaseData.chases,
    cfg: CHASE,
    getSpeed: () => player.speed,
    stamina: player.stamina,
    pose: {
      get: () => ({ pos: [player.pos.x, PLAYER.eye, player.pos.z], level: player.level, yaw: player.camera.rotation.y, pitch: player.camera.rotation.x }),
      set: (p) => {
        player.setView(p.pos, (p.yaw * 180) / Math.PI, (p.pitch * 180) / Math.PI, p.level ?? 0); // 층이 없는 예전 저장은 1층
        player.vel.set(0, 0); // 다시 시작할 때는 멈춘 채로
      },
    },
  });
  const variants = chaseVariants(runner.story.events);
  let next = 0;
  session.onResult = (r) => {
    if (r.outcome === 'caught') toast(`잡힘 — 추격 시작 지점에서 다시 (시도 ${r.attempt + 2}, 시작 거리 +${retryBonus(r.attempt + 1, CHASE)} m)`);
    else toast(`추격 ${r.id} ${r.outcome === 'trigger' ? '트리거 지점 도착' : '도착'} (거리 ${r.arrivalGap.toFixed(1)} m)${r.finale ? ` → ${FINALE_NAME[r.finale]}` : ''}`);
  };

  return {
    session,
    // 디버그(C 키·터치 메뉴): 진행 중이면 멈추고, 아니면 목록의 다음 추격을 시작한다
    debugToggle() {
      if (session.active) {
        session.stop();
        toast('추격 중지');
        return;
      }
      const v = variants[next];
      next = (next + 1) % variants.length;
      session.start(v.id, { atExit: v.atExit });
      toast(`추격 시작: ${v.label}`);
    },
    update(dt) {
      session.update(dt);
      if (session.locked) player.frozen = true; // 출구 여는 1초는 조작 불가 (story.update 가 매 프레임 frozen 을 정한 뒤에 덮어쓴다)
    },
    hudLine: () => session.hudLine(),
    reset: () => session.stop(),
  };
}
