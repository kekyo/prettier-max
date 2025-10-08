// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, access, readFile } from 'fs/promises';
import * as path from 'path';
import { constants as fsConstants } from 'fs';

import { createTestDirectory } from './test-utils';
import { runPrettierFormatProject, getPrettierVersion } from '../src/checker';

const createWorkspacePrettierStub = async (
  workspaceRoot: string,
  markerFileName: string,
  version: string
): Promise<void> => {
  const packageDir = path.join(workspaceRoot, 'node_modules', 'prettier');
  const binDir = path.join(packageDir, 'bin');
  await mkdir(binDir, { recursive: true });

  const packageJson = {
    name: 'prettier',
    version,
    bin: {
      prettier: 'bin/prettier.cjs',
    },
  };

  await writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf-8'
  );

  const script =
    `#!/usr/bin/env node\n` +
    `const fs = require('fs');\n` +
    `const path = require('path');\n` +
    `const args = process.argv.slice(2);\n` +
    `if (args.includes('--version')) {\n` +
    `  console.log('${version}');\n` +
    `  process.exit(0);\n` +
    `}\n` +
    `const markerPath = path.join(process.cwd(), '${markerFileName}');\n` +
    `fs.writeFileSync(markerPath, 'workspace-prettier-invoked');\n` +
    `process.exit(0);\n`;

  await writeFile(path.join(binDir, 'prettier.cjs'), script, 'utf-8');
};

describe('Prettier resolution', () => {
  it('prefers workspace parent Prettier when available', async () => {
    const workspaceRoot = await createTestDirectory(
      'prettier-max',
      'workspace-resolution'
    );
    const childProject = path.join(workspaceRoot, 'packages', 'child');
    await mkdir(childProject, { recursive: true });

    const markerFileName = 'workspace-prettier-used.txt';
    const stubVersion = '9.9.9-workspace';
    await createWorkspacePrettierStub(
      workspaceRoot,
      markerFileName,
      stubVersion
    );

    const resolvedVersion = await getPrettierVersion(childProject);
    expect(resolvedVersion).toBe(stubVersion);

    const result = await runPrettierFormatProject(childProject, undefined);
    expect(result.success).toBe(true);

    await expect(
      access(path.join(childProject, markerFileName), fsConstants.F_OK)
    ).resolves.toBeUndefined();
  });

  it('falls back to bundled Prettier when workspace copy is absent', async () => {
    const isolatedRoot = await createTestDirectory(
      'prettier-max',
      'bundled-resolution'
    );

    const bundledPackageJsonPath = require.resolve('prettier/package.json');
    const bundledPackageJson = JSON.parse(
      await readFile(bundledPackageJsonPath, 'utf-8')
    ) as { version: string };

    const resolvedVersion = await getPrettierVersion(isolatedRoot);
    expect(resolvedVersion).toBe(bundledPackageJson.version);
  });
});
