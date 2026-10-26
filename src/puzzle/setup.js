// 퍼즐 실행기 조립 (단계 0b-4): 세션 + 훅 + 디버그 시험 퍼즐 키 + HUD 줄. 실제 퍼즐 P1~P4 의 내용·연출은 이후 단계에서 붙인다.
// 사건과의 연결(사건의 puzzle 을 언제 시작할지)은 맵이 생긴 뒤 각 사건 단계에서 session.start(id) 와 콜백으로 붙인다.
import data from '../../data/puzzles.json';
import { PUZZLE } from '../config.js';
import { GhostHooks } from './hooks.js';
import { PuzzleSession } from './session.js';

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export function setupPuzzle({ story, toast }) {
  const runner = story.runner;
  const msg = (key, vars = {}) => fill(data.messages[key], vars);
  const hooks = new GhostHooks({ log: (line) => console.debug(`[퍼즐] ${line}`) }); // 연출은 아직 빈 함수: 호출 로그만
  const session = new PuzzleSession({ runner, puzzles: [...data.puzzles, ...data.debugPuzzles], cfg: PUZZLE, hooks });
  const def = () => session.defs.get(PUZZLE.debugId);
  const clueName = (id) => def().clues.find((c) => c.id === id)?.name ?? id;

  session.onStart = ({ id }) => toast(msg('start', { name: session.defs.get(id).name, total: session.puzzle.total }));
  session.onClue = ({ clue, n, total, dup }) => toast(dup ? msg('clueDup', { clue: clueName(clue) }) : msg('clue', { clue: clueName(clue), n, total }));
  session.onComplete = () => toast(msg('complete'));
  session.onWrong = ({ wrong, limit }) => toast(msg('wrong', { wrong, limit }));
  session.onSuccess = ({ id }) => toast(msg('success', { name: session.defs.get(id).name }));
  session.onFail = ({ id, attempt }) => toast(msg('fail', { limit: session.defs.get(id).wrongLimit, attempt: attempt + 1 }));

  const need = (fn) => {
    if (!session.active) return toast(msg('none'));
    fn();
  };
  return {
    session,
    // 디버그: I 시작/중지, O 다음 단서(모두 얻은 뒤에는 첫 단서를 다시 얻어 중복 무시를 확인), Z 정답, X 오답
    debugToggle() {
      if (session.active) {
        session.stop();
        toast(msg('stop'));
      } else session.start(PUZZLE.debugId);
    },
    debugClue: () => need(() => session.gather(session.puzzle.nextClue() ?? session.puzzle.clueIds[0])),
    debugRight: () => need(() => session.submit(def().answer)),
    debugWrong: () => need(() => session.submit(PUZZLE.debugWrongInput)),
    hudLine: () => session.hudLine(),
    reset: () => session.stop(),
  };
}
