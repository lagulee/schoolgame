// 스토리 진행기: 사건 하나의 대사를 차례로 보여 주고, 선택지가 있으면 받아서 플래그를 바꾼다.
// 사건마다 시점(pov: player | mingeon)을 바꾸고, 상호작용 사건(story.interactions)과 체크포인트 저장·복원을 맡는다.
// DOM 을 직접 다루지 않는다. 화면은 ui(showLine/showChoice/setSelected/setTimer/hide/isTyping/finishTyping/update)에 맡긴다.
import { Flags, endingForRoute } from './flags.js';
import { EventRegistry } from './registry.js';
import { Checkpoints } from './checkpoint.js';
import { fillText, withPlayerName } from './text.js';

export const POVS = ['player', 'mingeon'];

export class StoryRunner {
  // timing: { subtitleBase, subtitlePerChar } (src/config.js 의 STORY)
  constructor({ story, characters, ui, timing }) {
    this.story = story;
    this.characters = characters;
    this.ui = ui;
    this.timing = timing;
    this.flags = new Flags(story.flags);
    this.registry = new EventRegistry(story.events);
    this.interactions = new Map((story.interactions ?? []).map((d) => [d.id, d]));
    this.used = new Set(); // 이미 쓴 상호작용 사건 ID
    this.pov = 'player';
    this.repeat = false; // 엔딩을 본 뒤의 판이면 true → objectiveRepeat 를 쓴다 (setup 이 endingsSeen 으로 정함)
    this.allEndings = false; // A·B·C 를 모두 본 뒤의 판이면 true → grantRoofKey 사건(E1)에서 hasRoofKey (setup 이 정함)
    this.onEvent = null; // (id, phase: 'start'|'end') => void
    this.onChoice = null; // (eventId, optionId, timedOut) => void
    this.onEnding = null; // (endingKey, route) => void
    this.onPov = null; // (pov) => void  시작 위치·카메라·핸드폰 전환은 단계 0b·6 에서 여기에 붙인다
    this.onInteract = null; // (interactionId) => void
    this.checkpoints = new Checkpoints();
    this.checkpoints.register('flags', { save: () => this.flags.snapshot(), load: (v) => this.flags.restore(v) });
    this.checkpoints.register('events', { save: () => this.registry.snapshot(), load: (v) => this.registry.restore(v) });
    this.checkpoints.register('runner', { save: () => this.saveState(), load: (v) => this.loadState(v) });
    this.clear();
  }

  get route() {
    return this.flags.route;
  }

  get active() {
    return this.mode !== 'idle';
  }

  get choosing() {
    return this.mode === 'choice';
  }

  clear() {
    this.mode = 'idle'; // idle | line | choice | ending
    this.event = null;
    this.lineIdx = 0;
    this.lineLeft = Infinity; // 자막 자동 넘김까지 남은 시간
    this.choice = null; // { def, selected, left }
  }

  // 주인공 이름 주입 ({player}). 빈 값이면 "나"
  setPlayerName(name) {
    this.characters = withPlayerName(this.characters, name);
  }

  text(s) {
    return fillText(s, this.characters);
  }

  // 지금 시점의 인물 대사는 1인칭이라 이름 없이 표시한다 (주인공 시점이면 주인공, 태민 시점이면 태민)
  speakerName(who) {
    if (!who || who === this.pov) return '';
    return this.text(`{${who}}`);
  }

  setPov(pov) {
    if (!POVS.includes(pov)) throw new Error(`알 수 없는 시점: ${pov}`);
    if (this.pov === pov) return;
    this.pov = pov;
    this.onPov?.(pov);
  }

  // 핸드폰 목표 문구 (진행 중인 사건, 없으면 직전 사건 기준). 엔딩을 본 판이면 objectiveRepeat 우선
  objective() {
    const ev = this.event?.kind === 'event' ? this.event : this.registry.last ? this.registry.get(this.registry.last, this.route) : null;
    const key = (this.repeat && ev?.objectiveRepeat) || ev?.objective;
    const text = key ? this.story.objectives?.[key] : null;
    return text ? this.text(text) : '';
  }

  // 사건 시작. 성공하면 true, 막히면 { reason } 을 담아 false
  start(id) {
    if (this.mode === 'ending') this.close();
    const c = this.registry.check(id);
    if (!c.ok) {
      this.lastReason = c.reason;
      return false;
    }
    this.event = { kind: 'event', ...this.registry.begin(id, this.route) };
    this.lineIdx = -1;
    this.setPov(this.event.pov ?? 'player');
    if (this.event.grantRoofKey && this.allEndings) this.flags.set('hasRoofKey', true);
    this.onEvent?.(id, 'start');
    this.nextLine();
    return true;
  }

  // 상호작용 사건 (예: 신관 4층 {dohyeon}의 책 줍기 → earlyBook). 순서표와 별개로, 열린 구간 안에서 한 번만
  canInteract(id) {
    const def = this.interactions.get(id);
    if (!def) return { ok: false, reason: `없는 상호작용 ${id}` };
    if (this.mode === 'line' || this.mode === 'choice') return { ok: false, reason: `${this.event.id} 진행 중` };
    if (this.used.has(id)) return { ok: false, reason: `${id} 이미 사용` };
    const reg = this.registry;
    const seen = (ev) => reg.history.includes(ev) || reg.done.has(ev); // 시작했거나 (jump 로) 지나간 사건
    if (def.after && !seen(def.after)) return { ok: false, reason: `${def.after} 이후에만` };
    if (def.before && seen(def.before)) return { ok: false, reason: `${def.before} 시작 전에만` };
    return { ok: true, reason: '' };
  }

  interact(id) {
    const c = this.canInteract(id);
    if (!c.ok) {
      this.lastReason = c.reason;
      return false;
    }
    if (this.mode === 'ending') this.close();
    this.event = { kind: 'interaction', ...this.interactions.get(id) };
    this.lineIdx = -1;
    this.nextLine();
    return true;
  }

  // 순서상 다음 사건. 더 없으면 루트를 판정해 엔딩을 보여 준다
  next() {
    if (this.mode === 'line' || this.mode === 'choice') {
      this.lastReason = `${this.event.id} 진행 중`;
      return false;
    }
    const id = this.registry.nextId(this.flags.values, this.route);
    if (id) return this.start(id);
    this.showEnding();
    return true;
  }

  nextLine() {
    const lines = this.event.lines ?? [];
    this.lineIdx++;
    if (this.lineIdx < lines.length) {
      const line = lines[this.lineIdx];
      const style = line.style ?? 'dialog';
      const text = this.text(line.text);
      this.mode = 'line';
      this.lineLeft = style === 'dialog' ? Infinity : this.timing.subtitleBase + text.length * this.timing.subtitlePerChar;
      this.ui.showLine({ style, speaker: this.speakerName(line.who), text });
      return;
    }
    if (this.event.choice && !this.choice) {
      this.openChoice(this.event.choice);
      return;
    }
    this.finishEvent();
  }

  openChoice(def) {
    const selected = Math.max(0, def.options.findIndex((o) => o.id === def.default));
    this.choice = { def, selected, left: def.timeout ?? Infinity, picked: null };
    this.mode = 'choice';
    this.ui.showChoice({
      prompt: this.text(def.prompt),
      options: def.options.map((o) => this.text(o.label)),
      timeout: def.timeout ?? null,
      selected,
    });
  }

  moveSelection(delta) {
    if (this.mode !== 'choice') return;
    const n = this.choice.def.options.length;
    this.choice.selected = (this.choice.selected + delta + n) % n;
    this.ui.setSelected(this.choice.selected);
  }

  // index 를 생략하면 현재 강조된 항목
  choose(index = this.choice?.selected, timedOut = false) {
    if (this.mode !== 'choice') return false;
    const opt = this.choice.def.options[index];
    if (!opt) return false;
    this.choice.picked = opt.id;
    this.flags.apply(opt.set);
    this.onChoice?.(this.event.id, opt.id, timedOut);
    this.finishEvent();
    return true;
  }

  finishEvent() {
    const ev = this.event;
    this.flags.apply(ev.set);
    this.ui.hide();
    this.clear();
    if (ev.kind === 'interaction') {
      this.used.add(ev.id);
      this.onInteract?.(ev.id);
      return;
    }
    const id = this.registry.end();
    this.onEvent?.(id, 'end');
  }

  // key 를 주면 그 엔딩을 바로 보여 준다 (촬영·디버그)
  showEnding(key = null) {
    if (key) this.close();
    const route = key ? this.story.endings[key]?.route ?? this.route : this.route;
    key ??= endingForRoute(route, this.story.endings);
    const e = key ? this.story.endings[key] : null;
    this.mode = 'ending';
    this.lineLeft = Infinity;
    this.ui.showLine({
      style: 'ending',
      speaker: `${route} → ${e ? e.title : '엔딩 없음'}`,
      text: e ? this.text(e.summary) : '이 루트의 엔딩이 정의되지 않았다',
    });
    this.onEnding?.(key, route);
  }

  close() {
    if (this.mode === 'line' || this.mode === 'choice') return; // 사건 도중에는 닫지 않는다
    this.ui.hide();
    this.clear();
  }

  // E 키·대화창 터치: 타자 효과 중이면 문장을 다 보여 주고, 아니면 다음 줄
  advance() {
    if (this.mode === 'line') {
      if (this.ui.isTyping()) this.ui.finishTyping();
      else this.nextLine();
      return true;
    }
    if (this.mode === 'choice') return this.choose();
    if (this.mode === 'ending') {
      this.close();
      return true;
    }
    return false;
  }

  update(dt) {
    this.ui.update(dt);
    if (this.mode === 'line' && !this.ui.isTyping()) {
      this.lineLeft -= dt;
      if (this.lineLeft <= 0) this.nextLine();
    } else if (this.mode === 'choice' && Number.isFinite(this.choice.left)) {
      this.choice.left -= dt;
      const total = this.choice.def.timeout;
      this.ui.setTimer(Math.max(0, this.choice.left) / total, this.choice.left);
      if (this.choice.left <= 0) {
        const def = this.choice.def.options.findIndex((o) => o.id === this.choice.def.default);
        this.choose(Math.max(0, def), true); // 무응답 → 기본값
      }
    }
  }

  // 촬영·디버그용: 사건을 시작해 lineIdx 번째 줄(줄 수 이상이면 선택지)까지 바로 넘긴다.
  // flags 를 주면 먼저 적용한다 (루트별 변형 사건을 부를 때, 예: { dutyCompanion: true } 로 R2 의 E13)
  jump(id, lineIdx = 0, flags = {}) {
    this.reset();
    this.flags.restore(flags);
    const order = this.registry.order;
    // 앞선 사건은 기록만 남긴다 (플래그는 바꾸지 않음)
    for (const prev of order.slice(0, order.indexOf(id))) this.registry.done.add(prev);
    if (!this.start(id)) return false;
    for (let i = 0; i < lineIdx && this.mode === 'line'; i++) this.nextLine();
    return true;
  }

  reset() {
    this.ui.hide();
    this.clear();
    this.flags.reset();
    this.registry.reset();
    this.used.clear();
    this.setPov('player');
  }

  // 체크포인트: 플래그·사건 기록·러너 상태(시점·상호작용·진행 중인 사건과 줄)를 저장 객체 하나로.
  // 다른 항목(배터리 등)은 this.checkpoints.register(name, { save, load }) 로 더한다
  snapshot() {
    return this.checkpoints.snapshot();
  }

  restore(snap) {
    this.ui.hide();
    this.clear();
    this.checkpoints.restore(snap, ['flags', 'events', 'runner']);
  }

  saveState() {
    const ev = this.event && (this.mode === 'line' || this.mode === 'choice') ? this.event : null;
    return {
      pov: this.pov,
      used: [...this.used],
      event: ev ? { kind: ev.kind, id: ev.id, lineIdx: this.lineIdx } : null,
    };
  }

  // 진행 중이던 사건은 저장된 줄부터 다시 보여 준다 (선택지였다면 선택지부터, 고른 결과는 저장 전 상태)
  loadState(s) {
    this.used = new Set(s.used ?? []);
    this.setPov(s.pov ?? 'player');
    if (!s.event) return;
    if (s.event.kind === 'interaction') {
      this.event = { kind: 'interaction', ...this.interactions.get(s.event.id) };
    } else {
      this.registry.active = s.event.id;
      this.event = { kind: 'event', ...this.registry.get(s.event.id, this.route) };
    }
    this.lineIdx = s.event.lineIdx - 1;
    this.nextLine();
  }
}
