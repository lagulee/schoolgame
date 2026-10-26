// 본 엔딩 기록 (localStorage). 2회차 안내(objectiveRepeat)를 띄울지 판단하는 데 쓴다 (STORY 12장).
// 비공개 창·저장 차단 등으로 저장소 접근이 실패하면 조용히 무시하고 "본 엔딩 없음"으로 본다.

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
      return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : [];
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

  mark(key) {
    if (!key) return false;
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
