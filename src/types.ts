// prettier-max - A simple prettier Vite plugin
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/prettier-max/

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
   * Target file patterns to format
   * @default `.prettierignore` default patterns
   */
  targets?: string[];

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

  /**
   * Format files on build start
   * @default true
   */
  formatOnBuild?: boolean;

  /**
   * Fail the build if there are errors (formatting or TypeScript validation)
   * @default false
   */
  failOnError?: boolean;

  /**
   * Run TypeScript validation after formatting
   * @default true
   */
  typescript?: boolean;
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
