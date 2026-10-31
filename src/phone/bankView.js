// 보조배터리 물체 (단계 10): 놓여 있고(hidden 아님) 아직 줍지 않은 보조배터리를 작은 검은 상자 + 희미한 초록 표시등으로 그린다.
// 서랍·사물함 안(hidden)은 그리지 않는다. 자리는 PowerBanks.at 을 매 프레임 따라간다 (디버그 U 로 옮겨도 맞음). 깜빡임 없음.
import * as THREE from 'three';
import { PHONE } from '../config.js';

export class BankView {
  constructor(scene, banks, collision) {
    const V = PHONE.BANK_VIEW;
    this.banks = banks;
    this.collision = collision;
    this.group = new THREE.Group();
    this.group.name = 'powerbanks';
    scene.add(this.group);
    const body = new THREE.BoxGeometry(...V.size);
    const dot = new THREE.BoxGeometry(V.led, V.led, V.led);
    const mat = new THREE.MeshStandardMaterial({ color: V.color, roughness: 0.45, metalness: 0.2 });
    const led = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: V.ledColor, emissiveIntensity: V.ledGlow });
    this.items = new Map();
    for (const d of banks.defs.values()) {
      if (d.hidden) continue;
      const m = new THREE.Mesh(body, mat);
      m.castShadow = true;
      const l = new THREE.Mesh(dot, led);
      l.position.set(V.size[0] / 2 - V.led, V.size[1] / 2, V.size[2] / 2 - V.led * 2);
      m.add(l);
      m.rotation.y = V.turn;
      m.visible = false;
      this.group.add(m);
      this.items.set(d.id, { d, m });
    }
  }

  update() {
    for (const [id, { d, m }] of this.items) {
      const at = this.banks.at.get(id);
      m.visible = !!at;
      if (!at) continue;
      const [x, z] = at.pos;
      const moved = this.banks.moved.has(id); // 디버그로 옮긴 것은 바닥에
      const y = this.collision.floorHeight(x, z, at.level) + (moved ? 0 : d.h ?? 0) + PHONE.BANK_VIEW.size[1] / 2;
      m.position.set(x, y, z);
    }
  }
}
