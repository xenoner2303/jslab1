import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const backendTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000';

let gitSha = process.env.GIT_SHA || process.env.VITE_GIT_SHA || '';
if (!gitSha) {
  try {
    gitSha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    gitSha = 'dev';
  }
}

export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
      },
      '/ws': {
        target: backendTarget,
        ws: true,
      },
      '/health': {
        target: backendTarget,
      },
    },
  },
});
