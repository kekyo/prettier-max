import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTypeScriptCheck } from '../src/checker.js';
import { createTestDirectory } from './test-utils.js';
import { createConsoleLogger } from '../src/logger.js';

describe('Deprecated detection suppression directive', () => {
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

  it('should suppress deprecated warning with @prettier-max-ignore-deprecated directive', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'suppress-warning');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
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
  // @prettier-max-ignore-deprecated: Migration in progress
  oldFunction(); // This should NOT trigger warning
  
  // This should trigger warning (no suppression)
  oldFunction();
}
`
    );

    await createTsConfigFile(testDir);
    
    // Create a mock logger to capture debug messages
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    
    const result = await runTypeScriptCheck(testDir, true, mockLogger);
    
    // Should have one warning (the unsuppressed one)
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('PMAX001');
    expect(result.errors[0].line).toBe(14); // Line with unsuppressed usage
    
    // Check that debug log was called for suppression
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Found suppression directive')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Suppressed deprecated warning')
    );
  });

  it('should work with directive without note', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'suppress-without-note');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `/**
 * @deprecated Old API
 */
function oldAPI() {
  return 'old';
}

function test() {
  // @prettier-max-ignore-deprecated
  oldAPI(); // This should NOT trigger warning
}
`
    );

    await createTsConfigFile(testDir);
    
    const result = await runTypeScriptCheck(testDir, true);
    
    // Should have no errors
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report PMAX002 for unused suppression directive', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'unused-directive');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `
export function newFunction(): void {
  console.log('New implementation');
}

export function normalFunction(): void {
  // @prettier-max-ignore-deprecated: This is unnecessary
  newFunction(); // This is NOT deprecated, so directive is unused
}
`
    );

    await createTsConfigFile(testDir);
    
    const result = await runTypeScriptCheck(testDir, true);
    
    // Should have one PMAX002 error
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('PMAX002');
    expect(result.errors[0].message).toContain('Unnecessary @prettier-max-ignore-deprecated directive');
    expect(result.errors[0].line).toBe(7); // Line with the directive
  });

  it('should handle multiple suppressions correctly', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'multiple-suppressions');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `/**
 * @deprecated Use newFunc1 instead
 */
function oldFunc1() {
  return 'old1';
}

/**
 * @deprecated Use newFunc2 instead
 */
function oldFunc2() {
  return 'old2';
}

function newFunc() {
  return 'new';
}

function test() {
  // @prettier-max-ignore-deprecated: First suppression
  oldFunc1(); // Suppressed
  
  // @prettier-max-ignore-deprecated: Second suppression
  oldFunc2(); // Suppressed
  
  // @prettier-max-ignore-deprecated: Unused suppression
  newFunc(); // This will trigger PMAX002
  
  oldFunc1(); // This will trigger PMAX001
}
`
    );

    await createTsConfigFile(testDir);
    
    const result = await runTypeScriptCheck(testDir, true);
    
    // Should have 2 errors: 1 PMAX001 and 1 PMAX002
    const pmax001Errors = result.errors.filter(e => e.message.includes('PMAX001'));
    const pmax002Errors = result.errors.filter(e => e.message.includes('PMAX002'));
    
    expect(pmax001Errors).toHaveLength(1);
    expect(pmax002Errors).toHaveLength(1);
    
    expect(pmax001Errors[0].line).toBe(29); // Unsuppressed usage
    expect(pmax002Errors[0].line).toBe(26); // Unused directive
  });

  it('should not interfere when detectDeprecated is false', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'disabled-detection');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `
/**
 * @deprecated Old
 */
export const oldFunc = () => 'old';

// @prettier-max-ignore-deprecated: Should be ignored when detection is off
const result = oldFunc();

export { result };
`
    );

    await createTsConfigFile(testDir);
    
    // Run with detectDeprecated = false
    const result = await runTypeScriptCheck(testDir, false);
    
    // Should have no errors at all
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle suppression in different contexts', async () => {
    const testDir = await createTestDirectory('deprecated-suppression', 'different-contexts');
    await fs.mkdir(testDir, { recursive: true });

    const testFile = join(testDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `/**
 * @deprecated Old class
 */
class OldClass {
  value = 42;
}

/**
 * @deprecated Old interface
 */
interface OldInterface {
  data: string;
}

function test() {
  // @prettier-max-ignore-deprecated: Class instantiation
  const instance = new OldClass(); // Suppressed
  
  // @prettier-max-ignore-deprecated: Type annotation
  let data: OldInterface; // Suppressed
  
  // No suppression - should warn
  const another = new OldClass();
}
`
    );

    await createTsConfigFile(testDir);
    
    const result = await runTypeScriptCheck(testDir, true);
    
    // Should have only one PMAX001 warning (the unsuppressed one)
    const pmax001Errors = result.errors.filter(e => e.message.includes('PMAX001'));
    
    expect(pmax001Errors).toHaveLength(1);
    expect(pmax001Errors[0].message).toContain('OldClass');
    expect(pmax001Errors[0].line).toBe(23); // Unsuppressed usage
  });
});