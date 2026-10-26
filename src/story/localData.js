// data/*.local.json 을 빌드할 때 있으면 넣고, 없으면 빈 객체 (Vite import.meta.glob: 일치하는 파일이 없어도 오류가 나지 않는다).
// 브라우저 전용. Node 테스트는 names.js 의 합치기 규칙만 쓴다.
import { localKey } from './names.js';

const found = import.meta.glob('../../data/*.local.json', { eager: true, import: 'default' });

export const localFiles = Object.fromEntries(Object.entries(found).map(([p, v]) => [localKey(p), v]));
