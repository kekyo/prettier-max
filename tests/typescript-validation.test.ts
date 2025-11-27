// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { describe, it, expect } from 'vitest';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { createTestDirectory } from './test-utils';

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
      await writeFile(
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
      await writeFile(
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
      await writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.mjs')}';

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
      await mkdir(path.join(testDir, 'src'), { recursive: true });

      // Create a TypeScript file with errors
      await writeFile(
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

      // Check that TS error codes are included
      expect(output).toContain('TS2345'); // Type error code for argument type mismatch
      expect(output).toContain('TS2322'); // Type error code for type assignment mismatch

      // Build should continue (failOnError: false)
      expect(output).toContain('Build continuing despite TypeScript errors');
      expect(code).toBe(0);
    }, 20000);

    it('should fail build when failOnError is true', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'fail-on-error'
      );

      // Create package.json
      await writeFile(
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
      await writeFile(
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
      await writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.mjs')}';

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
      await mkdir(path.join(testDir, 'src'), { recursive: true });

      // Create a TypeScript file with errors
      await writeFile(
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

      // Check that TS error code is included
      expect(output).toContain('TS2345'); // Type error code for argument type mismatch
    }, 20000);

    it('should pass when no TypeScript errors', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'no-errors'
      );

      // Create package.json
      await writeFile(
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
      await writeFile(
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
      await writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.mjs')}';

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
      await mkdir(path.join(testDir, 'src'), { recursive: true });

      // Create a valid TypeScript file
      await writeFile(
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
      await writeFile(
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
      await writeFile(
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
      await writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.mjs')}';

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
      await mkdir(path.join(testDir, 'src'), { recursive: true });

      // Create a TypeScript file with errors
      await writeFile(
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

    it('should preserve TypeScript error codes in output', async () => {
      const testDir = await createTestDirectory(
        'typescript-validation',
        'preserve-error-codes'
      );

      // Create package.json
      await writeFile(
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
      await writeFile(
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
      await writeFile(
        path.join(testDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';
import prettierMax from '${path.join(process.cwd(), 'dist', 'index.mjs')}';

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
      await mkdir(path.join(testDir, 'src'), { recursive: true });

      // Create a TypeScript file with various types of errors
      await writeFile(
        path.join(testDir, 'src', 'index.ts'),
        `// File with various TypeScript errors to test error code preservation

// TS2304: Cannot find name
const undefinedVar = nonExistentVariable;

// TS2345: Argument type mismatch
const add = (a: number, b: number): number => a + b;
const result1 = add("string", 123);

// TS2322: Type assignment mismatch
const numberVar: number = "not a number";

// TS2339: Property does not exist
const obj = { prop1: "value" };
const value = obj.nonExistentProperty;

// TS2554: Expected arguments mismatch
const func = (a: number, b: number) => a + b;
const result2 = func(1);

// TS2551: Property name misspelling (did you mean...?)
const config = { enabled: true };
const isOn = config.enable; // Should suggest 'enabled'

export { undefinedVar, result1, numberVar, value, result2, isOn };
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
      expect(output).toContain('TypeScript validation failed');

      // Check that all expected TS error codes are preserved in the output
      expect(output).toContain('TS2304'); // Cannot find name
      expect(output).toContain('TS2345'); // Argument type mismatch
      expect(output).toContain('TS2322'); // Type assignment mismatch
      expect(output).toContain('TS2339'); // Property does not exist
      expect(output).toContain('TS2554'); // Expected arguments mismatch
      expect(output).toContain('TS2551'); // Property name misspelling

      // Check that error messages are in the expected format (TS####: message)
      expect(output).toMatch(/TS2304:.*Cannot find name/);
      expect(output).toMatch(/TS2345:.*not assignable to parameter/);
      expect(output).toMatch(/TS2322:.*not assignable to type/);
      expect(output).toMatch(/TS2339:.*does not exist on type/);
      expect(output).toMatch(/TS2554:.*Expected \d+ arguments/);
      expect(output).toMatch(/TS2551:.*Did you mean/);
      expect(code).toBe(0);
    }, 20000);
  });
});
