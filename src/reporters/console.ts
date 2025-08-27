// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

import { BaseErrorReporter } from './interface.js';
import type { PrettierError } from '../types.js';
import type { Logger } from 'vite';
import { relative, resolve } from 'node:path';

/**
 * Console reporter for IDE integration
 */
export class ConsoleReporter extends BaseErrorReporter {
  private readonly cwd: string;
  private hasReportedErrors = false;
  private isBuildMode = false;
  private logger?: Logger;

  constructor(cwd?: string) {
    super();
    this.cwd = cwd ?? process.cwd();
  }

  /**
   * Set build mode for different output formatting
   */
  setBuildMode(buildMode: boolean): void {
    this.isBuildMode = buildMode;
  }

  /**
   * Set Vite logger for build mode output
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  report(errors: PrettierError[]): void {
    this.errors = errors;

    if (errors.length === 0) {
      if (this.hasReportedErrors && !this.isBuildMode) {
        console.log('\x1b[32m✓\x1b[0m All files are properly formatted');
        this.hasReportedErrors = false;
      }
      return;
    }

    this.hasReportedErrors = true;

    if (!this.isBuildMode) {
      console.log('\x1b[31m✗\x1b[0m Prettier format check failed:');
      console.log('');
    }

    errors.forEach((error) => {
      const relativePath = relative(this.cwd, error.file);
      const location =
        error.line && error.column
          ? `:${error.line}:${error.column}`
          : error.line
            ? `:${error.line}`
            : '';

      // VSCode Problem Matcher compatible format
      // Use TypeScript format when logger is available (both build and dev mode)
      if (this.logger) {
        // TypeScript error format with color: filename(line,col): error CODE: message
        const line = error.line || 1;
        const column = error.column || 1;
        this.logger.error(
          `\x1b[31m${relativePath}(${line},${column}): error PRETTIER001: ${error.message}\x1b[0m`
        );
      } else if (this.isBuildMode) {
        // Fallback to console.error if logger is not available (build mode)
        const line = error.line || 1;
        const column = error.column || 1;
        console.error(
          `${resolve(this.cwd, relativePath)}(${line},${column}): error PRETTIER001: ${error.message}`
        );
      } else {
        // Dev mode without logger - use colored output
        console.log(
          `\x1b[31m${relativePath}${location}: error: ${error.message}\x1b[0m`
        );
      }
    });

    if (!this.isBuildMode) {
      console.log('');
      console.log(
        `\x1b[33m${errors.length} file${errors.length === 1 ? '' : 's'} need${errors.length === 1 ? 's' : ''} formatting\x1b[0m`
      );
      console.log('Run \x1b[36mprettier --write\x1b[0m to fix');
    }
  }

  clear(): void {
    this.errors = [];
    if (this.hasReportedErrors) {
      console.log('\x1b[32m✓\x1b[0m Prettier check cleared');
      this.hasReportedErrors = false;
    }
  }
}
