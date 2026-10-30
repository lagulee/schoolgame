// 실내 전체 배치 (단계 9 = 옛 1c, three 없음): 본관·신관 평면 + 3층 연결통로. 그리기(index.js)·분위기(atmosphere.js)·테스트가 같은 결과를 쓴다.
import { buildPlan, addInteriorCollision, spaceAt } from './plan.js';
import { connectorPlan, addConnectorCollision, inConnector } from './connector.js';
import { annexWalls, annexFaces } from '../layout.js';

// 신관 평면: 본관과 같은 규칙, 셸·외벽 면만 신관 것. 그리기 묶음 이름 앞머리 'A' (AL0 … AL4, Ashaft, Aextra)
export const buildAnnexPlan = (data) => buildPlan(data, { shells: annexWalls(), faces: Object.values(annexFaces()), group: 'A' });

export function buildSite(mainData, annexData) {
  const main = buildPlan(mainData);
  const annex = buildAnnexPlan(annexData);
  const bridge = connectorPlan(annexData.connector);
  for (const s of bridge.signs) (s.at === 'main' ? main : annex).signs.push(s); // 연결문·출구 유도등은 각 건물 묶음에서 그린다
  return { main, annex, bridge, plans: [main, annex] };
}

// 충돌 등록. 반환 { doors: 문 id → 박스 핸들 (본관 'entrance' 포함), connector: { closed, open } }
export function addSiteCollision(col, site) {
  const doors = new Map([...addInteriorCollision(col, site.main), ...addInteriorCollision(col, site.annex)]);
  return { doors, connector: addConnectorCollision(col, site.bridge) };
}

// (x, z, 층) 이 들어 있는 곳: { where: 'main' | 'annex' | 'bridge', space } 또는 null (바깥·빈 공간)
export function locate(site, x, z, level) {
  if (inConnector(site.bridge, x, z, level)) return { where: 'bridge', space: site.bridge };
  const m = spaceAt(site.main, x, z, level);
  if (m) return { where: 'main', space: m };
  const a = spaceAt(site.annex, x, z, level);
  return a ? { where: 'annex', space: a } : null;
}
