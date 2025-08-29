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
      insertTypesEntry: true,
    }),
    screwUp({
      outputMetadataFile: true,
    }),
    prettierMax(), // Self-hosted
  ],
  build: {
    lib: {
      entry: resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        'src/index.ts'
      ),
      name: 'prettierMax',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'vite',
        'node:path',
        'node:child_process',
        'node:fs/promises',
        'ignore',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
