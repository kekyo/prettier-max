import { describe, it, expect } from 'vitest';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
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

describe('Deprecated symbol detection', () => {
  it('should detect usage of @deprecated functions', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'deprecated-functions'
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
    await mkdir(path.join(testDir, 'src'), { recursive: true });

    // Create a TypeScript file with deprecated functions
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File with deprecated functions

/**
 * @deprecated Use newFunction instead
 */
export const oldFunction = (x: number): number => {
  return x * 2;
};

/**
 * @deprecated This function will be removed in v2.0.0
 */
export const legacyFunction = (s: string): string => {
  return s.toUpperCase();
};

export const newFunction = (x: number): number => {
  return x * 3;
};

// Using deprecated functions
const result1 = oldFunction(5);
const result2 = legacyFunction('hello');
const result3 = newFunction(10);

export { result1, result2, result3 };
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

    // Check that deprecated warnings were detected
    expect(output).toContain('PMAX001');
    expect(output).toContain('oldFunction');
    expect(output).toContain('is deprecated');
    expect(output).toContain('Use newFunction instead');
    
    expect(output).toContain('legacyFunction');
    expect(output).toContain('This function will be removed in v2.0.0');

    // Build should continue (failOnError: false)
    expect(output).toContain('Build continuing despite TypeScript errors');
  }, 20000);

  it('should detect usage of @deprecated classes and methods', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'deprecated-classes'
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
    await mkdir(path.join(testDir, 'src'), { recursive: true });

    // Create a TypeScript file with deprecated classes
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File with deprecated classes and methods

/**
 * @deprecated Use NewAPI instead
 */
export class OldAPI {
  getValue(): number {
    return 42;
  }
}

export class CurrentAPI {
  /**
   * @deprecated Use getNewValue instead
   */
  getOldValue(): number {
    return 100;
  }

  getNewValue(): number {
    return 200;
  }
}

// Using deprecated class and methods
const oldApi = new OldAPI();
const value1 = oldApi.getValue();

const currentApi = new CurrentAPI();
const value2 = currentApi.getOldValue();
const value3 = currentApi.getNewValue();

export { value1, value2, value3 };
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

    // Check that deprecated warnings were detected
    expect(output).toContain('PMAX001');
    expect(output).toContain('OldAPI');
    expect(output).toContain('is deprecated');
    expect(output).toContain('Use NewAPI instead');
    
    expect(output).toContain('getOldValue');
    expect(output).toContain('Use getNewValue instead');

    // Build should continue (failOnError: false)
    expect(output).toContain('Build continuing despite TypeScript errors');
  }, 20000);

  it('should not warn about non-deprecated symbols', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'no-deprecated'
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
    await mkdir(path.join(testDir, 'src'), { recursive: true });

    // Create a TypeScript file without deprecated symbols
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File without deprecated symbols

export const normalFunction = (x: number): number => {
  return x * 2;
};

export class NormalAPI {
  getValue(): number {
    return 42;
  }
}

// Using normal functions and classes
const result = normalFunction(5);
const api = new NormalAPI();
const value = api.getValue();

export { result, value };
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
    expect(output).toContain('TypeScript validation passed');

    // Check that no deprecated warnings were detected
    expect(output).not.toContain('PMAX001');
    expect(output).not.toContain('is deprecated');

    // Build should succeed
    expect(code).toBe(0);
  }, 20000);
});