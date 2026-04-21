// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker';
import { createTestDirectory } from './test-utils';

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
    const first = pmax001[0];
    expect(first).toBeDefined();
    expect(first?.message).toContain('OldType');
  });

  it('does not warn when union type alias includes deprecated compatibility branch', async () => {
    const testDir = await createTestDirectory(
      'deprecated-type-alias',
      'union-compatibility'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `/**
 * @deprecated Use ActiveSender instead.
 */
export type LegacySender = (value: string) => string;

export interface ActiveSender {
  readonly send: (value: string) => string;
}

export interface Tagged {
  readonly tag: string;
}

export type Sender = LegacySender | ActiveSender;
export type ComplexSender = LegacySender | (ActiveSender & Tagged);
export type FallbackSender = (LegacySender & Tagged) | ActiveSender;
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    expect(
      result.errors.filter((e) => e.message.includes('PMAX001')).length
    ).toBe(0);
    expect(result.success).toBe(true);
  });

  it('warns when intersection type alias requires deprecated type', async () => {
    const testDir = await createTestDirectory(
      'deprecated-type-alias',
      'intersection-required'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `/**
 * @deprecated Use ActiveSender instead.
 */
export interface LegacySender {
  readonly legacy: string;
}

export interface ActiveSender {
  readonly active: string;
}

export type Sender = LegacySender & ActiveSender;
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const pmax001 = result.errors.filter((e) => e.message.includes('PMAX001'));
    expect(pmax001.length).toBe(1);
    expect(pmax001[0]?.message).toContain('LegacySender');
  });

  it('warns when expression selects only deprecated union branch', async () => {
    const testDir = await createTestDirectory(
      'deprecated-type-alias',
      'union-selection'
    );
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(
      join(testDir, 'index.ts'),
      `/**
 * @deprecated Use ActiveSender instead.
 */
export type LegacySender = (value: string) => string;

export interface ActiveSender {
  readonly send: (value: string) => string;
}

export type Sender = LegacySender | ActiveSender;

const legacySender: Sender = (value) => value;
const activeSender: Sender = { send: (value) => value };

declare const useSender: (sender: Sender) => void;

useSender((value) => value);
useSender({ send: (value) => value });

export { activeSender, legacySender };
`
    );

    await createTsConfigFile(testDir);

    const result = await runTypeScriptCheck(testDir, true);
    const pmax001 = result.errors.filter((e) => e.message.includes('PMAX001'));
    expect(pmax001.length).toBe(2);
    expect(pmax001.every((e) => e.message.includes('LegacySender'))).toBe(true);
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
