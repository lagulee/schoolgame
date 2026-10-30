// 3층 연결통로 실내 + 잠긴 연결문 (단계 9 = 옛 1c, three 없음). STORY 4-1 "통로 안에 잠긴 연결문", E3·E4·E5.
// 통로 = 본관 뒷면 셸 ~ 신관 남쪽 면 셸 사이 (바닥 = 본관·신관 3층 바닥 7.65 m). 연결문은 본관 쪽 끝 셸 벽 두께 안에 있고
// 신관 쪽으로 90° 열리는 여닫이 철문이다. 열쇠(hasConnectorKey)가 있어야 열린다. 그리기는 connectorView.js.
import { SCHOOL, ANNEX, INTERIOR, PLAYER } from '../../config.js';
import { bridgeOpening } from '../layout.js';

export function connectorPlan(msg = {}) {
  const o = bridgeOpening();
  const Br = SCHOOL.bridge;
  const w = SCHOOL.shellWall;
  const C = ANNEX.connector;
  const zA = SCHOOL.annex.z1; // 신관 남쪽 면 (바깥)
  const zM = SCHOOL.main.backZ; // 본관 뒷면 (바깥)
  const hx = (o.x0 + o.x1 - C.w) / 2; // 서쪽 문설주 = 경첩
  const hz = zM; // 경첩은 셸 북쪽(통로 쪽) 면
  const zIn = zM + w; // 본관 안쪽 면
  const P = {
    id: 'bridge', name: msg.space ?? '연결통로', L: o.level, y: o.y0, ceil: o.y1, msg,
    rect: [o.x0, zA - w, o.x1, zIn], // 걷는 칸: 신관 안쪽 면 ~ 본관 안쪽 면 (두 셸 두께 포함)
    outer: [zA, zM], // 바깥으로 드러난 통로 구간 (띠창)
    sides: [[Br.x0, zA, o.x0, zM], [o.x1, zA, Br.x1, zM]], // 통로 옆벽
    jambs: [[o.x0, hz, hx, zIn], [hx + C.w, hz, o.x1, zIn]], // 셸 구멍 안 문 양옆 벽
    door: {
      id: 'connector', name: msg.name ?? '연결문', hinge: [hx, hz], w: C.w, h: C.h, y: o.y0, leaf: C.leaf,
      closed: [hx, hz, hx + C.w, zIn], // 닫힌 문 = 셸 구멍 안 문 자리
      open: [hx - 0.02, hz - C.w - 0.02, hx + C.leaf + 0.03, hz], // 90° 열린 문짝 (통로 서쪽에 붙음)
      pos: [hx + C.w / 2, (hz + zIn) / 2],
    },
    windows: [], // { side: 'w'|'e', z0, z1 } 창살 사이 띠창 한 칸
    bars: [],
    signs: [],
  };
  // 띠창: bridge.js 창살과 같은 자리 (통로 바깥 구간, 양쪽 벽)
  const cuts = [zA];
  for (let z = zA + Br.bars[0]; z < zM - Br.bars[1] / 2; z += Br.bars[1]) cuts.push(z);
  cuts.push(zM);
  for (const side of ['w', 'e']) {
    for (let i = 0; i + 1 < cuts.length; i++) P.windows.push({ side, z0: cuts[i], z1: cuts[i + 1] });
    for (let i = 1; i + 1 < cuts.length; i++) P.bars.push({ side, z: cuts[i] });
  }
  // 유도등: 연결문 위 (본관 쪽·통로 쪽 양면), 신관 출구 위 (신관 3층 홀 쪽)
  const sy = o.y0 + C.h + 0.25;
  const cx = (o.x0 + o.x1) / 2;
  P.signs.push({ at: 'main', L: o.level, kind: 'exit', pos: [cx, zIn, sy], normal: [0, 1] });
  P.signs.push({ at: 'annex', L: o.level, kind: 'exit', pos: [cx, hz, sy], normal: [0, -1] });
  P.signs.push({ at: 'annex', L: o.level, kind: 'exit', pos: [cx, zA - w - 0.25, sy], normal: [0, -1], hang: true }); // 출구 위는 벽이 없어 천장에 매단다
  return P;
}

// 충돌: 바닥(셸 두께까지)·발소리·옆벽·문 양옆 벽·문짝(닫힘/열림). 반환 { closed, open } 박스 핸들
export function addConnectorCollision(col, P) {
  const L = P.L;
  col.floor(...P.rect, P.y, L);
  col.surface(...P.rect, 'tile', L);
  for (const r of [...P.sides, ...P.jambs]) col.box(...r, L);
  const closed = col.box(...P.door.closed, L);
  const open = col.box(...P.door.open, L);
  open.on = false;
  return { closed, open };
}

// 연결문 상태 (three 없음, 테스트용). f = 열린 정도 0~1 (0 = 닫힘, 1 = 90°)
export class ConnectorState {
  constructor(P, handles, hasKey = () => false) {
    this.P = P;
    this.h = handles;
    this.hasKey = hasKey;
    this.f = 0;
    this.target = 0;
  }

  get locked() {
    return !this.hasKey('hasConnectorKey');
  }

  // 문짝이 쓸고 지나가는 자리(경첩 둘레 사분원)에 플레이어가 걸쳐 있나. doorway = 닫힌 문 자리(셸 구멍)까지 (닫을 때)
  blocking(player, doorway = true) {
    const p = player?.pos;
    if (!p || Math.abs((player.level ?? 0) - this.P.L) > 0.01) return false;
    const D = this.P.door;
    const [hx, hz] = D.hinge;
    const r = PLAYER.radius + 0.05;
    const inQuad = p.x > hx - r && p.z < hz + r && Math.hypot(p.x - hx, p.z - hz) < D.w + r;
    const [x0, z0, x1, z1] = D.closed;
    const cx = Math.max(x0, Math.min(p.x, x1));
    const cz = Math.max(z0, Math.min(p.z, z1));
    return inQuad || (doorway && Math.hypot(p.x - cx, p.z - cz) < r);
  }

  // E: 'locked' | 'blocked' | 'open' | 'close'
  use(player) {
    if (this.locked) return 'locked';
    if (this.blocking(player, this.target === 1)) return 'blocked'; // 열 때는 본관 쪽에서 문에 바짝 붙어 있어도 된다 (신관 쪽으로 열림)
    this.target = this.target ? 0 : 1;
    if (this.target) {
      this.h.closed.on = false;
      this.h.open.on = true;
    }
    return this.target ? 'open' : 'close';
  }

  update(dt, player) {
    if (this.f === this.target) return false;
    const r = dt / ANNEX.connector.time;
    this.f = this.target > this.f ? Math.min(1, this.f + r) : Math.max(0, this.f - r);
    if (this.f === 0) {
      if (this.blocking(player)) this.target = 1; // 닫히는 동안 들어섰으면 다시 연다
      else {
        this.h.closed.on = true;
        this.h.open.on = false;
      }
    }
    return true;
  }

  // 사건·디버그용: 바로 열린/닫힌 상태로
  set(open) {
    this.target = this.f = open ? 1 : 0;
    this.h.closed.on = !open;
    this.h.open.on = open;
  }
}

// 통로 안 천장 형광등 기구 자리 (꺼짐) [x, z]
export function connectorFixtures(P) {
  const every = INTERIOR.furniture.fixture.every;
  const [z0, z1] = P.outer;
  const n = Math.max(1, Math.round((z1 - z0) / every));
  const x = (P.rect[0] + P.rect[2]) / 2;
  return Array.from({ length: n }, (_, i) => [x, z0 + ((z1 - z0) * (i + 0.5)) / n]);
}

// 통로 안인가 (층 = 통로 층)
export const inConnector = (P, x, z, level) => Math.abs(level - P.L) < 1e-6 && x >= P.rect[0] && x <= P.rect[2] && z >= P.rect[1] && z <= P.rect[3];
