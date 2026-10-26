// 스토리 엔진 조립: 데이터(data/*.json) + 진행기 + 화면 + 상호작용 키를 묶어 main.js 에 넘긴다.
import story from '../../data/story.json';
import characters from '../../data/characters.json';
import { STORY } from '../config.js';
import { StoryRunner } from './runner.js';
import { StoryUI, storyKey } from './ui.js';
import { Interactions } from './interact.js';
import { FLAG_NAMES } from './flags.js';
import { EndingsSeen } from './endingsSeen.js';

export function setupStory({ player, touch, toast }) {
  const ui = new StoryUI({ typeSpeed: STORY.typeSpeed, timerWarn: STORY.timerWarn, touch });
  const runner = new StoryRunner({ story, characters, ui, timing: STORY });
  const interactions = new Interactions({ radius: STORY.interactRadius, touch });
  const endings = new EndingsSeen(STORY.endingsKey);
  runner.repeat = endings.repeat; // 엔딩을 본 뒤의 판이면 2회차 목표 문구 (표시는 단계 0b 핸드폰)
  const log = []; // 최근 스토리 기록 (HUD)
  const note = (msg) => {
    log.unshift(msg);
    log.length = Math.min(log.length, STORY.hudLog);
  };

  ui.onAdvance = () => runner.advance();
  ui.onPick = (i) => runner.choose(i);
  runner.flags.onChange = (name, value) => {
    note(`${name}=${value}`);
    toast(`플래그 ${name} = ${value}`);
  };
  runner.onEvent = (id, phase) => note(`${id} ${phase === 'start' ? '시작' : '끝'}`);
  runner.onChoice = (id, opt, timedOut) => note(`${id} 선택 ${opt}${timedOut ? ' (시간 초과)' : ''}`);
  runner.onPov = (pov) => note(`시점 ${pov}`);
  runner.onInteract = (id) => note(`상호작용 ${id}`);
  runner.onEnding = (key, route) => {
    endings.mark(key);
    note(`루트 ${route} → 엔딩 ${key ?? '-'}`);
    toast(`루트 ${route} → 엔딩 ${key ?? '없음'}`);
  };

  return {
    runner,
    ui,
    interactions,
    // 키 입력: 대화·선택지가 먼저, 그다음 E = 근처 대상 상호작용. 소비했으면 true
    key(code) {
      if (storyKey(runner, code)) return true;
      if (code === 'KeyE') {
        interactions.use();
        return true;
      }
      return false;
    },
    // 디버그: 순서상 다음 사건 불러오기
    next() {
      if (!runner.next()) toast(`다음 사건 불가: ${runner.lastReason}`);
      else if (runner.event) toast(`사건 ${runner.event.id} · ${runner.text(runner.event.title)}`);
    },
    // 디버그: 맵에 배치하기 전의 상호작용 사건 실행 (J = 신관 4층 {dohyeon}의 책 → earlyBook)
    book() {
      if (!runner.interact(STORY.debugBook)) toast(`상호작용 불가: ${runner.lastReason}`);
    },
    reset() {
      runner.reset();
      log.length = 0;
      toast('스토리 초기화');
    },
    update(dt) {
      runner.update(dt);
      player.frozen = runner.choosing; // 선택지가 떠 있는 동안 이동 정지 (W/S 가 선택 이동 키)
      interactions.enabled = !runner.active;
      interactions.update(player.pos.x, player.pos.z);
    },
    hudLines() {
      const f = runner.flags.values;
      const reg = runner.registry;
      return [
        `스토리: 진행 ${reg.active ?? '-'}  직전 ${reg.last ?? '-'}  루트 ${runner.route}  시점 ${runner.pov}  본 엔딩 ${endings.list().join(',') || '-'}`,
        `목표${runner.repeat ? '(2회차)' : ''}: ${runner.objective() || '-'}`,
        `플래그: ${FLAG_NAMES.map((n) => `${n} ${f[n] ? 1 : 0}`).join('  ')}`,
        `스토리 기록: ${log.join(' / ') || '-'}`,
      ];
    },
  };
}
