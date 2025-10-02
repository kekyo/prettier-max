// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker.js';
import { createTestDirectory } from './test-utils.js';

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

describe('Deprecated re-export handling', () => {
  it('warns for re-exporting deprecated symbol without export JSDoc', async () => {
    const testDir = await createTestDirectory(
      'deprecated-export',
      'reexport-warn'
    );
    await fs.mkdir(testDir, { recursive: true });

    // Source module with deprecated export
    await fs.writeFile(
      join(testDir, 'foobar.ts'),
      `/**\n * @deprecated Will be removed\n */\nexport const foobar = 1;\n`
    );

    // Re-export without JSDoc on the export declaration
    await fs.writeFile(
      join(testDir, 'index.ts'),
      `export { foobar } from './foobar';\n`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const pmax001 = result.errors.filter((e) => e.message.includes('PMAX001'));
    expect(pmax001.length).toBe(1);
    expect(pmax001[0].message).toContain('foobar');
  });

  it('suppresses warning when export declaration has @deprecated JSDoc', async () => {
    const testDir = await createTestDirectory(
      'deprecated-export',
      'reexport-jsdoc-suppress'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'foobar.ts'),
      `/**\n * @deprecated Will be removed\n */\nexport const foobar = 1;\n`
    );

    // JSDoc @deprecated attached to export declaration should suppress re-export warning
    await fs.writeFile(
      join(testDir, 'index.ts'),
      `/**\n * @deprecated Will be handled later\n */\nexport { foobar } from './foobar';\n`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    expect(
      result.errors.filter((e) => e.message.includes('PMAX001')).length
    ).toBe(0);
    expect(result.success).toBe(true);
  });

  it('suppresses warning with @prettier-max-ignore-deprecated before export', async () => {
    const testDir = await createTestDirectory(
      'deprecated-export',
      'reexport-directive-suppress'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'foobar.ts'),
      `/**\n * @deprecated Will be removed\n */\nexport const foobar = 1;\n`
    );

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `// @prettier-max-ignore-deprecated: Temporarily allow this export\nexport { foobar } from './foobar';\n`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const pmax001 = result.errors.filter((e) => e.message.includes('PMAX001'));
    const pmax002 = result.errors.filter((e) => e.message.includes('PMAX002'));
    // Should be fully suppressed without PMAX002 because the next line uses a deprecated symbol
    expect(pmax001.length).toBe(0);
    expect(pmax002.length).toBe(0);
    expect(result.success).toBe(true);
  });
});
