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
   * Generate .prettierrc and .prettierignore files if they don't exist
   * @default true
   */
  generatePrettierConfig?: boolean;

  /**
   * Fail the build if there are errors (formatting or TypeScript validation)
   * @default true
   */
  failOnError?: boolean;

  /**
   * Format files on build start
   * @default true
   */
  formatOnBuild?: boolean;

  /**
   * File extensions eligible for banner insertion (leading dot required)
   * @default ['.ts', '.tsx', '.js', '.jsx']
   */
  bannerExtensions?: string[];

  /**
   * Run TypeScript validation after formatting.
   * Provide a string to point to a specific tsconfig.json (resolved from the project root).
   * @default true
   */
  typescript?: boolean | string;

  /**
   * Detect usage of deprecated symbols marked with `@deprecated` JSDoc tag
   * Disabling this can improve performance on large projects
   * @default true
   */
  detectDeprecated?: boolean;

  //////////////////////////////////////////////////////////////////////////////

  /**
   * Path to prettier config `.prettierrc` file
   * @default Will not derive config file in the prettier
   */
  configPath?: string;

  /**
   * Custom error reporter
   * @default Internal default reporter
   */
  reporter?: ErrorReporter;
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
