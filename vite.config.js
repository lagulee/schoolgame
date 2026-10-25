import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

// 시작 화면 버전: 큰 글씨 `v1.0` (package.json 의 major.minor) + 작은 글씨 커밋 해시.
// 번호는 `main` 에 반영할 때마다 올린다(CLAUDE.md). 번호를 올리는 걸 잊어도 해시로 새 배포를 구분할 수 있다.
// 해시 끝 '+' = 커밋 안 된 변경이 있는 로컬 빌드, 개발 서버는 'dev · 해시'.
function appVersion(command) {
  const [major, minor] = JSON.parse(readFileSync('package.json', 'utf8')).version.split('.');
  const hash = git('rev-parse --short HEAD') || 'unknown';
  const dirty = git('status --porcelain') ? '+' : '';
  const t = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  return {
    label: `v${major}.${minor}`,
    build: command === 'serve' ? `dev · ${hash}${dirty}` : `${hash}${dirty}`,
    time: `${t} KST`,
  };
}

export default defineConfig(({ command }) => ({
  base: './', // GitHub Pages 하위 경로(/schoolgame/)에서도 에셋을 찾도록 상대 경로 사용
  define: { __APP_VERSION__: JSON.stringify(appVersion(command)) }, // { label, build, time }
  build: { chunkSizeWarningLimit: 1200 },
  server: { host: true },
}));
