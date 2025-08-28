import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { spawn } from 'node:child_process';
import { createTestDirectory } from './test-utils.js';

const runCommand = (
  command: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

describe('TypeScript validation', () => {
  describe('with TypeScript errors', () => {
    it('should detect TypeScript errors after formatting', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'detect-errors'
      );

      // Create package.json
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            type: 'module',
            scripts: {
              build: 'vite build',
            },
            devDependencies: {
              vite: '>=5.0.0',
              prettier: '>=3.6.0',
              typescript: '>=5.0.0',
            },
          },
          null,
          2
        )
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(testDir, 'tsconfig.json'),
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
            include: ['src'],
          },
          null,
          2
        )
      );

      // Create vite.config.ts
      await fs.writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.js')}';

export default defineConfig({
  plugins: [
    prettierMax({
      typescript: true,
      failOnError: false,
    }),
  ],
  logLevel: 'info',
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
});
`
      );

      // Create src directory
      await fs.ensureDir(path.join(testDir, 'src'));

      // Create a TypeScript file with errors
      await fs.writeFile(
        path.join(testDir, 'src', 'index.ts'),
        `// File with TypeScript errors
const add = (a: number, b: number): number => {
  return a + b;
};

// Type error: string is not assignable to number
const result: number = add("1", "2");

// Type error: number is not assignable to string  
const message: string = add(1, 2);

export { add, result, message };
`
      );

      // Install dependencies
      await runCommand('npm', ['install'], testDir);

      // Run build
      const { stdout, stderr, code } = await runCommand(
        'npx',
        ['vite', 'build'],
        testDir
      );

      const output = stdout + stderr;

      // Check that TypeScript validation ran
      expect(output).toContain('Running TypeScript validation');

      // Check that TypeScript errors were detected
      expect(output).toContain('TypeScript validation failed');
      expect(output).toContain('error');

      // Check specific error messages
      expect(output).toContain('src/index.ts');
      expect(output).toContain('not assignable');

      // Build should continue (failOnError: false)
      expect(output).toContain('Build continuing despite TypeScript errors');
    }, 20000);

    it('should fail build when failOnError is true', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'fail-on-error'
      );

      // Create package.json
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            type: 'module',
            scripts: {
              build: 'vite build',
            },
            devDependencies: {
              vite: '>=5.0.0',
              prettier: '>=3.6.0',
              typescript: '>=5.0.0',
            },
          },
          null,
          2
        )
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(testDir, 'tsconfig.json'),
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
            include: ['src'],
          },
          null,
          2
        )
      );

      // Create vite.config.ts
      await fs.writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.js')}';

export default defineConfig({
  plugins: [
    prettierMax({
      typescript: true,
      failOnError: true,
    }),
  ],
  logLevel: 'info',
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
});
`
      );

      // Create src directory
      await fs.ensureDir(path.join(testDir, 'src'));

      // Create a TypeScript file with errors
      await fs.writeFile(
        path.join(testDir, 'src', 'index.ts'),
        `// File with TypeScript errors
const multiply = (a: number, b: number): number => {
  return a * b;
};

// Type error
const result = multiply("2", 3);

export { multiply, result };
`
      );

      // Install dependencies
      await runCommand('npm', ['install'], testDir);

      // Run build
      const { stdout, stderr, code } = await runCommand(
        'npx',
        ['vite', 'build'],
        testDir
      );

      const output = stdout + stderr;

      // Build should fail
      expect(code).not.toBe(0);

      // Check error message
      expect(output).toContain('TypeScript validation failed');
    }, 20000);

    it('should pass when no TypeScript errors', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'no-errors'
      );

      // Create package.json
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            type: 'module',
            scripts: {
              build: 'vite build',
            },
            devDependencies: {
              vite: '>=5.0.0',
              prettier: '>=3.6.0',
              typescript: '>=5.0.0',
            },
          },
          null,
          2
        )
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(testDir, 'tsconfig.json'),
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
            include: ['src'],
          },
          null,
          2
        )
      );

      // Create vite.config.ts
      await fs.writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.js')}';

export default defineConfig({
  plugins: [
    prettierMax({
      typescript: true,
      failOnError: false,
    }),
  ],
  logLevel: 'info',
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
});
`
      );

      // Create src directory
      await fs.ensureDir(path.join(testDir, 'src'));

      // Create a valid TypeScript file
      await fs.writeFile(
        path.join(testDir, 'src', 'index.ts'),
        `// Valid TypeScript code
const add = (a: number, b: number): number => {
  return a + b;
};

const result: number = add(1, 2);
const message: string = \`Result is \${result}\`;

export { add, result, message };
`
      );

      // Install dependencies
      await runCommand('npm', ['install'], testDir);

      // Run build
      const { stdout, stderr, code } = await runCommand(
        'npx',
        ['vite', 'build'],
        testDir
      );

      const output = stdout + stderr;

      // Check that TypeScript validation ran and passed
      expect(output).toContain('Running TypeScript validation');
      expect(output).toContain('TypeScript validation passed');

      // Build should succeed
      expect(code).toBe(0);
    }, 20000);

    it('should skip TypeScript validation when disabled', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'disabled'
      );

      // Create package.json
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            type: 'module',
            scripts: {
              build: 'vite build',
            },
            devDependencies: {
              vite: '>=5.0.0',
              prettier: '>=3.6.0',
              typescript: '>=5.0.0',
            },
          },
          null,
          2
        )
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(testDir, 'tsconfig.json'),
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
            include: ['src'],
          },
          null,
          2
        )
      );

      // Create vite.config.ts
      await fs.writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.js')}';

export default defineConfig({
  plugins: [
    prettierMax({
      typescript: false,
      failOnError: false,
    }),
  ],
  logLevel: 'info',
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
});
`
      );

      // Create src directory
      await fs.ensureDir(path.join(testDir, 'src'));

      // Create a TypeScript file with errors
      await fs.writeFile(
        path.join(testDir, 'src', 'index.ts'),
        `// File with TypeScript errors that should be ignored
const add = (a: number, b: number): number => {
  return a + b;
};

// Type errors that won't be checked
const result = add("1", "2");

export { add, result };
`
      );

      // Install dependencies
      await runCommand('npm', ['install'], testDir);

      // Run build
      const { stdout, stderr, code } = await runCommand(
        'npx',
        ['vite', 'build'],
        testDir
      );

      const output = stdout + stderr;

      // TypeScript validation should not run
      expect(output).not.toContain('Running TypeScript validation');
      expect(output).not.toContain('TypeScript validation passed');
      expect(output).not.toContain('TypeScript validation failed');

      // Build should succeed (TypeScript errors ignored)
      expect(code).toBe(0);
    }, 20000);
  });
});
