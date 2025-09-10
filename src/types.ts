// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

// Re-export Logger interface for public API
export type { Logger } from './logger.js';

/**
 * Error information from prettier check
 */
export interface PrettierError {
  file: string;
  line?: number;
  column?: number;
  message: string;
}

/**
 * Reporter interface for outputting errors
 */
export interface ErrorReporter {
  report(errors: PrettierError[]): void;
  clear(): void;
}

/**
 * Plugin options
 */
export interface PrettierMaxOptions {
  /**
   * Path to prettier config `.prettierrc` file
   * @default Will not derive config file in the prettier
   */
  configPath?: string;

  /**
   * Format files on build start
   * @default true
   */
  formatOnBuild?: boolean;

  /**
   * Run TypeScript validation after formatting
   * @default true
   */
  typescript?: boolean;

  /**
   * Fail the build if there are errors (formatting or TypeScript validation)
   * @default true
   */
  failOnError?: boolean;

  /**
   * Custom error reporter
   * @default Internal default reporter
   */
  reporter?: ErrorReporter;

  /**
   * Generate .prettierrc and .prettierignore files if they don't exist
   * @default true
   */
  generatePrettierConfig?: boolean;

  /**
   * Detect usage of deprecated symbols marked with `@deprecated` JSDoc tag
   * Disabling this can improve performance on large projects
   * @default true
   */
  detectDeprecated?: boolean;
}

/**
 * Internal format result
 */
export interface FormatResult {
  success: boolean;
  errors: PrettierError[];
  formattedFiles: string[];
  duration: number;
}
