// 마지막 장면 화면 (단계 16): 시선 돌리기·쓰러짐 동안 조작을 멈추고, 쓰러짐의 붉은 막(#blood)·검은 막(#veil)·눈높이·고개·쓰러지는 소리를 그린다.
// E14·E15 의 freezeUntil(행동 줄 이름 앞 줄까지 조작 정지)과 E15 의 threat(화면 가장자리 어둡게)도 여기서 맡는다.
// 번쩍임 없음: 막은 한 방향으로 부드럽게만 변한다. FaintView 가 #veil·eyeDrop 을 매 프레임 덮어쓰므로 이 뷰는 그 뒤에 불러 더 큰 값을 쓴다.
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { ghostBang } from '../audio/ghost.js';

export class FinaleView {
  // runner: StoryRunner, bloodEl·veilEl·threatEl: DOM
  constructor({ runner, look, collapse, player, camera, audio, bloodEl, veilEl, threatEl }) {
    Object.assign(this, { runner, look, collapse, player, camera, audio, bloodEl, veilEl, threatEl });
    this.lastPhase = 'idle';
  }

  // 이 사건이 지금 조작을 멈춰야 하는가 (freezeUntil 이 가리키는 행동 줄 앞까지)
  frozenByEvent() {
    const r = this.runner;
    const ev = r.event;
    if (!ev?.freezeUntil || !r.busy || ev.kind !== 'event') return false;
    const at = ev.lines.findIndex((l) => l.do === ev.freezeUntil);
    return at < 0 || r.lineIdx < at;
  }

  update() {
    const c = this.collapse;
    if (this.look.active || c.frozen || this.frozenByEvent()) this.player.frozen = true; // story.update 가 매 프레임 frozen 을 정한 뒤에 덮어쓴다
    this.bloodEl.style.opacity = c.blood.toFixed(3);
    if (c.veil > 0) this.veilEl.style.opacity = Math.max(+this.veilEl.style.opacity || 0, c.veil).toFixed(3);
    if (c.sink > 0) this.player.eyeDrop = Math.max(this.player.eyeDrop, c.eyeDrop);
    if (c.pitch !== null) this.camera.rotation.x = c.pitch;
    const t = this.runner.busy && this.runner.event?.threat;
    if (t) this.threatEl.style.opacity = Math.max(+this.threatEl.style.opacity || 0, t).toFixed(3);
    // 몸이 바닥에 닿는 소리 (주저앉기가 끝나고 암전으로 넘어갈 때 한 번)
    if (c.phase === 'dark' && this.lastPhase !== 'dark' && this.audio.started) {
      const p = this.player.pos;
      ghostBang(this.audio, new THREE.Vector3(p.x, 0.2, p.z), SCENE.faint.bang);
    }
    this.lastPhase = c.phase;
  }
}
