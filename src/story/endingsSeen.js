// 본 엔딩 기록 (localStorage). 2회차 안내(objectiveRepeat)를 띄울지 판단하는 데 쓴다 (STORY 12장).
// A·B·C·D 를 구분해 저장한다. D(숨겨진 엔딩)는 A·B·C 완주 판정(allMain)에 영향이 없다.
// 비공개 창·저장 차단 등으로 저장소 접근이 실패하면 조용히 무시하고 "본 엔딩 없음"으로 본다.

import { ENDING_KEYS, earnsRoofKey } from './flags.js';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class EndingsSeen {
  // key: 저장 키 (src/config.js STORY.endingsKey), storage: getItem/setItem 이 있는 객체 (테스트용 주입)
  constructor(key, storage = defaultStorage()) {
    this.key = key;
    this.storage = storage;
  }

  // 본 엔딩 키 목록 (예: ['C', 'A'])
  list() {
    try {
      const v = JSON.parse(this.storage?.getItem(this.key) ?? '[]');
      return Array.isArray(v) ? v.filter((k) => ENDING_KEYS.includes(k)) : [];
    } catch {
      return [];
    }
  }

  has(key) {
    return this.list().includes(key);
  }

  // 엔딩을 하나 이상 본 뒤의 판인가 (2회차 안내 조건)
  get repeat() {
    return this.list().length > 0;
  }

  // A·B·C 를 모두 봤는가 (새 판 E1 에서 hasRoofKey)
  get allMain() {
    return earnsRoofKey(this.list());
  }

  mark(key) {
    if (!ENDING_KEYS.includes(key)) return false;
    const seen = this.list();
    if (!seen.includes(key)) seen.push(key);
    try {
      this.storage?.setItem(this.key, JSON.stringify(seen));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      // 무시
    }
  }
}
