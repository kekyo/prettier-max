// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker';
import { createTestDirectory } from './test-utils';

describe('TypeScript config path option', () => {
  it('uses provided tsconfig path when supplied', async () => {
    const testDir = await createTestDirectory(
      'typescript-config-path-option',
      'custom-config'
    );
    await fs.mkdir(join(testDir, 'src'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'src', 'index.ts'),
      `export const value: number = 1;
`
    );

    await fs.mkdir(join(testDir, 'configs'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'configs', 'tsconfig.build.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            lib: ['ES2020'],
            skipLibCheck: true,
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            strict: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ['../src/**/*.ts'],
        },
        null,
        2
      )
    );

    const configPath = join(testDir, 'configs', 'tsconfig.build.json');
    const result = await runTypeScriptCheck(
      testDir,
      true,
      undefined,
      configPath
    );

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports a missing provided tsconfig path', async () => {
    const testDir = await createTestDirectory(
      'typescript-config-path-option',
      'missing-config'
    );
    const missingConfigPath = join(testDir, 'configs', 'missing.json');

    const result = await runTypeScriptCheck(
      testDir,
      true,
      undefined,
      missingConfigPath
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.file).toBe(missingConfigPath);
    expect(result.errors[0]?.message).toContain('tsconfig.json');
  });
});
