import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The Vue plugin is intentionally thin. It is bundled for npm, with `vue`,
// `@karpeleslab/klbfw` (host-provided transport) and `@karpeleslab/klb-login-core`
// (the bundled CDN fallback) all left external so the host application resolves
// its own single copy of each.
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'klb-login-vue.mjs',
    },
    rollupOptions: {
      external: ['vue', '@karpeleslab/klbfw', '@karpeleslab/klb-login-core'],
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
});
