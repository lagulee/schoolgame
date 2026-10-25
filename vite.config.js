import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages 하위 경로(/schoolgame/)에서도 에셋을 찾도록 상대 경로 사용
  build: { chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
