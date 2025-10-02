// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

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
    const { stdout, stderr } = await runCommand(
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
    const { stdout, stderr } = await runCommand(
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

  it('should detect deprecated usage with bracket notation', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'bracket-notation'
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

    // Create a TypeScript file with bracket notation access to deprecated members
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File with bracket notation access to deprecated members

export const api = {
  /**
   * @deprecated Use newMethod instead
   */
  oldMethod: () => 'old',
  newMethod: () => 'new',
};

// Using bracket notation to access deprecated method
const methodName = 'oldMethod';
const result1 = api[methodName]();
const result2 = api['oldMethod']();

export { result1, result2 };
`
    );

    // Install dependencies
    await runCommand('npm', ['install'], testDir);

    // Run build
    const { stdout, stderr } = await runCommand(
      'npx',
      ['vite', 'build'],
      testDir
    );

    const output = stdout + stderr;

    // Check that TypeScript validation ran
    expect(output).toContain('Running TypeScript validation');

    // Check that deprecated warnings were detected
    expect(output).toContain('PMAX001');
    expect(output).toContain('oldMethod');
    expect(output).toContain('is deprecated');
  }, 20000);

  it('should detect deprecated usage in imports and exports', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'import-export'
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

    // Create module with deprecated exports
    await writeFile(
      path.join(testDir, 'src', 'utils.ts'),
      `/**
 * @deprecated Use newUtil instead
 */
export const oldUtil = () => 'old';

export const newUtil = () => 'new';

/**
 * @deprecated This class will be removed
 */
export class OldClass {
  value = 42;
}
`
    );

    // Create main file that imports deprecated symbols
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// Importing deprecated symbols
import { oldUtil, OldClass, newUtil } from './utils';

const result1 = oldUtil();
const instance = new OldClass();
const result2 = newUtil();

// Re-exporting deprecated symbols
export { oldUtil, OldClass };
export { result1, result2, instance };
`
    );

    // Install dependencies
    await runCommand('npm', ['install'], testDir);

    // Run build
    const { stdout, stderr } = await runCommand(
      'npx',
      ['vite', 'build'],
      testDir
    );

    const output = stdout + stderr;

    // Check that TypeScript validation ran
    expect(output).toContain('Running TypeScript validation');

    // Check that deprecated warnings were detected for imports
    expect(output).toContain('PMAX001');
    expect(output).toContain('oldUtil');
    expect(output).toContain('OldClass');
    expect(output).toContain('is deprecated');
  }, 20000);

  it('should detect deprecated type references', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'type-references'
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

    // Create a TypeScript file with deprecated type definitions and usage
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File with deprecated type references

/**
 * @deprecated Use NewInterface instead
 */
export interface OldInterface {
  value: number;
}

export interface NewInterface {
  value: number;
  extra: string;
}

/**
 * @deprecated Use NewType instead
 */
export type OldType = string | number;
export type NewType = string | number | boolean;

// Using deprecated types in type annotations
let x: OldInterface = { value: 42 };
let y: OldType = 'test';

function processOld(data: OldInterface): OldType {
  return data.value;
}

function processNew(data: NewInterface): NewType {
  return data.extra;
}

export { x, y, processOld, processNew };
`
    );

    // Install dependencies
    await runCommand('npm', ['install'], testDir);

    // Run build
    const { stdout, stderr } = await runCommand(
      'npx',
      ['vite', 'build'],
      testDir
    );

    const output = stdout + stderr;

    // Check that TypeScript validation ran
    expect(output).toContain('Running TypeScript validation');

    // Check that deprecated warnings were detected for type references
    expect(output).toContain('PMAX001');
    expect(output).toContain('OldInterface');
    expect(output).toContain('OldType');
    expect(output).toContain('is deprecated');
  }, 20000);

  it('should not warn about deprecated usage within deprecated functions', async () => {
    const testDir = await createTestDirectory(
      'deprecated-detection',
      'deprecated-within-deprecated'
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

    // Create a TypeScript file with deprecated functions calling other deprecated functions
    await writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `// File with deprecated functions calling other deprecated functions

/**
 * @deprecated Will be removed
 */
export function deprecatedHelper(): string {
  return 'helper';
}

/**
 * @deprecated Use newFunction instead
 */
export function oldFunction(): string {
  // Calling another deprecated function from within a deprecated function
  // This should NOT generate a warning
  return deprecatedHelper();
}

/**
 * @deprecated Legacy code
 */
export const arrowFunc = () => {
  // Deprecated arrow function calling deprecated functions
  // These should NOT generate warnings
  const result1 = oldFunction();
  const result2 = deprecatedHelper();
  return result1 + result2;
};

/**
 * @deprecated Old API
 */
export class OldAPI {
  /**
   * @deprecated Old method
   */
  oldMethod(): string {
    // Deprecated method calling deprecated functions
    // These should NOT generate warnings
    return oldFunction() + deprecatedHelper();
  }
  
  newMethod(): string {
    // Non-deprecated method calling deprecated functions
    // These SHOULD generate warnings
    return oldFunction() + deprecatedHelper();
  }
}

// Normal function calling deprecated functions
// These SHOULD generate warnings
export function normalFunction(): string {
  const api = new OldAPI();
  return oldFunction() + api.oldMethod();
}

// Top-level calls to deprecated functions
// These SHOULD generate warnings
const topLevelResult = oldFunction();

export { topLevelResult };
`
    );

    // Install dependencies
    await runCommand('npm', ['install'], testDir);

    // Run build
    const { stdout, stderr } = await runCommand(
      'npx',
      ['vite', 'build'],
      testDir
    );

    const output = stdout + stderr;

    // Check that TypeScript validation ran
    expect(output).toContain('Running TypeScript validation');

    // Check that warnings were generated
    expect(output).toContain('PMAX001');

    // Check specific warnings that should appear
    // The output shows line numbers where deprecated symbols are used
    const warningLines = output
      .split('\n')
      .filter((line) => line.includes('PMAX001'));

    // Count the number of PMAX001 occurrences
    const warningCount = warningLines.length;

    // We expect exactly 6 warnings:
    // 1. newMethod calling oldFunction (line 873)
    // 2. newMethod calling deprecatedHelper (line 873)
    // 3. normalFunction calling OldAPI constructor (line 880)
    // 4. normalFunction calling oldFunction (line 881)
    // 5. normalFunction calling oldMethod (line 881)
    // 6. Top-level call to oldFunction (line 886)

    // But NOT from deprecated functions calling other deprecated functions
    expect(warningCount).toBe(6);
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
