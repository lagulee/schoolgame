// E2 화면·소리 (단계 12): E2Scene 상태를 읽어 귀신·발소리·화면 가장자리 어둡게·문틈 연기·숨기 안내·떨어진 핸드폰을 그린다.
// 귀신은 교복 입은 학생 3D 모델(scene/ghost, 늘 플레이어 쪽을 봄)과 발소리. 밝기가 번쩍이는 연출은 없다 (깜빡임 규칙).
import * as THREE from 'three';
import { SCENE } from '../config.js';
import { canvasTexture } from '../materials/texgen.js';
import { ghostBang, ghostStep } from '../audio/ghost.js';
import { GhostFigure } from './ghost/figure.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 바닥에 번지는 연기 얼룩 (가운데 진하고 바깥으로 사라짐)
function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(0,0,0,1)');
  r.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c, true, 1);
}

// 깨진 화면: 검은 유리에 흰 금 몇 줄
function crackedTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#07090c';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = 'rgba(220,230,240,0.75)';
  g.lineWidth = 1.2;
  const cx = 40;
  const cy = 46;
  for (const [x, y] of [[0, 20], [64, 8], [64, 90], [10, 128], [50, 128], [0, 70]]) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo((cx + x) / 2 + 5, (cy + y) / 2 - 4);
    g.lineTo(x, y);
    g.stroke();
  }
  return canvasTexture(c, true, 1);
}

export class E2View {
  // scene2: E2Scene, doors: 본관 Doors (문 자리), traces: Traces, threatEl·hintEl: DOM
  constructor({ scene, e2, collision, audio, doors, traces, traceDefs, threatEl, hintEl }) {
    Object.assign(this, { e2, collision, audio, doors, traces, threatEl, hintEl });
    this.ghost = new GhostFigure({ name: 'ghostSilhouette' });
    this.ghost.material.opacity = SCENE.ghost.opacity;
    this.ghost.visible = false;
    scene.add(this.ghost);
    const smokeMat = new THREE.MeshBasicMaterial({ map: smokeTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
    this.smoke = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SCENE.smoke.size, SCENE.smoke.size), smokeMat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.smoke.push(m);
    }
    this.smokeMat = smokeMat;
    this.traceMeshes = new Map();
    for (const d of traceDefs) {
      const T = SCENE.trace;
      const m = new THREE.Mesh(new THREE.BoxGeometry(...T.size), [
        ...Array(2).fill(new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5 })),
        new THREE.MeshStandardMaterial({ map: crackedTexture(), roughness: 0.15, metalness: 0.3 }), // 위 = 깨진 화면
        ...Array(3).fill(new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5 })),
      ]);
      m.rotation.y = T.turn;
      m.visible = false;
      scene.add(m);
      this.traceMeshes.set(d.id, { d, m });
    }
    this.stepLeft = 0;
    this.wasStalled = false;
    this.hintShown = '';
    this.breath = 0;
  }

  update(dt) {
    const g = this.e2.ghost;
    const S = SCENE.steps;
    // 실루엣: 추격 중·문 앞을 지나갈 때만 (숨기 준비 중에는 소리만)
    const show = !!g && g.mode !== 'prep' && !g.hidden;
    this.ghost.visible = show;
    if (g) {
      const y = this.collision.floorHeight(g.x, g.z, g.level) + SCENE.ghost.h / 2;
      this.ghost.position.set(g.x, y, g.z);
      // 발소리: 가까울수록 빠르게
      const every = g.mode === 'chase' ? S.far + (S.near - S.far) * clamp01((S.farGap - g.gap) / (S.farGap - S.nearGap)) : g.mode === 'prep' ? S.prep : S.pass;
      this.stepLeft -= dt;
      if (this.stepLeft <= 0) {
        this.stepLeft = every;
        if (this.audio.started && !g.stalled) ghostStep(this.audio, new THREE.Vector3(g.x, y - SCENE.ghost.h / 2 + 0.1, g.z), S.gain);
      }
      // 지형 지연(C2): 귀신이 멈칫하며 벽을 두드린다 — 멈추는 순간 쿵 한 번
      if (g.stalled && !this.wasStalled && this.audio.started) ghostBang(this.audio, new THREE.Vector3(g.x, y, g.z), SCENE.bangGain * 0.7);
      this.wasStalled = !!g.stalled;
    } else {
      this.stepLeft = 0;
      this.wasStalled = false;
    }
    // 화면 가장자리: 추격 중 가까워질수록, 지나가는 동안 조금
    const T = SCENE.threat;
    let threat = g?.mode === 'chase' ? T.max * clamp01((T.startGap - g.gap) / T.rangeGap) : g?.mode === 'pass' ? T.pass : 0;
    if (g?.locked) threat = T.max + (T.unlock - T.max) * g.unlockK; // 마지막 추격: 출구를 여는 1초 동안 가장자리가 빠르게 어두워진다 (한 방향)
    this.threatEl.style.opacity = threat.toFixed(3);
    // 숨소리 (main.js 가 지친 숨과 큰 쪽을 쓴다)
    this.breath = g?.mode === 'pass' ? SCENE.breath.pass : g?.mode === 'prep' ? SCENE.breath.prep : 0;
    // 문틈 연기: 지나가는 동안 가운데에서 가장 진하게
    const passing = g?.mode === 'pass';
    const k = passing ? Math.sin(Math.PI * this.e2.hide.passT) : 0;
    this.smokeMat.opacity = SCENE.smoke.max * k;
    const doors = passing ? this.doors.list.filter((s) => s.d.room === this.e2.hideDef.room) : [];
    this.smoke.forEach((m, i) => {
      const s = doors[i];
      m.visible = passing && !!s;
      if (s) m.position.set(s.d.pos[0], this.collision.floorHeight(s.d.pos[0], s.d.pos[1] - 0.5, 0) + 0.015, s.d.pos[1] - 0.5);
    });
    // 숨기 안내 한 줄
    const hint = this.e2.hint;
    if (hint !== this.hintShown) {
      this.hintShown = hint;
      this.hintEl.textContent = hint;
      this.hintEl.classList.toggle('show', !!hint);
    }
    // 흔적
    for (const { d, m } of this.traceMeshes.values()) {
      m.visible = this.traces.visible(d.id);
      if (m.visible) m.position.set(d.pos[0], this.collision.floorHeight(d.pos[0], d.pos[1], d.level ?? 0) + SCENE.trace.size[1] / 2, d.pos[1]);
    }
  }
}
