// 사건 안의 작은 행동 (단계 13, three·DOM 없음): story.json pickups·sightings·sounds.
// - { do: 'take', id } : 그 물건을 주울 때까지 기다린다. pos 가 있으면 살펴보기(E)를 그 자리에 만들고,
//   spot 이면 신관 살펴보기 자리가 take(id) 를 부른다. 주우면 set 플래그를 켜고 다음 줄로.
//   주운 기록은 runner.used 의 'take:<id>' (체크포인트·스토리 초기화를 그대로 따른다).
// - { do: 'sound', id } : 소리를 한 번 내고 바로 다음 줄로.
// - sightings: 원경 귀신 (STORY E4). 사건 동안 서 있다가, 줍기(after)를 마치고 시야에서 벗어나면 흐려져 사라진다.
// 모든 판단은 update() 에서 지금 상태(runner.action·기록)를 보고 하므로 체크포인트 복원 뒤에도 따로 맞출 것이 없다.
const usedKey = (id) => `take:${id}`;

export class StorySteps {
  // story = story.json, interactions = Interactions, sound(def) = 소리 내기 (stepsView 가 연결)
  constructor({ runner, story, interactions, toast = () => {}, sound = () => {} }) {
    Object.assign(this, { runner, interactions, toast, sound });
    this.pickups = new Map((story.pickups ?? []).map((p) => [p.id, p]));
    this.sounds = story.sounds ?? {};
    this.sightings = (story.sightings ?? []).map((def) => ({ def, phase: 'off', alpha: 0, t: 0 }));
    this.placed = new Set(); // 지금 등록된 살펴보기 (pos 줍기)
  }

  taken(id) {
    return this.runner.used.has(usedKey(id));
  }

  // 지금 기다리는 줍기 id (없으면 null)
  get waiting() {
    const a = this.runner.action;
    return a?.do === 'take' ? a.id : null;
  }

  // 물건을 줍는다. 지금 기다리는 줍기가 아니면 false (부르는 쪽이 평소 문구를 띄운다)
  take(id) {
    if (this.waiting !== id || this.taken(id)) return false;
    const def = this.pickups.get(id) ?? {};
    this.runner.used.add(usedKey(id));
    if (this.placed.delete(id)) this.interactions.remove(usedKey(id)); // 살펴보기는 바로 없앤다
    this.runner.flags.apply(def.set);
    this.runner.resume('take');
    return true;
  }

  syncPickups() {
    const want = this.waiting;
    for (const id of [...this.placed]) {
      if (id === want) continue;
      this.interactions.remove(usedKey(id));
      this.placed.delete(id);
    }
    const def = want ? this.pickups.get(want) : null;
    if (!def?.pos || this.placed.has(want)) return;
    this.placed.add(want);
    this.interactions.add({ id: usedKey(want), pos: def.pos, level: def.level ?? 0, label: def.label ?? '살펴보기', onUse: () => this.take(want) });
  }

  // inView(def) = 그 자리가 지금 화면 안에 있는가 (stepsView 가 카메라로 판단)
  updateSightings(dt, inView) {
    const reg = this.runner.registry;
    for (const s of this.sightings) {
      const { def } = s;
      const started = reg.history.includes(def.event) || reg.done.has(def.event);
      if (!started) {
        Object.assign(s, { phase: 'off', alpha: 0, t: 0 }); // 스토리 초기화·앞선 체크포인트
        continue;
      }
      const active = reg.active === def.event;
      if (s.phase === 'off') {
        // 사건 중이면 나타나고, 이미 끝난 사건(복원·jump)이면 없는 채로
        Object.assign(s, active ? { phase: 'on', alpha: 1, t: 0 } : { phase: 'gone', alpha: 0 });
        continue;
      }
      if (s.phase === 'on') {
        const after = !def.after || this.taken(def.after) || !active;
        if (after) s.t += dt;
        if (after && (!inView(def) || s.t >= (def.maxStay ?? Infinity))) s.phase = 'fade';
      } else if (s.phase === 'fade') {
        s.alpha = Math.max(0, s.alpha - dt / (def.fade || 1));
        if (s.alpha === 0) s.phase = 'gone';
      }
    }
  }

  update(dt, inView = () => true) {
    this.syncPickups();
    const a = this.runner.action;
    if (a?.do === 'sound') {
      this.sound(this.sounds[a.id] ?? null);
      this.runner.resume('sound');
    }
    this.updateSightings(dt, inView);
  }
}
