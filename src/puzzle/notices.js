// 퍼즐 공통 알림 연결. DOM·JSON import 없음 (Node 테스트에서 그대로 쓴다).
// 공통 알림(시작·단서·틀림·성공·실패). 연출 훅이 자기 문구를 띄웠으면(hookShown) 틀림·실패 알림은 건너뛴다 (P3·P4 문구를 덮어쓰지 않게)
export function wireNotices({ session, toast, msg, clueName }) {
  session.onStart = ({ id }) => toast(msg('start', { name: session.defs.get(id).name, total: session.puzzle.total }));
  session.onClue = ({ clue, n, total, dup }) => toast(dup ? msg('clueDup', { clue: clueName(clue) }) : msg('clue', { clue: clueName(clue), n, total }));
  session.onComplete = () => toast(msg('complete'));
  session.onWrong = ({ wrong, limit, hookShown }) => !hookShown && toast(msg('wrong', { wrong, limit }));
  session.onSuccess = ({ id }) => toast(msg('success', { name: session.defs.get(id).name }));
  session.onFail = ({ id, attempt, hookShown }) => !hookShown && toast(msg('fail', { limit: session.defs.get(id).wrongLimit, attempt: attempt + 1 }));
}

