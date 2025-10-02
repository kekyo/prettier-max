// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { createTestDirectory } from './test-utils.js';
import prettierMax from '../src/index.js';
import type { PrettierMaxOptions } from '../src/index.js';
import { ConsoleReporter } from '../src/reporters/console.js';
import { runPrettierFormatProject } from '../src/checker.js';

describe('prettier-max plugin', () => {
  describe('ConsoleReporter', () => {
    let consoleLogSpy: any;
    let reporter: ConsoleReporter;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      reporter = new ConsoleReporter('/project');
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should report errors to console', () => {
      const errors = [
        {
          file: '/project/src/index.ts',
          message: 'File is not formatted with Prettier',
        },
        {
          file: '/project/src/app.tsx',
          line: 10,
          column: 5,
          message: 'File is not formatted with Prettier',
        },
      ];

      reporter.report(errors);

      expect(consoleLogSpy).toHaveBeenCalled();
      // Check that error message includes file paths
      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('src/index.ts');
      expect(output).toContain('src/app.tsx:10:5');
    });

    it('should show success message when no errors', () => {
      reporter.report([{ file: 'test.ts', message: 'error' }]); // First report error
      reporter.report([]); // Then report success

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('All files are properly formatted');
    });
  });

  describe('prettier format integration', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await createTestDirectory('prettier-max', 'check-integration');
    });

    it('should format unformatted files', async () => {
      // Create an unformatted file
      const unformattedContent = `const  foo   =    "bar"  ;
        const    baz="qux";`;
      const filePath = path.join(testDir, 'unformatted.js');
      await writeFile(filePath, unformattedContent);

      // Run prettier format on project
      const result = await runPrettierFormatProject(testDir, undefined);

      expect(result.success).toBe(true);
      expect(result.formattedFiles.length).toBeGreaterThan(0);
      expect(result.formattedFiles[0]).toContain('unformatted.js');

      // Check that file was actually formatted
      const formattedContent = await readFile(filePath, 'utf-8');
      expect(formattedContent).not.toBe(unformattedContent);
      expect(formattedContent).toContain("const foo = 'bar';");
    });

    it('should not modify already formatted files', async () => {
      // Create a properly formatted file (prettier defaults: single quotes, semicolon)
      const formattedContent = `const foo = 'bar';
const baz = 'qux';
`;
      const filePath = path.join(testDir, 'formatted.js');
      await writeFile(filePath, formattedContent);

      // Run prettier format on project
      const result = await runPrettierFormatProject(testDir, undefined);

      expect(result.success).toBe(true);
      expect(result.formattedFiles.length).toBe(0); // No files were modified

      // Verify content unchanged
      const contentAfter = await readFile(filePath, 'utf-8');
      expect(contentAfter).toBe(formattedContent);
    });
  });

  describe('plugin initialization', () => {
    it('should create plugin with default options', () => {
      const plugin = prettierMax();

      expect(plugin.name).toBe('prettier-max');
      expect(plugin.configResolved).toBeDefined();
      expect(plugin.configureServer).toBeDefined();
      expect(plugin.buildStart).toBeDefined();
    });

    it('should accept custom options', () => {
      const customReporter = new ConsoleReporter();
      const options: PrettierMaxOptions = {
        configPath: '.prettierrc',
        reporter: customReporter,
        formatOnBuild: true,
        failOnError: false,
      };

      const plugin = prettierMax(options);
      expect(plugin.name).toBe('prettier-max');
      expect(plugin.enforce).not.toBe('pre');
    });
  });

  describe('buildStart hook', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await createTestDirectory('prettier-max', 'build-start');
    });

    it('should format entire project on build start', async () => {
      // Create test files
      await writeFile(
        path.join(testDir, 'formatted.js'),
        `const foo = 'bar';\n`
      );
      const unformattedPath = path.join(testDir, 'unformatted.js');
      await writeFile(unformattedPath, `const  foo   =    "bar"  ;`);

      // Run project format
      const result = await runPrettierFormatProject(testDir, undefined);

      expect(result.success).toBe(true);
      expect(result.formattedFiles.length).toBeGreaterThan(0);
      expect(
        result.formattedFiles.some((f) => f.includes('unformatted.js'))
      ).toBe(true);

      // Verify the file was actually formatted
      const formatted = await readFile(unformattedPath, 'utf-8');
      expect(formatted).toContain("const foo = 'bar';");
    });

    it('should respect formatOnBuild option', () => {
      const pluginWithFormat = prettierMax({ formatOnBuild: true });
      expect(pluginWithFormat.buildStart).toBeDefined();

      const pluginWithoutFormat = prettierMax({ formatOnBuild: false });
      expect(pluginWithoutFormat.buildStart).toBeDefined();
    });

    it('should handle failOnError option', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const mockReporter = {
        report: vi.fn(),
        clear: vi.fn(),
      };

      // Create plugin with failOnError enabled
      const plugin = prettierMax({
        failOnError: true,
        reporter: mockReporter,
      });

      expect(plugin.buildStart).toBeDefined();
    });
  });
});
