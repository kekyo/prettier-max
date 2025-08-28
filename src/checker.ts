// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { FormatResult, PrettierError } from './types.js';
import type { Ignore } from 'ignore';
import { shouldProcessFile } from './utils.js';

/**
 * Run prettier format on specified files
 */
export const runPrettierFormat = async (
  files: string[],
  cwd: string,
  configPath?: string
): Promise<FormatResult> => {
  const startTime = Date.now();

  if (files.length === 0) {
    return {
      success: true,
      errors: [],
      formattedFiles: [],
      duration: 0,
    };
  }

  return new Promise((resolve) => {
    const errors: PrettierError[] = [];
    const formattedFiles: string[] = [];

    // Build prettier command arguments
    const args = ['--write', '--list-different'];

    if (configPath) {
      args.push('--config', configPath);
    }

    // Add files to check
    args.push(...files);

    const prettierProcess = spawn('npx', ['prettier', ...args], {
      cwd,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    prettierProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    prettierProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    prettierProcess.on('close', (code) => {
      const duration = Date.now() - startTime;

      // Code 0: All files formatted successfully
      // Code 2: Something went wrong (e.g., invalid config)

      if (code === 2) {
        // Configuration or other error
        if (stderr) {
          errors.push({
            file: cwd,
            message: `Prettier error: ${stderr.trim()}`,
          });
        }
        resolve({
          success: false,
          errors,
          formattedFiles,
          duration,
        });
        return;
      }

      // Parse formatted files from stdout (listed by --list-different)
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('[')) {
            formattedFiles.push(join(cwd, trimmed));
          }
        }
      }

      resolve({
        success: code === 0,
        errors,
        formattedFiles,
        duration,
      });
    });

    prettierProcess.on('error', (error) => {
      const duration = Date.now() - startTime;
      errors.push({
        file: cwd,
        message: `Failed to run prettier: ${error.message}`,
      });

      resolve({
        success: false,
        errors,
        formattedFiles,
        duration,
      });
    });
  });
};

/**
 * Recursively get all files in a directory
 */
const getAllFiles = async (
  dir: string,
  filter: Ignore | null,
  rootDir: string,
  files: string[] = []
): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and .git directories
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        await getAllFiles(fullPath, filter, rootDir, files);
      } else if (entry.isFile()) {
        // Check if file should be processed
        if (shouldProcessFile(fullPath, filter, rootDir)) {
          // Only check files with common code extensions
          const ext = entry.name.split('.').pop()?.toLowerCase();
          const codeExtensions = [
            'js',
            'jsx',
            'ts',
            'tsx',
            'mjs',
            'cjs',
            'vue',
            'json',
            'css',
            'scss',
            'less',
            'html',
            'md',
            'mdx',
            'yml',
            'yaml',
          ];
          if (ext && codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    // Directory might not be accessible, skip it
  }

  return files;
};

/**
 * Run prettier format on entire project
 */
export const runPrettierFormatProject = async (
  rootDir: string,
  configPath: string | undefined,
  filter: Ignore | null
): Promise<FormatResult> => {
  const startTime = Date.now();

  // Get all files in the project
  const allFiles = await getAllFiles(rootDir, filter, rootDir);

  if (allFiles.length === 0) {
    return {
      success: true,
      errors: [],
      formattedFiles: [],
      duration: Date.now() - startTime,
    };
  }

  // Run prettier format on all files
  return runPrettierFormat(allFiles, rootDir, configPath);
};

/**
 * Check if prettier is available
 */
export const getPrettierVersion = async (): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const checkProcess = spawn('npx', ['prettier', '--version'], {
      shell: process.platform === 'win32',
    });

    let stdout: string = '';

    checkProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    checkProcess.on('close', (code) => {
      resolve(code === 0 ? stdout.trim() : undefined);
    });

    checkProcess.on('error', () => {
      resolve(undefined);
    });
  });
};

/**
 * Check if TypeScript is available
 */
export const getTypeScriptVersion = async (): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const checkProcess = spawn('npx', ['tsc', '--version'], {
      shell: process.platform === 'win32',
    });

    let stdout: string = '';

    checkProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    checkProcess.on('close', (code) => {
      if (code === 0 && stdout) {
        // Extract version from "Version X.X.X" format
        const match = stdout.match(/Version\s+(\S+)/);
        resolve(match ? match[1] : stdout.trim());
      } else {
        resolve(undefined);
      }
    });

    checkProcess.on('error', () => {
      resolve(undefined);
    });
  });
};

/**
 * Run TypeScript type checking
 */
export const runTypeScriptCheck = async (
  cwd: string
): Promise<FormatResult> => {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const errors: PrettierError[] = [];

    const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
      cwd,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    tscProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tscProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tscProcess.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code !== 0) {
        // Parse TypeScript errors from stdout (TypeScript outputs to stdout, not stderr)
        const output = stdout || stderr;
        const lines = output.split('\n');
        for (const line of lines) {
          // TypeScript error format: file(line,column): error TSxxxx: message
          const match = line.match(
            /^(.+?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)$/
          );
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2], 10),
              column: parseInt(match[3], 10),
              message: match[4],
            });
          }
        }
      }

      resolve({
        success: code === 0,
        errors,
        formattedFiles: [], // TypeScript check doesn't format files
        duration,
      });
    });

    tscProcess.on('error', (error) => {
      const duration = Date.now() - startTime;
      errors.push({
        file: cwd,
        message: `Failed to run TypeScript check: ${error.message}`,
      });

      resolve({
        success: false,
        errors,
        formattedFiles: [],
        duration,
      });
    });
  });
};
