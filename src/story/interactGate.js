// E 상호작용(살펴보기·문) 안내를 켤지 정한다. DOM 없음 (Node 테스트에서 그대로 쓴다).
// 사건이 없으면 켜고, 추격·숨기·퍼즐 같은 행동 줄에서는 문·물건을 쓸 수 있게 켜 두되,
// 연출 행동 줄(STORY.noInteractActions: look·escape·collapse·scare …)에서는 안내를 숨긴다.
import { STORY } from '../config.js';

export function interactionsOpen(runner, cfg = STORY) {
  if (!runner.active) return true;
  return runner.mode === 'action' && !cfg.noInteractActions.includes(runner.action?.do);
}
