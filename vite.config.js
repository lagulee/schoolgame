import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

// 시작 화면에 표시할 버전: 커밋 해시(+ 저장 안 된 변경이 있으면 '+') 와 빌드 시각(KST).
// 배포(GitHub Actions)된 화면의 해시를 푸시한 커밋과 대조해 새 배포가 반영됐는지 확인한다.
function appVersion(command) {
  const hash = git('rev-parse --short HEAD') || 'unknown';
  const dirty = git('status --porcelain') ? '+' : '';
  if (command === 'serve') return `dev · ${hash}${dirty}`;
  const t = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  return `v${hash}${dirty} · ${t} KST`;
}

export default defineConfig(({ command }) => ({
  base: './', // GitHub Pages 하위 경로(/schoolgame/)에서도 에셋을 찾도록 상대 경로 사용
  define: { __APP_VERSION__: JSON.stringify(appVersion(command)) },
  build: { chunkSizeWarningLimit: 1200 },
  server: { host: true },
}));
