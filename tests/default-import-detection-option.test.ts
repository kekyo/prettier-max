// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker';
import { createTestDirectory } from './test-utils';

describe('Default import detection option', () => {
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
          include: ['*.ts'],
        },
        null,
        2
      )
    );
  };

  it('should not detect default import when detectDefaultImport is none (default)', async () => {
    const testDir = await createTestDirectory(
      'default-import-detection-option',
      'detect-default-none'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(join(testDir, 'foo.ts'), 'export default class Foo {}');
    await fs.writeFile(
      join(testDir, 'index.ts'),
      `import Foo from './foo';
const foo = new Foo();
export { foo };
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, false);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should allow type-only default imports when detectDefaultImport is exceptType', async () => {
    const testDir = await createTestDirectory(
      'default-import-detection-option',
      'detect-default-except-type'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(join(testDir, 'foo.ts'), 'export default class Foo {}');
    await fs.writeFile(
      join(testDir, 'value.ts'),
      `import Foo from './foo';
const foo = new Foo();
export { foo };
`
    );
    await fs.writeFile(
      join(testDir, 'type-only.ts'),
      `import type Foo from './foo';
export type FooAlias = Foo;
`
    );
    await fs.writeFile(
      join(testDir, 'reexport.ts'),
      `export { default as FooAlias } from './foo';
`
    );
    await fs.writeFile(
      join(testDir, 'export-default.ts'),
      `export default function bar() {
  return 1;
}
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(
      testDir,
      false,
      undefined,
      undefined,
      'exceptType'
    );

    const defaultErrors = result.errors.filter((e) =>
      e.message.includes('PMAX003')
    );

    expect(result.success).toBe(false);
    expect(defaultErrors.length).toBeGreaterThan(0);
    expect(defaultErrors.some((e) => e.file.endsWith('type-only.ts'))).toBe(
      false
    );
    expect(defaultErrors.some((e) => e.file.endsWith('value.ts'))).toBe(true);
    expect(defaultErrors.some((e) => e.file.endsWith('reexport.ts'))).toBe(
      true
    );
    expect(
      defaultErrors.some((e) => e.file.endsWith('export-default.ts'))
    ).toBe(true);
  });

  it('should detect type-only default imports when detectDefaultImport is all', async () => {
    const testDir = await createTestDirectory(
      'default-import-detection-option',
      'detect-default-all'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(join(testDir, 'foo.ts'), 'export default class Foo {}');
    await fs.writeFile(
      join(testDir, 'type-only.ts'),
      `import type Foo from './foo';
export type FooAlias = Foo;
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(
      testDir,
      false,
      undefined,
      undefined,
      'all'
    );

    const defaultErrors = result.errors.filter((e) =>
      e.message.includes('PMAX003')
    );

    expect(result.success).toBe(false);
    expect(defaultErrors.some((e) => e.file.endsWith('type-only.ts'))).toBe(
      true
    );
  });
});
