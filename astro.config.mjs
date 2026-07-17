import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.simplefast.ai',
  output: 'static',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssMinify: true,
      // Three.js is isolated to the homepage hero; keep the warning threshold aligned with that intentional chunk.
      chunkSizeWarningLimit: 650,
    },
  },
});
