// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { createTestDirectory } from './test-utils.js';
import { generatePrettierConfigFiles } from '../src/configGenerator.js';
import { createConsoleLogger } from '../src/logger.js';
import {
  prettierrcTemplate,
  prettierignoreTemplate,
} from '../src/templates.js';

describe('prettier config generation', () => {
  const logger = createConsoleLogger('test');
  it('should generate .prettierrc file when it does not exist', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-prettierrc'
    );
    const prettierrcPath = path.join(testDir, '.prettierrc');

    // Ensure file doesn't exist
    expect(existsSync(prettierrcPath)).toBe(false);

    // Generate config files
    await generatePrettierConfigFiles(testDir, logger);

    // Check file was created
    expect(existsSync(prettierrcPath)).toBe(true);

    // Verify content
    const content = await readFile(prettierrcPath, 'utf-8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent).toEqual(prettierrcTemplate);
  });

  it('should generate .prettierignore file when it does not exist', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-prettierignore'
    );
    const prettierignorePath = path.join(testDir, '.prettierignore');

    // Ensure file doesn't exist
    expect(existsSync(prettierignorePath)).toBe(false);

    // Generate config files
    await generatePrettierConfigFiles(testDir, logger);

    // Check file was created
    expect(existsSync(prettierignorePath)).toBe(true);

    // Verify content
    const content = await readFile(prettierignorePath, 'utf-8');
    expect(content).toBe(prettierignoreTemplate);
  });

  it('should not overwrite existing .prettierrc file', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-no-overwrite-rc'
    );
    const prettierrcPath = path.join(testDir, '.prettierrc');
    const existingContent = '{"printWidth": 120, "useTabs": true}';

    // Create existing file
    await writeFile(prettierrcPath, existingContent, 'utf-8');

    // Generate config files
    await generatePrettierConfigFiles(testDir, logger);

    // Verify file was not overwritten
    const content = await readFile(prettierrcPath, 'utf-8');
    expect(content).toBe(existingContent);
  });

  it('should not overwrite existing .prettierignore file', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-no-overwrite-ignore'
    );
    const prettierignorePath = path.join(testDir, '.prettierignore');
    const existingContent = '# Custom ignore\ncustom-folder/\n*.custom';

    // Create existing file
    await writeFile(prettierignorePath, existingContent, 'utf-8');

    // Generate config files
    await generatePrettierConfigFiles(testDir, logger);

    // Verify file was not overwritten
    const content = await readFile(prettierignorePath, 'utf-8');
    expect(content).toBe(existingContent);
  });

  it('should generate both files when neither exists', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-both'
    );
    const prettierrcPath = path.join(testDir, '.prettierrc');
    const prettierignorePath = path.join(testDir, '.prettierignore');

    // Ensure files don't exist
    expect(existsSync(prettierrcPath)).toBe(false);
    expect(existsSync(prettierignorePath)).toBe(false);

    // Generate config files
    await generatePrettierConfigFiles(testDir, logger);

    // Check both files were created
    expect(existsSync(prettierrcPath)).toBe(true);
    expect(existsSync(prettierignorePath)).toBe(true);
  });

  it('should handle errors gracefully when unable to write files', async () => {
    const testDir = await createTestDirectory(
      'prettier-max',
      'config-generation-error'
    );
    // Create a directory where .prettierrc would be (to cause write error)
    const prettierrcPath = path.join(testDir, '.prettierrc');
    await mkdir(prettierrcPath);

    // Should not throw, just log warning
    await expect(
      generatePrettierConfigFiles(testDir, logger)
    ).resolves.toBeUndefined();

    // Directory should still exist (not replaced by file)
    const s = await stat(prettierrcPath);
    expect(s.isDirectory()).toBe(true);
  });
});
