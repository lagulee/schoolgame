// 옥상 수영장 화면 (단계 21): 문을 열 때의 검은 막(#veil)·조작 정지, 옥상에 있을 때만 옥상 묶음·광원·물소리를 켜고,
// 네온 간판은 처음 한 번 서서히 켜지고(깜빡임 0), 안개를 조금 걷어 맑은 밤하늘로 만든다(천천히). 물결 무늬는 흐르기만 한다.
// 논리(문 조건·암전 단계·간판 읽기·엔딩 D)는 scene/roof.js. 다른 뷰가 #veil 을 먼저 쓰므로 더 큰 값만 덮어쓴다.
import { ROOF } from '../config.js';
import { poolWater } from '../audio/water.js';

const ease = (k) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};

export class RoofView {
  // roof = RoofScene, build = world/roof/build.js 의 반환값, fog = scene.fog
  constructor({ roof, build, player, audio, veilEl, fog, poolPos }) {
    Object.assign(this, { roof, build, player, veilEl, fog });
    this.water = poolWater(audio, poolPos, { gain: ROOF.sound.water, ref: ROOF.sound.ref });
    this.fogK = 1; // 안개 배율 (지금 값)
    this.base = fog?.density ?? 0;
    this.neon = 0;
    this.lightBase = build.poolLight.intensity;
  }

  // 지금 옥상(층 ROOF.level)에 있는가
  get on() {
    return Math.abs((this.player.level ?? 0) - ROOF.level) < 1e-6;
  }

  update(dt) {
    const r = this.roof;
    const b = this.build;
    const on = this.on;
    if (r.frozen) this.player.frozen = true; // finaleView·vanishView 뒤에 불러 덮어쓴다
    if (r.veil > 0) this.veilEl.style.opacity = Math.max(+this.veilEl.style.opacity || 0, r.veil).toFixed(3);
    b.group.visible = on;
    if (!on && this.fogK === 1) {
      this.base = this.fog?.density ?? 0;
      this.water.setLevel(0);
      return;
    }
    // 네온: 문으로 올라왔으면 도착 뒤 neonOn 초에 걸쳐 한 번 켜진다 (촬영·디버그로 바로 올라오면 켜진 채)
    this.neon = r.onRoof ? ease(r.since / ROOF.neonOn) : 1;
    if (b.neon) {
      b.neon.mat.color.setScalar(this.neon * 1.6);
      b.neon.light.intensity = ROOF.sign.neon.light.intensity * this.neon;
    }
    b.poolLight.intensity = this.lightBase;
    const target = on ? ROOF.fog : 1;
    const step = dt / ROOF.fogFade;
    this.fogK = dt === 0 ? target : target < this.fogK ? Math.max(target, this.fogK - step) : Math.min(target, this.fogK + step);
    if (this.fog) this.fog.density = this.base * this.fogK;
    this.water.setLevel(on ? 1 : 0);
    if (on) b.update(dt);
  }
}
