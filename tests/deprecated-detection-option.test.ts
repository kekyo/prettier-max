import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker.js';
import { createTestDirectory } from './test-utils.js';

describe('Deprecated detection option', () => {
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

  it('should not detect deprecated usage when detectDeprecated is false', async () => {
    const testDir = await createTestDirectory('deprecated-detection-option', 'detect-deprecated-false');
    await fs.mkdir(testDir, { recursive: true });

    // Create a file with deprecated usage
    const testFile = join(testDir, 'deprecated-test.ts');
    await fs.writeFile(
      testFile,
      `
/**
 * @deprecated Use newFunction instead
 */
export function oldFunction(): void {
  console.log('Old implementation');
}

export function normalFunction(): void {
  oldFunction(); // This should NOT trigger warning when detectDeprecated is false
}

// Also test with arrow functions
/**
 * @deprecated Legacy implementation
 */
export const oldArrowFunc = () => 'old';

export const useOldArrow = () => oldArrowFunc();
`
    );

    await createTsConfigFile(testDir);
    
    // Run check with detectDeprecated set to false
    const result = await runTypeScriptCheck(testDir, false);
    
    // Should have no errors when detectDeprecated is false
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect deprecated usage when detectDeprecated is true (default)', async () => {
    const testDir = await createTestDirectory('deprecated-detection-option', 'detect-deprecated-true');
    await fs.mkdir(testDir, { recursive: true });

    // Create a file with deprecated usage
    const testFile = join(testDir, 'deprecated-test.ts');
    await fs.writeFile(
      testFile,
      `
/**
 * @deprecated Use newFunction instead
 */
export function oldFunction(): void {
  console.log('Old implementation');
}

export function normalFunction(): void {
  oldFunction(); // This SHOULD trigger warning when detectDeprecated is true
}

// Also test with arrow functions
/**
 * @deprecated Legacy implementation
 */
export const oldArrowFunc = () => 'old';

export const useOldArrow = () => oldArrowFunc();
`
    );

    await createTsConfigFile(testDir);
    
    // Run check with detectDeprecated set to true (default)
    const result = await runTypeScriptCheck(testDir, true);
    
    // Should have deprecation warnings
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Check for specific error messages
    const deprecationErrors = result.errors.filter(e => e.message.includes('PMAX001'));
    expect(deprecationErrors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('oldFunction'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('deprecated'))).toBe(true);
  });

  it('should use default value (true) when detectDeprecated is not specified', async () => {
    const testDir = await createTestDirectory('deprecated-detection-option', 'detect-deprecated-default');
    await fs.mkdir(testDir, { recursive: true });

    // Create a file with deprecated usage
    const testFile = join(testDir, 'deprecated-test.ts');
    await fs.writeFile(
      testFile,
      `
/**
 * @deprecated This is old
 */
export interface OldInterface {
  value: number;
}

export const useOldInterface = (data: OldInterface) => data.value;
`
    );

    await createTsConfigFile(testDir);
    
    // Run check without specifying detectDeprecated (should use default: true)
    const result = await runTypeScriptCheck(testDir);
    
    // Should have deprecation warning by default
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('PMAX001'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('OldInterface'))).toBe(true);
  });

  it('should have better performance with detectDeprecated false on large codebases', async () => {
    const testDir = await createTestDirectory('deprecated-detection-option', 'performance-test');
    await fs.mkdir(testDir, { recursive: true });

    // Create multiple files with deprecated symbols to simulate a larger codebase
    for (let i = 0; i < 5; i++) {
      const testFile = join(testDir, `module${i}.ts`);
      await fs.writeFile(
        testFile,
        `
/**
 * @deprecated Old module ${i}
 */
export class OldClass${i} {
  value = ${i};
}

export function useOldClass${i}() {
  return new OldClass${i}();
}

/**
 * @deprecated Legacy function ${i}
 */
export function legacyFunc${i}() {
  return ${i};
}

// Multiple usages of deprecated items
export const test${i}_1 = legacyFunc${i}();
export const test${i}_2 = new OldClass${i}();
export const test${i}_3 = useOldClass${i}();
`
      );
    }

    await createTsConfigFile(testDir);
    
    // Measure time with detectDeprecated false
    const startTimeFalse = Date.now();
    const resultFalse = await runTypeScriptCheck(testDir, false);
    const durationFalse = Date.now() - startTimeFalse;
    
    // Measure time with detectDeprecated true
    const startTimeTrue = Date.now();
    const resultTrue = await runTypeScriptCheck(testDir, true);
    const durationTrue = Date.now() - startTimeTrue;
    
    // With detectDeprecated false, should have no errors
    expect(resultFalse.success).toBe(true);
    expect(resultFalse.errors).toHaveLength(0);
    
    // With detectDeprecated true, should have many deprecation warnings
    expect(resultTrue.success).toBe(false);
    expect(resultTrue.errors.length).toBeGreaterThan(0);
    
    // Performance note: detectDeprecated=false should typically be faster
    // due to skipping TypeChecker creation and AST traversal
    // However, we can't reliably assert timing in tests due to system variability
    console.log(`Performance comparison:
      detectDeprecated=false: ${durationFalse}ms
      detectDeprecated=true: ${durationTrue}ms`);
  });
});