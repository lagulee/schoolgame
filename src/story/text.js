// 대사 자리표시자 치환. 이름은 data/characters.json 한 곳에서만 정하고 대사에는 {id} 로만 쓴다.
// {id:조사} 형식이면 이름의 받침에 맞는 조사를 붙인다. 예: {gyuha:이} → "서진이" / 이름이 받침 없이 끝나면 "…가".
// 가명을 바꿔도 조사가 어긋나지 않게 하려는 장치다.

// [받침 있을 때, 받침 없을 때]
const PARTICLES = [
  ['이', '가'],
  ['은', '는'],
  ['을', '를'],
  ['과', '와'],
  ['아', '야'],
  ['이랑', '랑'],
  ['이나', '나'],
  ['으로', '로'],
];
const PAIR = new Map();
for (const p of PARTICLES) for (const w of p) PAIR.set(w, p);

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONG_COUNT = 28;
const JONG_RIEUL = 8; // ㄹ 받침: '으로/로' 에서는 받침 없는 쪽(로)을 쓴다

// 마지막 글자의 받침 번호 (0 = 받침 없음, 한글이 아니면 0 으로 본다)
export function finalConsonant(word) {
  const c = word.trim().codePointAt(word.trim().length - 1) ?? 0;
  if (c < HANGUL_FIRST || c > HANGUL_LAST) return 0;
  return (c - HANGUL_FIRST) % JONG_COUNT;
}

export function withParticle(word, particle) {
  const pair = PAIR.get(particle);
  if (!pair) return word + particle; // 받침과 무관한 조사(의, 도, 만 …)는 그대로 붙인다
  const jong = finalConsonant(word);
  const useFirst = pair[0] === '으로' ? jong !== 0 && jong !== JONG_RIEUL : jong !== 0;
  return word + (useFirst ? pair[0] : pair[1]);
}

// characters: { id: { name } }. 모르는 id 는 그대로 남겨 데이터 오류가 화면에서 바로 보이게 한다.
export function fillText(text, characters) {
  return String(text).replace(/\{([a-z][a-zA-Z0-9]*)(?::([^}]+))?\}/g, (m, id, particle) => {
    const ch = characters[id];
    if (!ch || typeof ch.name !== 'string') return m;
    return particle ? withParticle(ch.name, particle) : ch.name;
  });
}

// 데이터 검사용: 문자열 안의 자리표시자 id 목록
export function placeholderIds(text) {
  return [...String(text).matchAll(/\{([a-z][a-zA-Z0-9]*)(?::[^}]+)?\}/g)].map((m) => m[1]);
}

// 주인공 이름 주입 지점. 대사의 {player} 는 플레이어가 입력한 이름으로 바뀐다 (입력 화면은 단계 0c).
// 값이 없거나 공백뿐이면 "나". characters 는 바꾸지 않고 새 객체를 돌려준다.
export const PLAYER_DEFAULT_NAME = '나';

export function withPlayerName(characters, name) {
  const v = typeof name === 'string' ? name.trim() : '';
  return { ...characters, player: { ...characters.player, name: v || PLAYER_DEFAULT_NAME } };
}
