import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
export const loadStory = () => ({ story: read('data/story.json'), characters: read('data/characters.json') });

// 화면 없이 진행기를 돌리기 위한 가짜 UI (마지막으로 그린 것을 기록)
export function fakeUI() {
  return {
    shown: null,
    typing: false,
    showLine(l) { this.shown = { kind: 'line', ...l }; },
    showChoice(c) { this.shown = { kind: 'choice', ...c }; },
    setSelected(i) { this.selected = i; },
    setTimer(frac) { this.timer = frac; },
    hide() { this.shown = null; },
    isTyping() { return this.typing; },
    finishTyping() { this.typing = false; },
    update() {},
  };
}
