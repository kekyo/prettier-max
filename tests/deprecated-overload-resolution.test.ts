// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker';
import { createTestDirectory } from './test-utils';

describe('Deprecated overload resolution', () => {
  const createTsConfigFile = async (testDir: string): Promise<void> => {
    await fs.writeFile(
      join(testDir, 'tsconfig.json'),
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
          include: ['*.ts', '*.d.ts'],
        },
        null,
        2
      )
    );
  };

  it('should only warn for the deprecated overload selected by the call', async () => {
    const testDir = await createTestDirectory(
      'deprecated-overload-resolution',
      'selected-overload-only'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'api.d.ts'),
      `export interface ExampleApi {
  description(str: string): this;
  /**
   * @deprecated Use the single-argument overload instead
   */
  description(str: string, argsDescription: Record<string, string>): this;

  option(
    flags: string,
    description?: string,
    defaultValue?: string | boolean | string[],
  ): this;
  /**
   * @deprecated Use choices or a custom function instead
   */
  option(
    flags: string,
    description: string,
    regexp: RegExp,
    defaultValue?: string | boolean | string[],
  ): this;
}

export const api: ExampleApi;
`
    );

    await fs.writeFile(
      join(testDir, 'test.ts'),
      `import { api } from './api';

api.description('safe');
api.description('deprecated', { sourceDir: 'Source directory to convert' });

api.option('--safe', 'Safe option', 'value');
api.option('--deprecated', 'Deprecated option', /value/);
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const deprecationErrors = result.errors.filter((error) =>
      error.message.includes('PMAX001')
    );

    expect(deprecationErrors).toHaveLength(2);
    expect(deprecationErrors.some((error) => error.line === 4)).toBe(true);
    expect(deprecationErrors.some((error) => error.line === 7)).toBe(true);
    expect(
      deprecationErrors.some(
        (error) =>
          error.message.includes("'description' is deprecated") &&
          error.message.includes('single-argument overload')
      )
    ).toBe(true);
    expect(
      deprecationErrors.some(
        (error) =>
          error.message.includes("'option' is deprecated") &&
          error.message.includes('custom function instead')
      )
    ).toBe(true);
  });
});
