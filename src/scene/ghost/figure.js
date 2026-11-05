// 게임에서 쓰는 귀신 한 명 (단계 뒤 귀신 모델 교체): 3D 모델(model.js)을 감싸 예전 실루엣 판과 같은 쓰임새를 준다.
// - position 은 예전 판처럼 '몸 가운데'(바닥 + SCENE.ghost.h / 2) 를 받고, 안쪽 모델을 내려 발이 바닥에 닿게 한다.
// - material.opacity 로 짙기를 정한다(0 = 안 보임). 모든 재질에 같이 적용하고, 1 보다 작을 때만 반투명으로 그린다.
// - 그릴 때마다 보는 사람(GhostFigure.viewer = 카메라) 쪽으로 몸을 돌린다 (고개를 떨군 채, 또는 stare 자세면 똑바로 봄).
// 지오메트리·텍스처는 자세별로 한 번만 만들어 모든 귀신이 나눠 쓰고, 재질만 귀신마다 따로 둔다 (짙기가 다르므로).
import * as THREE from 'three';
import { SCENE } from '../../config.js';
import { buildGhostModel } from './model.js';

const bases = new Map();

export class GhostFigure extends THREE.Group {
  static viewer = null;

  // pose: idle | stare, front: true 면 깊이 검사 뒤에 그린다(점프스케어: 라이트 번짐 위)
  constructor({ pose = 'idle', name = 'ghost', front = false } = {}) {
    super();
    this.name = name;
    if (!bases.has(pose)) bases.set(pose, buildGhostModel({ pose }));
    const model = bases.get(pose).clone(true);
    const mats = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (!mats.has(o.material)) mats.set(o.material, o.material.clone());
      o.material = mats.get(o.material);
      if (front) o.renderOrder = 10;
    });
    model.position.y = -SCENE.ghost.h / 2;
    this.model = model;
    this.mats = [...mats.values()];
    this.add(model);
    let alpha = 1;
    const mats2 = this.mats;
    // 예전 Sprite 의 material.opacity 자리
    this.material = {
      get opacity() { return alpha; },
      set opacity(v) {
        alpha = Math.max(0, Math.min(1, v));
        const see = alpha < 0.999;
        for (const m of mats2) {
          m.opacity = alpha;
          m.transparent = see;
        }
      },
    };
  }

  updateMatrixWorld(force) {
    const c = GhostFigure.viewer;
    if (c && this.visible) this.rotation.y = Math.atan2(c.position.x - this.position.x, c.position.z - this.position.z);
    super.updateMatrixWorld(force);
  }
}
