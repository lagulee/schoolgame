// 귀신이 길을 찾는 Navigator (three 없음, setup.js 에서 옮김 v1.28.1 — Node 테스트가 같은 것을 쓰도록): 귀신에게는 모든 문이 열려 있다 (잠긴 문도 지나간다)
import { NAV } from '../config.js';
import { Navigator } from '../world/nav.js';

export function ghostNavigator(collision, info) {
  const nav = new Navigator(collision, { ...NAV, maxExpand: 60000 }); // 길이 없을 때 오래 헤매지 않게 한도를 낮춘다
  const open = new Set(info.handles.values());
  if (info.connector) open.add(info.connector.closed);
  nav.setPassable(open, 'ghost');
  return nav;
}
