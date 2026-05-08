import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'esnext',
  dts: true,
  clean: true,
  shims: true,
  keepNames: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  minify: false,
});
