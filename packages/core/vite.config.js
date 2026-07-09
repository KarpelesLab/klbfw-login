import { defineConfig } from 'vite';

// The core ships as a single, dependency-free ESM file so it can be served
// straight from a CDN (jsdelivr/unpkg) and dynamically imported by hosts.
// CSS is shipped as an injected string (src/styles.js), not a separate asset,
// to keep the CDN surface to one file.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'core.mjs',
    },
    // No externals: the bundle must be fully self-contained for CDN use.
    rollupOptions: {},
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
});
