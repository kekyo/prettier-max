// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { FormatResult, PrettierError } from './types.js';

/**
 * Run prettier format on entire project
 */
export const runPrettierFormatProject = async (
  rootDir: string,
  configPath: string | undefined
): Promise<FormatResult> => {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const errors: PrettierError[] = [];
    const formattedFiles: string[] = [];

    // Build prettier command arguments
    const args = ['--write', '.', '--list-different'];

    if (configPath) {
      args.push('--config', configPath);
    }

    const prettierProcess = spawn('npx', ['prettier', ...args], {
      cwd: rootDir,
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
            file: rootDir,
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
            formattedFiles.push(join(rootDir, trimmed));
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
        file: rootDir,
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
