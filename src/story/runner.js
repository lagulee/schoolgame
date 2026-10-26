// 스토리 진행기: 사건 하나의 대사를 차례로 보여 주고, 선택지가 있으면 받아서 플래그를 바꾼다.
// DOM 을 직접 다루지 않는다. 화면은 ui(showLine/showChoice/setSelected/setTimer/hide/isTyping/finishTyping/update)에 맡긴다.
import { Flags, endingForRoute } from './flags.js';
import { EventRegistry } from './registry.js';
import { fillText } from './text.js';

export class StoryRunner {
  // timing: { subtitleBase, subtitlePerChar } (src/config.js 의 STORY)
  constructor({ story, characters, ui, timing }) {
    this.story = story;
    this.characters = characters;
    this.ui = ui;
    this.timing = timing;
    this.flags = new Flags(story.flags);
    this.registry = new EventRegistry(story.events);
    this.onEvent = null; // (id, phase: 'start'|'end') => void
    this.onChoice = null; // (eventId, optionId, timedOut) => void
    this.onEnding = null; // (endingKey, route) => void
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

  text(s) {
    return fillText(s, this.characters);
  }

  speakerName(who) {
    if (!who || who === 'player') return '';
    return this.text(`{${who}}`);
  }

  // 사건 시작. 성공하면 true, 막히면 { reason } 을 담아 false
  start(id) {
    if (this.mode === 'ending') this.close();
    const c = this.registry.check(id);
    if (!c.ok) {
      this.lastReason = c.reason;
      return false;
    }
    this.event = this.registry.begin(id);
    this.lineIdx = -1;
    this.onEvent?.(id, 'start');
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
    this.flags.apply(this.event.set);
    const id = this.registry.end();
    this.ui.hide();
    this.clear();
    this.onEvent?.(id, 'end');
  }

  showEnding() {
    const route = this.route;
    const key = endingForRoute(route, this.story.endings);
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

  // 촬영·디버그용: 사건을 시작해 lineIdx 번째 줄(줄 수 이상이면 선택지)까지 바로 넘긴다
  jump(id, lineIdx = 0) {
    this.reset();
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
  }
}
