// 기절·각성 화면 (단계 15): 검은 막(#veil) 불투명도, 누웠다 일어나는 눈높이(player.eyeDrop)와 고개, 쓰러지는 소리.
// 번쩍임 없음: 막은 한 방향으로 부드럽게만 변한다.
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { ghostBang } from '../audio/ghost.js';

export class FaintView {
  constructor({ faint, player, camera, audio, veilEl }) {
    Object.assign(this, { faint, player, camera, audio, veilEl });
    this.wasActive = false;
  }

  update() {
    const f = this.faint;
    this.veilEl.style.opacity = f.veil.toFixed(3);
    this.player.eyeDrop = f.eyeDrop;
    if (f.pitch !== null) this.camera.rotation.x = f.pitch;
    if (f.active) this.player.frozen = true; // story.update 가 매 프레임 frozen 을 정한 뒤에 덮어쓴다
    if (this.wasActive && !f.active) this.player.eyeDrop = 0;
    this.wasActive = f.active;
    if (f.bang) {
      f.bang = false;
      const p = this.player.pos;
      if (this.audio.started) ghostBang(this.audio, new THREE.Vector3(p.x, 0.2, p.z), SCENE.faint.bang);
    }
  }
}
