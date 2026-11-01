import { defineConfig } from 'vite';

const backendTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
      },
      '/ws': {
        target: backendTarget,
        ws: true,
      },
    },
  },
});
