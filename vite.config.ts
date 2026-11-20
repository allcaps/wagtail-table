import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'frontend/public',
  build: {
    target: 'es2022',
    outDir: 'src/wagtail_table/static/wagtail_table',
    emptyOutDir: false,
    lib: {
      entry: 'frontend/wagtail.ts',
      name: 'WagtailTable',
      formats: ['iife'],
      fileName: () => 'table.js',
      cssFileName: 'table',
    },
  },
});
