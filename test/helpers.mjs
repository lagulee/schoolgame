import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
export const loadStory = () => ({ story: read('data/story.json'), characters: read('data/characters.json') });
export const loadSkeletons = () => ({
  puzzles: read('data/puzzles.json').puzzles,
  chases: read('data/chases.json').chases,
  powerbanks: read('data/powerbanks.json').powerbanks,
});

// localStorage 대신 쓰는 메모리 저장소. fail 이면 모든 접근이 예외
export function memoryStorage(fail = false) {
  const m = new Map();
  const guard = () => { if (fail) throw new Error('저장소 접근 불가'); };
  return {
    getItem: (k) => (guard(), m.has(k) ? m.get(k) : null),
    setItem: (k, v) => (guard(), m.set(k, String(v))),
    removeItem: (k) => (guard(), m.delete(k)),
  };
}

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
