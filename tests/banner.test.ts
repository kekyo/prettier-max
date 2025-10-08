// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { createTestDirectory } from './test-utils';
import { applyBanner } from '../src/banner';

const makeLogger = () => ({
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
});

const ensureDir = async (target: string) => {
  await mkdir(target, { recursive: true });
};

describe('applyBanner', () => {
  it('inserts banner into simple file', async () => {
    const rootDir = await createTestDirectory('banner', 'insert');
    const banner = `// Banner line\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const sourcePath = join(rootDir, 'index.ts');
    await writeFile(sourcePath, 'export const value = 1;\n');

    const summary = await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(sourcePath, 'utf8');

    expect(summary?.inserted).toBe(1);
    expect(summary?.replaced).toBe(0);
    expect(content.startsWith('// Banner line\n\n')).toBe(true);
  });

  it('respects shebang line', async () => {
    const rootDir = await createTestDirectory('banner', 'shebang');
    const banner = `// Copyright\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const sourcePath = join(rootDir, 'script.ts');
    await writeFile(sourcePath, '#!/usr/bin/env node\nconsole.log("ok");\n');

    await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(sourcePath, 'utf8');

    expect(content.startsWith('#!/usr/bin/env node\n// Copyright\n\n')).toBe(
      true
    );
  });

  it('replaces existing banner with new content', async () => {
    const rootDir = await createTestDirectory('banner', 'replace');
    const oldBanner = `// Old banner\n\n`;
    const newBanner = `// New banner\n`;
    await writeFile(join(rootDir, '.prettierbanner'), newBanner);
    const sourcePath = join(rootDir, 'component.ts');
    await writeFile(
      sourcePath,
      `${oldBanner}export const Comp = () => null;\n`
    );

    const summary = await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(sourcePath, 'utf8');

    expect(summary?.replaced).toBe(1);
    expect(summary?.inserted).toBe(0);
    expect(content.startsWith('// New banner\n\n')).toBe(true);
    expect(content.includes('Old banner')).toBe(false);
  });

  it('does not duplicate when banner already present', async () => {
    const rootDir = await createTestDirectory('banner', 'no-duplicate');
    const banner = `// Stable banner\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const sourcePath = join(rootDir, 'stable.ts');
    await writeFile(
      sourcePath,
      `// Stable banner\n\nexport const stable = true;\n`
    );

    const summary = await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(sourcePath, 'utf8');

    expect(summary?.inserted).toBe(0);
    expect(summary?.replaced).toBe(0);
    expect(content).toBe('// Stable banner\n\nexport const stable = true;\n');
  });

  it('skips files listed in .prettierignore', async () => {
    const rootDir = await createTestDirectory('banner', 'ignore');
    const banner = `// Ignore check\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    await writeFile(join(rootDir, '.prettierignore'), 'ignored.ts\n');
    const ignored = join(rootDir, 'ignored.ts');
    await writeFile(ignored, 'export const ignored = true;\n');

    const summary = await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(ignored, 'utf8');

    expect(summary?.total).toBe(0);
    expect(summary?.inserted).toBe(0);
    expect(summary?.replaced).toBe(0);
    expect(content).toBe('export const ignored = true;\n');
  });

  it('filters by configured extensions', async () => {
    const rootDir = await createTestDirectory('banner', 'extensions');
    const banner = `// Mixed banner\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const jsPath = join(rootDir, 'index.js');
    const tsPath = join(rootDir, 'index.ts');
    await writeFile(jsPath, 'console.log("js");\n');
    await writeFile(tsPath, 'console.log("ts");\n');

    await applyBanner({
      rootDir,
      logger: makeLogger(),
      extensions: ['.js'],
    });

    const jsContent = await readFile(jsPath, 'utf8');
    const tsContent = await readFile(tsPath, 'utf8');

    expect(jsContent.startsWith('// Mixed banner\n\n')).toBe(true);
    expect(tsContent.startsWith('console.log("ts");')).toBe(true);
  });

  it('preserves CRLF banner formatting', async () => {
    const rootDir = await createTestDirectory('banner', 'crlf');
    const banner = `// Windows banner\r\n\r\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const sourcePath = join(rootDir, 'win.ts');
    await writeFile(sourcePath, 'export {};\r\n');

    await applyBanner({ rootDir, logger: makeLogger() });
    const content = await readFile(sourcePath, 'utf8');

    expect(content.startsWith('// Windows banner\r\n\r\n')).toBe(true);
  });

  it('throws on banners exceeding line limit', async () => {
    const rootDir = await createTestDirectory('banner', 'exceed');
    const manyLines = Array.from({ length: 21 }, (_, i) => `// ${i}`).join(
      '\n'
    );
    await writeFile(join(rootDir, '.prettierbanner'), manyLines);
    const sourcePath = join(rootDir, 'overflow.ts');
    await writeFile(sourcePath, 'export const overflow = 1;\n');

    await expect(
      applyBanner({ rootDir, logger: makeLogger() })
    ).rejects.toThrow(/must not exceed 20 lines/);

    const content = await readFile(sourcePath, 'utf8');
    expect(content.startsWith('export const overflow = 1;')).toBe(true);
  });

  it('ignores files inside skipped directories', async () => {
    const rootDir = await createTestDirectory('banner', 'skip-dirs');
    const banner = `// Skip directories\n`;
    await writeFile(join(rootDir, '.prettierbanner'), banner);
    const nodeModulesDir = join(rootDir, 'node_modules', 'pkg');
    await ensureDir(nodeModulesDir);
    const nmPath = join(nodeModulesDir, 'mod.ts');
    await writeFile(nmPath, 'export const inside = true;\n');
    const normalPath = join(rootDir, 'main.ts');
    await writeFile(normalPath, 'export const outside = true;\n');

    await applyBanner({ rootDir, logger: makeLogger() });

    const nmContent = await readFile(nmPath, 'utf8');
    const normalContent = await readFile(normalPath, 'utf8');

    expect(nmContent.startsWith('export const inside = true;')).toBe(true);
    expect(normalContent.startsWith('// Skip directories\n\n')).toBe(true);
  });
});
