// 이름·크레딧 로컬 덮어쓰기 (결정 D1). 저장소에는 가명만 커밋하고, 실명이 필요한 개인 빌드는
// .gitignore 한 data/characters.local.json · data/credits.local.json 이 "있을 때만" 덮어쓴다. 없으면 가명 그대로.
// 파일 찾기는 localData.js(Vite 전용)가 하고, 여기는 합치는 규칙만 둔다 (Node 테스트에서 그대로 쓴다).

const isName = (v) => typeof v === 'string' && v.trim() !== '';

// characters.local.json: { "gyuha": { "name": "…" }, … }. 저장소에 있는 id 의 name 만 바꾼다 (모르는 id·빈 값은 무시)
export function mergeCharacters(base, local) {
  const out = { ...base };
  if (!local || typeof local !== 'object') return out;
  for (const id of Object.keys(base)) {
    if (id.startsWith('_') || id === 'player') continue; // 주인공 이름은 입력값으로만 (withPlayerName)
    const name = local[id]?.name;
    if (isName(name)) out[id] = { ...base[id], name: name.trim() };
  }
  return out;
}

// credits.local.json: { "entries": [{ "id": "developer", "names": ["…"] }] }. 같은 id 항목의 label·names 만 바꾼다
export function mergeCredits(base, local) {
  const entries = base.entries.map((e) => ({ ...e, names: [...e.names] }));
  for (const o of Array.isArray(local?.entries) ? local.entries : []) {
    const e = entries.find((x) => x.id === o?.id);
    if (!e) continue;
    if (isName(o.label)) e.label = o.label;
    if (Array.isArray(o.names) && o.names.length && o.names.every(isName)) e.names = [...o.names];
  }
  return { ...base, entries };
}

// files: { 'characters': {...}, 'credits': {...} } 처럼 로컬 파일 이름(확장자 앞) → 내용. 없는 파일은 빠져 있으면 된다
export function applyLocal({ characters, credits }, files = {}) {
  return {
    characters: mergeCharacters(characters, files.characters),
    credits: mergeCredits(credits, files.credits),
  };
}

// '../../data/characters.local.json' → 'characters'
export function localKey(path) {
  return path.split('/').pop().replace(/\.local\.json$/, '');
}
