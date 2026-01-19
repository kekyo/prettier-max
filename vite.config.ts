// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dts from 'vite-plugin-dts';
import screwUp from 'screw-up';
import prettierMax from './src/index';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
    }),
    screwUp({
      outputMetadataFile: true,
    }),
    // Self-hosted
    prettierMax({
      typescript: 'tsconfig.test.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        'src/index.ts'
      ),
      name: 'prettier-max',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'vite',
        'path',
        'child_process',
        'fs/promises',
        'fs',
        'url',
        'typescript',
        'debug',
      ],
    },
    target: 'es2018',
    sourcemap: true,
    minify: false,
  },
});
