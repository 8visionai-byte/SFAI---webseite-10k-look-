import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.simplefast.ai',
  output: 'static',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      // 'esbuild' zamiast domyślnego lightningcss: lightningcss bez targetów wycina
      // KAŻDY -webkit-backdrop-filter z bundla (Safari 16-17 traciło blur paneli glass,
      // mimo poprawnych prefiksów w źródle). Esbuild zachowuje autorskie prefiksy 1:1.
      cssMinify: 'esbuild',
      // Three.js is isolated to the homepage hero; keep the warning threshold aligned with that intentional chunk.
      chunkSizeWarningLimit: 650,
    },
  },
});
