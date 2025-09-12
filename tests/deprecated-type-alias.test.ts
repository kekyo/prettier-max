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

describe('Deprecated detection within type alias declarations', () => {
  it('warns when export type alias uses deprecated type', async () => {
    const testDir = await createTestDirectory('deprecated-type-alias', 'warn');
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'types.ts'),
      `/**\n * @deprecated Use NewType\n */\nexport type OldType = string;\n`
    );

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `export type Foo = import('./types').OldType;\n`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const pmax001 = result.errors.filter((e) => e.message.includes('PMAX001'));
    expect(pmax001.length).toBe(1);
    expect(pmax001[0].message).toContain('OldType');
  });

  it('does not warn inside deprecated export type alias', async () => {
    const testDir = await createTestDirectory(
      'deprecated-type-alias',
      'suppress'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'types.ts'),
      `/**\n * @deprecated Use NewType\n */\nexport type OldType = string;\n`
    );

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `/**\n * @deprecated Alias to be removed later\n */\nexport type Foo = import('./types').OldType;\n`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    // Should be suppressed because the type alias itself is deprecated
    expect(
      result.errors.filter((e) => e.message.includes('PMAX001')).length
    ).toBe(0);
    expect(result.success).toBe(true);
  });
});
