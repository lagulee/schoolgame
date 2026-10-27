// 스토리 엔진 조립: 데이터(data/*.json) + 진행기 + 화면 + 상호작용 키를 묶어 main.js 에 넘긴다.
import story from '../../data/story.json';
import baseCharacters from '../../data/characters.json';
import baseCredits from '../../data/credits.json';
import chaseData from '../../data/chases.json';
import { STORY, PLAYER } from '../config.js';
import { StoryRunner } from './runner.js';
import { StoryUI, storyKey } from './ui.js';
import { Interactions } from './interact.js';
import { FLAG_NAMES } from './flags.js';
import { EndingsSeen } from './endingsSeen.js';
import { applyLocal } from './names.js';
import { localFiles } from './localData.js';
import { loadChases } from './chases.js';

// 가명 + (있으면) data/*.local.json 덮어쓰기 (결정 D1)
const { characters, credits } = applyLocal({ characters: baseCharacters, credits: baseCredits }, localFiles);
loadChases(chaseData, { walk: PLAYER.walk, run: PLAYER.run }); // 귀신 속도 범위 검사 (어긋나면 시작할 때 오류)

export function setupStory({ player, touch, toast }) {
  const ui = new StoryUI({ typeSpeed: STORY.typeSpeed, timerWarn: STORY.timerWarn, touch });
  const runner = new StoryRunner({ story, characters, ui, timing: STORY });
  const interactions = new Interactions({ radius: STORY.interactRadius, touch });
  const endings = new EndingsSeen(STORY.endingsKey);
  runner.repeat = endings.repeat; // 엔딩을 본 뒤의 판이면 2회차 목표 문구 (핸드폰 화면에 표시)
  runner.allEndings = endings.allMain; // A·B·C 를 모두 본 판이면 E1 에서 hasRoofKey
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
    credits, // 옥상 수영장 간판 크레딧 (표시는 단계 8)
    // 주인공 이름 주입 지점 (입력 화면은 단계 0c). 빈 값이면 "나"
    setPlayerName(name) {
      runner.setPlayerName(name);
    },
    // 키 입력 우선순위: ① 대화·선택지 ② E = 근처(interactRadius) 대상 상호작용. 소비했으면 true
    // 소비하지 않은 E 는 main.js 가 핸드폰 화면 열기/닫기로 쓴다 (③)
    key(code) {
      if (storyKey(runner, code)) return true;
      return code === 'KeyE' && interactions.use();
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
      runner.repeat = endings.repeat;
      runner.allEndings = endings.allMain;
      log.length = 0;
      toast('스토리 초기화');
    },
    update(dt) {
      runner.update(dt);
      player.frozen = runner.choosing; // 선택지가 떠 있는 동안 이동 정지 (W/S 가 선택 이동 키)
      interactions.enabled = !runner.active;
      interactions.update(player.pos.x, player.pos.z, player.level);
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
