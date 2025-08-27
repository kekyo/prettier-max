import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIgnoreFilter,
  createTargetsFilter,
  shouldProcessFile,
} from '../src/utils.js';
import { createTestDirectory } from './test-utils.js';
import * as fs from 'fs-extra';
import * as path from 'node:path';

describe('ignore filter functionality', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDirectory('prettier-max', 'ignore-filter');
  });

  describe('createIgnoreFilter', () => {
    it('should ignore default patterns', async () => {
      const filter = await createIgnoreFilter(testDir);

      // Should ignore default patterns
      expect(
        shouldProcessFile(
          path.join(testDir, 'node_modules/foo.js'),
          filter,
          testDir
        )
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, '.git/config'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(
          path.join(testDir, 'src/node_modules/bar.js'),
          filter,
          testDir
        )
      ).toBe(false);

      // Should not ignore regular files
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, 'package.json'), filter, testDir)
      ).toBe(true);
    });

    it('should respect .prettierignore patterns', async () => {
      // Create .prettierignore file
      await fs.writeFile(
        path.join(testDir, '.prettierignore'),
        'dist\n*.min.js\n**/*.generated.ts'
      );

      const filter = await createIgnoreFilter(testDir);

      // Should ignore patterns from .prettierignore
      expect(
        shouldProcessFile(path.join(testDir, 'dist/bundle.js'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, 'app.min.js'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(
          path.join(testDir, 'src/types.generated.ts'),
          filter,
          testDir
        )
      ).toBe(false);

      // Should not ignore other files
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, 'app.js'), filter, testDir)
      ).toBe(true);
    });

    it('should respect .gitignore patterns', async () => {
      // Create .gitignore file
      await fs.writeFile(
        path.join(testDir, '.gitignore'),
        '.env\n*.log\ncoverage/'
      );

      const filter = await createIgnoreFilter(testDir);

      // Should ignore patterns from .gitignore
      expect(
        shouldProcessFile(path.join(testDir, '.env'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, 'error.log'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(
          path.join(testDir, 'coverage/index.html'),
          filter,
          testDir
        )
      ).toBe(false);

      // Should not ignore other files
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, '.env.example'), filter, testDir)
      ).toBe(true);
    });

    it('should combine .prettierignore and .gitignore patterns', async () => {
      await fs.writeFile(path.join(testDir, '.gitignore'), '*.log');

      await fs.writeFile(path.join(testDir, '.prettierignore'), 'dist/');

      const filter = await createIgnoreFilter(testDir);

      // Should ignore from both files
      expect(
        shouldProcessFile(path.join(testDir, 'error.log'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, 'dist/bundle.js'), filter, testDir)
      ).toBe(false);

      // Should not ignore other files
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
    });
  });

  describe('createTargetsFilter', () => {
    it('should include only specified patterns', () => {
      const filter = createTargetsFilter(['src/**/*.js', '*.ts']);

      // Should include matching patterns
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(
          path.join(testDir, 'src/components/App.js'),
          filter,
          testDir
        )
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, 'test.ts'), filter, testDir)
      ).toBe(true);

      // Should exclude non-matching patterns
      expect(
        shouldProcessFile(path.join(testDir, 'src/styles.css'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, 'test.js'), filter, testDir)
      ).toBe(false);
      expect(
        shouldProcessFile(path.join(testDir, 'lib/index.js'), filter, testDir)
      ).toBe(false);
    });

    it('should handle exclude patterns with !', () => {
      const filter = createTargetsFilter(['src/**/*.js', '!**/*.test.js']);

      // Should include matching patterns
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), filter, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, 'src/utils.js'), filter, testDir)
      ).toBe(true);

      // Should exclude negated patterns
      expect(
        shouldProcessFile(
          path.join(testDir, 'src/index.test.js'),
          filter,
          testDir
        )
      ).toBe(false);
      expect(
        shouldProcessFile(
          path.join(testDir, 'src/utils.test.js'),
          filter,
          testDir
        )
      ).toBe(false);
    });
  });

  describe('shouldProcessFile', () => {
    it('should exclude files outside of project root', () => {
      const filter = createTargetsFilter(['**/*.js']);

      expect(shouldProcessFile('/other/project/file.js', null, testDir)).toBe(
        false
      );
      expect(shouldProcessFile('/other/project/file.js', filter, testDir)).toBe(
        false
      );
    });

    it('should include all files when no filter is provided', () => {
      expect(
        shouldProcessFile(path.join(testDir, 'any-file.txt'), null, testDir)
      ).toBe(true);
      expect(
        shouldProcessFile(path.join(testDir, 'src/index.js'), null, testDir)
      ).toBe(true);
    });
  });
});
