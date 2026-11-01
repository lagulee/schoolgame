// 주인공 이름 (단계 0c, STORY 12장, DOM 없음): 필수 1~max 자, 앞뒤 공백·제어 문자·방향 제어 문자 제거.
// 화면에는 textContent 로만 쓰고(HTML 해석 없음), 브라우저 localStorage 에만 저장한다 (외부 전송 없음).
// 글자 수는 코드 포인트 기준 (한글 한 글자 = 1, 이모지 하나 = 1).
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

export function cleanName(raw, max) {
  const name = String(raw ?? '').replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  const n = Array.from(name).length;
  if (!n) return { ok: false, name: '', reason: '이름을 입력해 주세요' };
  if (n > max) return { ok: false, name, reason: `이름은 ${max}자까지 쓸 수 있어요` };
  return { ok: true, name, reason: '' };
}

// 저장소 접근은 사생활 보호 모드 등에서 막힐 수 있으므로 실패해도 진행한다
export function loadName(storage, key) {
  try {
    return storage?.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function saveName(storage, key, name) {
  try {
    storage?.setItem(key, name);
  } catch {
    // 저장 실패: 이번 판에서만 쓴다
  }
}
